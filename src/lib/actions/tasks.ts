"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import * as taskService from "@/lib/workflow/task-service";

const createSchema = z.object({
  title: z.string().min(1, "Nhập tiêu đề công việc"),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assigneeId: z.string().uuid().optional().or(z.literal("")),
  dueAt: z.string().optional(),
});

export async function createTaskAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority") || "normal",
    assigneeId: formData.get("assigneeId") || "",
    dueAt: formData.get("dueAt") || undefined,
  });

  const task = await taskService.createTask({
    title: parsed.title,
    description: parsed.description ?? null,
    priority: parsed.priority,
    dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
    assigneeId: parsed.assigneeId ? parsed.assigneeId : null,
    createdBy: user.id,
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect(`/tasks/${task.id}`);
}

export async function assignTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  const assigneeId = z.string().uuid().parse(formData.get("assigneeId"));
  await taskService.assignTask({ taskId, assigneeId, actorId: user.id });
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
}

export async function verifyTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  await taskService.verifyTask({ taskId, actorId: user.id });
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
}

export async function cancelTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  const reason = (formData.get("reason") as string) || undefined;
  await taskService.cancelTask({ taskId, actorId: user.id, reason });
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
}

export async function commentTaskAction(formData: FormData) {
  const user = await requireUser();
  const taskId = z.string().uuid().parse(formData.get("taskId"));
  const text = z.string().min(1).parse(formData.get("text"));
  await taskService.addManagerComment({ taskId, actorId: user.id, text });
  revalidatePath(`/tasks/${taskId}`);
}
