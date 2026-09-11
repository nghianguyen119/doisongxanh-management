import type { taskPriority, taskStatus } from "@/db/schema"
import type { TaskStatus } from "@/lib/workflow/task-status"

export type KanbanPriority = (typeof taskPriority.enumValues)[number]

export interface KanbanTask {
  id: string
  title: string
  description: string | null
  /** status groups two statuses into the "Đang làm" column */
  status: TaskStatus
  priority: KanbanPriority
  dueAt: string | null
  overdue: boolean
  assigneeName: string | null
  attachmentCount: number
}

export interface KanbanColumnConfig {
  id: string
  title: string
  eyebrow: string
  /** status a card gets when dropped into this column */
  status: (typeof taskStatus.enumValues)[number]
  /** statuses that land in this column when reading from the DB */
  statuses: TaskStatus[]
  accent: string
  dot: string
}

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "new",
    title: "Mới tạo",
    eyebrow: "Chưa giao",
    status: "new",
    statuses: ["new"],
    accent: "from-slate-500/20 via-slate-500/5 to-transparent",
    dot: "bg-slate-400",
  },
  {
    id: "assigned",
    title: "Đã giao",
    eyebrow: "Chờ nhận",
    status: "assigned",
    statuses: ["assigned"],
    accent: "from-blue-500/20 via-blue-500/5 to-transparent",
    dot: "bg-blue-500",
  },
  {
    id: "inProgress",
    title: "Đang làm",
    eyebrow: "Thực hiện",
    status: "in_progress",
    statuses: ["accepted", "in_progress"],
    accent:
      "from-amber-600/20 via-amber-600/5 dark:from-amber-400/20 dark:via-amber-400/5 to-transparent",
    dot: "bg-amber-500",
  },
  {
    id: "blocked",
    title: "Sự cố",
    eyebrow: "Cần hỗ trợ",
    status: "blocked",
    statuses: ["blocked"],
    accent: "from-rose-500/20 via-rose-500/5 to-transparent",
    dot: "bg-rose-500",
  },
  {
    id: "done",
    title: "Chờ xác nhận",
    eyebrow: "Kiểm tra",
    status: "done",
    statuses: ["done"],
    accent: "from-violet-500/20 via-violet-500/5 to-transparent",
    dot: "bg-violet-500",
  },
  {
    id: "verified",
    title: "Hoàn thành",
    eyebrow: "Đã xác nhận",
    status: "verified",
    statuses: ["verified"],
    accent:
      "from-green-600/20 via-green-600/5 dark:from-green-400/20 dark:via-green-400/5 to-transparent",
    dot: "bg-green-600 dark:bg-green-400",
  },
]
