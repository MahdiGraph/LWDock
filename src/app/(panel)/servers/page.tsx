import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth"
import { MyServers } from "@/components/servers/my-servers"

export const metadata: Metadata = { title: "My servers" }

export default async function ServersPage() {
  const user = await requireUser()
  if (user.role === "admin") redirect("/admin/servers")
  return <MyServers name={user.name || user.username} />
}
