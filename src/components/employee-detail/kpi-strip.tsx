import Link from "next/link";
import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";
import {
  overdueTasksHref,
  openTasksHref,
  statusTasksHref,
  type EmployeeStats,
} from "./derive";

function StatusMix({ stats }: { stats: EmployeeStats }) {
  const segments = [
    {
      label: "Đang mở",
      count: stats.open,
      className: "bg-foreground/35",
    },
    {
      label: "Chờ xác nhận",
      count: stats.awaiting,
      className: "bg-amber-500/80",
    },
    {
      label: "Đã xác nhận",
      count: stats.verified,
      className: "bg-emerald-500/80",
    },
    {
      label: "Đã huỷ",
      count: stats.cancelled,
      className: "bg-muted-foreground/25",
    },
  ].filter((segment) => segment.count > 0);

  if (segments.length === 0) return null;

  return (
    <div className="min-w-0 space-y-1.5 @2xl:w-64">
      <span
        aria-hidden
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        {segments.map((segment) => (
          <span
            key={segment.label}
            title={`${segment.label}: ${segment.count}`}
            className={segment.className}
            style={{ width: `${(segment.count / stats.total) * 100}%` }}
          />
        ))}
      </span>
      <span className="block text-[11px] text-muted-foreground">
        {segments
          .map((segment) => `${segment.count} ${segment.label.toLowerCase()}`)
          .join(" · ")}
      </span>
    </div>
  );
}

type KpiCell = {
  label: string;
  value: string;
  caption: string;
  href: string;
  valueTone?: string;
  meter?: number;
  span?: boolean;
};

function Kpi({ cell }: { cell: KpiCell }) {
  return (
    <Link
      href={cell.href}
      className={cn(
        "group flex flex-col gap-1 bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
        cell.span && "col-span-2 @xl:col-span-1",
      )}
    >
      <span className="flex items-center justify-between gap-2 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {cell.label}
        <ArrowUpRightIcon
          aria-hidden
          className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70"
        />
      </span>
      <span
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums",
          cell.valueTone,
        )}
      >
        {cell.value}
      </span>
      {cell.meter !== undefined && (
        <span
          aria-hidden
          className="mt-0.5 block h-1 w-full max-w-44 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full bg-foreground/40"
            style={{ width: `${Math.round(cell.meter * 100)}%` }}
          />
        </span>
      )}
      <span className="text-xs leading-relaxed text-muted-foreground">
        {cell.caption}
      </span>
    </Link>
  );
}

/**
 * Five numbers, each one derived from the assigned tasks and linked to the
 * matching filtered task list. Zero is shown as plainly as a non-zero value.
 */
export function KpiStrip({
  employeeId,
  stats,
}: {
  employeeId: string;
  stats: EmployeeStats;
}) {
  const openParts = [
    stats.openByStatus.in_progress > 0
      ? `${stats.openByStatus.in_progress} đang làm`
      : null,
    stats.openByStatus.assigned > 0
      ? `${stats.openByStatus.assigned} cần làm`
      : null,
    stats.openByStatus.blocked > 0
      ? `${stats.openByStatus.blocked} gặp sự cố`
      : null,
  ].filter(Boolean);

  const cells: KpiCell[] = [
    {
      label: "Đang mở",
      value: String(stats.open),
      caption: openParts.length
        ? openParts.join(" · ")
        : "Không có việc nào đang mở",
      href: openTasksHref(employeeId),
    },
    {
      label: "Quá hạn",
      value: String(stats.overdue),
      caption:
        stats.overdue > 0
          ? "Việc mở đã qua hạn chót"
          : "Mọi việc đều trong hạn",
      href: overdueTasksHref(employeeId),
      valueTone: stats.overdue > 0 ? "text-destructive" : undefined,
    },
    {
      label: "Chờ xác nhận",
      value: String(stats.awaiting),
      caption:
        stats.awaiting > 0
          ? "Nhân viên đã báo hoàn thành"
          : "Không có việc chờ duyệt",
      href: statusTasksHref(employeeId, ["done"]),
      valueTone:
        stats.awaiting > 0 ? "text-amber-700 dark:text-amber-300" : undefined,
    },
    {
      label: "Đã xác nhận",
      value: String(stats.verified),
      caption:
        stats.verified > 0
          ? "Đã kiểm tra và xác nhận"
          : "Chưa có việc nào được duyệt",
      href: statusTasksHref(employeeId, ["verified"]),
      valueTone:
        stats.verified > 0
          ? "text-emerald-700 dark:text-emerald-400"
          : undefined,
    },
    {
      label: "Tỉ lệ hoàn thành",
      value: stats.rate === null ? "—" : `${Math.round(stats.rate * 100)}%`,
      caption:
        stats.scale > 0
          ? `${stats.completed}/${stats.scale} việc đã hoàn thành`
          : "Chưa có việc để tính",
      href: statusTasksHref(employeeId, ["done", "verified"]),
      meter: stats.rate ?? 0,
      span: true,
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 shadow-xs dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Tổng quan công việc
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total > 0
              ? `Theo dõi ${stats.total} công việc đã giao cho nhân viên`
              : "Chưa có công việc nào được giao"}
          </p>
        </div>
        {stats.total > 0 && <StatusMix stats={stats} />}
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-border/70 bg-border/70 @xl:grid-cols-5">
        {cells.map((cell) => (
          <Kpi key={cell.label} cell={cell} />
        ))}
      </div>
    </section>
  );
}
