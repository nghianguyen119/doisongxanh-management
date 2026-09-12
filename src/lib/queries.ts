import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  lt,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  employee,
  employeeInvite,
  employeeStatus,
  task,
  taskAttachment,
  taskEvent,
  taskPriority,
  taskStatus,
  user,
  zaloMessageLog,
} from "@/db/schema";
import { OPEN_TASK_STATUSES, taskRef } from "@/lib/labels";
import type { TaskStatus } from "@/lib/workflow/task-status";
import type { ExtendedColumnFilter } from "@/types/data-table";
import type { KanbanTask } from "@/components/kanban/columns";

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

export type TableQueryParams = {
  page: number;
  perPage: number;
  sort: string | null;
  filters: ExtendedColumnFilter[] | null;
};

type TaskPriority = (typeof taskPriority.enumValues)[number];
type EmployeeStatus = (typeof employeeStatus.enumValues)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getStringFilter(
  filters: ExtendedColumnFilter[] | null,
  id: string,
): string | null {
  const match = filters?.find((filter) => filter.id === id);
  if (!match || typeof match.value !== "string") return null;
  const value = match.value.trim();
  return value || null;
}

function getStringArrayFilter(
  filters: ExtendedColumnFilter[] | null,
  id: string,
): string[] {
  const match = filters?.find((filter) => filter.id === id);
  return Array.isArray(match?.value) ? match.value : [];
}

const isTaskStatus = (value: string): value is TaskStatus =>
  (taskStatus.enumValues as readonly string[]).includes(value);

const isTaskPriority = (value: string): value is TaskPriority =>
  (taskPriority.enumValues as readonly string[]).includes(value);

const isEmployeeStatus = (value: string): value is EmployeeStatus =>
  (employeeStatus.enumValues as readonly string[]).includes(value);

/**
 * Filters arrive from the URL, so anything that reaches a Postgres enum or
 * uuid column has to be validated first — otherwise `?filters=...` with a bad
 * value is a 500 rather than an ignored filter.
 */
export function normalizeTaskFilters(filters: ExtendedColumnFilter[] | null) {
  return {
    title: getStringFilter(filters, "title"),
    statuses: getStringArrayFilter(filters, "status").filter(isTaskStatus),
    priorities: getStringArrayFilter(filters, "priority").filter(isTaskPriority),
    assigneeIds: getStringArrayFilter(filters, "assignee").filter((id) =>
      UUID_RE.test(id),
    ),
  };
}

export function normalizeEmployeeFilters(
  filters: ExtendedColumnFilter[] | null,
) {
  return {
    name: getStringFilter(filters, "name"),
    statuses: getStringArrayFilter(filters, "status").filter(isEmployeeStatus),
  };
}

function clampPage(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function clampPerPage(value: number) {
  if (!Number.isFinite(value) || value < 1) return 10;
  return Math.min(Math.floor(value), 100);
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function getTaskOrderBy(sort: string | null) {
  const [id, direction] = (sort ?? "").split(".");
  const order = direction === "asc" ? asc : desc;

  switch (id) {
    case "title":
      return [order(task.title)];
    case "status":
      return [order(task.status)];
    case "priority":
      return [order(task.priority)];
    case "due":
      return [order(task.dueAt)];
    case "assignee":
      // Sort by the person's name, not the UUID stored on the row. Raw
      // identifiers: the relational query builder rewrites column interpolations
      // to its own aliases, which breaks a correlated subquery like this.
      return [
        sql`(select "employee"."name" from "employee" where "employee"."id" = "task"."assignee_id") ${
          direction === "asc" ? sql`asc nulls last` : sql`desc nulls last`
        }`,
      ];
    default:
      return [desc(task.updatedAt)];
  }
}

export async function listTasksPage(params: TableQueryParams) {
  const page = clampPage(params.page);
  const perPage = clampPerPage(params.perPage);
  const { title, statuses, priorities, assigneeIds } = normalizeTaskFilters(
    params.filters,
  );

  const conditions = [];
  if (title) conditions.push(ilike(task.title, `%${escapeLike(title)}%`));
  if (statuses.length) conditions.push(inArray(task.status, statuses));
  if (priorities.length) conditions.push(inArray(task.priority, priorities));
  if (assigneeIds.length)
    conditions.push(inArray(task.assigneeId, assigneeIds));
  const where = conditions.length ? and(...conditions) : undefined;

  const [totalRows] = await db.select({ n: count() }).from(task).where(where);
  const total = Number(totalRows?.n ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pageCount);

  const data = await db.query.task.findMany({
    where,
    orderBy: getTaskOrderBy(params.sort),
    with: { assignee: true },
    extras: {
      overdue:
        sql<boolean>`${task.dueAt} is not null and ${task.dueAt} < now()`.as(
          "overdue",
        ),
    },
    limit: perPage,
    offset: (safePage - 1) * perPage,
  });

  return { data, pageCount };
}

export async function getTaskDetail(id: string) {
  const t = await db.query.task.findFirst({
    where: eq(task.id, id),
    with: {
      assignee: true,
      events: { orderBy: asc(taskEvent.createdAt) },
      attachments: { orderBy: asc(taskAttachment.createdAt) },
    },
    extras: {
      overdue:
        sql<boolean>`${task.dueAt} is not null and ${task.dueAt} < now()`.as(
          "overdue",
        ),
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

function getEmployeeOrderBy(sort: string | null) {
  const [id, direction] = (sort ?? "").split(".");
  const order = direction === "asc" ? asc : desc;

  switch (id) {
    case "name":
      return [order(employee.name)];
    case "phone":
      return [order(employee.phone)];
    case "status":
      return [order(employee.status)];
    case "open":
      return [order(count(task.id))];
    default:
      return [asc(employee.name)];
  }
}

export async function listEmployeesPage(params: TableQueryParams) {
  const page = clampPage(params.page);
  const perPage = clampPerPage(params.perPage);
  const { name, statuses } = normalizeEmployeeFilters(params.filters);

  const conditions = [];
  if (name) conditions.push(ilike(employee.name, `%${escapeLike(name)}%`));
  if (statuses.length) conditions.push(inArray(employee.status, statuses));
  const where = conditions.length ? and(...conditions) : undefined;

  const baseQuery = () =>
    db
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
      .where(where)
      .groupBy(employee.id);

  const [totalRows] = await db
    .select({ n: count() })
    .from(baseQuery().as("filtered_employees"));
  const total = Number(totalRows?.n ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pageCount);

  const data = await baseQuery()
    .orderBy(...getEmployeeOrderBy(params.sort))
    .limit(perPage)
    .offset((safePage - 1) * perPage);

  return { data, pageCount };
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
    .select({
      id: employee.id,
      name: employee.name,
      status: employee.status,
      zaloUserId: employee.zaloUserId,
    })
    .from(employee)
    .where(inArray(employee.status, ["active", "invited"]))
    .orderBy(asc(employee.name));
}

/**
 * Inbound messages from Zalo users that are not linked to any employee —
 * customers reaching the OA. Read-only; the bot acknowledges them once and
 * managers follow up in Zalo manually.
 */
export async function listRecentClientMessages(limit = 50) {
  const linkedZaloUserIds = db
    .select({ id: employee.zaloUserId })
    .from(employee)
    .where(isNotNull(employee.zaloUserId));

  return db
    .select({
      id: zaloMessageLog.id,
      zaloUserId: zaloMessageLog.zaloUserId,
      eventName: zaloMessageLog.eventName,
      payload: zaloMessageLog.payload,
      createdAt: zaloMessageLog.createdAt,
    })
    .from(zaloMessageLog)
    .where(
      and(
        eq(zaloMessageLog.direction, "in"),
        isNotNull(zaloMessageLog.zaloUserId),
        inArray(zaloMessageLog.eventName, ["text", "image", "user_info"]),
        notInArray(zaloMessageLog.zaloUserId, linkedZaloUserIds),
      ),
    )
    .orderBy(desc(zaloMessageLog.createdAt))
    .limit(limit);
}

/**
 * Every task that still belongs on the board, with the bits the cards show.
 * Cancelled tasks are left to /tasks.
 */
export async function getKanbanTasks(): Promise<KanbanTask[]> {
  const [rows, attachmentRows] = await Promise.all([
    db.query.task.findMany({
      where: ne(task.status, "cancelled"),
      orderBy: [desc(task.updatedAt)],
      with: { assignee: { columns: { name: true } } },
      extras: {
        overdue:
          sql<boolean>`${task.dueAt} is not null and ${task.dueAt} < now()`.as(
            "overdue",
          ),
      },
    }),
    db
      .select({ taskId: taskAttachment.taskId, n: count() })
      .from(taskAttachment)
      .groupBy(taskAttachment.taskId),
  ]);

  const attachmentCounts = new Map(
    attachmentRows.map((row) => [row.taskId, Number(row.n)]),
  );

  return rows.map((t) => ({
    id: t.id,
    ref: taskRef(t.refNo),
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    overdue: t.overdue,
    assigneeName: t.assignee?.name ?? null,
    attachmentCount: attachmentCounts.get(t.id) ?? 0,
  }));
}
