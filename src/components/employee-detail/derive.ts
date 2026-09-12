import { formatDistanceStrict } from "date-fns";
import { vi } from "date-fns/locale";

import {
  EMPLOYEE_STATUS_LABEL,
  OPEN_TASK_STATUSES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
} from "@/lib/labels";

export type EmployeeStatus = keyof typeof EMPLOYEE_STATUS_LABEL;
export type EmployeeTaskStatus = keyof typeof TASK_STATUS_LABEL;
export type EmployeeTaskPriority = keyof typeof TASK_PRIORITY_LABEL;

/** The slice of an assigned task the profile page actually renders. */
export type EmployeeTask = {
  id: string;
  refNo: number;
  title: string;
  description: string | null;
  status: EmployeeTaskStatus;
  priority: EmployeeTaskPriority;
  dueAt: Date | null;
  updatedAt: Date;
};

export type NextDueTask = {
  id: string;
  title: string;
  dueAt: Date;
};

export type OpenTaskStatus = "assigned" | "in_progress" | "blocked";

export type EmployeeStats = {
  total: number;
  open: number;
  openByStatus: Record<OpenTaskStatus, number>;
  overdue: number;
  /** Employee reported completion, waiting for the manager (`done`). */
  awaiting: number;
  verified: number;
  cancelled: number;
  /** `done` + `verified`. */
  completed: number;
  /** Denominator for the completion rate: everything but `cancelled`. */
  scale: number;
  /** 0..1, or null when the employee has no tasks to rate. */
  rate: number | null;
  nextDue: NextDueTask | null;
};

export function isOpenStatus(
  status: EmployeeTaskStatus,
): status is OpenTaskStatus {
  return OPEN_TASK_STATUSES.includes(status);
}

/**
 * Everything the KPI strip, hero and table show is derived here from the
 * assigned tasks alone — no separate aggregate queries, no invented numbers.
 */
export function deriveEmployeeStats(
  tasks: EmployeeTask[],
  now: Date = new Date(),
): EmployeeStats {
  const openByStatus = { assigned: 0, in_progress: 0, blocked: 0 };
  let open = 0;
  let overdue = 0;
  let awaiting = 0;
  let verified = 0;
  let cancelled = 0;
  let nextDue: NextDueTask | null = null;

  for (const task of tasks) {
    if (isOpenStatus(task.status)) {
      open += 1;
      openByStatus[task.status] += 1;
      if (task.dueAt) {
        if (task.dueAt.getTime() < now.getTime()) overdue += 1;
        if (!nextDue || task.dueAt.getTime() < nextDue.dueAt.getTime()) {
          nextDue = { id: task.id, title: task.title, dueAt: task.dueAt };
        }
      }
    } else if (task.status === "done") {
      awaiting += 1;
    } else if (task.status === "verified") {
      verified += 1;
    } else if (task.status === "cancelled") {
      cancelled += 1;
    }
  }

  const completed = awaiting + verified;
  const scale = tasks.length - cancelled;

  return {
    total: tasks.length,
    open,
    openByStatus,
    overdue,
    awaiting,
    verified,
    cancelled,
    completed,
    scale,
    rate: scale > 0 ? completed / scale : null,
    nextDue,
  };
}

/** "Quá hạn 2 ngày" / "Còn 3 giờ" for a real deadline. */
export function dueDistanceLabel(
  dueAt: Date,
  now: Date,
): { text: string; overdue: boolean } {
  const distance = formatDistanceStrict(dueAt, now, { locale: vi });
  const overdue = dueAt.getTime() < now.getTime();
  return { text: overdue ? `Quá hạn ${distance}` : `Còn ${distance}`, overdue };
}

/**
 * Two-letter initials from a Vietnamese name: family name + given name
 * ("Nguyễn Thị Nguyệt Hồng" → "NH"). Single-word names use the first two
 * letters.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts[parts.length - 1];
  if (parts.length === 1) return last.slice(0, 2).toLocaleUpperCase("vi");
  return (parts[0][0] + last[0]).toLocaleUpperCase("vi");
}

export type TaskFilter = {
  id: "assignee" | "status" | "due";
  value: string[];
};

/** `/tasks` reads the `filters` JSON param (nuqs `parseAsJson`). */
export function tasksHref(
  employeeId: string,
  extra: TaskFilter[] = [],
  sort?: string,
) {
  const filters: TaskFilter[] = [
    { id: "assignee", value: [employeeId] },
    ...extra,
  ];
  const params = new URLSearchParams({ filters: JSON.stringify(filters) });
  if (sort) params.set("sort", sort);
  return `/tasks?${params.toString()}`;
}

export function allTasksHref(employeeId: string) {
  return tasksHref(employeeId);
}

export function openTasksHref(employeeId: string) {
  return tasksHref(employeeId, [
    { id: "status", value: [...OPEN_TASK_STATUSES] },
  ]);
}

export function overdueTasksHref(employeeId: string) {
  return tasksHref(employeeId, [{ id: "due", value: ["overdue"] }], "due.asc");
}

export function statusTasksHref(employeeId: string, statuses: string[]) {
  return tasksHref(employeeId, [{ id: "status", value: statuses }]);
}
