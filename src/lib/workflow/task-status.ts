import { taskStatus } from "@/db/schema";

export type TaskStatus = (typeof taskStatus.enumValues)[number];

/**
 * Legal next statuses for each status.
 *
 * This exists because Zalo buttons never expire: the "✔️ Đã xong" button from
 * a message sent weeks ago still sits in the employee's chat history, and
 * tapping it posts its payload again. Without a guard that would silently
 * resurrect a task the manager had already verified or cancelled.
 *
 * `assigned` is the single "to do" state: it holds drafts that have no
 * assignee yet and tasks an employee has been given but not started. There is
 * no separate acceptance step; `assigned` appears in most lists because a
 * manager re-assigning a task resets it to `assigned`.
 */
export const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  assigned: [
    "in_progress",
    "done",
    "blocked",
    "assigned",
    "cancelled",
  ],
  in_progress: ["done", "blocked", "assigned", "cancelled"],
  blocked: ["in_progress", "done", "assigned", "cancelled"],
  done: ["verified", "blocked", "in_progress", "assigned", "cancelled"],
  verified: [], // terminal
  cancelled: ["assigned"], // reopened only by an explicit re-assign
};

/** Statuses an employee can no longer act on from a stale Zalo button. */
export const CLOSED_STATUSES: TaskStatus[] = ["verified", "cancelled"];

/**
 * Zalo button action -> the status it moves the task to. Used to recognise a
 * tap whose action already took effect (the employee hammered the button
 * because of network latency): the handler then stays quiet instead of
 * replying "công việc đã kết thúc".
 */
export const ACTION_TARGET_STATUS: Record<string, TaskStatus | undefined> = {
  start: "in_progress",
  done: "done",
  issue: "blocked",
};

export function isClosed(status: TaskStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Every status that may legally move to `to`. Used as the `WHERE status IN
 * (...)` guard so the check and the write happen in one atomic statement —
 * two simultaneous taps of the same button cannot both succeed.
 */
export function statusesAllowedToReach(to: TaskStatus): TaskStatus[] {
  return taskStatus.enumValues.filter((from) => canTransition(from, to));
}
