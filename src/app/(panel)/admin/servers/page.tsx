import type { Metadata } from "next"
import { requireAdmin } from "@/lib/auth"
import { publicSettings } from "@/lib/settings"
import { isKind } from "@/lib/kinds"
import { AdminServers } from "@/components/admin/servers"

export const metadata: Metadata = { title: "Servers" }

export default async function AdminServersPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireAdmin()
  const { kind } = await searchParams
  return (
    <AdminServers
      configured={publicSettings().leaseweb.configured}
      initialKind={kind && isKind(kind) ? kind : "dedicated"}
    />
  )
}
