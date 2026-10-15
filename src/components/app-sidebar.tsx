"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  CaretUpDownIcon,
  ClockCounterClockwiseIcon,
  GearSixIcon,
  HardDrivesIcon,
  SignOutIcon,
  SquaresFourIcon,
  UserCircleIcon,
  UsersIcon,
} from "@phosphor-icons/react"
import { Wordmark } from "@/components/logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { api } from "@/lib/client"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: SquaresFourIcon, exact: true },
  { href: "/admin/servers", label: "Servers", icon: HardDrivesIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/activity", label: "Activity", icon: ClockCounterClockwiseIcon },
  { href: "/admin/settings", label: "Settings", icon: GearSixIcon },
]

const USER_NAV: NavItem[] = [
  { href: "/servers", label: "My servers", icon: HardDrivesIcon },
  { href: "/account", label: "Account", icon: UserCircleIcon },
]

export function AppSidebar({ user }: { user: { username: string; name: string | null; role: "admin" | "user" } }) {
  const pathname = usePathname()
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)

  const groups =
    user.role === "admin"
      ? [
          { label: "Admin", items: ADMIN_NAV },
          { label: "You", items: [USER_NAV[1]] },
        ]
      : [{ label: null, items: USER_NAV }]

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null)
    router.replace("/login")
    router.refresh()
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5 pb-3">
        <Link href="/" className="outline-none" onClick={() => setOpenMobile(false)}>
          <Wordmark />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label ?? "main"}>
            {group.label ? <SidebarGroupLabel className="text-[13px]">{group.label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item)} className="h-10 text-sm">
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="h-12">
                  <span className="flex size-8 shrink-0 items-center justify-center bg-sidebar-accent text-sm font-semibold uppercase">
                    {(user.name || user.username).slice(0, 1)}
                  </span>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{user.name || user.username}</span>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {user.role === "admin" ? "Admin" : "User"} · {user.username}
                    </span>
                  </span>
                  <CaretUpDownIcon className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="text-[13px] font-normal text-muted-foreground">
                  Signed in as {user.username}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <UserCircleIcon /> Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={signOut}>
                  <SignOutIcon /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
