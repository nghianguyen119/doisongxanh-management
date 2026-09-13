import Link from "next/link";
import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react/ssr";
import type { actorType } from "@/db/schema";
import { TASK_PRIORITY_LABEL, taskRef } from "@/lib/labels";
import { formatVN } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BentoCard, BentoHeader } from "./bento-card";
import { overdueDuration } from "./overdue-tile";
import type { TaskPriority } from "./status-colors";

export type BlockedIssue = {
  text: string | null;
  createdAt: Date;
  actorType: (typeof actorType.enumValues)[number];
  actorId: string | null;
};

export type DashboardBlockedTask = {
  id: string;
  refNo: number;
  title: string;
  priority: TaskPriority;
  dueAt: Date | null;
  assignee: { name: string } | null;
  blockedSince: Date;
  issue: BlockedIssue | null;
  imageCount: number;
};

const ALL_BLOCKED_HREF = `/tasks?${new URLSearchParams({
  filters: JSON.stringify([{ id: "status", value: ["blocked"] }]),
}).toString()}`;

const MAX_VISIBLE = 6;

const PRIORITY_TONE: Record<TaskPriority, string> = {
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted text-muted-foreground",
};

function PriorityTag({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        PRIORITY_TONE[priority],
      )}
    >
      {TASK_PRIORITY_LABEL[priority]}
    </span>
  );
}

function MetaLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function IssueQueueTile({
  blocked,
  className,
}: {
  blocked: DashboardBlockedTask[];
  className?: string;
}) {
  const now = new Date().getTime();
  const visible = blocked.slice(0, MAX_VISIBLE);
  const hidden = blocked.length - visible.length;

  return (
    <BentoCard className={className}>
      <div className="relative flex flex-1 flex-col p-6 @3xl/main:p-7">
        <BentoHeader
          label="Sự cố đang xử lý"
          aside={
            <div className="flex items-center gap-3">
              {blocked.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-red-500"
                  />
                  {blocked.length} sự cố
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  0 sự cố
                </span>
              )}
              <Link
                href={ALL_BLOCKED_HREF}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Xem tất cả
                <ArrowRightIcon weight="bold" className="size-3" />
              </Link>
            </div>
          }
        />

        {visible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center gap-3 py-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircleIcon weight="fill" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">
                Không có sự cố nào đang mở
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mọi công việc đang chạy suôn sẻ.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-3 flex flex-1 flex-col divide-y divide-border/60">
            {visible.map((task) => {
              const overdue =
                task.dueAt !== null && task.dueAt.getTime() < now;
              const duration = overdueDuration(task.blockedSince, now);
              const description = task.issue?.text;

              return (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="group relative flex flex-col gap-3 py-4 pl-4 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none @3xl/main:grid @3xl/main:grid-cols-[minmax(0,1fr)_7.5rem_6rem_auto] @3xl/main:items-center @3xl/main:gap-x-8 @3xl/main:pl-5 @3xl/main:pr-2"
                  >
                    <span
                      aria-hidden
                      className="absolute top-4 bottom-4 left-0 w-[3px] rounded-full bg-red-500/45 transition-colors group-hover:bg-red-500"
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {taskRef(task.refNo)}
                        </span>
                        <PriorityTag priority={task.priority} />
                        {task.imageCount > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            {task.imageCount} ảnh
                          </span>
                        )}
                        <span className="ml-auto text-xs font-semibold text-red-600 tabular-nums @3xl/main:hidden dark:text-red-400">
                          Bị chặn {duration}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm font-medium group-hover:underline">
                        {task.title}
                      </p>

                      {description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      ) : (
                        <>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Chưa có mô tả sự cố
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/75">
                            Sự cố được đánh dấu trên bảng
                          </p>
                        </>
                      )}

                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate">
                          {task.assignee?.name ?? "Chưa giao"}
                        </span>
                        {task.dueAt && (
                          <span className="flex shrink-0 items-center gap-1.5 @3xl/main:hidden">
                            <span aria-hidden>·</span>
                            <span
                              className={cn(
                                "tabular-nums",
                                overdue &&
                                  "font-semibold text-red-600 dark:text-red-400",
                              )}
                            >
                              Hạn {formatVN(task.dueAt, "dd/MM")}
                            </span>
                          </span>
                        )}
                        <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-primary @3xl/main:hidden">
                          Xử lý
                          <ArrowRightIcon weight="bold" className="size-3.5" />
                        </span>
                      </div>
                    </div>

                    <div className="hidden @3xl/main:block">
                      <MetaLabel>Bị chặn</MetaLabel>
                      <p className="mt-1 text-sm font-semibold text-red-600 tabular-nums dark:text-red-400">
                        {duration}
                      </p>
                    </div>

                    <div className="hidden @3xl/main:block">
                      <MetaLabel>Hạn</MetaLabel>
                      <p
                        className={cn(
                          "mt-1 text-sm tabular-nums",
                          overdue
                            ? "font-semibold text-red-600 dark:text-red-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {task.dueAt ? formatVN(task.dueAt, "dd/MM") : "—"}
                      </p>
                    </div>

                    <span className="hidden items-center justify-end gap-1 text-sm font-medium text-primary @3xl/main:inline-flex">
                      Xử lý
                      <ArrowRightIcon
                        weight="bold"
                        className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {hidden > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Còn{" "}
            <Link
              href={ALL_BLOCKED_HREF}
              className="font-medium text-primary hover:underline"
            >
              {hidden} sự cố khác
            </Link>
            .
          </p>
        )}
      </div>
    </BentoCard>
  );
}
