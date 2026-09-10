"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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
      : "Không thể thực hiện: công việc đã được xác nhận hoặc đã huỷ.",
  );
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
  assertOk(await taskService.assignTask({ taskId, assigneeId, actorId: user.id }));
  revalidateTask(taskId);
}

export async function verifyTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  assertOk(await taskService.verifyTask({ taskId, actorId: user.id }));
  revalidateTask(taskId);
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
