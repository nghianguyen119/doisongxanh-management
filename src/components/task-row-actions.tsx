"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckCircleIcon,
  DotsThreeVerticalIcon,
  EyeIcon,
  ProhibitIcon,
} from "@phosphor-icons/react"

import { cancelTaskAction, verifyTaskAction } from "@/lib/actions/tasks"
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
    action: (formData: FormData) => Promise<void>,
    fields: Record<string, string>
  ) {
    startTransition(async () => {
      const formData = new FormData()
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value)
      }
      await action(formData)
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
            onClick={() => run(verifyTaskAction, { taskId })}
          >
            <CheckCircleIcon />
            Xác nhận hoàn thành
          </DropdownMenuItem>
        )}
        {!closed && (
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onClick={() => run(cancelTaskAction, { taskId })}
          >
            <ProhibitIcon />
            Huỷ công việc
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
