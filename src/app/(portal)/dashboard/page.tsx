import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { getDashboardData } from "@/lib/queries";
import {
  OPEN_TASK_STATUSES,
  TASK_EVENT_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "@/lib/labels";
import { Badge, Card, PageHeader } from "@/components/ui";
import { SectionCards } from "@/components/section-cards";

export default async function DashboardPage() {
  const { statusCounts, overdue, workload, recent } = await getDashboardData();

  const stats = {
    open: OPEN_TASK_STATUSES.reduce((n, s) => n + (statusCounts[s] ?? 0), 0),
    overdue: overdue.length,
    awaitingVerification: statusCounts["done"] ?? 0,
    verified: statusCounts["verified"] ?? 0,
  };

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description="Tình hình công việc toàn công ty."
      />

      <div className="mb-6">
        <SectionCards stats={stats} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Quá hạn / cần chú ý</h2>
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có công việc quá hạn. 🎉</p>
          ) : (
            <ul className="divide-y divide-border">
              {overdue.map((t) => (
                <li key={t.id} className="py-2 text-sm">
                  <Link
                    href={`/tasks/${t.id}`}
                    className="font-medium hover:underline"
                  >
                    {t.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {t.assignee?.name ?? "Chưa giao"} ·{" "}
                    <Badge tone={TASK_STATUS_TONE[t.status]}>
                      {TASK_STATUS_LABEL[t.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Khối lượng theo nhân viên</h2>
          {workload.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có nhân viên hoạt động.</p>
          ) : (
            <ul className="divide-y divide-border">
              {workload.map((w) => (
                <li
                  key={w.employeeId}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <Link
                    href={`/employees/${w.employeeId}`}
                    className="hover:underline"
                  >
                    {w.name}
                  </Link>
                  <span className="font-medium">{Number(w.open)} việc mở</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold">Hoạt động gần đây</h2>
        <ul className="divide-y divide-border">
          {recent.map((e) => (
            <li key={e.id} className="py-2 text-sm">
              <span className="text-muted-foreground">
                {formatDistanceToNow(e.createdAt, {
                  addSuffix: true,
                  locale: vi,
                })}
              </span>{" "}
              — {TASK_EVENT_LABEL[e.type]} ·{" "}
              <Link
                href={`/tasks/${e.taskId}`}
                className="font-medium hover:underline"
              >
                {e.taskTitle}
              </Link>
              {typeof (e.payload as { to?: string }).to === "string" && (
                <> → {TASK_STATUS_LABEL[
                  (e.payload as { to: keyof typeof TASK_STATUS_LABEL }).to
                ] ?? (e.payload as { to: string }).to}</>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
