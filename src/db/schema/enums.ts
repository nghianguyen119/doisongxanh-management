import { pgEnum } from "drizzle-orm/pg-core";

export const employeeStatus = pgEnum("employee_status", [
  "invited",
  "active",
  "inactive",
]);

export const taskStatus = pgEnum("task_status", [
  "assigned", // to do: created (maybe unassigned) or assigned, not started
  "in_progress", // employee tapped "Bắt đầu"
  "blocked", // employee reported an issue
  "done", // employee reported completion
  "verified", // manager confirmed the work
  "cancelled",
]);

export const taskPriority = pgEnum("task_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const taskEventType = pgEnum("task_event_type", [
  "created",
  "updated",
  "assigned",
  "status_changed",
  "comment",
  "issue_reported",
  "attachment_added",
  "reminder_sent",
  "notification",
  "nudge_sent",
]);

/** Notification categories the mobile app's inbox (bell) understands. */
export const mobileNotificationKind = pgEnum("mobile_notification_kind", [
  "message",
  "task",
  "alert",
]);

export const mobilePlatform = pgEnum("mobile_platform", ["android", "ios"]);

export const actorType = pgEnum("actor_type", ["manager", "employee", "system"]);

export const attachmentKind = pgEnum("attachment_kind", ["image", "file"]);

export const zaloDirection = pgEnum("zalo_direction", ["in", "out"]);

export const conversationState = pgEnum("conversation_state", [
  "idle",
  "awaiting_link_code",
  "awaiting_issue_text",
  "awaiting_task_pick",
]);
