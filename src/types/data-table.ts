import type { CellData, RowData, TableFeatures } from "@tanstack/react-table"
import type { ComponentType } from "react"

export type FilterVariant = "text" | "number" | "select" | "multiSelect"

export interface Option {
  label: string
  value: string
  count?: number
  icon?: ComponentType<{ className?: string }>
}

export interface ExtendedColumnSort {
  id: string
  desc: boolean
}

export interface ExtendedColumnFilter {
  id: string
  value: string | string[]
}

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module "@tanstack/react-table" {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    label?: string
    placeholder?: string
    variant?: FilterVariant
    options?: Option[]
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
