"use client"

import * as React from "react"
import type { RowData, Table } from "@tanstack/react-table"
import { GearSixIcon } from "@phosphor-icons/react"

import { dataTableFeatures } from "@/components/data-table/data-table-features"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DataTableViewOptionsProps<TData extends RowData>
  extends React.ComponentProps<typeof PopoverContent> {
  table: Table<typeof dataTableFeatures, TData>
  disabled?: boolean
}

export function DataTableViewOptions<TData extends RowData>({
  table,
  disabled,
  className,
  ...props
}: DataTableViewOptionsProps<TData>) {
  const columns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter(
          (column) =>
            typeof column.accessorFn !== "undefined" && column.getCanHide()
        ),
    [table]
  )

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label="Hiện/ẩn cột"
            variant="outline"
            className="ml-auto hidden h-8 font-normal lg:flex"
            disabled={disabled}
          />
        }
      >
        <GearSixIcon className="text-muted-foreground" />
        Cột
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn("w-44 p-0", className)}
        {...props}
      >
        <Command>
          <CommandInput placeholder="Tìm cột..." />
          <CommandList>
            <CommandEmpty>Không có cột.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  data-checked={column.getIsVisible()}
                  onSelect={() =>
                    column.toggleVisibility(!column.getIsVisible())
                  }
                >
                  <span className="truncate">
                    {column.columnDef.meta?.label ?? column.id}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
