"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employee, taskStatus } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { parseVNInput } from "@/lib/time";
import type { ActionResultState } from "@/lib/action-state";
import * as taskService from "@/lib/workflow/task-service";
import type { TaskResult } from "@/lib/workflow/task-service";
import type { NotifyResult } from "@/lib/workflow/notification-service";

const priority = z.enum(["low", "normal", "high", "urgent"]);

const taskFields = z.object({
  title: z.string().trim().min(1, "Nhập tiêu đề công việc").max(200),
  description: z.string().trim().max(2000).optional(),
  priority: priority.default("normal"),
  dueAt: z.string().optional(),
});

function readTaskFields(formData: FormData) {
  const parsed = taskFields.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority") || "normal",
    dueAt: formData.get("dueAt") || undefined,
  });
  return {
    title: parsed.title,
    description: parsed.description ?? null,
    priority: parsed.priority,
    // Managers type Vietnam wall-clock time; the server may be anywhere.
    dueAt: parseVNInput(parsed.dueAt),
  };
}

/** An error we produced for the user; safe to display verbatim. */
class UserInputError extends Error {}

function toActionError(err: unknown): string {
  if (err instanceof UserInputError) return err.message;
  if (err instanceof z.ZodError) {
    return err.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
  }
  console.error("[tasks] unexpected form error", err);
  return "Không thể thực hiện. Vui lòng thử lại.";
}

/** Turns a refused mutation into a message the toast can show. */
function mutationError(res: Extract<TaskResult, { ok: false }>): string {
  switch (res.reason) {
    case "not_found":
      return "Không tìm thấy công việc.";
    case "invalid_assignee":
      return "Nhân viên không tồn tại hoặc đã ngừng hoạt động.";
    case "invalid_transition":
      return "Không thể chuyển công việc theo hướng này.";
    default:
      return "Không thể thực hiện: công việc đã được xác nhận hoặc đã huỷ.";
  }
}

/**
 * The mutation itself succeeded but the Zalo message did not go out (employee
 * not linked, outside the 7-day window, OA tier, ...). The form warns instead
 * of celebrating; the task timeline keeps the exact reason.
 */
function deliveryWarning(res: { zalo?: NotifyResult }): string | undefined {
  if (!res.zalo || res.zalo.ok) return undefined;
  return res.zalo.error === "not_linked"
    ? "Đã lưu nhưng chưa gửi được Zalo vì nhân viên chưa kết nối."
    : "Đã lưu nhưng chưa gửi được Zalo, xem Diễn tiến để biết lý do.";
}

/** The select only offers active/invited staff; a crafted form could bypass it. */
async function assertAssignable(assigneeId: string) {
  const emp = await db.query.employee.findFirst({
    where: eq(employee.id, assigneeId),
  });
  if (!emp || emp.status === "inactive") {
    throw new UserInputError("Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
  }
}

function revalidateTask(taskId: string) {
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function createTaskAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  const user = await requireUser();

  try {
    const fields = readTaskFields(formData);
    const rawAssignee = formData.get("assigneeId");
    const assigneeId =
      typeof rawAssignee === "string" && rawAssignee
        ? z.string().uuid().parse(rawAssignee)
        : null;
    if (assigneeId) await assertAssignable(assigneeId);

    const created = await taskService.createTask({
      ...fields,
      assigneeId,
      createdBy: user.id,
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return {
      success: true,
      warning: deliveryWarning(created),
      redirectTo: `/tasks/${created.task.id}`,
    };
  } catch (err) {
    return { error: toActionError(err) };
  }
}

export async function updateTaskAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  const user = await requireUser();

  try {
    const taskId = z.string().uuid().parse(formData.get("taskId"));
    const res = await taskService.updateTask({
      taskId,
      actorId: user.id,
      ...readTaskFields(formData),
    });
    if (!res.ok) return { error: mutationError(res) };

    revalidateTask(taskId);
    return { success: true, warning: deliveryWarning(res) };
  } catch (err) {
    return { error: toActionError(err) };
  }
}

export async function assignTaskAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  const user = await requireUser();

  try {
    const taskId = z.string().uuid().parse(formData.get("taskId"));
    const assigneeId = z.string().uuid().parse(formData.get("assigneeId"));
    await assertAssignable(assigneeId);

    const res = await taskService.assignTask({
      taskId,
      assigneeId,
      actorId: user.id,
    });
    if (!res.ok) return { error: mutationError(res) };

    revalidateTask(taskId);
    return { success: true, warning: deliveryWarning(res) };
  } catch (err) {
    return { error: toActionError(err) };
  }
}

export async function verifyTaskAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  const user = await requireUser();

  try {
    const taskId = z.string().uuid().parse(formData.get("taskId"));
    const res = await taskService.verifyTask({ taskId, actorId: user.id });
    if (!res.ok) return { error: mutationError(res) };

    revalidateTask(taskId);
    return { success: true, warning: deliveryWarning(res) };
  } catch (err) {
    return { error: toActionError(err) };
  }
}

/** Returns a started-but-unwanted task to the backlog (assignee cleared). */
export async function unassignTaskAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  const user = await requireUser();

  try {
    const taskId = z.string().uuid().parse(formData.get("taskId"));
    const res = await taskService.unassignTask({ taskId, actorId: user.id });
    if (!res.ok) return { error: mutationError(res) };

    revalidateTask(taskId);
    return { success: true };
  } catch (err) {
    return { error: toActionError(err) };
  }
}

export async function cancelTaskAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  const user = await requireUser();

  try {
    const taskId = z.string().uuid().parse(formData.get("taskId"));
    const reason = (formData.get("reason") as string) || undefined;
    const res = await taskService.cancelTask({
      taskId,
      actorId: user.id,
      reason,
    });
    if (!res.ok) return { error: mutationError(res) };

    revalidateTask(taskId);
    return { success: true, warning: deliveryWarning(res) };
  } catch (err) {
    return { error: toActionError(err) };
  }
}

export async function commentTaskAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  const user = await requireUser();

  try {
    const taskId = z.string().uuid().parse(formData.get("taskId"));
    const text = z
      .string()
      .trim()
      .min(1, "Nhập nội dung lời nhắn")
      .max(2000)
      .parse(formData.get("text"));

    const res = await taskService.addManagerComment({
      taskId,
      actorId: user.id,
      text,
    });
    if (!res.ok) return { error: mutationError(res) };

    revalidatePath(`/tasks/${taskId}`);
    return { success: true, warning: deliveryWarning(res) };
  } catch (err) {
    return { error: toActionError(err) };
  }
}

/** Bulk variant used by the table's selection action bar. */
export async function cancelTasksAction(formData: FormData) {
  const user = await requireUser();
  const ids = z
    .array(z.string().uuid())
    .min(1)
    .parse(JSON.parse(String(formData.get("taskIds"))));

  for (const taskId of ids) {
    // Already-closed tasks are skipped so one stale selection cannot abort
    // the whole batch.
    await taskService.cancelTask({ taskId, actorId: user.id });
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

const kanbanMoveSchema = z.object({
  taskId: z.string().uuid(),
  to: z.enum(taskStatus.enumValues),
});

export type MoveTaskResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | "invalid_request"
        | "not_found"
        | "closed"
        | "invalid_assignee"
        | "invalid_transition"
      message: string
      taskId?: string
    };

const MOVE_ERROR_MESSAGE: Record<
  "not_found" | "closed" | "invalid_assignee" | "invalid_transition",
  string
> = {
  not_found: "Không tìm thấy công việc.",
  closed: "Công việc đã kết thúc nên không thể chuyển.",
  invalid_assignee: "Cần giao việc cho nhân viên trước khi chuyển tiếp.",
  invalid_transition: "Không thể chuyển công việc theo hướng này.",
};

/**
 * Called by the kanban board when a card is dropped in another column.
 * Returns a result instead of throwing so the board can revert the optimistic
 * move and show a toast (with an action when it can help).
 */
export async function moveTaskAction(input: {
  taskId: string;
  to: string;
}): Promise<MoveTaskResult> {
  const user = await requireUser();
  const parsed = kanbanMoveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_request",
      message: "Yêu cầu không hợp lệ.",
    };
  }

  const res = await taskService.moveTaskTo({
    ...parsed.data,
    actorId: user.id,
  });
  if (!res.ok) {
    return {
      ok: false,
      reason: res.reason,
      message: MOVE_ERROR_MESSAGE[res.reason],
      taskId: parsed.data.taskId,
    };
  }

  revalidatePath("/kanban");
  revalidateTask(parsed.data.taskId);
  return { ok: true };
}
