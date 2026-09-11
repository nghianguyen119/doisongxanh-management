"use client"

import * as React from "react"
import {
  parseAsInteger,
  parseAsJson,
  parseAsString,
  throttle,
  useQueryState,
} from "nuqs"
import {
  functionalUpdate,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"

import {
  dataTableFeatures,
  type DataTableColumnDef,
} from "@/components/data-table/data-table-features"
import {
  isExtendedColumnFilterArray,
  parseFilters,
  parseSorting,
  serializeFilters,
  serializeSorting,
} from "@/lib/data-table"
import type { ExtendedColumnFilter } from "@/types/data-table"

const PAGE_KEY = "page"
const PER_PAGE_KEY = "perPage"
const SORT_KEY = "sort"
const FILTERS_KEY = "filters"

interface UseDataTableProps<TData extends RowData> {
  data: TData[]
  columns: DataTableColumnDef<TData>[]
  pageCount: number
  getRowId?: (row: TData) => string
  initialState?: {
    columnVisibility?: ColumnVisibilityState
    rowSelection?: RowSelectionState
    pageSize?: number
  }
}

export function useDataTable<TData extends RowData>({
  data,
  columns,
  pageCount,
  getRowId,
  initialState,
}: UseDataTableProps<TData>) {
  const [page, setPage] = useQueryState(
    PAGE_KEY,
    parseAsInteger.withDefault(1).withOptions({ limitUrlUpdates: throttle(200) })
  )
  const [perPage, setPerPage] = useQueryState(
    PER_PAGE_KEY,
    parseAsInteger
      .withDefault(initialState?.pageSize ?? 10)
      .withOptions({ limitUrlUpdates: throttle(200) })
  )
  const [sortParam, setSortParam] = useQueryState(
    SORT_KEY,
    parseAsString.withOptions({ limitUrlUpdates: throttle(200) })
  )
  const [filterParam, setFilterParam] = useQueryState(
    FILTERS_KEY,
    parseAsJson<ExtendedColumnFilter[]>((value) =>
      isExtendedColumnFilterArray(value) ? value : null
    ).withOptions({ limitUrlUpdates: throttle(200) })
  )

  const pagination: PaginationState = React.useMemo(
    () => ({ pageIndex: Math.max(page - 1, 0), pageSize: perPage }),
    [page, perPage]
  )
  const sorting: SortingState = React.useMemo(
    () => parseSorting(sortParam),
    [sortParam]
  )
  const columnFilters: ColumnFiltersState = React.useMemo(
    () => parseFilters(filterParam),
    [filterParam]
  )

  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>(initialState?.columnVisibility ?? {})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  )

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    pageCount,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    getRowId,
    onPaginationChange: (updater) => {
      const next = functionalUpdate(updater, pagination)
      void setPage(next.pageIndex + 1)
      void setPerPage(next.pageSize)
    },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)
      void setSortParam(serializeSorting(next))
      void setPage(1)
    },
    onColumnFiltersChange: (updater) => {
      const next = functionalUpdate(updater, columnFilters)
      void setFilterParam(serializeFilters(next))
      void setPage(1)
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  })

  return { table }
}
