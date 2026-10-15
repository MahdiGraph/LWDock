import { cookies } from "next/headers"
import { requireUser } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const store = await cookies()
  const defaultOpen = store.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar user={{ username: user.username, name: user.name, role: user.role }} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 bg-background px-3 md:px-6">
          <SidebarTrigger />
          <ThemeToggle />
        </header>
        <main className="min-w-0 flex-1 px-3 pt-2 pb-16 md:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
