import { and, asc, count, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  employee,
  employeeInvite,
  task,
  taskAttachment,
  taskEvent,
  taskStatus,
  user,
} from "@/db/schema";
import { OPEN_TASK_STATUSES } from "@/lib/labels";
import type { TaskStatus } from "@/lib/workflow/task-status";

export async function getDashboardData() {
  const statusRows = await db
    .select({ status: task.status, n: count() })
    .from(task)
    .groupBy(task.status);

  const statusCounts = Object.fromEntries(
    statusRows.map((r) => [r.status, Number(r.n)]),
  ) as Record<string, number>;

  const overdue = await db.query.task.findMany({
    where: and(
      inArray(task.status, OPEN_TASK_STATUSES),
      isNotNull(task.dueAt),
      lt(task.dueAt, new Date()),
    ),
    orderBy: asc(task.dueAt),
    with: { assignee: true },
    limit: 20,
  });

  const workload = await db
    .select({
      employeeId: employee.id,
      name: employee.name,
      open: count(task.id),
    })
    .from(employee)
    .leftJoin(
      task,
      and(
        eq(task.assigneeId, employee.id),
        inArray(task.status, OPEN_TASK_STATUSES),
      ),
    )
    .where(eq(employee.status, "active"))
    .groupBy(employee.id, employee.name)
    .orderBy(desc(count(task.id)));

  const recent = await db
    .select({
      id: taskEvent.id,
      type: taskEvent.type,
      actorType: taskEvent.actorType,
      payload: taskEvent.payload,
      createdAt: taskEvent.createdAt,
      taskId: taskEvent.taskId,
      taskTitle: task.title,
    })
    .from(taskEvent)
    .innerJoin(task, eq(task.id, taskEvent.taskId))
    .orderBy(desc(taskEvent.createdAt))
    .limit(15);

  return { statusCounts, overdue, workload, recent };
}

export type TaskFilters = {
  status?: string;
  assigneeId?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Filters come straight from the query string, so anything that reaches a
 * Postgres enum or uuid column has to be validated first — otherwise
 * `/tasks?status=bogus` is a 500 rather than an ignored filter.
 */
export function parseTaskFilters(sp: Record<string, unknown>): TaskFilters {
  const status =
    typeof sp.status === "string" &&
    (taskStatus.enumValues as readonly string[]).includes(sp.status)
      ? sp.status
      : undefined;

  const assigneeId =
    typeof sp.assigneeId === "string" && UUID_RE.test(sp.assigneeId)
      ? sp.assigneeId
      : undefined;

  return { status, assigneeId };
}

export async function listTasks(filters: TaskFilters = {}) {
  const where = [];
  if (filters.status) {
    where.push(eq(task.status, filters.status as TaskStatus));
  }
  if (filters.assigneeId) where.push(eq(task.assigneeId, filters.assigneeId));

  return db.query.task.findMany({
    where: where.length ? and(...where) : undefined,
    orderBy: [desc(task.updatedAt)],
    with: { assignee: true },
    limit: 200,
  });
}

export async function getTaskDetail(id: string) {
  const t = await db.query.task.findFirst({
    where: eq(task.id, id),
    with: {
      assignee: true,
      events: { orderBy: asc(taskEvent.createdAt) },
      attachments: { orderBy: asc(taskAttachment.createdAt) },
    },
  });
  if (!t) return null;

  // Resolve manager actor names in one pass.
  const managerIds = [
    ...new Set(
      t.events
        .filter((e) => e.actorType === "manager" && e.actorId)
        .map((e) => e.actorId as string),
    ),
  ];
  const managers = managerIds.length
    ? await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, managerIds))
    : [];
  const managerName = new Map(managers.map((m) => [m.id, m.name]));

  return { task: t, managerName };
}

export async function listEmployees() {
  return db
    .select({
      id: employee.id,
      name: employee.name,
      phone: employee.phone,
      position: employee.position,
      status: employee.status,
      zaloUserId: employee.zaloUserId,
      open: count(task.id),
    })
    .from(employee)
    .leftJoin(
      task,
      and(
        eq(task.assigneeId, employee.id),
        inArray(task.status, OPEN_TASK_STATUSES),
      ),
    )
    .groupBy(employee.id)
    .orderBy(asc(employee.name));
}

export async function getEmployeeDetail(id: string) {
  const emp = await db.query.employee.findFirst({
    where: eq(employee.id, id),
    with: {
      invites: { orderBy: desc(employeeInvite.createdAt) },
    },
  });
  if (!emp) return null;

  const tasks = await db.query.task.findMany({
    where: eq(task.assigneeId, id),
    orderBy: desc(task.updatedAt),
    limit: 100,
  });

  const now = Date.now();
  const activeInvite =
    emp.invites.find((i) => !i.consumedAt && i.expiresAt.getTime() > now) ??
    null;

  return { employee: emp, tasks, activeInvite };
}

export async function listActiveEmployeesForSelect() {
  return db
    .select({ id: employee.id, name: employee.name, status: employee.status })
    .from(employee)
    .where(inArray(employee.status, ["active", "invited"]))
    .orderBy(asc(employee.name));
}
