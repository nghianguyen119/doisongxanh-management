import { getZaloClient } from "@/lib/zalo/factory";
import {
  BTN,
  copy,
  taskCardText,
  taskNoticeText,
  type TaskCardInput,
} from "./bot-copy";

/**
 * Composes + sends the Vietnamese Zalo messages that correspond to task
 * lifecycle changes. Called by task-service after it has written the
 * task_event row.
 *
 * Sends are best-effort — a Zalo outage must not roll back a DB change that
 * already happened — so every function returns the outcome instead of
 * throwing. Callers log it as a `notification` task_event so the timeline
 * shows whether each message actually went out.
 */

/** What the message was about, for the timeline label. */
export type NotificationKind =
  | "assigned"
  | "updated"
  | "started"
  | "done"
  | "issue"
  | "verified"
  | "cancelled"
  | "comment"
  | "reminder";

export type NotifyResult = { ok: true } | { ok: false; error: string };

async function safe(p: Promise<unknown>): Promise<NotifyResult> {
  try {
    await p;
    return { ok: true };
  } catch (err) {
    console.error("[notification] send failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function notifyAssigned(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendButtons(
      zaloUserId,
      taskCardText(task, {
        heading: copy.assignedHeading,
        closing: copy.assignedClosing,
      }),
      [
        BTN.start(task.id),
        BTN.done(task.id),
        BTN.issue(task.id),
        BTN.progress(task.id),
        BTN.myTasks(),
      ],
    ),
  );
}

export function notifyUpdated(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendButtons(
      zaloUserId,
      taskCardText(task, {
        heading: copy.updatedHeading,
        closing: copy.updatedClosing,
      }),
      [
        BTN.done(task.id),
        BTN.issue(task.id),
        BTN.progress(task.id),
        BTN.myTasks(),
      ],
    ),
  );
}

/** Full "current task" card shown after the employee picks from the menu. */
export function sendPickedCard(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendButtons(
      zaloUserId,
      taskCardText(task, {
        heading: copy.pickedCardHeading,
        closing: copy.pickedCardClosing,
      }),
      [
        BTN.start(task.id),
        BTN.done(task.id),
        BTN.issue(task.id),
        BTN.progress(task.id),
        BTN.myTasks(),
      ],
    ),
  );
}

export function notifyStarted(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendButtons(
      zaloUserId,
      taskNoticeText(task, {
        heading: copy.startedHeading,
        closing: copy.startedClosing,
      }),
      [BTN.done(task.id), BTN.issue(task.id), BTN.progress(task.id)],
    ),
  );
}

export function notifyDoneAck(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendText(
      zaloUserId,
      taskNoticeText(task, {
        heading: copy.doneHeading,
        closing: copy.doneClosing,
      }),
    ),
  );
}

export function notifyIssueAck(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendText(
      zaloUserId,
      taskNoticeText(task, {
        heading: copy.issueAckHeading,
        closing: copy.issueAckClosing,
      }),
    ),
  );
}

export function notifyVerified(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendText(
      zaloUserId,
      taskNoticeText(task, {
        heading: copy.verifiedHeading,
        closing: copy.verifiedClosing,
      }),
    ),
  );
}

export function notifyCancelled(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendText(
      zaloUserId,
      taskNoticeText(task, {
        heading: copy.cancelledHeading,
        closing: copy.cancelledClosing,
      }),
    ),
  );
}

export function forwardManagerComment(
  task: TaskCardInput,
  zaloUserId: string,
  text: string,
) {
  return safe(
    getZaloClient().sendText(
      zaloUserId,
      taskNoticeText(task, {
        heading: copy.managerCommentHeading,
        closing: text,
      }),
    ),
  );
}

export function sendReminder(
  task: TaskCardInput,
  zaloUserId: string,
  overdue: boolean,
) {
  return safe(
    getZaloClient().sendButtons(
      zaloUserId,
      taskCardText(task, {
        heading: overdue
          ? copy.reminderOverdueHeading
          : copy.reminderDueHeading,
        closing: copy.reminderClosing,
      }),
      [
        BTN.done(task.id),
        BTN.issue(task.id),
        BTN.progress(task.id),
        BTN.myTasks(),
      ],
    ),
  );
}
