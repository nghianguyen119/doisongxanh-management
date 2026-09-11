"use client"

import * as React from "react"
import type { Table } from "@tanstack/react-table"
import { ProhibitIcon } from "@phosphor-icons/react"

import { dataTableFeatures } from "@/components/data-table/data-table-features"
import { Button } from "@/components/ui/button"
import { cancelTasksAction } from "@/lib/actions/tasks"
import type { TaskRow } from "@/components/tasks-table"

export function TasksActionBar({
  table,
}: {
  table: Table<typeof dataTableFeatures, TaskRow>
}) {
  const [pending, startTransition] = React.useTransition()
  const selected = table.getSelectedRowModel().rows
  const ids = selected.map((row) => row.original.id)

  function onCancel() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("taskIds", JSON.stringify(ids))
      await cancelTasksAction(formData)
      table.resetRowSelection()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <span className="text-sm text-muted-foreground">
        Đã chọn {ids.length} công việc
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={onCancel}
        >
          <ProhibitIcon />
          Huỷ công việc
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => table.resetRowSelection()}
        >
          Bỏ chọn
        </Button>
      </div>
    </div>
  )
}
