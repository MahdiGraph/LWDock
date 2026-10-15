import type { Metadata } from "next"
import { requireAdmin } from "@/lib/auth"
import { publicSettings } from "@/lib/settings"
import { SettingsForms } from "@/components/admin/settings"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  await requireAdmin()
  return <SettingsForms initial={publicSettings()} />
}
