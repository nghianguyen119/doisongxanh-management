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
} from "./kanban"

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
}

interface TaskCardProps extends Omit<
  ComponentProps<typeof KanbanItem>,
  "value" | "children"
> {
  task: MockTask
  isOverlay?: boolean
}

function TaskCard({ task, isOverlay, ...props }: TaskCardProps) {
  const card = (
    <div
      className={cn(
        "bg-background rounded-lg border p-3 shadow-xs transition-all",
        !isOverlay && "hover:border-primary/30 hover:shadow-sm",
        isOverlay && "ring-primary/20 rotate-1 shadow-lg ring-2"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {task.labels.map((label) => (
            <span
              key={label}
              className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs font-medium"
            >
              {label}
            </span>
          ))}
        </div>
        <span className="text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap tabular-nums">
          <CalendarBlankIcon className="size-3" />
          {task.dueDate}
        </span>
      </div>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            PRIORITY_STYLES[task.priority]
          )}
        />
        <p className="line-clamp-2 text-sm leading-snug font-medium">
          {task.title}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Avatar className="size-5">
          <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
          <AvatarFallback className="text-[9px]">
            {task.assignee.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1">
            <ChatCircleIcon className="size-3" />
            {task.comments}
          </span>
          <span className="flex items-center gap-1">
            <PaperclipIcon className="size-3" />
            {task.attachments}
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <KanbanItem value={task.id} {...props}>
      {isOverlay ? card : <KanbanItemHandle>{card}</KanbanItemHandle>}
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
  const title = COLUMN_TITLES[value] ?? value

  return (
    <KanbanColumn value={value} {...props}>
      <div className="bg-muted flex h-full flex-col rounded-xl border p-2">
        <div className="flex items-center justify-between px-3 pt-2 pb-4">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <Badge variant="outline">{tasks.length}</Badge>
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
        <KanbanColumnContent value={value} className="gap-2.5">
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
        <KanbanBoard className="grid auto-rows-fr grid-cols-[repeat(5,minmax(14rem,1fr))] gap-3 sm:grid-cols-[repeat(5,minmax(14rem,1fr))]">
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
