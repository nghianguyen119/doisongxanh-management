import Link from "next/link";
import { CheckCircleIcon } from "@phosphor-icons/react/ssr";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  taskRef,
} from "@/lib/labels";
import { formatVN } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/workflow/task-status";
import { BentoCard, BentoHeader } from "./bento-card";
import type { TaskPriority } from "./status-colors";

export type OverdueTask = {
  id: string;
  refNo: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
  assignee: { name: string } | null;
};

const MAX_VISIBLE = 8;

/**
 * How long a task has been overdue, as plain millisecond arithmetic. Kept
 * deliberately free of date-fns so it cannot pick up the server timezone —
 * both sides of the subtraction are absolute instants.
 */
export function overdueDuration(dueAt: Date, now: number): string {
  const minutes = Math.floor(Math.max(0, now - dueAt.getTime()) / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ`;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (days < 30) {
    return restHours > 0 ? `${days} ngày ${restHours} giờ` : `${days} ngày`;
  }
  return `${Math.floor(days / 30)} tháng`;
}

function PriorityTag({ priority }: { priority: TaskPriority }) {
  if (priority !== "urgent" && priority !== "high") return null;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        priority === "urgent"
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      {TASK_PRIORITY_LABEL[priority]}
    </span>
  );
}

export function OverdueTile({
  overdue,
  className,
}: {
  overdue: OverdueTask[];
  className?: string;
}) {
  const now = new Date().getTime();
  const visible = overdue.slice(0, MAX_VISIBLE);
  const hidden = overdue.length - visible.length;

  return (
    <BentoCard className={className}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 size-56 rounded-full bg-red-500/5 blur-3xl"
      />

      <div className="relative flex flex-1 flex-col p-6 @3xl/main:p-7">
        <BentoHeader
          label="Quá hạn cần xử lý"
          aside={
            overdue.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-red-500"
                />
                {overdue.length} việc
              </span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">
                Trong tầm kiểm soát
              </span>
            )
          }
        />

        {visible.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircleIcon weight="fill" className="size-6" />
            </span>
            <div>
              <p className="text-sm font-medium">
                Không có công việc quá hạn
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Mọi việc đang được xử lý đúng hạn.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-4 flex flex-1 flex-col divide-y divide-border/60">
            {visible.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="group flex items-start gap-3.5 -mx-2 rounded-2xl px-2 py-3.5 transition-colors hover:bg-muted/50"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500 ring-4 ring-red-500/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {taskRef(task.refNo)}
                      </span>
                      <PriorityTag priority={task.priority} />
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          TASK_STATUS_TONE[task.status],
                        )}
                      >
                        {TASK_STATUS_LABEL[task.status]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium group-hover:underline">
                      {task.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {task.assignee?.name ?? "Chưa giao"}
                      {task.dueAt
                        ? ` · Hạn ${formatVN(task.dueAt, "HH:mm dd/MM")}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5 text-right">
                    <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                      Quá hạn
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-red-600 tabular-nums dark:text-red-400">
                      {task.dueAt ? overdueDuration(task.dueAt, now) : "—"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hidden > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Còn{" "}
            <Link href="/tasks" className="font-medium text-primary hover:underline">
              {hidden} việc quá hạn khác
            </Link>
            .
          </p>
        )}
      </div>
    </BentoCard>
  );
}
