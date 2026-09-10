import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { employee, task, zaloConversation } from "@/db/schema";
import { getZaloClient } from "@/lib/zalo/factory";
import { BUTTON_PAYLOAD } from "@/lib/zalo/types";
import { copy } from "./bot-copy";
import * as linking from "./employee-linking";
import * as tasks from "./task-service";
import * as notify from "./notification-service";

const OPEN_STATUSES = ["assigned", "accepted", "in_progress", "blocked"] as const;
const SKIP_WORDS = ["bỏ qua", "bo qua", "skip", "không", "khong"];

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

async function getConversation(zaloUserId: string): Promise<ConvRow> {
  const existing = await db.query.zaloConversation.findFirst({
    where: eq(zaloConversation.zaloUserId, zaloUserId),
  });
  if (existing) return existing;
  const [row] = await db
    .insert(zaloConversation)
    .values({ zaloUserId })
    .onConflictDoNothing()
    .returning();
  return (
    row ??
    (await db.query.zaloConversation.findFirst({
      where: eq(zaloConversation.zaloUserId, zaloUserId),
    }))!
  );
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
      inArray(task.status, [...OPEN_STATUSES]),
    ),
    orderBy: desc(task.assignedAt),
  });
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
  const ctxTaskId = (conv.context as { taskId?: string }).taskId;

  switch (conv.state) {
    case "awaiting_issue_text":
      if (ctxTaskId) {
        await tasks.reportIssue({
          taskId: ctxTaskId,
          employeeId: emp.id,
          text,
        });
      }
      await setState(zaloUserId, "idle");
      return;

    case "awaiting_done_note":
      if (ctxTaskId) {
        await tasks.completeTask({
          taskId: ctxTaskId,
          employeeId: emp.id,
          note: text,
        });
      }
      await setState(zaloUserId, "idle");
      return;

    case "awaiting_done_photo":
      if (isSkip(text)) {
        if (ctxTaskId) {
          await tasks.completeTask({
            taskId: ctxTaskId,
            employeeId: emp.id,
            note: (conv.context as { note?: string }).note ?? null,
          });
        }
        await setState(zaloUserId, "idle");
        return;
      }
      // treat as the completion note, still wait for the photo
      await db
        .update(zaloConversation)
        .set({ context: { ...conv.context, note: text } })
        .where(eq(zaloConversation.zaloUserId, zaloUserId));
      await say(zaloUserId, copy.askDonePhoto);
      return;

    default:
      return handleIdleText(zaloUserId, emp, text);
  }
}

export async function handleInboundImage(zaloUserId: string, urls: string[]) {
  const emp = await findEmployee(zaloUserId);
  if (!emp) return say(zaloUserId, copy.notLinkedHint);

  const conv = await getConversation(zaloUserId);
  const ctx = conv.context as { taskId?: string; note?: string };

  if (conv.state === "awaiting_done_photo" && ctx.taskId) {
    await tasks.completeTask({
      taskId: ctx.taskId,
      employeeId: emp.id,
      note: ctx.note ?? null,
      attachmentUrls: urls,
    });
    await setState(zaloUserId, "idle");
    return;
  }

  const open = await openTasksFor(emp.id);
  if (open.length === 1) {
    await tasks.addEmployeeComment({
      taskId: open[0].id,
      employeeId: emp.id,
      text: "[hình ảnh]",
      attachmentUrls: urls,
    });
    await say(zaloUserId, copy.employeeCommentAck);
    return;
  }
  await say(zaloUserId, open.length === 0 ? copy.noActiveTask : copy.help);
}

export async function handleFollow(zaloUserId: string) {
  const emp = await findEmployee(zaloUserId);
  if (emp) {
    if (emp.status === "inactive") {
      await db
        .update(employee)
        .set({ status: "active" })
        .where(eq(employee.id, emp.id));
    }
    return say(zaloUserId, copy.help);
  }
  await setState(zaloUserId, "awaiting_link_code");
  await getZaloClient().requestUserInfo(zaloUserId, copy.shareInfoPrompt);
  await say(zaloUserId, copy.followGreeting);
}

export async function handleUnfollow(zaloUserId: string) {
  const emp = await findEmployee(zaloUserId);
  if (emp) {
    await db
      .update(employee)
      .set({ status: "inactive" })
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
    await say(zaloUserId, copy.phoneLinkNotFound);
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
  if (!t || t.assigneeId !== emp.id) {
    return say(zaloUserId, copy.noActiveTask);
  }

  switch (action) {
    case "accept":
      await tasks.acceptTask({ taskId, employeeId: emp.id });
      return;
    case "start":
      await tasks.startTask({ taskId, employeeId: emp.id });
      return;
    case "done":
      await setState(zaloUserId, "awaiting_done_photo", { taskId });
      await say(zaloUserId, copy.askDonePhoto);
      return;
    case "issue":
      await setState(zaloUserId, "awaiting_issue_text", { taskId });
      await say(zaloUserId, copy.askIssueText);
      return;
    case "detail":
      await notify.sendTaskDetail(tasks.taskToCard(t), zaloUserId);
      return;
    default:
      await say(zaloUserId, copy.help);
  }
}

async function handleUnlinkedText(zaloUserId: string, text: string) {
  if (/^[A-Za-z0-9]{6}$/.test(text.trim())) {
    const res = await linking.linkByInviteCode(zaloUserId, text);
    if (res.ok) {
      await setState(zaloUserId, "idle");
      return say(zaloUserId, copy.linkSuccess(res.name));
    }
    return say(zaloUserId, copy.linkNotFound);
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
