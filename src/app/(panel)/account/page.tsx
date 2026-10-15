import type { Metadata } from "next"
import { requireUser } from "@/lib/auth"
import { AccountForm } from "@/components/account-form"

export const metadata: Metadata = { title: "Account" }

export default async function AccountPage() {
  const user = await requireUser()
  return <AccountForm user={{ username: user.username, name: user.name, role: user.role, createdAt: user.created_at }} />
}
