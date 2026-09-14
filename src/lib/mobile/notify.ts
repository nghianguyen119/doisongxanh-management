import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mobileDevice, mobileNotification } from "@/db/schema";
import { mobilePush } from "@/lib/workflow/bot-copy";
import { isFcmConfigured, sendFcmDataMessage } from "./fcm";

/**
 * Writes an inbox row and fans out an FCM data-only push to every active
 * device of an employee. Called by `task-service` alongside the Zalo send;
 * push is best-effort — the inbox is the durable path.
 */

export type MobilePushKind =
  | "message"
  | "task_new"
  | "task_updated"
  | "task_reminder"
  | "task_alert"
  | "task_urgent";

export interface MobileTaskInput {
  id: string;
  /** Human-facing reference, e.g. `DSX-12`. */
  ref: string;
  title: string;
  dueAt?: Date | null;
}

export type MobileNotifyResult =
  | { ok: true; devices: number }
  | { ok: false; error: string };

function presentation(kind: MobilePushKind, task: MobileTaskInput, text?: string) {
  const label = { ref: task.ref, title: task.title };
  switch (kind) {
    case "message": {
      const copy = mobilePush.managerMessage(text ?? task.title);
      return { ...copy, inboxKind: "message" as const };
    }
    case "task_urgent":
    case "task_alert": {
      const copy = mobilePush.taskUrgent(label);
      return { ...copy, inboxKind: "alert" as const };
    }
    case "task_updated": {
      const copy = mobilePush.taskUpdated(label);
      return { ...copy, inboxKind: "task" as const };
    }
    case "task_reminder": {
      const copy = mobilePush.taskReminder(label);
      return { ...copy, inboxKind: "task" as const };
    }
    default: {
      const copy = mobilePush.taskNew(label);
      return { ...copy, inboxKind: "task" as const };
    }
  }
}

export async function notifyMobileTask(input: {
  employeeId: string;
  kind: MobilePushKind;
  task: MobileTaskInput;
  /** Manager message text; used by `kind: "message"`. */
  text?: string;
  /** Current alert batch id; echoed by the app on ack. */
  deliveryId?: string;
  /** Re-alert ticks pass false so the inbox is not duplicated. */
  inbox?: boolean;
}): Promise<MobileNotifyResult> {
  const { title, body, inboxKind } = presentation(
    input.kind,
    input.task,
    input.text,
  );

  if (input.inbox !== false) {
    try {
      await db.insert(mobileNotification).values({
        employeeId: input.employeeId,
        kind: inboxKind,
        title,
        body,
        taskId: input.task.id,
      });
    } catch (err) {
      // The inbox row must never block the push or the task mutation.
      console.error("[mobile] failed to write inbox row", err);
    }
  }

  const devices = await db.query.mobileDevice.findMany({
    where: and(
      eq(mobileDevice.employeeId, input.employeeId),
      isNull(mobileDevice.revokedAt),
      isNotNull(mobileDevice.pushToken),
    ),
  });
  if (devices.length === 0) {
    return { ok: false, error: "no_device" };
  }
  if (!isFcmConfigured()) {
    return { ok: false, error: "fcm_not_configured" };
  }

  const data: Record<string, string> = {
    taskId: input.task.id,
    kind: input.kind,
    ref: input.task.ref,
    title: input.task.title,
  };
  if (input.task.dueAt) data.dueAt = input.task.dueAt.toISOString();
  if (input.deliveryId) data.deliveryId = input.deliveryId;

  const results = await Promise.all(
    devices.map((device) =>
      sendFcmDataMessage(device.pushToken as string, data),
    ),
  );
  const sent = results.filter((result) => result.ok).length;
  if (sent === 0) {
    const firstError = results.find((result) => !result.ok);
    return {
      ok: false,
      error: firstError && !firstError.ok ? firstError.error : "send_failed",
    };
  }
  return { ok: true, devices: sent };
}

/**
 * Mark alert inbox rows for one task as read — used when the employee
 * acknowledges the alert, and when a new assignment supersedes them.
 */
export async function markTaskNotificationsRead(
  employeeId: string,
  taskId: string,
): Promise<void> {
  await db
    .update(mobileNotification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(mobileNotification.employeeId, employeeId),
        eq(mobileNotification.taskId, taskId),
        isNull(mobileNotification.readAt),
      ),
    );
}
