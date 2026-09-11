"use client"

import type { CellData, Column, RowData } from "@tanstack/react-table"
import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
  EyeSlashIcon,
  XIcon,
} from "@phosphor-icons/react"

import { dataTableFeatures } from "@/components/data-table/data-table-features"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface DataTableColumnHeaderProps<
  TData extends RowData,
  TValue extends CellData = CellData,
> extends React.ComponentProps<typeof DropdownMenuTrigger> {
  column: Column<typeof dataTableFeatures, TData, TValue>
  label: string
}

export function DataTableColumnHeader<
  TData extends RowData,
  TValue extends CellData = CellData,
>({
  column,
  label,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return <div className={cn(className)}>{label}</div>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "-ml-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring data-open:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          className
        )}
        {...props}
      >
        {label}
        {column.getCanSort() &&
          (column.getIsSorted() === "desc" ? (
            <CaretDownIcon />
          ) : column.getIsSorted() === "asc" ? (
            <CaretUpIcon />
          ) : (
            <CaretUpDownIcon />
          ))}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        {column.getCanSort() && (
          <>
            <DropdownMenuCheckboxItem
              checked={column.getIsSorted() === "asc"}
              onClick={() => column.toggleSorting(false)}
            >
              <CaretUpIcon />
              Tăng dần
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={column.getIsSorted() === "desc"}
              onClick={() => column.toggleSorting(true)}
            >
              <CaretDownIcon />
              Giảm dần
            </DropdownMenuCheckboxItem>
            {column.getIsSorted() && (
              <DropdownMenuItem onClick={() => column.clearSorting()}>
                <XIcon />
                Bỏ sắp xếp
              </DropdownMenuItem>
            )}
          </>
        )}
        {column.getCanHide() && (
          <DropdownMenuCheckboxItem
            checked={!column.getIsVisible()}
            onClick={() => column.toggleVisibility(false)}
          >
            <EyeSlashIcon />
            Ẩn cột
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
