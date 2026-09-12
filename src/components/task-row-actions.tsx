"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BellIcon,
  CheckCircleIcon,
  DotsThreeVerticalIcon,
  EyeIcon,
  ProhibitIcon,
  WarningIcon,
} from "@phosphor-icons/react"

import { toast } from "sonner"

import {
  cancelTaskAction,
  sendReminderAction,
  verifyTaskAction,
} from "@/lib/actions/tasks"
import type { ActionStateFn } from "@/lib/action-state"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function TaskRowActions({
  taskId,
  status,
  closed,
}: {
  taskId: string
  status: string
  closed: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  function run(
    action: ActionStateFn,
    fields: Record<string, string>,
    successMessage: string
  ) {
    startTransition(async () => {
      const formData = new FormData()
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value)
      }
      const state = await action(null, formData)
      if (state?.error) {
        toast.error(state.error)
      } else if (state?.warning) {
        toast.warning(state.warning)
      } else if (state?.success) {
        toast.success(successMessage)
      }
      router.refresh()
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
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem render={<Link href={`/tasks/${taskId}`} />}>
          <EyeIcon />
          Xem chi tiết
        </DropdownMenuItem>
        {status === "done" && (
          <DropdownMenuItem
            onClick={() =>
              run(verifyTaskAction, { taskId }, "Đã xác nhận hoàn thành")
            }
          >
            <CheckCircleIcon />
            Xác nhận hoàn thành
          </DropdownMenuItem>
        )}
        {!closed && (
          <DropdownMenuItem
            disabled={pending}
            onClick={() =>
              run(
                sendReminderAction,
                { taskId, overdue: "false" },
                "Đã gửi nhắc hạn"
              )
            }
          >
            <BellIcon />
            Gửi nhắc hạn
          </DropdownMenuItem>
        )}
        {!closed && (
          <DropdownMenuItem
            disabled={pending}
            onClick={() =>
              run(
                sendReminderAction,
                { taskId, overdue: "true" },
                "Đã gửi nhắc quá hạn"
              )
            }
          >
            <WarningIcon />
            Gửi nhắc quá hạn
          </DropdownMenuItem>
        )}
        {!closed && (
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onClick={() =>
              run(cancelTaskAction, { taskId }, "Đã huỷ công việc")
            }
          >
            <ProhibitIcon />
            Huỷ công việc
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
