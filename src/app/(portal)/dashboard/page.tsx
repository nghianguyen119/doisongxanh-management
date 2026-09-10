import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { getDashboardData } from "@/lib/queries";
import {
  TASK_EVENT_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "@/lib/labels";
import { Badge, Card, PageHeader } from "@/components/ui";
import { taskStatus } from "@/db/schema";

export default async function DashboardPage() {
  const { statusCounts, overdue, workload, recent } = await getDashboardData();

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description="Tình hình công việc toàn công ty."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {taskStatus.enumValues.map((s) => (
          <Card key={s} className="p-3 text-center">
            <div className="text-2xl font-semibold">{statusCounts[s] ?? 0}</div>
            <div className="mt-1 text-xs text-muted">
              {TASK_STATUS_LABEL[s]}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Quá hạn / cần chú ý</h2>
          {overdue.length === 0 ? (
            <p className="text-sm text-muted">Không có công việc quá hạn. 🎉</p>
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
                  <div className="text-xs text-muted">
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
            <p className="text-sm text-muted">Chưa có nhân viên hoạt động.</p>
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
              <span className="text-muted">
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
