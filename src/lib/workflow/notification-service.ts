import { getZaloClient } from "@/lib/zalo/factory";
import { BTN, copy, taskCardText, type TaskCardInput } from "./bot-copy";

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
      taskCardText(task, copy.assignedHeading),
      [BTN.start(task.id), BTN.done(task.id), BTN.issue(task.id), BTN.detail(task.id)],
    ),
  );
}

export function notifyUpdated(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendButtons(
      zaloUserId,
      taskCardText(task, copy.updatedHeading),
      [BTN.done(task.id), BTN.issue(task.id), BTN.detail(task.id)],
    ),
  );
}

export function notifyStarted(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendButtons(zaloUserId, copy.startedAck, [
      BTN.done(task.id),
      BTN.issue(task.id),
    ]),
  );
}

export function notifyDoneAck(zaloUserId: string) {
  return safe(getZaloClient().sendText(zaloUserId, copy.doneAck));
}

export function notifyIssueAck(zaloUserId: string) {
  return safe(getZaloClient().sendText(zaloUserId, copy.issueAck));
}

export function notifyVerified(zaloUserId: string) {
  return safe(getZaloClient().sendText(zaloUserId, copy.verifiedNotice));
}

export function notifyCancelled(zaloUserId: string) {
  return safe(getZaloClient().sendText(zaloUserId, copy.cancelledNotice));
}

export function forwardManagerComment(zaloUserId: string, text: string) {
  return safe(getZaloClient().sendText(zaloUserId, copy.managerComment(text)));
}

export function sendTaskDetail(task: TaskCardInput, zaloUserId: string) {
  return safe(
    getZaloClient().sendButtons(
      zaloUserId,
      taskCardText(task, copy.detailHeading),
      [BTN.done(task.id), BTN.issue(task.id)],
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
      taskCardText(
        task,
        overdue ? copy.reminderOverdue(task.title) : copy.reminderDue(task.title),
      ),
      [BTN.done(task.id), BTN.issue(task.id), BTN.detail(task.id)],
    ),
  );
}
