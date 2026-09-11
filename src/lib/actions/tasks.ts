"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employee, taskStatus } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { parseVNInput } from "@/lib/time";
import * as taskService from "@/lib/workflow/task-service";
import type { TaskResult } from "@/lib/workflow/task-service";

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

/** Turns a refused mutation into a message the error boundary can show. */
function assertOk(res: TaskResult) {
  if (res.ok) return res.task;
  throw new Error(
    res.reason === "not_found"
      ? "Không tìm thấy công việc."
      : res.reason === "invalid_assignee"
        ? "Nhân viên không tồn tại hoặc đã ngừng hoạt động."
        : res.reason === "invalid_transition"
          ? "Không thể chuyển công việc theo hướng này."
          : "Không thể thực hiện: công việc đã được xác nhận hoặc đã huỷ.",
  );
}

/** The select only offers active/invited staff; a crafted form could bypass it. */
async function assertAssignable(assigneeId: string) {
  const emp = await db.query.employee.findFirst({
    where: eq(employee.id, assigneeId),
  });
  if (!emp || emp.status === "inactive") {
    throw new Error("Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
  }
}

function revalidateTask(taskId: string) {
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function createTaskAction(formData: FormData) {
  const user = await requireUser();
  const fields = readTaskFields(formData);

  const rawAssignee = formData.get("assigneeId");
  const assigneeId =
    typeof rawAssignee === "string" && rawAssignee
      ? z.string().uuid().parse(rawAssignee)
      : null;
  if (assigneeId) await assertAssignable(assigneeId);

  const task = await taskService.createTask({
    ...fields,
    assigneeId,
    createdBy: user.id,
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect(`/tasks/${task.id}`);
}

export async function updateTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  assertOk(
    await taskService.updateTask({
      taskId,
      actorId: user.id,
      ...readTaskFields(formData),
    }),
  );
  revalidateTask(taskId);
}

export async function assignTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  const assigneeId = z.string().uuid().parse(formData.get("assigneeId"));
  await assertAssignable(assigneeId);
  assertOk(await taskService.assignTask({ taskId, assigneeId, actorId: user.id }));
  revalidateTask(taskId);
}

export async function verifyTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  assertOk(await taskService.verifyTask({ taskId, actorId: user.id }));
  revalidateTask(taskId);
}

/** Returns a started-but-unwanted task to the backlog (assignee cleared). */
export async function unassignTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  assertOk(await taskService.unassignTask({ taskId, actorId: user.id }));
  revalidateTask(taskId);
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

export async function cancelTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  const reason = (formData.get("reason") as string) || undefined;
  assertOk(await taskService.cancelTask({ taskId, actorId: user.id, reason }));
  revalidateTask(taskId);
}

export async function commentTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  const text = z.string().trim().min(1).max(2000).parse(formData.get("text"));
  assertOk(await taskService.addManagerComment({ taskId, actorId: user.id, text }));
  revalidatePath(`/tasks/${taskId}`);
}
