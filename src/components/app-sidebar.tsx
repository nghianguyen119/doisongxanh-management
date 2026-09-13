"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  SquaresFourIcon,
  ListChecksIcon,
  UsersIcon,
  ChatCircleIcon,
  KanbanIcon,
} from "@phosphor-icons/react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

/**
 * Icon colours follow the kanban status palette (KANBAN_COLUMNS) so the shell
 * and the board read as one system: blue = active, amber = in progress,
 * violet = awaiting review, green = done, slate = neutral.
 */
const NAV_MAIN = [
  {
    title: "Tổng quan",
    url: "/dashboard",
    icon: <SquaresFourIcon weight="duotone" color="#3b82f6" />,
  },
  {
    title: "Công việc",
    url: "/tasks",
    icon: <ListChecksIcon weight="duotone" color="#f59e0b" />,
  },
  {
    title: "Bảng tiến độ",
    url: "/kanban",
    icon: <KanbanIcon weight="duotone" color="#8b5cf6" />,
  },
  {
    title: "Nhân viên",
    url: "/employees",
    icon: <UsersIcon weight="duotone" color="#16a34a" />,
  },
]

const NAV_SECONDARY = [
  {
    title: "Zalo công ty",
    url: "/settings/zalo",
    icon: <ChatCircleIcon weight="duotone" color="#64748b" />,
  },
]

export type AppSidebarUser = {
  name: string
  email: string
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: AppSidebarUser }) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <Image
                src="/logo.png"
                alt=""
                width={20}
                height={20}
                priority
                className="size-5!"
              />
              <span className="text-base font-semibold">Đời Sống Xanh</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={NAV_MAIN} />
        <NavSecondary items={NAV_SECONDARY} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
