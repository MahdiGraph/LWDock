import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { hasUsers } from "@/lib/auth"
import { AuthShell } from "@/components/auth/auth-shell"
import { SetupForm } from "@/components/auth/setup-form"

export const metadata: Metadata = { title: "Set up" }

export default function SetupPage() {
  if (hasUsers()) redirect("/login")
  return (
    <AuthShell>
      <SetupForm />
    </AuthShell>
  )
}
