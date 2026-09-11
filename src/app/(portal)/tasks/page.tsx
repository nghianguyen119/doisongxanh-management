import Link from "next/link";
import { formatVNShort } from "@/lib/time";
import {
  listActiveEmployeesForSelect,
  listTasks,
  parseTaskFilters,
} from "@/lib/queries";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "@/lib/labels";
import { LinkButton, PageHeader } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { taskStatus } from "@/db/schema";

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const sp = await searchParams;
  // Unvalidated values would reach a Postgres enum/uuid column and 500.
  const filters = parseTaskFilters(sp);
  const [tasks, employees] = await Promise.all([
    listTasks(filters),
    listActiveEmployeesForSelect(),
  ]);
  const { status, assigneeId } = filters;

  const withFilter = (next: Partial<typeof filters>) => {
    const q = new URLSearchParams();
    const merged = { ...filters, ...next };
    if (merged.status) q.set("status", merged.status);
    if (merged.assigneeId) q.set("assigneeId", merged.assigneeId);
    const s = q.toString();
    return s ? `/tasks?${s}` : "/tasks";
  };

  return (
    <div>
      <PageHeader
        title="Công việc"
        description="Tất cả công việc và trạng thái hiện tại."
        action={<LinkButton href="/tasks/new">+ Tạo công việc</LinkButton>}
      />

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <Link
          href={withFilter({ status: undefined })}
          className={`rounded-full border px-3 py-1 ${!status ? "border-primary bg-primary/10" : "border-border"}`}
        >
          Tất cả
        </Link>
        {taskStatus.enumValues.map((s) => (
          <Link
            key={s}
            href={withFilter({ status: s })}
            className={`rounded-full border px-3 py-1 ${status === s ? "border-primary bg-primary/10" : "border-border"}`}
          >
            {TASK_STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href={withFilter({ assigneeId: undefined })}
          className={`rounded-full border px-3 py-1 ${!assigneeId ? "border-primary bg-primary/10" : "border-border"}`}
        >
          Mọi nhân viên
        </Link>
        {employees.map((e) => (
          <Link
            key={e.id}
            href={withFilter({ assigneeId: e.id })}
            className={`rounded-full border px-3 py-1 ${assigneeId === e.id ? "border-primary bg-primary/10" : "border-border"}`}
          >
            {e.name}
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <Empty className="border p-10">
          <EmptyHeader>
            <EmptyTitle>Chưa có công việc nào.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
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
                    {t.dueAt ? formatVNShort(t.dueAt) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={TASK_STATUS_TONE[t.status]}>
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
