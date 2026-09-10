import { getZaloClient } from "@/lib/zalo/factory";
import { BTN, copy, taskCardText, type TaskCardInput } from "./bot-copy";

/**
 * Composes + sends the Vietnamese Zalo messages that correspond to task
 * lifecycle changes. Called by task-service after it has written the
 * task_event row. All functions are best-effort: a Zalo failure is logged by
 * the client but must not roll back the DB change.
 */

async function safe<T>(p: Promise<T>): Promise<void> {
  try {
    await p;
  } catch (err) {
    console.error("[notification] send failed", err);
  }
}

export async function notifyAssigned(task: TaskCardInput, zaloUserId: string) {
  const client = getZaloClient();
  await safe(
    client.sendButtons(
      zaloUserId,
      taskCardText(task, copy.assignedHeading),
      [BTN.accept(task.id), BTN.issue(task.id), BTN.detail(task.id)],
    ),
  );
}

export async function notifyAccepted(task: TaskCardInput, zaloUserId: string) {
  await safe(
    getZaloClient().sendButtons(zaloUserId, copy.acceptedAck, [
      BTN.start(task.id),
      BTN.done(task.id),
      BTN.issue(task.id),
    ]),
  );
}

export async function notifyStarted(task: TaskCardInput, zaloUserId: string) {
  await safe(
    getZaloClient().sendButtons(zaloUserId, copy.startedAck, [
      BTN.done(task.id),
      BTN.issue(task.id),
    ]),
  );
}

export async function notifyDoneAck(zaloUserId: string) {
  await safe(getZaloClient().sendText(zaloUserId, copy.doneAck));
}

export async function notifyIssueAck(zaloUserId: string) {
  await safe(getZaloClient().sendText(zaloUserId, copy.issueAck));
}

export async function notifyVerified(zaloUserId: string) {
  await safe(getZaloClient().sendText(zaloUserId, copy.verifiedNotice));
}

export async function notifyCancelled(zaloUserId: string) {
  await safe(getZaloClient().sendText(zaloUserId, copy.cancelledNotice));
}

export async function forwardManagerComment(zaloUserId: string, text: string) {
  await safe(getZaloClient().sendText(zaloUserId, copy.managerComment(text)));
}

export async function sendTaskDetail(task: TaskCardInput, zaloUserId: string) {
  await safe(
    getZaloClient().sendButtons(
      zaloUserId,
      taskCardText(task, "ℹ️ Chi tiết công việc:"),
      [BTN.done(task.id), BTN.issue(task.id)],
    ),
  );
}

export async function sendReminder(task: TaskCardInput, zaloUserId: string) {
  await safe(
    getZaloClient().sendButtons(zaloUserId, copy.reminder(task.title), [
      BTN.done(task.id),
      BTN.issue(task.id),
      BTN.detail(task.id),
    ]),
  );
}
