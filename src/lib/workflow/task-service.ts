import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { employee, task, taskAttachment, taskEvent } from "@/db/schema";
import { OPEN_TASK_STATUSES } from "@/lib/labels";
import type { TaskCardInput } from "./bot-copy";
import * as notify from "./notification-service";
import type {
  NotificationKind,
  NotifyResult,
} from "./notification-service";
import { statusesAllowedToReach, canTransition, isClosed, type TaskStatus } from "./task-status";

type TaskRow = typeof task.$inferSelect;
type Actor = { type: "manager" | "employee" | "system"; id: string | null };

/**
 * Every mutation returns a result instead of throwing, because half of the
 * callers are Zalo message handlers that must answer the employee in
 * Vietnamese rather than blow up a webhook.
 */
export type TaskResult =
  | {
      ok: true;
      task: TaskRow;
      /** Delivery outcome of the Zalo notification, when one was attempted. */
      zalo?: NotifyResult;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "closed"
        | "invalid_assignee"
        | "invalid_transition";
      task?: TaskRow;
    };

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
 * Best-effort Zalo send whose outcome becomes a `notification` task_event.
 * Zalo delivery is not guaranteed (7-day window, blocked OA, outage), so the
 * timeline must show whether the message actually reached the employee.
 */
async function notifyEmployee(
  taskId: string,
  kind: NotificationKind,
  zaloUserId: string | null,
  send: (zid: string) => Promise<NotifyResult>,
): Promise<NotifyResult> {
  const res = zaloUserId
    ? await send(zaloUserId)
    : { ok: false as const, error: "not_linked" };
  // The outcome is an audit trail, not part of the mutation: a failure to
  // write it must never surface as a task failure.
  try {
    await logEvent(taskId, "notification", { type: "system", id: null }, {
      kind,
      ok: res.ok,
      error: res.ok ? null : res.error,
    });
  } catch (err) {
    console.error("[notification] failed to record delivery outcome", err);
  }
  return res;
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
  const patch: Partial<typeof task.$inferInsert> = {
    status: to,
    updatedAt: new Date(),
    ...extra,
  };
  // Leaving `done` (rejected work, stale button, reassignment) must clear the
  // completion timestamp, otherwise the task looks finished while it is open.
  if (to !== "done") patch.completedAt = null;

  const [row] = await db
    .update(task)
    .set(patch)
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
  createdBy: string | null;
}): Promise<{ task: TaskRow; zalo?: NotifyResult }> {
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

  await logEvent(
    row.id,
    "created",
    input.createdBy
      ? { type: "manager", id: input.createdBy }
      : { type: "system", id: null },
  );

  if (input.assigneeId) {
    const res = await assignTask({
      taskId: row.id,
      assigneeId: input.assigneeId,
      actorId: input.createdBy,
    });
    if (res.ok) return { task: res.task, zalo: res.zalo };
  }
  return { task: row };
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
  // Verified/cancelled work is frozen: rewriting a finished record would hide
  // what was actually agreed.
  if (isClosed(before.status)) return { ok: false, reason: "closed", task: before };

  const dueChanged = before.dueAt?.getTime() !== input.dueAt?.getTime();

  const [row] = await db
    .update(task)
    .set({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      dueAt: input.dueAt ?? null,
      updatedAt: new Date(),
      // A moved deadline deserves a fresh reminder instead of being throttled
      // out by the previous one.
      ...(dueChanged ? { lastRemindedAt: null } : {}),
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
  let zalo: NotifyResult | undefined;
  if (changed.some((k) => k !== "description")) {
    zalo = await notifyEmployee(
      input.taskId,
      "updated",
      await assigneeZaloId(row),
      (z) => notify.notifyUpdated(toCard(row), z),
    );
  }
  return { ok: true, task: row, zalo };
}

export async function assignTask(input: {
  taskId: string;
  assigneeId: string;
  actorId: string | null;
}): Promise<TaskResult> {
  // Inactive staff cannot be assigned new work (and the FK would otherwise
  // fail for an id that does not exist at all).
  const emp = await db.query.employee.findFirst({
    where: eq(employee.id, input.assigneeId),
  });
  if (!emp || emp.status === "inactive") {
    return { ok: false, reason: "invalid_assignee" };
  }

  const res = await transition(input.taskId, "assigned", {
    assigneeId: input.assigneeId,
    assignedAt: new Date(),
    completedAt: null,
    lastRemindedAt: null,
  });
  if (!res.ok) return res;

  await logEvent(
    input.taskId,
    "assigned",
    input.actorId
      ? { type: "manager", id: input.actorId }
      : { type: "system", id: null },
    { assigneeId: input.assigneeId },
  );

  const zalo = await notifyEmployee(
    input.taskId,
    "assigned",
    await assigneeZaloId(res.task),
    (z) => notify.notifyAssigned(toCard(res.task), z),
  );
  return { ...res, zalo };
}

export async function unassignTask(input: {
  taskId: string;
  actorId: string;
}): Promise<TaskResult> {
  // Only work that has not started can go back to the unassigned pool. The
  // status check sits in the WHERE clause so it is atomic with the clear.
  const [row] = await db
    .update(task)
    .set({
      assigneeId: null,
      assignedAt: null,
      completedAt: null,
      lastRemindedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(task.id, input.taskId), eq(task.status, "assigned")))
    .returning();

  if (!row) {
    const current = await getTask(input.taskId);
    return current
      ? { ok: false, reason: "invalid_transition", task: current }
      : { ok: false, reason: "not_found" };
  }

  await logEvent(
    input.taskId,
    "status_changed",
    { type: "manager", id: input.actorId },
    { reason: "unassigned" },
  );
  return { ok: true, task: row };
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

  const zalo = await notifyEmployee(
    input.taskId,
    "verified",
    await assigneeZaloId(res.task),
    (z) => notify.notifyVerified(z),
  );
  return { ...res, zalo };
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

  const zalo = await notifyEmployee(
    input.taskId,
    "cancelled",
    await assigneeZaloId(res.task),
    (z) => notify.notifyCancelled(z),
  );
  return { ...res, zalo };
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

  const zalo = await notifyEmployee(
    input.taskId,
    "comment",
    await assigneeZaloId(t),
    (z) => notify.forwardManagerComment(z, input.text),
  );
  return { ok: true, task: t, zalo };
}

/**
 * Board move: a manager drops a card into another column. The transition table
 * still guards what is legal and `assigned` needs an assignee; the assignee is
 * kept when a card is dragged back to the "Cần làm" column.
 */
export async function moveTaskTo(input: {
  taskId: string;
  to: TaskStatus;
  actorId: string;
}): Promise<TaskResult> {
  const before = await getTask(input.taskId);
  if (!before) return { ok: false, reason: "not_found" };
  if (isClosed(before.status))
    return { ok: false, reason: "closed", task: before };
  // Checked here as well as inside `transition` so the caller can tell a bad
  // direction apart from a concurrent change.
  if (!canTransition(before.status, input.to)) {
    return { ok: false, reason: "invalid_transition", task: before };
  }

  if (input.to === "assigned") {
    if (!before.assigneeId) {
      return { ok: false, reason: "invalid_assignee", task: before };
    }
    const emp = await db.query.employee.findFirst({
      where: eq(employee.id, before.assigneeId),
    });
    if (!emp || emp.status === "inactive") {
      return { ok: false, reason: "invalid_assignee", task: before };
    }
  }

  const extra: Partial<typeof task.$inferInsert> = {};
  if (input.to === "done") {
    // Match the Zalo completion path; `transition` only clears it otherwise.
    extra.completedAt = new Date();
  }
  if (OPEN_TASK_STATUSES.includes(input.to)) {
    // Moving back into an open column deserves fresh reminders.
    extra.lastRemindedAt = null;
  }

  const res = await transition(input.taskId, input.to, extra);
  if (!res.ok) return res;

  await logEvent(
    input.taskId,
    "status_changed",
    { type: "manager", id: input.actorId },
    { to: input.to, via: "kanban" },
  );
  return res;
}

// ---------------------------------------------------------------------------
// Employee-initiated (called from the conversation state machine)
// ---------------------------------------------------------------------------

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

  const zalo = await notifyEmployee(
    input.taskId,
    "started",
    await assigneeZaloId(res.task),
    (z) => notify.notifyStarted(toCard(res.task), z),
  );
  return { ...res, zalo };
}

export async function completeTask(input: {
  taskId: string;
  employeeId: string;
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "done", { completedAt: new Date() });
  if (!res.ok) return res;

  await logEvent(input.taskId, "status_changed", {
    type: "employee",
    id: input.employeeId,
  }, { to: "done" });

  const zalo = await notifyEmployee(
    input.taskId,
    "done",
    await assigneeZaloId(res.task),
    (z) => notify.notifyDoneAck(z),
  );
  return { ...res, zalo };
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

  const zalo = await notifyEmployee(
    input.taskId,
    "issue",
    await assigneeZaloId(res.task),
    (z) => notify.notifyIssueAck(z),
  );
  return { ...res, zalo };
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
