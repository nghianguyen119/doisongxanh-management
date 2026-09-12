import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { OPEN_TASK_STATUSES } from "@/lib/labels";
import { APP_TZ, formatVN } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/workflow/task-status";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { BentoCard } from "./bento-card";

const WEEKDAY_VI = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function greetingFor(hour: number) {
  if (hour < 12) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** `/tasks` reads the `filters` JSON param (nuqs `parseAsJson`). */
function tasksHref(filters: ExtendedColumnFilter[], sort?: string) {
  const params = new URLSearchParams({ filters: JSON.stringify(filters) });
  if (sort) params.set("sort", sort);
  return `/tasks?${params.toString()}`;
}

function CompletionRing({
  ratio,
  percent,
}: {
  ratio: number;
  percent: number;
}) {
  const size = 176;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - Math.min(1, Math.max(0, ratio)));

  return (
    <div className="relative size-40 shrink-0 @2xl/main:size-44">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full -rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient
            id="dashboard-completion-ring"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="var(--chart-2)" />
            <stop offset="100%" stopColor="var(--chart-4)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="url(#dashboard-completion-ring)"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-semibold tracking-tight tabular-nums">
          {percent}%
        </span>
        <span className="mt-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          hoàn thành
        </span>
      </div>
    </div>
  );
}

export function HeroTile({
  counts,
  overdueCount,
  className,
}: {
  counts: Record<TaskStatus, number>;
  overdueCount: number;
  className?: string;
}) {
  const now = new Date();
  const vnNow = new TZDate(now, APP_TZ);
  const open = OPEN_TASK_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const completed = counts.done + counts.verified;
  const scale = total - counts.cancelled;
  const rate = scale > 0 ? completed / scale : 0;

  const summary =
    open === 0
      ? "Toàn công ty đã xử lý xong mọi việc — không còn công việc nào đang mở."
      : overdueCount > 0
        ? `Toàn công ty đang mở ${open} công việc, trong đó ${overdueCount} việc đã quá hạn cần xử lý ngay${
            counts.done > 0 ? `, ${counts.done} việc chờ xác nhận` : ""
          }.`
        : `Toàn công ty đang mở ${open} công việc, tất cả đều trong hạn${
            counts.done > 0 ? `, ${counts.done} việc chờ xác nhận` : ""
          }.`;

  const stats: {
    label: string;
    value: number;
    tone: string;
    href: string;
  }[] = [
    {
      label: "Đang mở",
      value: open,
      tone: "text-foreground",
      href: tasksHref([{ id: "status", value: OPEN_TASK_STATUSES }]),
    },
    {
      label: "Quá hạn",
      value: overdueCount,
      tone:
        overdueCount > 0
          ? "text-red-600 dark:text-red-400"
          : "text-foreground",
      href: tasksHref([{ id: "due", value: ["overdue"] }], "due.asc"),
    },
    {
      label: "Chờ xác nhận",
      value: counts.done,
      tone:
        counts.done > 0
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground",
      href: tasksHref([{ id: "status", value: ["done"] }]),
    },
    {
      label: "Đã xác nhận",
      value: counts.verified,
      tone: "text-emerald-600 dark:text-emerald-400",
      href: tasksHref([{ id: "status", value: ["verified"] }]),
    },
  ];

  return (
    <BentoCard className={className}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -right-24 size-72 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />
        <div className="absolute -bottom-36 -left-24 size-72 rounded-full bg-chart-1/10 blur-3xl dark:bg-chart-1/5" />
      </div>

      <div className="relative flex flex-1 flex-col gap-8 p-6 @3xl/main:p-8">
        <div className="flex flex-col gap-7 @2xl/main:flex-row @2xl/main:items-center @2xl/main:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              {WEEKDAY_VI[vnNow.getDay()]} · {formatVN(now, "dd/MM/yyyy")}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight @3xl/main:text-3xl">
              {greetingFor(vnNow.getHours())}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {summary}
            </p>
          </div>

          <CompletionRing ratio={rate} percent={Math.round(rate * 100)} />
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border/70 pt-5 @xl/main:grid-cols-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="group rounded-xl p-2 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span
                className={cn(
                  "block text-2xl font-semibold tracking-tight tabular-nums",
                  stat.tone,
                )}
              >
                {stat.value}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {stat.label}
                <ArrowRightIcon
                  weight="bold"
                  className="size-3 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </BentoCard>
  );
}
