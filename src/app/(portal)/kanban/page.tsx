import { PageHeader } from "@/components/ui"
import { ShadcnStudioKanbanBoard } from "@/components/kanban/shadcn-studio/kanban-board"

export default function KanbanPage() {
  return (
    <div>
      <PageHeader
        title="Kanban"
        description="Bảng Kanban với dữ liệu mẫu."
      />
      <ShadcnStudioKanbanBoard />
    </div>
  )
}
