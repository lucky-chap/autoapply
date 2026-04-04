"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

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
import {
  LayoutDashboard,
  FileText,
  Settings2,
  ShieldCheck,
  Plus,
  LifeBuoyIcon,
  SendIcon,
  Briefcase,
} from "lucide-react"
import Link from "next/link"

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string }
}) {
  const pathname = usePathname()

  const data = {
    user,
    navMain: [
      {
        title: "Overview",
        url: "/dashboard",
        icon: <LayoutDashboard />,
        isActive: pathname === "/dashboard",
      },
      {
        title: "New Application",
        url: "/dashboard/new",
        icon: <Plus />,
        isActive: pathname === "/dashboard/new",
      },
      {
        title: "Resume Profile",
        url: "/dashboard/resume",
        icon: <FileText />,
        isActive: pathname === "/dashboard/resume",
      },
      {
        title: "Preferences",
        url: "/dashboard/preferences",
        icon: <Settings2 />,
        isActive: pathname === "/dashboard/preferences",
      },
      {
        title: "Security Settings",
        url: "/dashboard/permissions",
        icon: <ShieldCheck />,
        isActive: pathname === "/dashboard/permissions",
      },
    ],
    navSecondary: [
      {
        title: "Support",
        url: "mailto:support@autoapply.dev",
        icon: <LifeBuoyIcon />,
      },
      {
        title: "Feedback",
        url: "#",
        icon: <SendIcon />,
      },
    ],
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-black text-white">
                <Briefcase className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">AutoApply</span>
                <span className="truncate text-xs">Job Automation</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
