import type { Metadata } from "next"
import { requireAdmin } from "@/lib/auth"
import { ActivityLog } from "@/components/admin/activity"

export const metadata: Metadata = { title: "Activity" }

export default async function ActivityPage() {
  await requireAdmin()
  return <ActivityLog />
}
