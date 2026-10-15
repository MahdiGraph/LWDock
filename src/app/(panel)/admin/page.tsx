import type { Metadata } from "next"
import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { publicSettings } from "@/lib/settings"
import type { AuditRow } from "@/lib/audit"
import { AdminOverview } from "@/components/admin/overview"

export const metadata: Metadata = { title: "Overview" }

export default async function AdminPage() {
  const me = await requireAdmin()
  const users = db()
    .prepare("SELECT COUNT(*) AS total, COALESCE(SUM(role = 'admin'), 0) AS admins, COALESCE(SUM(disabled), 0) AS disabled FROM users")
    .get() as { total: number; admins: number; disabled: number }
  const assignments = db()
    .prepare("SELECT COUNT(*) AS total, COUNT(DISTINCT kind || ':' || server_id) AS servers FROM assignments")
    .get() as { total: number; servers: number }
  // Server actions only; sign-ins and settings changes are on the Activity page.
  const recent = db()
    .prepare("SELECT * FROM audit_logs WHERE server_id IS NOT NULL ORDER BY id DESC LIMIT 8")
    .all() as AuditRow[]

  return (
    <AdminOverview
      name={me.name || me.username}
      users={users}
      assignments={assignments}
      recent={recent}
      settings={publicSettings()}
    />
  )
}
