"use server";

import { z } from "zod";
import { isRealSendTesterEnabled } from "@/env";
import { requireUser } from "@/lib/session";
import { getRealZaloClient } from "@/lib/zalo/factory";
import {
  BTN,
  copy,
  taskCardText,
  taskNoticeText,
  type TaskCardInput,
} from "@/lib/workflow/bot-copy";

/**
 * Local-only send tester behind /settings/zalo. It exercises every outbound
 * message shape through the *live* transport with the token stored in
 * `zalo_oa_token`, even when ZALO_TRANSPORT=mock, so the exact payload Zalo
 * receives can be verified before go-live. The action refuses to run in a
 * production build.
 */
export type ZaloTestKind =
  | "text"
  | "assigned"
  | "updated"
  | "started"
  | "reminder_due"
  | "reminder_overdue"
  | "request_user_info";

const ZALO_TEST_KINDS = [
  "text",
  "assigned",
  "updated",
  "started",
  "reminder_due",
  "reminder_overdue",
  "request_user_info",
] as const satisfies readonly ZaloTestKind[];

export type ZaloTestResult =
  | { ok: true; kind: ZaloTestKind; messageId: string }
  | { ok: false; kind: ZaloTestKind; error: string };

const inputSchema = z.object({
  zaloUserId: z.string().trim().min(1, "Chưa có Zalo user id."),
  kind: z.enum(ZALO_TEST_KINDS),
  text: z.string().trim().max(2000).optional(),
});

/** Sample task so the cards look exactly like the lifecycle notifications. */
function testTask(): TaskCardInput {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    ref: "DSX-0",
    title: "Việc kiểm thử từ trang Zalo công ty",
    description: "Tin gửi thử, không phải việc thật.",
    priority: "normal",
    dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  };
}

async function send(kind: ZaloTestKind, zaloUserId: string, text?: string) {
  const client = getRealZaloClient();
  const t = testTask();

  switch (kind) {
    case "text":
      return client.sendText(zaloUserId, text || copy.genericAck);
    case "assigned":
      return client.sendButtons(
        zaloUserId,
        taskCardText(t, {
          heading: copy.assignedHeading,
          closing: copy.assignedClosing,
        }),
        [
          BTN.start(t.id),
          BTN.done(t.id),
          BTN.issue(t.id),
          BTN.progress(t.id),
          BTN.myTasks(),
        ],
      );
    case "updated":
      return client.sendButtons(
        zaloUserId,
        taskCardText(t, {
          heading: copy.updatedHeading,
          closing: copy.updatedClosing,
        }),
        [BTN.done(t.id), BTN.issue(t.id), BTN.progress(t.id), BTN.myTasks()],
      );
    case "started":
      return client.sendButtons(
        zaloUserId,
        taskNoticeText(t, {
          heading: copy.startedHeading,
          closing: copy.startedClosing,
        }),
        [BTN.done(t.id), BTN.issue(t.id), BTN.progress(t.id)],
      );
    case "reminder_due":
      return client.sendButtons(
        zaloUserId,
        taskCardText(t, {
          heading: copy.reminderDueHeading,
          closing: copy.reminderClosing,
        }),
        [BTN.done(t.id), BTN.issue(t.id), BTN.progress(t.id), BTN.myTasks()],
      );
    case "reminder_overdue":
      return client.sendButtons(
        zaloUserId,
        taskCardText(t, {
          heading: copy.reminderOverdueHeading,
          closing: copy.reminderClosing,
        }),
        [BTN.done(t.id), BTN.issue(t.id), BTN.progress(t.id), BTN.myTasks()],
      );
    case "request_user_info":
      return client.requestUserInfo(zaloUserId, copy.requestInfoTitle);
  }
}

export async function sendZaloTestAction(
  input: unknown,
): Promise<ZaloTestResult> {
  await requireUser();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "text",
      error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    };
  }

  const { zaloUserId, kind, text } = parsed.data;

  if (!isRealSendTesterEnabled()) {
    return {
      ok: false,
      kind,
      error: "Chỉ gửi thật được khi chạy local (không chạy production).",
    };
  }

  try {
    const { messageId } = await send(kind, zaloUserId, text);
    console.log(`[zalo:test] sent ${kind} to=${zaloUserId} message_id=${messageId}`);
    return { ok: true, kind, messageId };
  } catch (err) {
    console.error(`[zalo:test] failed ${kind} to=${zaloUserId}`, err);
    return {
      ok: false,
      kind,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
