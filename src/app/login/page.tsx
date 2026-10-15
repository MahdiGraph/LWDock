import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser, hasUsers } from "@/lib/auth"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage() {
  if (!hasUsers()) redirect("/setup")
  const user = await getCurrentUser()
  if (user) redirect(user.role === "admin" ? "/admin" : "/servers")
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  )
}
