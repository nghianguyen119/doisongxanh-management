import type { taskPriority } from "@/db/schema";
import type { TaskStatus } from "@/lib/workflow/task-status";

export type TaskPriority = (typeof taskPriority.enumValues)[number];

/**
 * Solid hues that echo `TASK_STATUS_TONE` (blue / amber / red / emerald /
 * green / gray) for contexts that cannot use Tailwind classes: recharts
 * `fill`, inline SVG strokes, etc. Values mirror Tailwind's 500/600 palette
 * so the charts keep working in light and dark mode.
 */
export const STATUS_CHART_COLOR: Record<TaskStatus, string> = {
  assigned: "oklch(62.3% 0.214 259.815)", // blue-500
  in_progress: "oklch(76.9% 0.188 70.08)", // amber-500
  blocked: "oklch(63.7% 0.237 25.331)", // red-500
  done: "oklch(69.6% 0.17 162.48)", // emerald-500
  verified: "oklch(62.7% 0.194 149.214)", // green-600
  cancelled: "oklch(55.1% 0.027 264.364)", // gray-500
};

export const STATUS_DOT_CLASS: Record<TaskStatus, string> = {
  assigned: "bg-blue-500",
  in_progress: "bg-amber-500",
  blocked: "bg-red-500",
  done: "bg-emerald-500",
  verified: "bg-green-600",
  cancelled: "bg-gray-400",
};

export const STATUS_TEXT_CLASS: Record<TaskStatus, string> = {
  assigned: "text-blue-600 dark:text-blue-400",
  in_progress: "text-amber-600 dark:text-amber-400",
  blocked: "text-red-600 dark:text-red-400",
  done: "text-emerald-600 dark:text-emerald-400",
  verified: "text-green-700 dark:text-green-400",
  cancelled: "text-gray-500 dark:text-gray-400",
};

const isTaskStatus = (value: string): value is TaskStatus =>
  value in STATUS_DOT_CLASS;

export function statusFromPayload(
  payload: Record<string, unknown>,
): TaskStatus | null {
  const to = payload.to;
  return typeof to === "string" && isTaskStatus(to) ? to : null;
}
