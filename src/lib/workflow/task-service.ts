import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { employee, task, taskAttachment, taskEvent } from "@/db/schema";
import type { TaskCardInput } from "./bot-copy";
import * as notify from "./notification-service";
import { statusesAllowedToReach, type TaskStatus } from "./task-status";

type TaskRow = typeof task.$inferSelect;
type Actor = { type: "manager" | "employee" | "system"; id: string | null };

/**
 * Every mutation returns a result instead of throwing, because half of the
 * callers are Zalo message handlers that must answer the employee in
 * Vietnamese rather than blow up a webhook.
 */
export type TaskResult =
  | { ok: true; task: TaskRow }
  | { ok: false; reason: "not_found" | "closed"; task?: TaskRow };

function toCard(t: TaskRow): TaskCardInput {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    dueAt: t.dueAt,
  };
}

async function getTask(taskId: string): Promise<TaskRow | undefined> {
  return db.query.task.findFirst({ where: eq(task.id, taskId) });
}

async function assigneeZaloId(t: TaskRow): Promise<string | null> {
  if (!t.assigneeId) return null;
  const emp = await db.query.employee.findFirst({
    where: eq(employee.id, t.assigneeId),
  });
  return emp?.zaloUserId ?? null;
}

async function logEvent(
  taskId: string,
  type: (typeof taskEvent.$inferInsert)["type"],
  actor: Actor,
  payload: Record<string, unknown> = {},
) {
  const [row] = await db
    .insert(taskEvent)
    .values({ taskId, type, actorType: actor.type, actorId: actor.id, payload })
    .returning({ id: taskEvent.id });
  return row.id;
}

/**
 * Move a task to `to`, but only from a status the transition table allows.
 * The guard lives in the WHERE clause so the read and the write are a single
 * atomic statement: two concurrent taps of the same Zalo button cannot both
 * take effect.
 */
async function transition(
  taskId: string,
  to: TaskStatus,
  extra: Partial<typeof task.$inferInsert> = {},
): Promise<TaskResult> {
  const [row] = await db
    .update(task)
    .set({ status: to, updatedAt: new Date(), ...extra })
    .where(
      and(eq(task.id, taskId), inArray(task.status, statusesAllowedToReach(to))),
    )
    .returning();

  if (row) return { ok: true, task: row };

  const current = await getTask(taskId);
  return current
    ? { ok: false, reason: "closed", task: current }
    : { ok: false, reason: "not_found" };
}

// ---------------------------------------------------------------------------
// Manager-initiated
// ---------------------------------------------------------------------------

export async function createTask(input: {
  title: string;
  description?: string | null;
  priority?: TaskRow["priority"];
  dueAt?: Date | null;
  assigneeId?: string | null;
  createdBy: string;
}): Promise<TaskRow> {
  const [row] = await db
    .insert(task)
    .values({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "normal",
      dueAt: input.dueAt ?? null,
      createdBy: input.createdBy,
    })
    .returning();

  await logEvent(row.id, "created", { type: "manager", id: input.createdBy });

  if (input.assigneeId) {
    const res = await assignTask({
      taskId: row.id,
      assigneeId: input.assigneeId,
      actorId: input.createdBy,
    });
    if (res.ok) return res.task;
  }
  return row;
}

export async function updateTask(input: {
  taskId: string;
  actorId: string;
  title: string;
  description?: string | null;
  priority: TaskRow["priority"];
  dueAt?: Date | null;
}): Promise<TaskResult> {
  const before = await getTask(input.taskId);
  if (!before) return { ok: false, reason: "not_found" };

  const [row] = await db
    .update(task)
    .set({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      dueAt: input.dueAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(task.id, input.taskId))
    .returning();

  const changed = (["title", "description", "priority", "dueAt"] as const).filter(
    (k) => String(before[k] ?? "") !== String(row[k] ?? ""),
  );
  if (changed.length === 0) return { ok: true, task: row };

  await logEvent(input.taskId, "updated", { type: "manager", id: input.actorId }, {
    fields: changed,
  });

  // Tell the employee only when something they act on actually moved.
  const zid = await assigneeZaloId(row);
  if (zid && changed.some((k) => k !== "description")) {
    await notify.notifyUpdated(toCard(row), zid);
  }
  return { ok: true, task: row };
}

export async function assignTask(input: {
  taskId: string;
  assigneeId: string;
  actorId: string;
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "assigned", {
    assigneeId: input.assigneeId,
    assignedAt: new Date(),
    completedAt: null,
    lastRemindedAt: null,
  });
  if (!res.ok) return res;

  await logEvent(input.taskId, "assigned", { type: "manager", id: input.actorId }, {
    assigneeId: input.assigneeId,
  });

  const zid = await assigneeZaloId(res.task);
  if (zid) {
    const sent = await notify.notifyAssigned(toCard(res.task), zid);
    if (sent) {
      await logEvent(input.taskId, "reminder_sent", { type: "system", id: null }, {
        kind: "assigned",
      });
    }
  }
  return res;
}

export async function verifyTask(input: {
  taskId: string;
  actorId: string;
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "verified");
  if (!res.ok) return res;

  await logEvent(input.taskId, "status_changed", {
    type: "manager",
    id: input.actorId,
  }, { to: "verified" });

  const zid = await assigneeZaloId(res.task);
  if (zid) await notify.notifyVerified(zid);
  return res;
}

export async function cancelTask(input: {
  taskId: string;
  actorId: string;
  reason?: string;
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "cancelled");
  if (!res.ok) return res;

  await logEvent(input.taskId, "status_changed", {
    type: "manager",
    id: input.actorId,
  }, { to: "cancelled", reason: input.reason ?? null });

  const zid = await assigneeZaloId(res.task);
  if (zid) await notify.notifyCancelled(zid);
  return res;
}

export async function addManagerComment(input: {
  taskId: string;
  actorId: string;
  text: string;
}): Promise<TaskResult> {
  const t = await getTask(input.taskId);
  if (!t) return { ok: false, reason: "not_found" };

  await logEvent(input.taskId, "comment", { type: "manager", id: input.actorId }, {
    text: input.text,
  });

  const zid = await assigneeZaloId(t);
  if (zid) await notify.forwardManagerComment(zid, input.text);
  return { ok: true, task: t };
}

// ---------------------------------------------------------------------------
// Employee-initiated (called from the conversation state machine)
// ---------------------------------------------------------------------------

export async function acceptTask(input: {
  taskId: string;
  employeeId: string;
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "accepted");
  if (!res.ok) return res;

  await logEvent(input.taskId, "status_changed", {
    type: "employee",
    id: input.employeeId,
  }, { to: "accepted" });

  const zid = await assigneeZaloId(res.task);
  if (zid) await notify.notifyAccepted(toCard(res.task), zid);
  return res;
}

export async function startTask(input: {
  taskId: string;
  employeeId: string;
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "in_progress");
  if (!res.ok) return res;

  await logEvent(input.taskId, "status_changed", {
    type: "employee",
    id: input.employeeId,
  }, { to: "in_progress" });

  const zid = await assigneeZaloId(res.task);
  if (zid) await notify.notifyStarted(toCard(res.task), zid);
  return res;
}

export async function completeTask(input: {
  taskId: string;
  employeeId: string;
  note?: string | null;
  attachmentUrls?: string[];
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "done", { completedAt: new Date() });
  if (!res.ok) return res;

  const eventId = await logEvent(input.taskId, "status_changed", {
    type: "employee",
    id: input.employeeId,
  }, { to: "done", note: input.note ?? null });

  await saveAttachments(input.taskId, eventId, input.attachmentUrls);

  const zid = await assigneeZaloId(res.task);
  if (zid) await notify.notifyDoneAck(zid);
  return res;
}

export async function reportIssue(input: {
  taskId: string;
  employeeId: string;
  text: string;
  attachmentUrls?: string[];
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "blocked");
  if (!res.ok) return res;

  const eventId = await logEvent(input.taskId, "issue_reported", {
    type: "employee",
    id: input.employeeId,
  }, { text: input.text });

  await saveAttachments(input.taskId, eventId, input.attachmentUrls);

  const zid = await assigneeZaloId(res.task);
  if (zid) await notify.notifyIssueAck(zid);
  return res;
}

export async function addEmployeeComment(input: {
  taskId: string;
  employeeId: string;
  text: string;
  attachmentUrls?: string[];
}): Promise<TaskResult> {
  const t = await getTask(input.taskId);
  if (!t) return { ok: false, reason: "not_found" };

  const eventId = await logEvent(input.taskId, "comment", {
    type: "employee",
    id: input.employeeId,
  }, { text: input.text });

  await saveAttachments(input.taskId, eventId, input.attachmentUrls);
  return { ok: true, task: t };
}

async function saveAttachments(
  taskId: string,
  eventId: string,
  urls: string[] | undefined,
) {
  if (!urls?.length) return;
  await db.insert(taskAttachment).values(
    urls.map((url) => ({ taskId, eventId, kind: "image" as const, url })),
  );
}

export { toCard as taskToCard, getTask };
