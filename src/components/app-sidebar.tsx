"use client"

import * as React from "react"
import Link from "next/link"
import {
  SquaresFourIcon,
  ListChecksIcon,
  UsersIcon,
  ChatCircleIcon,
  KanbanIcon,
  LeafIcon,
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

const NAV_MAIN = [
  {
    title: "Tổng quan",
    url: "/dashboard",
    icon: <SquaresFourIcon weight="duotone" color="#3b82f6" />,
  },
  {
    title: "Công việc",
    url: "/tasks",
    icon: <ListChecksIcon weight="duotone" color="#10b981" />,
  },
  {
    title: "Kanban",
    url: "/kanban",
    icon: <KanbanIcon weight="duotone" color="#f43f5e" />,
  },
  {
    title: "Nhân viên",
    url: "/employees",
    icon: <UsersIcon weight="duotone" color="#8b5cf6" />,
  },
]

const NAV_SECONDARY = [
  {
    title: "Zalo OA",
    url: "/settings/zalo",
    icon: <ChatCircleIcon weight="duotone" color="#0ea5e9" />,
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
              <LeafIcon
                weight="duotone"
                color="#22c55e"
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
