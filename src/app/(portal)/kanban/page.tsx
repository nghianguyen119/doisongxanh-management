import Link from "next/link"
import { PlusIcon } from "@phosphor-icons/react/ssr"

import { PageHeader } from "@/components/ui"
import { Button } from "@/components/ui/button"
import { KanbanBoardView } from "@/components/kanban/shadcn-studio/kanban-board"
import { KANBAN_COLUMNS } from "@/components/kanban/columns"
import { getKanbanTasks } from "@/lib/queries"

export default async function KanbanPage() {
  const tasks = await getKanbanTasks()
  const initialColumns = Object.fromEntries(
    KANBAN_COLUMNS.map((column) => [
      column.id,
      tasks.filter((task) => column.statuses.includes(task.status)),
    ])
  )

  return (
    <div>
      <PageHeader
        title="Bảng tiến độ"
        description="Theo dõi công việc theo từng bước xử lý. Kéo thả để cập nhật trạng thái."
        action={
          <Button render={<Link href="/tasks/new" />} nativeButton={false}>
            <PlusIcon />
            Tạo công việc
          </Button>
        }
      />
      <KanbanBoardView initialColumns={initialColumns} />
    </div>
  )
}
