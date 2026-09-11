import Link from "next/link";
import { PlusIcon } from "@phosphor-icons/react/ssr";
import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsJson,
  parseAsString,
} from "nuqs/server";
import { formatVNShort } from "@/lib/time";
import { listActiveEmployeesForSelect, listTasksPage } from "@/lib/queries";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "@/lib/labels";
import { isClosed } from "@/lib/workflow/task-status";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { TasksTable, type TaskRow } from "@/components/tasks-table";
import { isExtendedColumnFilterArray } from "@/lib/data-table";
import type { ExtendedColumnFilter } from "@/types/data-table";

const searchParamsCache = createSearchParamsCache({
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  sort: parseAsString,
  filters: parseAsJson<ExtendedColumnFilter[]>((value) =>
    isExtendedColumnFilterArray(value) ? value : null,
  ),
});

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const params = searchParamsCache.parse(await searchParams);
  const [{ data, pageCount }, employees] = await Promise.all([
    listTasksPage(params),
    listActiveEmployeesForSelect(),
  ]);

  const rows: TaskRow[] = data.map((t) => {
    const closed = isClosed(t.status);
    return {
      id: t.id,
      title: t.title,
      assignee: t.assignee?.name ?? "Chưa giao",
      priority: TASK_PRIORITY_LABEL[t.priority],
      due: t.dueAt ? formatVNShort(t.dueAt) : "—",
      status: t.status,
      statusLabel: TASK_STATUS_LABEL[t.status],
      statusTone: TASK_STATUS_TONE[t.status],
      closed,
      overdue: t.overdue && !closed,
    };
  });

  return (
    <div>
      <PageHeader
        title="Công việc"
        description="Tất cả công việc và trạng thái hiện tại."
        action={
          <Button render={<Link href="/tasks/new" />} nativeButton={false}>
            <PlusIcon />
            Tạo công việc
          </Button>
        }
      />

      <TasksTable
        data={rows}
        pageCount={pageCount}
        assignees={employees.map((e) => ({ value: e.id, label: e.name }))}
      />
    </div>
  );
}
