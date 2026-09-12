"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ArrowsOutIcon, XIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Wraps an intercepted `/tasks/[id]` navigation in a dialog. Closing goes back
 * to the page the manager came from (kanban board, task list, ...) instead of
 * leaving them on a task URL they never visited.
 */
export function TaskModal({
  expandHref,
  children,
}: {
  /** The full page URL; a plain anchor bypasses route interception. */
  expandHref: string
  children: ReactNode
}) {
  const router = useRouter()

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
          <DialogTitle className="text-base">Chi tiết công việc</DialogTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Mở trang đầy đủ"
              render={<a href={expandHref} />}
              nativeButton={false}
            >
              <ArrowsOutIcon />
              <span className="sr-only">Mở trang đầy đủ</span>
            </Button>
            <DialogClose
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <XIcon />
              <span className="sr-only">Đóng</span>
            </DialogClose>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
