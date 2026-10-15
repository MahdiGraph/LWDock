import { db } from "./db"
import type { User } from "./auth"

const MAX_ROWS = 20_000

export function audit(entry: {
  user: Pick<User, "id" | "username"> | null
  action: string
  accountId?: number | null
  kind?: string | null
  serverId?: string | null
  detail?: string | null
  status?: number | null
  ip?: string | null
}) {
  try {
    db()
      .prepare(
        "INSERT INTO audit_logs (at, user_id, username, action, account_id, kind, server_id, detail, status, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        Date.now(),
        entry.user?.id ?? null,
        entry.user?.username ?? null,
        entry.action,
        entry.accountId ?? null,
        entry.kind ?? null,
        entry.serverId ?? null,
        entry.detail ?? null,
        entry.status ?? null,
        entry.ip ?? null
      )
    // Keep the table bounded.
    if (Math.random() < 0.02) {
      db()
        .prepare("DELETE FROM audit_logs WHERE id <= (SELECT id FROM audit_logs ORDER BY id DESC LIMIT 1 OFFSET ?)")
        .run(MAX_ROWS)
    }
  } catch (e) {
    console.error("audit log failed", e)
  }
}

export type AuditRow = {
  id: number
  at: number
  user_id: number | null
  username: string | null
  action: string
  account_id: number | null
  kind: string | null
  server_id: string | null
  detail: string | null
  status: number | null
  ip: string | null
}
