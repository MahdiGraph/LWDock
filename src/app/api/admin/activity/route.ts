import { db } from "@/lib/db"
import { json, requireApiAdmin, route } from "@/lib/http"
import type { AuditRow } from "@/lib/audit"

export const GET = route(async (req) => {
  requireApiAdmin(req)
  const params = req.nextUrl.searchParams
  const before = Number(params.get("before")) || Number.MAX_SAFE_INTEGER
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200)
  const q = params.get("q")?.trim()
  const rows = (
    q
      ? db()
          .prepare(
            `SELECT * FROM audit_logs WHERE id < ? AND (username LIKE ? OR action LIKE ? OR server_id LIKE ?)
             ORDER BY id DESC LIMIT ?`
          )
          .all(before, `%${q}%`, `%${q}%`, `%${q}%`, limit)
      : db().prepare("SELECT * FROM audit_logs WHERE id < ? ORDER BY id DESC LIMIT ?").all(before, limit)
  ) as AuditRow[]
  return json({ rows, more: rows.length === limit })
})
