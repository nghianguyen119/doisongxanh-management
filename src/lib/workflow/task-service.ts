import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employee, task, taskAttachment, taskEvent } from "@/db/schema";
import type { TaskCardInput } from "./bot-copy";
import * as notify from "./notification-service";

type TaskRow = typeof task.$inferSelect;
type Actor = { type: "manager" | "employee" | "system"; id: string | null };

function toCard(t: TaskRow): TaskCardInput {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    dueAt: t.dueAt,
  };
}

async function getTask(taskId: string): Promise<TaskRow> {
  const t = await db.query.task.findFirst({ where: eq(task.id, taskId) });
  if (!t) throw new Error(`Task ${taskId} not found`);
  return t;
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
    .values({
      taskId,
      type,
      actorType: actor.type,
      actorId: actor.id,
      payload,
    })
    .returning({ id: taskEvent.id });
  return row.id;
}

async function setStatus(taskId: string, status: TaskRow["status"], extra: Partial<TaskRow> = {}) {
  const [row] = await db
    .update(task)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(task.id, taskId))
    .returning();
  return row;
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
}) {
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
    return assignTask({
      taskId: row.id,
      assigneeId: input.assigneeId,
      actorId: input.createdBy,
    });
  }
  return row;
}

export async function assignTask(input: {
  taskId: string;
  assigneeId: string;
  actorId: string;
}) {
  const row = await setStatus(input.taskId, "assigned", {
    assigneeId: input.assigneeId,
    assignedAt: new Date(),
  });
  await logEvent(input.taskId, "assigned", {
    type: "manager",
    id: input.actorId,
  }, { assigneeId: input.assigneeId });

  const zid = await assigneeZaloId(row);
  if (zid) {
    await notify.notifyAssigned(toCard(row), zid);
    await logEvent(input.taskId, "reminder_sent", { type: "system", id: null }, {
      kind: "assigned",
    });
  }
  return row;
}

export async function verifyTask(input: { taskId: string; actorId: string }) {
  const row = await setStatus(input.taskId, "verified");
  await logEvent(input.taskId, "status_changed", {
    type: "manager",
    id: input.actorId,
  }, { to: "verified" });
  const zid = await assigneeZaloId(row);
  if (zid) await notify.notifyVerified(zid);
  return row;
}

export async function cancelTask(input: {
  taskId: string;
  actorId: string;
  reason?: string;
}) {
  const row = await setStatus(input.taskId, "cancelled");
  await logEvent(input.taskId, "status_changed", {
    type: "manager",
    id: input.actorId,
  }, { to: "cancelled", reason: input.reason ?? null });
  const zid = await assigneeZaloId(row);
  if (zid) await notify.notifyCancelled(zid);
  return row;
}

export async function addManagerComment(input: {
  taskId: string;
  actorId: string;
  text: string;
}) {
  await logEvent(input.taskId, "comment", {
    type: "manager",
    id: input.actorId,
  }, { text: input.text });
  const t = await getTask(input.taskId);
  const zid = await assigneeZaloId(t);
  if (zid) await notify.forwardManagerComment(zid, input.text);
}

// ---------------------------------------------------------------------------
// Employee-initiated (called from the conversation state machine)
// ---------------------------------------------------------------------------

export async function acceptTask(input: { taskId: string; employeeId: string }) {
  const row = await setStatus(input.taskId, "accepted");
  await logEvent(input.taskId, "status_changed", {
    type: "employee",
    id: input.employeeId,
  }, { to: "accepted" });
  const zid = await assigneeZaloId(row);
  if (zid) await notify.notifyAccepted(toCard(row), zid);
  return row;
}

export async function startTask(input: { taskId: string; employeeId: string }) {
  const row = await setStatus(input.taskId, "in_progress");
  await logEvent(input.taskId, "status_changed", {
    type: "employee",
    id: input.employeeId,
  }, { to: "in_progress" });
  const zid = await assigneeZaloId(row);
  if (zid) await notify.notifyStarted(toCard(row), zid);
  return row;
}

export async function completeTask(input: {
  taskId: string;
  employeeId: string;
  note?: string | null;
  attachmentUrls?: string[];
}) {
  const row = await setStatus(input.taskId, "done", { completedAt: new Date() });
  const eventId = await logEvent(input.taskId, "status_changed", {
    type: "employee",
    id: input.employeeId,
  }, { to: "done", note: input.note ?? null });

  for (const url of input.attachmentUrls ?? []) {
    await db.insert(taskAttachment).values({
      taskId: input.taskId,
      eventId,
      kind: "image",
      url,
    });
  }
  const zid = await assigneeZaloId(row);
  if (zid) await notify.notifyDoneAck(zid);
  return row;
}

export async function reportIssue(input: {
  taskId: string;
  employeeId: string;
  text: string;
  attachmentUrls?: string[];
}) {
  const row = await setStatus(input.taskId, "blocked");
  const eventId = await logEvent(input.taskId, "issue_reported", {
    type: "employee",
    id: input.employeeId,
  }, { text: input.text });

  for (const url of input.attachmentUrls ?? []) {
    await db.insert(taskAttachment).values({
      taskId: input.taskId,
      eventId,
      kind: "image",
      url,
    });
  }
  const zid = await assigneeZaloId(row);
  if (zid) await notify.notifyIssueAck(zid);
  return row;
}

export async function addEmployeeComment(input: {
  taskId: string;
  employeeId: string;
  text: string;
  attachmentUrls?: string[];
}) {
  const eventId = await logEvent(input.taskId, "comment", {
    type: "employee",
    id: input.employeeId,
  }, { text: input.text });
  for (const url of input.attachmentUrls ?? []) {
    await db.insert(taskAttachment).values({
      taskId: input.taskId,
      eventId,
      kind: "image",
      url,
    });
  }
}

export { toCard as taskToCard, getTask };
