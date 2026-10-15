import { redirect } from "next/navigation"
import { getCurrentUser, hasUsers } from "@/lib/auth"

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect(hasUsers() ? "/login" : "/setup")
  redirect(user.role === "admin" ? "/admin" : "/servers")
}
