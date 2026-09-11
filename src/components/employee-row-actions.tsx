"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DotsThreeVerticalIcon,
  EyeIcon,
  PowerIcon,
  ProhibitIcon,
  TicketIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  generateInviteAction,
  setEmployeeStatusAction,
} from "@/lib/actions/employees"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ActionResultState } from "@/lib/action-state"

export function EmployeeRowActions({
  employeeId,
  status,
  zaloLinked,
}: {
  employeeId: string
  status: "invited" | "active" | "inactive"
  zaloLinked: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  function run(
    action: (
      prev: ActionResultState,
      formData: FormData
    ) => Promise<ActionResultState>,
    fields: Record<string, string>,
    opts: { loading: string; success: string; redirectTo?: string }
  ) {
    startTransition(async () => {
      const formData = new FormData()
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value)
      }
      const id = `employee-row-${employeeId}`
      toast.loading(opts.loading, { id })
      try {
        const result = await action(null, formData)
        if (result?.error) {
          toast.error(result.error, { id })
          return
        }
        toast.success(opts.success, { id })
        if (opts.redirectTo) {
          router.push(opts.redirectTo)
        } else {
          router.refresh()
        }
      } catch {
        toast.error("Không thực hiện được. Vui lòng thử lại.", { id })
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Thao tác"
            disabled={pending}
          />
        }
      >
        <DotsThreeVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href={`/employees/${employeeId}`} />}>
          <EyeIcon />
          Xem chi tiết
        </DropdownMenuItem>
        {!zaloLinked && (
          <DropdownMenuItem
            onClick={() =>
              run(generateInviteAction, { employeeId }, {
                loading: "Đang tạo mã mời…",
                success: "Đã tạo mã mời",
                redirectTo: `/employees/${employeeId}`,
              })
            }
          >
            <TicketIcon />
            Tạo mã mời
          </DropdownMenuItem>
        )}
        {status === "active" ? (
          <DropdownMenuItem
            onClick={() =>
              run(
                setEmployeeStatusAction,
                { employeeId, status: "inactive" },
                { loading: "Đang cập nhật…", success: "Đã ngừng hoạt động" }
              )
            }
          >
            <ProhibitIcon />
            Ngừng hoạt động
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              run(
                setEmployeeStatusAction,
                { employeeId, status: "active" },
                { loading: "Đang cập nhật…", success: "Đã kích hoạt" }
              )
            }
          >
            <PowerIcon />
            Kích hoạt
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
