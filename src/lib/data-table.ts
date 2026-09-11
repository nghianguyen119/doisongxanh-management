import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"

import type {
  ExtendedColumnFilter,
  ExtendedColumnSort,
} from "@/types/data-table"

export function serializeSorting(sorting: SortingState): string | null {
  const first = sorting[0] as ExtendedColumnSort | undefined
  if (!first) return null
  return `${first.id}.${first.desc ? "desc" : "asc"}`
}

export function parseSorting(sort: string | null): SortingState {
  if (!sort) return []
  const [id, direction] = sort.split(".")
  if (!id) return []
  return [{ id, desc: direction === "desc" }]
}

export function serializeFilters(
  filters: ColumnFiltersState,
): ExtendedColumnFilter[] | null {
  const valid = filters.filter((filter) => {
    const value = filter.value
    if (value === undefined || value === null || value === "") return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  })

  if (!valid.length) return null

  return valid.map((filter) => ({
    id: filter.id,
    value: filter.value as string | string[],
  }))
}

export function parseFilters(
  filters: ExtendedColumnFilter[] | null,
): ColumnFiltersState {
  return (filters ?? []).map((filter) => ({
    id: filter.id,
    value: filter.value,
  }))
}

export function isExtendedColumnFilterArray(
  value: unknown,
): value is ExtendedColumnFilter[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false
      const candidate = item as { id?: unknown; value?: unknown }
      if (typeof candidate.id !== "string") return false
      return (
        typeof candidate.value === "string" ||
        (Array.isArray(candidate.value) &&
          candidate.value.every((entry) => typeof entry === "string"))
      )
    })
  )
}
