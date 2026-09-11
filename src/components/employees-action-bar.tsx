"use client"

import * as React from "react"
import type { Table } from "@tanstack/react-table"
import { PowerIcon, ProhibitIcon } from "@phosphor-icons/react"

import { dataTableFeatures } from "@/components/data-table/data-table-features"
import { Button } from "@/components/ui/button"
import { setEmployeesStatusAction } from "@/lib/actions/employees"
import type { EmployeeRow } from "@/components/employees-table"

export function EmployeesActionBar({
  table,
}: {
  table: Table<typeof dataTableFeatures, EmployeeRow>
}) {
  const [pending, startTransition] = React.useTransition()
  const ids = table.getSelectedRowModel().rows.map((row) => row.original.id)

  function setStatus(status: "active" | "inactive") {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("employeeIds", JSON.stringify(ids))
      formData.set("status", status)
      await setEmployeesStatusAction(formData)
      table.resetRowSelection()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <span className="text-sm text-muted-foreground">
        Đã chọn {ids.length} nhân viên
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setStatus("active")}
        >
          <PowerIcon />
          Kích hoạt
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => setStatus("inactive")}
        >
          <ProhibitIcon />
          Ngừng hoạt động
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
