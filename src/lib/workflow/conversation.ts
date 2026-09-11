import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { employee, task, zaloConversation } from "@/db/schema";
import { OPEN_TASK_STATUSES } from "@/lib/labels";
import { getZaloClient } from "@/lib/zalo/factory";
import { BUTTON_PAYLOAD } from "@/lib/zalo/types";
import { copy } from "./bot-copy";
import * as linking from "./employee-linking";
import * as tasks from "./task-service";
import type { TaskResult } from "./task-service";
import * as notify from "./notification-service";
import { isClosed } from "./task-status";

const SKIP_WORDS = ["bỏ qua", "bo qua", "skip", "không", "khong", "ko"];

/**
 * A half-finished flow ("we asked for a photo") is abandoned after this long.
 * Without it an employee who taps "Đã xong" and then wanders off stays stuck
 * forever: every later message would be swallowed as a completion note.
 */
const STATE_TTL_MS = 30 * 60 * 1000;

type EmployeeRow = typeof employee.$inferSelect;
type ConvRow = typeof zaloConversation.$inferSelect;

async function say(zaloUserId: string, text: string) {
  await getZaloClient().sendText(zaloUserId, text);
}

async function findEmployee(zaloUserId: string): Promise<EmployeeRow | null> {
  return (
    (await db.query.employee.findFirst({
      where: eq(employee.zaloUserId, zaloUserId),
    })) ?? null
  );
}

/** Reads the conversation cursor, treating a stale in-flight state as idle. */
async function getConversation(zaloUserId: string): Promise<ConvRow> {
  const [row] = await db
    .insert(zaloConversation)
    .values({ zaloUserId })
    .onConflictDoUpdate({
      // No-op update so the row always comes back, new or existing.
      target: zaloConversation.zaloUserId,
      set: { zaloUserId },
    })
    .returning();

  const expired =
    row.state !== "idle" &&
    Date.now() - row.updatedAt.getTime() > STATE_TTL_MS;

  if (expired) {
    await setState(zaloUserId, "idle");
    return { ...row, state: "idle", context: {} };
  }
  return row;
}

async function setState(
  zaloUserId: string,
  state: ConvRow["state"],
  context: Record<string, unknown> = {},
) {
  await db
    .insert(zaloConversation)
    .values({ zaloUserId, state, context })
    .onConflictDoUpdate({
      target: zaloConversation.zaloUserId,
      set: { state, context, turn: 0, updatedAt: new Date() },
    });
}

async function openTasksFor(employeeId: string) {
  return db.query.task.findMany({
    where: and(
      eq(task.assigneeId, employeeId),
      inArray(task.status, OPEN_TASK_STATUSES),
    ),
    orderBy: desc(task.assignedAt),
  });
}

/**
 * Turns a rejected mutation into something the employee can understand. The
 * service already sent the happy-path acknowledgement.
 */
async function reportFailure(zaloUserId: string, res: TaskResult) {
  if (res.ok) return;
  await say(
    zaloUserId,
    res.reason === "not_found" ? copy.noActiveTask : copy.taskClosed,
  );
}

// ---------------------------------------------------------------------------
// Entry points (called by dispatch.ts)
// ---------------------------------------------------------------------------

export async function handleInboundText(zaloUserId: string, text: string) {
  const button = BUTTON_PAYLOAD.decode(text);
  if (button) return handleTaskAction(zaloUserId, button.action, button.taskId);

  const emp = await findEmployee(zaloUserId);
  if (!emp) return handleUnlinkedText(zaloUserId, text);

  const conv = await getConversation(zaloUserId);
  const ctx = conv.context as { taskId?: string; note?: string };

  switch (conv.state) {
    case "awaiting_issue_text": {
      if (!ctx.taskId) break;
      const res = await tasks.reportIssue({
        taskId: ctx.taskId,
        employeeId: emp.id,
        text,
      });
      await setState(zaloUserId, "idle");
      return reportFailure(zaloUserId, res);
    }

    case "awaiting_done_note": {
      if (!ctx.taskId) break;
      const res = await tasks.completeTask({
        taskId: ctx.taskId,
        employeeId: emp.id,
        note: text,
      });
      await setState(zaloUserId, "idle");
      return reportFailure(zaloUserId, res);
    }

    case "awaiting_done_photo": {
      if (!ctx.taskId) break;
      if (isSkip(text)) {
        const res = await tasks.completeTask({
          taskId: ctx.taskId,
          employeeId: emp.id,
          note: ctx.note ?? null,
        });
        await setState(zaloUserId, "idle");
        return reportFailure(zaloUserId, res);
      }
      // Treat it as the completion note and keep waiting for the photo.
      await setState(zaloUserId, "awaiting_done_photo", { ...ctx, note: text });
      return say(zaloUserId, copy.askDonePhoto);
    }
  }

  return handleIdleText(zaloUserId, emp, text);
}

export async function handleInboundImage(zaloUserId: string, urls: string[]) {
  const emp = await findEmployee(zaloUserId);
  if (!emp) return say(zaloUserId, copy.notLinkedHint);

  const conv = await getConversation(zaloUserId);
  const ctx = conv.context as { taskId?: string; note?: string };

  if (conv.state === "awaiting_done_photo" && ctx.taskId) {
    const res = await tasks.completeTask({
      taskId: ctx.taskId,
      employeeId: emp.id,
      note: ctx.note ?? null,
      attachmentUrls: urls,
    });
    await setState(zaloUserId, "idle");
    return reportFailure(zaloUserId, res);
  }

  if (conv.state === "awaiting_issue_text" && ctx.taskId) {
    // Photo first, description still to come — attach it to the issue.
    const res = await tasks.reportIssue({
      taskId: ctx.taskId,
      employeeId: emp.id,
      text: "[hình ảnh sự cố]",
      attachmentUrls: urls,
    });
    await setState(zaloUserId, "idle");
    return reportFailure(zaloUserId, res);
  }

  const open = await openTasksFor(emp.id);
  if (open.length === 1) {
    await tasks.addEmployeeComment({
      taskId: open[0].id,
      employeeId: emp.id,
      text: "[hình ảnh]",
      attachmentUrls: urls,
    });
    return say(zaloUserId, copy.employeeCommentAck);
  }
  await say(zaloUserId, open.length === 0 ? copy.noActiveTask : copy.help);
}

export async function handleFollow(zaloUserId: string) {
  const emp = await findEmployee(zaloUserId);
  if (emp) {
    // Following the OA again does not undo a manager's decision to disable
    // the account; only an explicit re-activation in the portal does.
    if (emp.status === "inactive") return say(zaloUserId, copy.accountInactive);
    return say(zaloUserId, copy.help);
  }
  await getZaloClient().requestUserInfo(zaloUserId, copy.shareInfoPrompt);
  await say(zaloUserId, copy.followGreeting);
}

export async function handleUnfollow(zaloUserId: string) {
  const emp = await findEmployee(zaloUserId);
  if (emp) {
    await db
      .update(employee)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(employee.id, emp.id));
  }
}

export async function handleUserInfo(
  zaloUserId: string,
  info: { name?: string; phone?: string },
) {
  if (await findEmployee(zaloUserId)) return;
  if (!info.phone) return say(zaloUserId, copy.askInviteCode);

  const res = await linking.linkByPhone(zaloUserId, info.phone);
  if (res.ok) {
    await setState(zaloUserId, "idle");
    await say(zaloUserId, copy.phoneLinkSuccess(res.name));
  } else {
    await say(
      zaloUserId,
      res.reason === "inactive" ? copy.accountInactive : copy.phoneLinkNotFound,
    );
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function isSkip(text: string) {
  return SKIP_WORDS.includes(text.trim().toLowerCase());
}

async function handleTaskAction(
  zaloUserId: string,
  action: string,
  taskId: string,
) {
  const emp = await findEmployee(zaloUserId);
  if (!emp) return say(zaloUserId, copy.notLinkedHint);

  const t = await db.query.task.findFirst({ where: eq(task.id, taskId) });
  if (!t) return say(zaloUserId, copy.noActiveTask);
  if (t.assigneeId !== emp.id) return say(zaloUserId, copy.taskNotYours);

  // Zalo buttons live in the chat forever; refuse taps on a finished task
  // rather than resurrecting it.
  if (isClosed(t.status)) return say(zaloUserId, copy.taskClosed);

  switch (action) {
    case "accept":
      return reportFailure(
        zaloUserId,
        await tasks.acceptTask({ taskId, employeeId: emp.id }),
      );
    case "start":
      return reportFailure(
        zaloUserId,
        await tasks.startTask({ taskId, employeeId: emp.id }),
      );
    case "done":
      await setState(zaloUserId, "awaiting_done_photo", { taskId });
      return say(zaloUserId, copy.askDonePhoto);
    case "issue":
      await setState(zaloUserId, "awaiting_issue_text", { taskId });
      return say(zaloUserId, copy.askIssueText);
    case "detail":
      await notify.sendTaskDetail(tasks.taskToCard(t), zaloUserId);
      return;
    default:
      return say(zaloUserId, copy.help);
  }
}

async function handleUnlinkedText(zaloUserId: string, text: string) {
  if (/^[A-Za-z0-9]{6}$/.test(text.trim())) {
    const res = await linking.linkByInviteCode(zaloUserId, text);
    if (res.ok) {
      await setState(zaloUserId, "idle");
      return say(zaloUserId, copy.linkSuccess(res.name));
    }
    return say(
      zaloUserId,
      res.reason === "already_linked"
        ? copy.alreadyLinked
        : res.reason === "inactive"
          ? copy.accountInactive
          : copy.linkNotFound,
    );
  }
  return say(zaloUserId, copy.notLinkedHint);
}

async function handleIdleText(
  zaloUserId: string,
  emp: EmployeeRow,
  text: string,
) {
  const open = await openTasksFor(emp.id);
  if (open.length === 1) {
    await tasks.addEmployeeComment({
      taskId: open[0].id,
      employeeId: emp.id,
      text,
    });
    return say(zaloUserId, copy.employeeCommentAck);
  }
  return say(zaloUserId, open.length === 0 ? copy.noActiveTask : copy.help);
}
