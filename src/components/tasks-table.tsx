"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import {
  dataTableFeatures,
  type DataTableColumnDef,
} from "@/components/data-table/data-table-features"
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { TaskRowActions } from "@/components/task-row-actions"
import { TasksActionBar } from "@/components/tasks-action-bar"
import { useDataTable } from "@/hooks/use-data-table"
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { Option } from "@/types/data-table"

export interface TaskRow {
  id: string
  ref: string
  title: string
  assignee: string
  priority: string
  due: string
  status: string
  statusLabel: string
  statusTone: string
  closed: boolean
  overdue: boolean
}

export interface TaskAssigneeOption {
  value: string
  label: string
}

const STATUS_OPTIONS: Option[] = Object.entries(TASK_STATUS_LABEL).map(
  ([value, label]) => ({ value, label })
)

const PRIORITY_OPTIONS: Option[] = Object.entries(TASK_PRIORITY_LABEL).map(
  ([value, label]) => ({ value, label })
)

const columnHelper = createColumnHelper<typeof dataTableFeatures, TaskRow>()

export function TasksTable({
  data,
  pageCount,
  assignees,
}: {
  data: TaskRow[]
  pageCount: number
  assignees: TaskAssigneeOption[]
}) {
  const columns = React.useMemo<DataTableColumnDef<TaskRow>[]>(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "select",
          header: ({ table }) => (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={table.getIsAllPageRowsSelected()}
                indeterminate={
                  table.getIsSomePageRowsSelected() &&
                  !table.getIsAllPageRowsSelected()
                }
                onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(!!value)
                }
                aria-label="Chọn tất cả"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Chọn hàng"
              />
            </div>
          ),
          enableSorting: false,
          enableHiding: false,
        }),
        columnHelper.accessor("title", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Công việc" />
          ),
          cell: ({ row }) => (
            <Link
              href={`/tasks/${row.original.id}`}
              className="font-medium hover:underline"
            >
              <span className="text-muted-foreground mr-1.5 font-mono text-xs">
                {row.original.ref}
              </span>
              {row.original.title}
            </Link>
          ),
          enableHiding: false,
          enableColumnFilter: true,
          meta: {
            label: "Công việc",
            variant: "text",
            placeholder: "Tìm theo tiêu đề...",
          },
        }),
        columnHelper.accessor("assignee", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Nhân viên" />
          ),
          enableColumnFilter: true,
          meta: {
            label: "Nhân viên",
            variant: "multiSelect",
            options: assignees,
          },
        }),
        columnHelper.accessor("priority", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Ưu tiên" />
          ),
          cell: ({ row }) => (
            <Badge variant="outline" className="px-1.5 text-muted-foreground">
              {row.original.priority}
            </Badge>
          ),
          enableColumnFilter: true,
          meta: {
            label: "Ưu tiên",
            variant: "multiSelect",
            options: PRIORITY_OPTIONS,
          },
        }),
        columnHelper.accessor("due", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Hạn" />
          ),
          cell: ({ row }) => (
            <div
              className={cn(
                "text-right tabular-nums",
                row.original.overdue && "font-medium text-destructive"
              )}
            >
              {row.original.due}
            </div>
          ),
          meta: { label: "Hạn" },
        }),
        columnHelper.accessor("statusLabel", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Trạng thái" />
          ),
          cell: ({ row }) => (
            <Badge className={row.original.statusTone}>
              {row.original.statusLabel}
            </Badge>
          ),
          enableColumnFilter: true,
          meta: {
            label: "Trạng thái",
            variant: "multiSelect",
            options: STATUS_OPTIONS,
          },
        }),
        columnHelper.display({
          id: "actions",
          header: () => <span className="sr-only">Thao tác</span>,
          cell: ({ row }) => (
            <div className="flex justify-end">
              <TaskRowActions
                taskId={row.original.id}
                status={row.original.status}
                closed={row.original.closed}
              />
            </div>
          ),
          enableSorting: false,
          enableHiding: false,
        }),
      ]),
    [assignees]
  )

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    getRowId: (row) => row.id,
  })

  return (
    <DataTable
      table={table}
      emptyMessage="Chưa có công việc nào."
      actionBar={<TasksActionBar table={table} />}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  )
}
