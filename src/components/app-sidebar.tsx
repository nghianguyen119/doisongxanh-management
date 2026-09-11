"use client"

import * as React from "react"
import Link from "next/link"
import {
  SquaresFourIcon,
  ListChecksIcon,
  UsersIcon,
  ChatCircleIcon,
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
    icon: <SquaresFourIcon />,
  },
  {
    title: "Công việc",
    url: "/tasks",
    icon: <ListChecksIcon />,
  },
  {
    title: "Nhân viên",
    url: "/employees",
    icon: <UsersIcon />,
  },
]

const NAV_SECONDARY = [
  {
    title: "Zalo OA",
    url: "/settings/zalo",
    icon: <ChatCircleIcon />,
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
              <LeafIcon className="size-5! text-primary" />
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
