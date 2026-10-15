import type { Metadata } from "next"
import { requireAdmin } from "@/lib/auth"
import { AdminUsers } from "@/components/admin/users"

export const metadata: Metadata = { title: "Users" }

export default async function AdminUsersPage() {
  const me = await requireAdmin()
  return <AdminUsers meId={me.id} />
}
