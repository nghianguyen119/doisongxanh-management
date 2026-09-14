import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { task, taskAttachment, taskEvent } from "@/db/schema";
import {
  serializeTaskDetail,
  serializeTaskSummary,
  type MobileTaskDetail,
  type MobileTaskSummary,
} from "./serialize";

/**
 * Task reads for the mobile API. Every query is scoped to the authenticated
 * employee, so one device can never see another employee's work.
 */

const MAX_TASKS = 300;

export async function listEmployeeTasks(
  employeeId: string,
): Promise<MobileTaskSummary[]> {
  const [rows, counts] = await Promise.all([
    db.query.task.findMany({
      where: eq(task.assigneeId, employeeId),
      orderBy: desc(task.updatedAt),
      limit: MAX_TASKS,
    }),
    db
      .select({ taskId: taskAttachment.taskId, n: count() })
      .from(taskAttachment)
      .innerJoin(task, eq(task.id, taskAttachment.taskId))
      .where(eq(task.assigneeId, employeeId))
      .groupBy(taskAttachment.taskId),
  ]);

  const countByTask = new Map(
    counts.map((row) => [row.taskId, Number(row.n)]),
  );
  return rows.map((row) =>
    serializeTaskSummary(row, countByTask.get(row.id) ?? 0),
  );
}

export async function getEmployeeTaskDetail(
  employeeId: string,
  taskId: string,
): Promise<MobileTaskDetail | null> {
  const row = await db.query.task.findFirst({
    where: and(eq(task.id, taskId), eq(task.assigneeId, employeeId)),
    with: {
      events: { orderBy: asc(taskEvent.createdAt) },
      attachments: { orderBy: asc(taskAttachment.createdAt) },
    },
  });
  if (!row) return null;
  return serializeTaskDetail(row, row.events, row.attachments);
}

/** Fresh summary after a mutation (the action response shape). */
export async function taskSummaryById(
  taskId: string,
): Promise<MobileTaskSummary | null> {
  const row = await db.query.task.findFirst({ where: eq(task.id, taskId) });
  if (!row) return null;
  const [counts] = await db
    .select({ n: count() })
    .from(taskAttachment)
    .where(eq(taskAttachment.taskId, taskId));
  return serializeTaskSummary(row, Number(counts?.n ?? 0));
}
