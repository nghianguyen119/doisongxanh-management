"use client"

import * as React from "react"
import type { Column, RowData, Table } from "@tanstack/react-table"
import { XIcon } from "@phosphor-icons/react"

import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter"
import { dataTableFeatures } from "@/components/data-table/data-table-features"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DataTableToolbarProps<TData extends RowData>
  extends React.ComponentProps<"div"> {
  table: Table<typeof dataTableFeatures, TData>
}

export function DataTableToolbar<TData extends RowData>({
  table,
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.atoms.columnFilters.get().length > 0

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table]
  )

  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn(
        "flex w-full items-start justify-between gap-2 p-1",
        className
      )}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {columns.map((column) => (
          <DataTableToolbarFilter key={column.id} column={column} />
        ))}
        {isFiltered && (
          <Button
            aria-label="Đặt lại bộ lọc"
            variant="outline"
            className="border-dashed"
            onClick={() => table.resetColumnFilters()}
          >
            <XIcon />
            Đặt lại
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}

interface DataTableToolbarFilterProps<TData extends RowData> {
  column: Column<typeof dataTableFeatures, TData>
}

function DataTableToolbarFilter<TData extends RowData>({
  column,
}: DataTableToolbarFilterProps<TData>) {
  const columnMeta = column.columnDef.meta

  if (!columnMeta?.variant) return null

  switch (columnMeta.variant) {
    case "text":
      return (
        <Input
          placeholder={columnMeta.placeholder ?? columnMeta.label}
          value={(column.getFilterValue() as string) ?? ""}
          onChange={(event) => column.setFilterValue(event.target.value)}
          className="h-8 w-40 lg:w-56"
        />
      )

    case "number":
      return (
        <Input
          type="number"
          inputMode="numeric"
          placeholder={columnMeta.placeholder ?? columnMeta.label}
          value={(column.getFilterValue() as string) ?? ""}
          onChange={(event) => column.setFilterValue(event.target.value)}
          className="h-8 w-30"
        />
      )

    case "select":
    case "multiSelect":
      return (
        <DataTableFacetedFilter
          column={column}
          title={columnMeta.label ?? column.id}
          options={columnMeta.options ?? []}
          multiple={columnMeta.variant === "multiSelect"}
        />
      )

    default:
      return null
  }
}
