"use client"

import type { ComponentProps } from "react"
import { useState } from "react"
import {
  CalendarBlankIcon,
  ChatCircleIcon,
  DotsSixVerticalIcon,
  PaperclipIcon,
} from "@phosphor-icons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  COLUMN_TITLES,
  INITIAL_COLUMNS,
  type MockTask,
  type TaskPriority,
} from "@/components/kanban/mock-data"
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/components/ui/kanban"

const COLUMN_META: Record<
  string,
  { eyebrow: string; accent: string; dot: string }
> = {
  backlog: {
    eyebrow: "Ideas",
    accent: "from-slate-500/20 via-slate-500/5 to-transparent",
    dot: "bg-slate-400",
  },
  todo: {
    eyebrow: "Next up",
    accent: "from-blue-500/20 via-blue-500/5 to-transparent",
    dot: "bg-blue-500",
  },
  inProgress: {
    eyebrow: "Building",
    accent:
      "from-amber-600/20 via-amber-600/5 dark:from-amber-400/20 dark:via-amber-400/5 to-transparent",
    dot: "bg-amber-500",
  },
  review: {
    eyebrow: "Validate",
    accent: "from-violet-500/20 via-violet-500/5 to-transparent",
    dot: "bg-violet-500",
  },
  done: {
    eyebrow: "Shipped",
    accent:
      "from-green-600/20 via-green-600/5 dark:from-green-400/20 dark:via-green-400/5 to-transparent",
    dot: "bg-green-600 dark:bg-green-400",
  },
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300",
}

interface TaskCardProps extends Omit<
  ComponentProps<typeof KanbanItem>,
  "value" | "children"
> {
  task: MockTask
  isOverlay?: boolean
}

function TaskCard({ task, isOverlay, ...props }: TaskCardProps) {
  const initials = task.assignee.name
    .split(" ")
    .map((part) => part[0])
    .join("")

  const cardContent = (
    <div
      className={cn(
        "bg-card text-card-foreground relative overflow-hidden rounded-lg border p-3 shadow-xs transition-shadow",
        !isOverlay && "hover:shadow-sm"
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
              <span>{task.code}</span>
              {task.estimate && (
                <>
                  <span className="size-1 rounded-full bg-current opacity-40" />
                  <span>{task.estimate}</span>
                </>
              )}
            </div>
            <h3 className="line-clamp-2 text-sm leading-snug font-medium">
              {task.title}
            </h3>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs leading-4 font-medium capitalize",
              PRIORITY_STYLES[task.priority]
            )}
          >
            {task.priority}
          </span>
        </div>

        {task.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
            {task.description}
          </p>
        )}

        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {task.labels.map((label) => (
              <span
                key={label}
                className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs font-medium"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6 border">
              <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground line-clamp-1 text-xs">
              {task.assignee.name}
            </span>
          </div>
          <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs whitespace-nowrap tabular-nums">
            <span className="flex items-center gap-1">
              <ChatCircleIcon className="size-3" />
              {task.comments}
            </span>
            <span className="flex items-center gap-1">
              <PaperclipIcon className="size-3" />
              {task.attachments}
            </span>
            <time className="flex items-center gap-1">
              <CalendarBlankIcon className="size-3" />
              {task.dueDate}
            </time>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <KanbanItem value={task.id} {...props}>
      {isOverlay ? cardContent : <KanbanItemHandle>{cardContent}</KanbanItemHandle>}
    </KanbanItem>
  )
}

interface TaskColumnProps extends Omit<
  ComponentProps<typeof KanbanColumn>,
  "children" | "value"
> {
  value: string
  tasks: MockTask[]
  isOverlay?: boolean
}

function TaskColumn({ value, tasks, isOverlay, ...props }: TaskColumnProps) {
  const meta = COLUMN_META[value]
  const title = COLUMN_TITLES[value] ?? value

  return (
    <KanbanColumn value={value} {...props}>
      <div className="bg-muted/50 flex flex-col rounded-xl border p-2 shadow-xs">
        <div className={cn("mb-2 rounded-lg bg-linear-to-r p-3", meta.accent)}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <span className={cn("size-2 rounded-full", meta.dot)} />
                {meta.eyebrow}
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{title}</h2>
                <Badge variant="outline">{tasks.length}</Badge>
              </div>
            </div>
            <KanbanColumnHandle
              render={(handleProps) => (
                <Button
                  {...handleProps}
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Move ${title} column`}
                >
                  <DotsSixVerticalIcon />
                </Button>
              )}
            />
          </div>
        </div>
        <KanbanColumnContent value={value} className="min-h-105 gap-2.5">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} isOverlay={isOverlay} />
          ))}
        </KanbanColumnContent>
      </div>
    </KanbanColumn>
  )
}

export function ShadcnStudioKanbanBoard() {
  const [columns, setColumns] =
    useState<Record<string, MockTask[]>>(INITIAL_COLUMNS)

  return (
    <div className="space-y-4 overflow-x-auto pb-2">
      <Kanban
        value={columns}
        onValueChange={setColumns}
        getItemValue={(item) => item.id}
        className="w-full"
      >
        <KanbanBoard className="grid auto-rows-fr grid-cols-[repeat(5,minmax(16rem,1fr))] gap-3 sm:grid-cols-[repeat(5,minmax(16rem,1fr))]">
          {Object.entries(columns).map(([columnId, tasks]) => (
            <TaskColumn key={columnId} value={columnId} tasks={tasks} />
          ))}
        </KanbanBoard>
        <KanbanOverlay>
          {({ value, variant }) => {
            const activeValue = String(value)

            if (variant === "column") {
              return (
                <TaskColumn
                  value={activeValue}
                  tasks={columns[activeValue] ?? []}
                  isOverlay
                />
              )
            }

            const task = Object.values(columns)
              .flat()
              .find((t) => t.id === activeValue)

            return task ? <TaskCard task={task} isOverlay /> : null
          }}
        </KanbanOverlay>
      </Kanban>
    </div>
  )
}
