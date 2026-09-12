import Link from "next/link";
import { ArrowUpRightIcon, ClipboardTextIcon, PlusIcon } from "@phosphor-icons/react/ssr";

import {
  OPEN_TASK_STATUSES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  taskRef,
} from "@/lib/labels";
import { formatVN, formatVNShort } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  dueDistanceLabel,
  type EmployeeStatus,
  type EmployeeTask,
  type EmployeeTaskPriority,
} from "./derive";

const PRIORITY_TONE: Record<EmployeeTaskPriority, string> = {
  urgent: "text-destructive",
  high: "text-amber-700 dark:text-amber-300",
  normal: "text-muted-foreground",
  low: "text-muted-foreground",
};

function TaskEmptyState({
  employeeStatus,
}: {
  employeeStatus: EmployeeStatus;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border-t border-border/70 px-5 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/5">
        <ClipboardTextIcon className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">Chưa giao công việc nào</p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {employeeStatus === "invited"
            ? "Nhân viên cần kết nối Zalo trước khi nhận thông báo. Tạo mã mời, sau đó giao việc đầu tiên."
            : employeeStatus === "inactive"
              ? "Nhân viên đang ngừng hoạt động. Chuyển sang Đang hoạt động để giao việc và nhắc hạn qua Zalo."
              : "Giao công việc đầu tiên để theo dõi tiến độ và nhắc hạn qua Zalo."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          size="sm"
          render={<Link href="/tasks/new" />}
          nativeButton={false}
        >
          <PlusIcon />
          Giao việc mới
        </Button>
        {employeeStatus === "invited" ? (
          <Button
            size="sm"
            variant="outline"
            render={<a href="#zalo" />}
            nativeButton={false}
          >
            Tạo mã mời Zalo
          </Button>
        ) : null}
        {employeeStatus === "inactive" ? (
          <Button
            size="sm"
            variant="outline"
            render={<a href="#trang-thai" />}
            nativeButton={false}
          >
            Đổi trạng thái
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The employee's assigned tasks as a calm ledger. Rows stay readable from
 * 390px (ref, title, compact meta line, status) up to the full table, where
 * priority and deadline get their own columns.
 */
export function TaskLedger({
  tasks,
  employeeStatus,
  allHref,
  now,
}: {
  tasks: EmployeeTask[];
  employeeStatus: EmployeeStatus;
  allHref: string;
  now: Date;
}) {
  const openCount = tasks.filter((task) =>
    OPEN_TASK_STATUSES.includes(task.status),
  ).length;

  return (
    <Card className="@container gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold">Công việc</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tasks.length === 0
              ? "Chưa có công việc nào được giao"
              : `${tasks.length} công việc · ${openCount} đang mở`}
          </p>
        </div>
        {tasks.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={allHref} />}
            nativeButton={false}
          >
            Xem trên danh sách
            <ArrowUpRightIcon data-icon="inline-end" />
          </Button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <TaskEmptyState employeeStatus={employeeStatus} />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-border/70 bg-muted/30 text-left">
              <th className="px-5 py-2 text-[11px] font-medium tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase">
                Công việc
              </th>
              <th className="hidden px-3 py-2 text-[11px] font-medium tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase @2xl:table-cell">
                Ưu tiên
              </th>
              <th className="hidden px-3 py-2 text-[11px] font-medium tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase @2xl:table-cell">
                Hạn
              </th>
              <th className="px-5 py-2 text-right text-[11px] font-medium tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase">
                Trạng thái
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const open = OPEN_TASK_STATUSES.includes(task.status);
              const due = task.dueAt
                ? dueDistanceLabel(task.dueAt, now)
                : null;
              const overdue = Boolean(open && due?.overdue);

              return (
                <tr
                  key={task.id}
                  className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
                >
                  <td className="px-5 py-3 align-middle">
                    <div className="flex min-w-0 flex-col items-start gap-0.5">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {taskRef(task.refNo)}
                      </span>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="font-medium tracking-tight underline-offset-4 hover:underline"
                      >
                        {task.title}
                      </Link>
                      {task.description ? (
                        <span className="mt-0.5 hidden max-w-xl text-xs leading-relaxed text-muted-foreground @2xl:line-clamp-1">
                          {task.description}
                        </span>
                      ) : null}
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground @2xl:hidden">
                        <span className={PRIORITY_TONE[task.priority]}>
                          {TASK_PRIORITY_LABEL[task.priority]}
                        </span>
                        <span aria-hidden>·</span>
                        <span
                          className={cn(overdue && "text-destructive font-medium")}
                        >
                          {task.dueAt
                            ? overdue
                              ? due?.text
                              : `Hạn ${formatVNShort(task.dueAt)}`
                            : "Không hạn"}
                        </span>
                      </span>
                    </div>
                  </td>

                  <td className="hidden px-3 py-3 align-middle whitespace-nowrap @2xl:table-cell">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        PRIORITY_TONE[task.priority],
                      )}
                    >
                      {TASK_PRIORITY_LABEL[task.priority]}
                    </span>
                  </td>

                  <td className="hidden px-3 py-3 align-middle whitespace-nowrap @2xl:table-cell">
                    {task.dueAt ? (
                      <div className="space-y-0.5">
                        <div
                          className={cn(
                            "text-xs tabular-nums",
                            overdue && "text-destructive font-medium",
                          )}
                        >
                          {formatVN(task.dueAt, "dd/MM HH:mm")}
                        </div>
                        {open && due ? (
                          <div className="text-[11px] text-muted-foreground">
                            {due.text}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Không hạn
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-3 text-right align-middle whitespace-nowrap">
                    <Badge className={TASK_STATUS_TONE[task.status]}>
                      {TASK_STATUS_LABEL[task.status]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
