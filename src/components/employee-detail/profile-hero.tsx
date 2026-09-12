import Link from "next/link";
import {
  CalendarBlankIcon,
  LinkBreakIcon,
  LinkSimpleIcon,
  ListChecksIcon,
  PhoneIcon,
  PlusIcon,
} from "@phosphor-icons/react/ssr";

import {
  EMPLOYEE_STATUS_LABEL,
  EMPLOYEE_STATUS_TONE,
} from "@/lib/labels";
import { formatVNDate, formatVN } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dueDistanceLabel,
  initials,
  openTasksHref,
  type EmployeeStats,
  type EmployeeStatus,
} from "./derive";

export type HeroEmployee = {
  id: string;
  name: string;
  phone: string | null;
  position: string | null;
  status: EmployeeStatus;
  zaloUserId: string | null;
  zaloDisplayName: string | null;
  createdAt: Date;
};

function MetaItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function NextDeadline({
  task,
  now,
  className,
}: {
  task: EmployeeStats["nextDue"];
  now: Date;
  className?: string;
}) {
  const due = task ? dueDistanceLabel(task.dueAt, now) : null;

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Hạn gần nhất
      </p>
      {task && due ? (
        <>
          <Link
            href={`/tasks/${task.id}`}
            title={task.title}
            className="mt-1.5 block truncate text-sm font-medium underline-offset-4 hover:underline"
          >
            {task.title}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {formatVN(task.dueAt, "dd/MM HH:mm")}
            <span aria-hidden> · </span>
            <span className={cn(due.overdue && "text-destructive")}>
              {due.text}
            </span>
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Không có việc nào đặt hạn.
        </p>
      )}
    </div>
  );
}

/**
 * Identity first: who this person is, how to reach them, and the handful of
 * management actions that make sense from their profile.
 */
export function ProfileHero({
  employee,
  stats,
  now,
}: {
  employee: HeroEmployee;
  stats: EmployeeStats;
  now: Date;
}) {
  return (
    <section className="rounded-2xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 shadow-xs dark:shadow-none">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-5 p-5 @3xl:grid-cols-[auto_minmax(0,1fr)_224px] @xl:p-6">
        <div
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl bg-muted text-lg font-semibold tracking-tight text-foreground/60 ring-1 ring-foreground/5 select-none @xl:size-20 @xl:text-2xl"
        >
          {initials(employee.name)}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-pretty @xl:text-2xl">
              {employee.name}
            </h1>
            <Badge className={EMPLOYEE_STATUS_TONE[employee.status]}>
              {EMPLOYEE_STATUS_LABEL[employee.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {employee.position ?? "Chưa cập nhật vị trí"}
          </p>

          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            <MetaItem icon={<PhoneIcon />}>
              {employee.phone ? (
                <a
                  href={`tel:${employee.phone}`}
                  className="hover:underline"
                  title="Gọi điện"
                >
                  {employee.phone}
                </a>
              ) : (
                <span className="text-muted-foreground">Chưa có SĐT</span>
              )}
            </MetaItem>

            <MetaItem
              icon={
                employee.zaloUserId ? (
                  <LinkSimpleIcon className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <LinkBreakIcon />
                )
              }
            >
              {employee.zaloUserId ? (
                employee.zaloDisplayName ? (
                  <span>
                    Zalo{" "}
                    <span className="font-medium">
                      {employee.zaloDisplayName}
                    </span>
                  </span>
                ) : (
                  <span>Đã kết nối Zalo</span>
                )
              ) : (
                <span className="text-muted-foreground">Chưa kết nối Zalo</span>
              )}
            </MetaItem>

            <MetaItem icon={<CalendarBlankIcon />}>
              Tham gia {formatVNDate(employee.createdAt)}
            </MetaItem>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button render={<Link href="/tasks/new" />} nativeButton={false}>
              <PlusIcon />
              Giao việc mới
            </Button>
            {stats.open > 0 ? (
              <Button
                variant="outline"
                render={<Link href={openTasksHref(employee.id)} />}
                nativeButton={false}
              >
                <ListChecksIcon />
                {stats.open} việc đang mở
              </Button>
            ) : null}
            {employee.phone ? (
              <Button
                variant="ghost"
                render={<a href={`tel:${employee.phone}`} />}
                nativeButton={false}
              >
                <PhoneIcon />
                Gọi điện
              </Button>
            ) : null}
            {!employee.zaloUserId ? (
              <Button
                variant="ghost"
                render={<a href="#zalo" />}
                nativeButton={false}
              >
                <LinkSimpleIcon />
                Kết nối Zalo
              </Button>
            ) : null}
          </div>
        </div>

        <NextDeadline
          task={stats.nextDue}
          now={now}
          className="col-span-2 border-t border-border/70 pt-4 @3xl:col-span-1 @3xl:border-t-0 @3xl:border-l @3xl:pt-0 @3xl:pl-6"
        />
      </div>
    </section>
  );
}
