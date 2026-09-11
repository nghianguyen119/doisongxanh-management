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
    action: (formData: FormData) => Promise<void>,
    fields: Record<string, string>,
    redirectTo?: string
  ) {
    startTransition(async () => {
      const formData = new FormData()
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value)
      }
      await action(formData)
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
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
              run(
                generateInviteAction,
                { employeeId },
                `/employees/${employeeId}`
              )
            }
          >
            <TicketIcon />
            Tạo mã mời
          </DropdownMenuItem>
        )}
        {status === "active" ? (
          <DropdownMenuItem
            onClick={() =>
              run(setEmployeeStatusAction, {
                employeeId,
                status: "inactive",
              })
            }
          >
            <ProhibitIcon />
            Ngừng hoạt động
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              run(setEmployeeStatusAction, { employeeId, status: "active" })
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
