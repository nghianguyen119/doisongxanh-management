"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircleIcon } from "@phosphor-icons/react"
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
import { useDataTable } from "@/hooks/use-data-table"
import { EMPLOYEE_STATUS_LABEL } from "@/lib/labels"
import type { Option } from "@/types/data-table"
import { EmployeeRowActions } from "@/components/employee-row-actions"
import { EmployeesActionBar } from "@/components/employees-action-bar"

export interface EmployeeRow {
  id: string
  name: string
  position: string | null
  phone: string
  zalo: boolean
  open: number
  status: "invited" | "active" | "inactive"
  statusLabel: string
  statusTone: string
}

const STATUS_OPTIONS: Option[] = Object.entries(EMPLOYEE_STATUS_LABEL).map(
  ([value, label]) => ({ value, label })
)

const columnHelper = createColumnHelper<typeof dataTableFeatures, EmployeeRow>()

export function EmployeesTable({
  data,
  pageCount,
}: {
  data: EmployeeRow[]
  pageCount: number
}) {
  const columns = React.useMemo<DataTableColumnDef<EmployeeRow>[]>(
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
        columnHelper.accessor("name", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Tên" />
          ),
          cell: ({ row }) => (
            <>
              <Link
                href={`/employees/${row.original.id}`}
                className="font-medium hover:underline"
              >
                {row.original.name}
              </Link>
              {row.original.position && (
                <span className="block text-xs text-muted-foreground">
                  {row.original.position}
                </span>
              )}
            </>
          ),
          enableHiding: false,
          enableColumnFilter: true,
          meta: {
            label: "Tên",
            variant: "text",
            placeholder: "Tìm theo tên...",
          },
        }),
        columnHelper.accessor("phone", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label="SĐT" />
          ),
          meta: { label: "SĐT" },
        }),
        columnHelper.accessor("zalo", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Zalo" />
          ),
          cell: ({ row }) =>
            row.original.zalo ? (
              <Badge variant="outline" className="px-1.5 text-muted-foreground">
                <CheckCircleIcon className="fill-green-500 dark:fill-green-400" />
                Đã kết nối
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          meta: { label: "Zalo" },
        }),
        columnHelper.accessor("open", {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label="Việc mở" />
          ),
          cell: ({ row }) => (
            <div className="text-right tabular-nums">{row.original.open}</div>
          ),
          meta: { label: "Việc mở" },
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
              <EmployeeRowActions
                employeeId={row.original.id}
                status={row.original.status}
                zaloLinked={row.original.zalo}
              />
            </div>
          ),
          enableSorting: false,
          enableHiding: false,
        }),
      ]),
    []
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
      emptyMessage="Chưa có nhân viên nào."
      actionBar={<EmployeesActionBar table={table} />}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  )
}
