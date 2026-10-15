import { db } from "./db"

export type AdminUserRow = {
  id: number
  username: string
  name: string | null
  role: "admin" | "user"
  disabled: number
  created_at: number
  last_login_at: number | null
  servers: { account_id: number; kind: string; server_id: string; label: string | null }[]
}

export function listUsers(): AdminUserRow[] {
  const users = db()
    .prepare("SELECT id, username, name, role, disabled, created_at, last_login_at FROM users ORDER BY role, username")
    .all() as Omit<AdminUserRow, "servers">[]
  const assignments = db()
    .prepare("SELECT user_id, account_id, kind, server_id, label FROM assignments ORDER BY created_at")
    .all() as { user_id: number; account_id: number; kind: string; server_id: string; label: string | null }[]
  return users.map((u) => ({
    ...u,
    servers: assignments.filter((a) => a.user_id === u.id).map(({ account_id, kind, server_id, label }) => ({ account_id, kind, server_id, label })),
  }))
}
