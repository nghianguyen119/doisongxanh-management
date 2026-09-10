import Link from "next/link";
import { format } from "date-fns";
import { listTasks } from "@/lib/queries";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "@/lib/labels";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { taskStatus } from "@/db/schema";

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const tasks = await listTasks({ status });

  return (
    <div>
      <PageHeader
        title="Công việc"
        description="Tất cả công việc và trạng thái hiện tại."
        action={<LinkButton href="/tasks/new">+ Tạo công việc</LinkButton>}
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/tasks"
          className={`rounded-full border px-3 py-1 ${!status ? "border-primary bg-primary/10" : "border-border"}`}
        >
          Tất cả
        </Link>
        {taskStatus.enumValues.map((s) => (
          <Link
            key={s}
            href={`/tasks?status=${s}`}
            className={`rounded-full border px-3 py-1 ${status === s ? "border-primary bg-primary/10" : "border-border"}`}
          >
            {TASK_STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <EmptyState>Chưa có công việc nào.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Công việc</th>
                <th className="px-4 py-2 font-medium">Nhân viên</th>
                <th className="px-4 py-2 font-medium">Ưu tiên</th>
                <th className="px-4 py-2 font-medium">Hạn</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-background">
                  <td className="px-4 py-2">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{t.assignee?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {TASK_PRIORITY_LABEL[t.priority]}
                  </td>
                  <td className="px-4 py-2">
                    {t.dueAt ? format(t.dueAt, "dd/MM HH:mm") : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={TASK_STATUS_TONE[t.status]}>
                      {TASK_STATUS_LABEL[t.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
