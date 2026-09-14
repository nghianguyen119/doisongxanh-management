import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { employee, task, taskAttachment, taskEvent } from "@/db/schema";
import { OPEN_TASK_STATUSES, taskRef } from "@/lib/labels";
import * as mobileNotify from "@/lib/mobile/notify";
import type { TaskCardInput } from "./bot-copy";
import * as notify from "./notification-service";
import type {
  NotificationKind,
  NotifyResult,
} from "./notification-service";
import {
  NUDGE_DAILY_CAP,
  NUDGE_LEVELS,
  isWithinWorkHours,
  nextWorkStart,
  nudgeLevelFor,
  vnDayKey,
  type NudgeLevel,
} from "./nudge";
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
    ref: taskRef(t.refNo),
    title: t.title,
    description: t.description,
    priority: t.priority,
    dueAt: t.dueAt,
  };
}

function toMobileCard(t: TaskRow) {
  return { id: t.id, ref: taskRef(t.refNo), title: t.title, dueAt: t.dueAt };
}

/**
 * Mobile push/inbox is best-effort like Zalo: a failure must not fail the
 * mutation, and the inbox row is written even when FCM is not configured.
 */
async function notifyMobileEmployee(
  t: TaskRow,
  kind: mobileNotify.MobilePushKind,
  extra: {
    text?: string;
    deliveryId?: string;
    inbox?: boolean;
  } = {},
): Promise<mobileNotify.MobileNotifyResult> {
  if (!t.assigneeId) return { ok: false, error: "not_assigned" };
  try {
    return await mobileNotify.notifyMobileTask({
      employeeId: t.assigneeId,
      kind,
      task: toMobileCard(t),
      ...extra,
    });
  } catch (err) {
    console.error("[mobile] notify failed", err);
    return { ok: false, error: "send_failed" };
  }
}

/**
 * Fields for an assignment's next acknowledgement cycle. Urgent work starts a
 * loud-alert batch (delivery id + attempt 1); anything else clears any batch
 * left over from a previous assignment.
 */
function alertBatchPatch(
  priority: TaskRow["priority"],
): Partial<typeof task.$inferInsert> {
  if (priority !== "urgent") {
    return {
      alertDeliveryId: null,
      alertAttempts: 0,
      lastAlertAt: null,
      escalationLevel: 0,
    };
  }
  return {
    alertDeliveryId: `dlv-${randomUUID()}`,
    alertAttempts: 1,
    lastAlertAt: new Date(),
    escalationLevel: 1,
  };
}

/** A material change (everything but the description) restarts the ack cycle. */
const ACK_RESET_PATCH: Partial<typeof task.$inferInsert> = {
  acknowledgedAt: null,
  acknowledgedBy: null,
  escalationLevel: 0,
  alertDeliveryId: null,
  alertAttempts: 0,
  lastAlertAt: null,
};

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

  const changed = (["title", "description", "priority", "dueAt"] as const).filter(
    (k) => {
      const next =
        k === "title"
          ? input.title
          : k === "description"
            ? (input.description ?? null)
            : k === "priority"
              ? input.priority
              : (input.dueAt ?? null);
      return String(before[k] ?? "") !== String(next ?? "");
    },
  );
  // Description edits are invisible to the employee's work; everything else is
  // material and restarts the acknowledgement cycle (so it alerts again).
  const materialChanged = changed.some((k) => k !== "description");

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
      ...(materialChanged
        ? { ...ACK_RESET_PATCH, ...alertBatchPatch(input.priority) }
        : {}),
    })
    .where(eq(task.id, input.taskId))
    .returning();

  if (changed.length === 0) return { ok: true, task: row };

  await logEvent(input.taskId, "updated", { type: "manager", id: input.actorId }, {
    fields: changed,
  });

  // Tell the employee only when something they act on actually moved.
  let zalo: NotifyResult | undefined;
  if (materialChanged) {
    zalo = await notifyEmployee(
      input.taskId,
      "updated",
      await assigneeZaloId(row),
      (z) => notify.notifyUpdated(toCard(row), z),
    );
    await notifyMobileEmployee(
      row,
      row.priority === "urgent" ? "task_urgent" : "task_updated",
      row.priority === "urgent" && row.alertDeliveryId
        ? { deliveryId: row.alertDeliveryId }
        : {},
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

  const before = await getTask(input.taskId);
  if (!before) return { ok: false, reason: "not_found" };

  const res = await transition(input.taskId, "assigned", {
    assigneeId: input.assigneeId,
    assignedAt: new Date(),
    completedAt: null,
    lastRemindedAt: null,
    startedAt: null,
    verifiedAt: null,
    // A new assignment is a fresh acknowledgement cycle.
    ...ACK_RESET_PATCH,
    ...alertBatchPatch(before.priority),
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
  await notifyMobileEmployee(
    res.task,
    res.task.priority === "urgent" ? "task_urgent" : "task_new",
    res.task.alertDeliveryId
      ? { deliveryId: res.task.alertDeliveryId }
      : {},
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
      ...ACK_RESET_PATCH,
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
  const res = await transition(input.taskId, "verified", {
    verifiedAt: new Date(),
    alertDeliveryId: null,
    alertAttempts: 0,
    lastAlertAt: null,
  });
  if (!res.ok) return res;

  await logEvent(input.taskId, "status_changed", {
    type: "manager",
    id: input.actorId,
  }, { to: "verified" });

  const zalo = await notifyEmployee(
    input.taskId,
    "verified",
    await assigneeZaloId(res.task),
    (z) => notify.notifyVerified(toCard(res.task), z),
  );
  await notifyMobileEmployee(res.task, "task_updated");
  return { ...res, zalo };
}

export async function cancelTask(input: {
  taskId: string;
  actorId: string;
  reason?: string;
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "cancelled", {
    alertDeliveryId: null,
    alertAttempts: 0,
    lastAlertAt: null,
  });
  if (!res.ok) return res;

  await logEvent(input.taskId, "status_changed", {
    type: "manager",
    id: input.actorId,
  }, { to: "cancelled", reason: input.reason ?? null });

  const zalo = await notifyEmployee(
    input.taskId,
    "cancelled",
    await assigneeZaloId(res.task),
    (z) => notify.notifyCancelled(toCard(res.task), z),
  );
  await notifyMobileEmployee(res.task, "task_updated");
  return { ...res, zalo };
}

/**
 * Manager-triggered reminder. Ignores the cron's due window and 12h throttle,
 * but keeps the same guards: an open task and a linked assignee. The delivery
 * outcome is recorded in the timeline either way.
 */
export async function remindTask(input: {
  taskId: string;
  actorId: string;
  overdue: boolean;
}): Promise<TaskResult> {
  const t = await getTask(input.taskId);
  if (!t) return { ok: false, reason: "not_found" };
  if (isClosed(t.status)) return { ok: false, reason: "closed", task: t };

  // A manual nudge of urgent work joins the loud-alert chain (starting a
  // batch if the assignment never had one); everything else is a normal
  // reminder. A fresh loud batch is a new acknowledgement cycle, so an
  // already-acknowledged task must ask for «Đã nhận» again.
  let alertFields: Partial<typeof task.$inferInsert> = {};
  if (t.priority === "urgent" && !t.alertDeliveryId) {
    alertFields = {
      ...alertBatchPatch("urgent"),
      acknowledgedAt: null,
      acknowledgedBy: null,
    };
  }
  const taskRow = Object.keys(alertFields).length
    ? ((await db
        .update(task)
        .set({ ...alertFields, updatedAt: new Date() })
        .where(eq(task.id, t.id))
        .returning())[0] ?? t)
    : t;

  const zaloUserId = await assigneeZaloId(t);
  const zalo: NotifyResult = zaloUserId
    ? await notify.sendReminder(toCard(t), zaloUserId, input.overdue)
    : { ok: false, error: "not_linked" };

  await notifyMobileEmployee(
    taskRow,
    taskRow.priority === "urgent" ? "task_alert" : "task_reminder",
    taskRow.alertDeliveryId ? { deliveryId: taskRow.alertDeliveryId } : {},
  );

  try {
    await logEvent(
      input.taskId,
      "notification",
      { type: "manager", id: input.actorId },
      {
        kind: "reminder",
        ok: zalo.ok,
        error: zalo.ok ? null : zalo.error,
        overdue: input.overdue,
        manual: true,
      },
    );
  } catch (err) {
    console.error("[notification] failed to record delivery outcome", err);
  }

  if (zalo.ok) {
    await db
      .update(task)
      .set({ lastRemindedAt: new Date() })
      .where(eq(task.id, t.id));
  }
  return { ok: true, task: taskRow, zalo };
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
    (z) => notify.forwardManagerComment(toCard(t), z, input.text),
  );
  await notifyMobileEmployee(t, "message", { text: input.text });
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
    // Done work no longer alarms.
    extra.alertDeliveryId = null;
    extra.alertAttempts = 0;
    extra.lastAlertAt = null;
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
  attachmentUrls?: string[];
}): Promise<TaskResult> {
  // Resuming after an issue must not overwrite the original start time.
  const existing = await getTask(input.taskId);
  const res = await transition(input.taskId, "in_progress", {
    startedAt: existing?.startedAt ?? new Date(),
  });
  if (!res.ok) return res;

  const eventId = await logEvent(input.taskId, "status_changed", {
    type: "employee",
    id: input.employeeId,
  }, { to: "in_progress" });
  await saveAttachments(input.taskId, eventId, input.attachmentUrls);

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
  attachmentUrls?: string[];
}): Promise<TaskResult> {
  const res = await transition(input.taskId, "done", {
    completedAt: new Date(),
    // Done work no longer alarms.
    alertDeliveryId: null,
    alertAttempts: 0,
    lastAlertAt: null,
  });
  if (!res.ok) return res;

  const eventId = await logEvent(input.taskId, "status_changed", {
    type: "employee",
    id: input.employeeId,
  }, { to: "done" });
  await saveAttachments(input.taskId, eventId, input.attachmentUrls);

  const zalo = await notifyEmployee(
    input.taskId,
    "done",
    await assigneeZaloId(res.task),
    (z) => notify.notifyDoneAck(toCard(res.task), z),
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
    (z) => notify.notifyIssueAck(toCard(res.task), z),
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

// ---------------------------------------------------------------------------
// Mobile app: acknowledgement and manager nudges
// ---------------------------------------------------------------------------

export type AckResult =
  | { ok: true }
  | { ok: false; reason: "not_found" };

/**
 * The app's «Đã nhận» button. Records `acknowledgedAt` and stops the alert
 * chain for the current batch. Idempotent; a stale `deliveryId` (an old push
 * that arrived after a newer assignment) never clears the newer alert.
 */
export async function acknowledgeTask(input: {
  taskId: string;
  employeeId: string;
  deliveryId?: string;
}): Promise<AckResult> {
  const t = await getTask(input.taskId);
  if (!t || t.assigneeId !== input.employeeId) {
    return { ok: false, reason: "not_found" };
  }
  if (
    input.deliveryId &&
    t.alertDeliveryId &&
    t.alertDeliveryId !== input.deliveryId
  ) {
    // An old batch's ack must not silence the current one.
    return { ok: true };
  }

  await db
    .update(task)
    .set({
      acknowledgedAt: t.acknowledgedAt ?? new Date(),
      acknowledgedBy: input.employeeId,
      alertDeliveryId: null,
      alertAttempts: 0,
      lastAlertAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(task.id, input.taskId), eq(task.assigneeId, input.employeeId)));

  await mobileNotify.markTaskNotificationsRead(input.employeeId, input.taskId);
  return { ok: true };
}

export type NudgeFailure =
  | "not_found"
  | "not_waiting"
  | "too_soon"
  | "outside_hours"
  | "daily_cap"
  | "cooldown"
  | "escalated"
  | "text_required";

export type NudgeResult =
  | {
      ok: true;
      task: TaskRow;
      nudgeCount: number;
      nextNudgeAt: Date | null;
    }
  | {
      ok: false;
      reason: NudgeFailure;
      task?: TaskRow;
      availableAt?: Date | null;
    };

/**
 * Employee nudges a manager while work waits: `blocked` (issue not resolved)
 * or `done` (completion not verified). The server re-derives the level from
 * how long the task has been waiting and enforces the same cooldown / work
 * hours / daily cap the app shows, so a modified client cannot spam managers.
 */
export async function nudgeManager(input: {
  taskId: string;
  employeeId: string;
  level: NudgeLevel;
  text?: string;
}): Promise<NudgeResult> {
  const t = await getTask(input.taskId);
  if (!t || t.assigneeId !== input.employeeId) {
    return { ok: false, reason: "not_found" };
  }

  let waitingSince: Date | null = null;
  let trigger: "issue" | "approval" | null = null;
  if (t.status === "done") {
    const fallback = await latestEmployeeEvent(input.taskId);
    waitingSince = t.completedAt ?? fallback?.createdAt ?? null;
    trigger = "approval";
  } else if (t.status === "blocked") {
    const issue = await db.query.taskEvent.findFirst({
      where: and(
        eq(taskEvent.taskId, input.taskId),
        eq(taskEvent.type, "issue_reported"),
        eq(taskEvent.actorType, "employee"),
      ),
      orderBy: (e, { desc }) => desc(e.createdAt),
    });
    waitingSince = issue?.createdAt ?? null;
    trigger = "issue";
  }
  if (!waitingSince || !trigger) return { ok: false, reason: "not_waiting", task: t };

  const now = new Date();
  const waitingMs = now.getTime() - waitingSince.getTime();
  if (waitingMs < NUDGE_LEVELS[0].afterMs) {
    return {
      ok: false,
      reason: "too_soon",
      task: t,
      availableAt: new Date(waitingSince.getTime() + NUDGE_LEVELS[0].afterMs),
    };
  }
  if (!isWithinWorkHours(now)) {
    return { ok: false, reason: "outside_hours", task: t, availableAt: nextWorkStart(now) };
  }

  const rule = nudgeLevelFor(waitingMs);
  const history = await db.query.taskEvent.findMany({
    where: and(
      eq(taskEvent.taskId, input.taskId),
      eq(taskEvent.type, "nudge_sent"),
    ),
    orderBy: (e, { desc }) => desc(e.createdAt),
  });

  const today = vnDayKey(now);
  const todayCount = history.filter(
    (event) => vnDayKey(event.createdAt) === today,
  ).length;
  if (todayCount >= NUDGE_DAILY_CAP) {
    return { ok: false, reason: "daily_cap", task: t, availableAt: nextWorkStart(now) };
  }

  const last = history[0];
  if (last) {
    const cooldownEnd = new Date(last.createdAt.getTime() + rule.cooldownMs);
    if (now < cooldownEnd) {
      return { ok: false, reason: "cooldown", task: t, availableAt: cooldownEnd };
    }
    const lastLevel = Number(last.payload?.level ?? 0);
    if (lastLevel === 3 && last.createdAt >= waitingSince) {
      return { ok: false, reason: "escalated", task: t };
    }
  }

  if (rule.level === 3 && !input.text?.trim()) {
    return { ok: false, reason: "text_required", task: t };
  }

  await db.insert(taskEvent).values({
    taskId: input.taskId,
    type: "nudge_sent",
    actorType: "employee",
    actorId: input.employeeId,
    payload: {
      level: rule.level,
      requestedLevel: input.level,
      text: input.text?.trim() || null,
      trigger,
    },
  });

  return {
    ok: true,
    task: t,
    nudgeCount: history.length + 1,
    nextNudgeAt: new Date(now.getTime() + rule.cooldownMs),
  };
}

async function latestEmployeeEvent(taskId: string) {
  return db.query.taskEvent.findFirst({
    where: and(
      eq(taskEvent.taskId, taskId),
      eq(taskEvent.actorType, "employee"),
    ),
    orderBy: (e, { desc }) => desc(e.createdAt),
  });
}

export { toCard as taskToCard, getTask };
