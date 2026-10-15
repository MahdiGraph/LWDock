import { db } from "./db"
import type { User } from "./auth"
import { KIND_META, summarize, type Kind, type ServerSummary } from "./kinds"
import { lwFetchAll, lwRequest, LeasewebError } from "./leaseweb"

export type Assignee = { userId: number; username: string; name: string | null }

export function canAccess(user: User, kind: Kind, serverId: string): boolean {
  if (user.role === "admin") return true
  return !!db()
    .prepare("SELECT 1 FROM assignments WHERE user_id = ? AND kind = ? AND server_id = ?")
    .get(user.id, kind, serverId)
}

export function assignmentsFor(kind: Kind): Map<string, Assignee[]> {
  const rows = db()
    .prepare(
      `SELECT a.server_id, u.id AS userId, u.username, u.name FROM assignments a
       JOIN users u ON u.id = a.user_id WHERE a.kind = ? ORDER BY u.username`
    )
    .all(kind) as (Assignee & { server_id: string })[]
  const map = new Map<string, Assignee[]>()
  for (const row of rows) {
    const list = map.get(row.server_id) ?? []
    list.push({ userId: row.userId, username: row.username, name: row.name })
    map.set(row.server_id, list)
  }
  return map
}

const globalForCache = globalThis as unknown as {
  __lwdockList?: Partial<Record<Kind, { at: number; items: ServerSummary[] }>>
}

/** Every server of one kind on the Leaseweb account, cached for a minute. */
export async function listAccountServers(kind: Kind, refresh = false): Promise<ServerSummary[]> {
  const cache = (globalForCache.__lwdockList ??= {})
  const hit = cache[kind]
  if (!refresh && hit && Date.now() - hit.at < 60_000) return hit.items
  const meta = KIND_META[kind]
  const raw = await lwFetchAll<Record<string, unknown>>(meta.base, meta.listKey)
  const items = raw.map((r) => summarize(kind, r))
  cache[kind] = { at: Date.now(), items }
  return items
}

export type UserServer = ServerSummary & { error?: string }

/** The servers assigned to a user, with live details from Leaseweb. */
export async function listUserServers(user: User): Promise<UserServer[]> {
  const rows = db()
    .prepare("SELECT kind, server_id, label FROM assignments WHERE user_id = ? ORDER BY created_at")
    .all(user.id) as { kind: Kind; server_id: string; label: string | null }[]

  const results: UserServer[] = []
  const queue = [...rows]
  async function worker() {
    for (let row = queue.shift(); row; row = queue.shift()) {
      try {
        const { data } = await lwRequest<Record<string, unknown>>({
          path: `${KIND_META[row.kind].base}/${encodeURIComponent(row.server_id)}`,
        })
        results.push(summarize(row.kind, data))
      } catch (e) {
        results.push({
          kind: row.kind,
          id: row.server_id,
          name: row.label || row.server_id,
          reference: null,
          ip: null,
          location: null,
          spec: null,
          state: null,
          os: null,
          error: e instanceof LeasewebError ? e.message : "Could not load this server.",
        })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, worker))
  const order = new Map(rows.map((r, i) => [`${r.kind}:${r.server_id}`, i]))
  return results.sort((a, b) => (order.get(`${a.kind}:${a.id}`) ?? 0) - (order.get(`${b.kind}:${b.id}`) ?? 0))
}
