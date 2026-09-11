"use client"

import { usePathname } from "next/navigation"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const SECTION_TITLES: [prefix: string, title: string][] = [
  ["/dashboard", "Tổng quan"],
  ["/tasks", "Công việc"],
  ["/kanban", "Bảng tiến độ"],
  ["/employees", "Nhân viên"],
  ["/settings/zalo", "Zalo OA"],
]

export function SiteHeader({ zaloMock }: { zaloMock?: boolean }) {
  const pathname = usePathname()
  const title =
    SECTION_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ??
    "Đời Sống Xanh"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{title}</h1>
        {zaloMock && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Zalo: mô phỏng
          </span>
        )}
      </div>
    </header>
  )
}
