"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarBlankIcon,
  PaperclipIcon,
  SpinnerIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatVNShort } from "@/lib/time"
import { TASK_PRIORITY_LABEL } from "@/lib/labels"
import { moveTaskAction } from "@/lib/actions/tasks"
import {
  KANBAN_COLUMNS,
  type KanbanColumnConfig,
  type KanbanPriority,
  type KanbanTask,
} from "@/components/kanban/columns"
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/components/ui/kanban"

const PRIORITY_STYLES: Record<KanbanPriority, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300",
  normal:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
  high: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
  urgent:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300",
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function TaskCard({
  task,
  isOverlay,
  disabled,
}: {
  task: KanbanTask
  isOverlay?: boolean
  disabled?: boolean
}) {
  const card = (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-lg border p-3 shadow-xs transition-shadow",
        !isOverlay && "hover:shadow-sm",
        isOverlay && "ring-primary/20 rotate-1 shadow-lg ring-2"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/tasks/${task.id}`}
          className="line-clamp-2 text-sm leading-snug font-medium hover:underline"
        >
          <span className="text-muted-foreground mr-1.5 font-mono text-[10px]">
            {task.ref}
          </span>
          {task.title}
        </Link>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-xs leading-4 font-medium",
            PRIORITY_STYLES[task.priority]
          )}
        >
          {TASK_PRIORITY_LABEL[task.priority]}
        </span>
      </div>

      {task.description && (
        <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="text-muted-foreground mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar className="size-5">
            <AvatarFallback className="text-[9px]">
              {task.assigneeName ? initialsOf(task.assigneeName) : "?"}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{task.assigneeName ?? "Chưa giao"}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {task.attachmentCount > 0 && (
            <span className="flex items-center gap-1">
              <PaperclipIcon className="size-3" />
              {task.attachmentCount}
            </span>
          )}
          {task.dueAt && (
            <span
              className={cn(
                "flex items-center gap-1 whitespace-nowrap tabular-nums",
                task.overdue && "text-destructive font-medium"
              )}
            >
              <CalendarBlankIcon className="size-3" />
              {formatVNShort(new Date(task.dueAt))}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <KanbanItem value={task.id} disabled={disabled}>
      {isOverlay ? card : <KanbanItemHandle>{card}</KanbanItemHandle>}
    </KanbanItem>
  )
}

function TaskColumn({
  config,
  tasks,
  isOverlay,
  disabled,
}: {
  config: KanbanColumnConfig
  tasks: KanbanTask[]
  isOverlay?: boolean
  disabled?: boolean
}) {
  return (
    <KanbanColumn value={config.id}>
      <div className="bg-muted/50 flex flex-col rounded-xl border p-2 shadow-xs">
        <div className={cn("mb-2 rounded-lg bg-linear-to-r p-3", config.accent)}>
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <span className={cn("size-2 rounded-full", config.dot)} />
            {config.eyebrow}
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{config.title}</h2>
            <Badge variant="outline">{tasks.length}</Badge>
          </div>
        </div>
        <KanbanColumnContent value={config.id} className="min-h-105 gap-2.5">
          {tasks.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-xs">
              Chưa có việc
            </p>
          )}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isOverlay={isOverlay}
              disabled={disabled}
            />
          ))}
        </KanbanColumnContent>
      </div>
    </KanbanColumn>
  )
}

/** The first task whose column changed between two board snapshots. */
function findMovedTask(
  previous: Record<string, KanbanTask[]>,
  next: Record<string, KanbanTask[]>
) {
  for (const [toColumn, tasks] of Object.entries(next)) {
    for (const task of tasks) {
      const fromColumn = Object.keys(previous).find((key) =>
        previous[key].some((candidate) => candidate.id === task.id)
      )
      if (fromColumn && fromColumn !== toColumn) {
        return { task, toColumn }
      }
    }
  }
  return null
}

/** Cheap identity of the server snapshot; used to re-sync after refresh. */
function fingerprint(columns: Record<string, KanbanTask[]>) {
  return KANBAN_COLUMNS.map(
    (column) =>
      `${column.id}:${(columns[column.id] ?? []).map((task) => task.id).join(",")}`
  ).join("|")
}

export function KanbanBoardView({
  initialColumns,
}: {
  initialColumns: Record<string, KanbanTask[]>
}) {
  const router = useRouter()
  const [columns, setColumns] = React.useState(initialColumns)
  const [isPending, startTransition] = React.useTransition()

  // Re-sync when a refreshed server snapshot arrives (e.g. another manager
  // moved something). Done during render, the React-recommended way, and
  // skipped while our own move is still in flight.
  const signature = React.useMemo(() => fingerprint(initialColumns), [initialColumns])
  const [seenSignature, setSeenSignature] = React.useState(signature)
  if (signature !== seenSignature && !isPending) {
    setSeenSignature(signature)
    setColumns(initialColumns)
  }

  function openTask(taskId: string) {
    router.push(`/tasks/${taskId}`)
  }

  function handleValueChange(next: Record<string, KanbanTask[]>) {
    const previous = columns
    const moved = findMovedTask(previous, next)
    setColumns(next)
    if (!moved) return

    const config = KANBAN_COLUMNS.find((column) => column.id === moved.toColumn)
    if (!config) return

    // An unassigned card has nobody to work on it, so it cannot move columns.
    // Say so straight away and offer a way to fix it.
    if (!moved.task.assigneeName) {
      setColumns(previous)
      toast.error("Cần giao việc cho nhân viên trước.", {
        action: {
          label: "Mở công việc",
          onClick: () => openTask(moved.task.id),
        },
      })
      return
    }

    // The call can reject (offline, DB error). Without this catch the rejection
    // bubbles out of the transition and replaces the whole page with the error
    // boundary, so revert the optimistic move and explain instead.
    startTransition(async () => {
      try {
        const result = await moveTaskAction({
          taskId: moved.task.id,
          to: config.status,
        })
        if (!result.ok) {
          setColumns(previous)
          toast.error(result.message, {
            action:
              result.reason === "invalid_assignee"
                ? {
                    label: "Mở công việc",
                    onClick: () => openTask(moved.task.id),
                  }
                : undefined,
          })
        }
      } catch {
        setColumns(previous)
        toast.error("Không thể lưu thay đổi. Vui lòng thử lại.")
      }
    })
  }

  return (
    <div className="relative space-y-4 overflow-x-auto pb-2">
      {isPending && (
        <div className="bg-background/90 text-muted-foreground pointer-events-none absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-sm">
          <SpinnerIcon className="size-3 animate-spin" />
          Đang lưu…
        </div>
      )}

      <Kanban
        value={columns}
        onValueChange={handleValueChange}
        getItemValue={(item) => item.id}
        className="w-full"
      >
        <KanbanBoard className="grid auto-rows-fr grid-cols-[repeat(5,minmax(15rem,1fr))] gap-3 sm:grid-cols-[repeat(5,minmax(15rem,1fr))]">
          {KANBAN_COLUMNS.map((config) => (
            <TaskColumn
              key={config.id}
              config={config}
              tasks={columns[config.id] ?? []}
              disabled={isPending}
            />
          ))}
        </KanbanBoard>
        <KanbanOverlay>
          {({ value, variant }) => {
            const activeValue = String(value)

            if (variant === "column") return null

            const task = Object.values(columns)
              .flat()
              .find((candidate) => candidate.id === activeValue)

            return task ? <TaskCard task={task} isOverlay /> : null
          }}
        </KanbanOverlay>
      </Kanban>
    </div>
  )
}
