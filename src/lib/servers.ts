import { db } from "./db"
import type { User } from "./auth"
import { accountNames, listAccounts } from "./accounts"
import { KIND_META, summarize, type Kind, type ServerSummary } from "./kinds"
import { lwFetchAll, lwRequest, LeasewebError } from "./leaseweb"

export type Assignee = { userId: number; username: string; name: string | null }

export function canAccess(user: User, accountId: number, kind: Kind, serverId: string): boolean {
  if (user.role === "admin") return true
  return !!db()
    .prepare("SELECT 1 FROM assignments WHERE user_id = ? AND account_id = ? AND kind = ? AND server_id = ?")
    .get(user.id, accountId, kind, serverId)
}

/** Assignees of every server of one kind, keyed by "accountId:serverId". */
export function assignmentsFor(kind: Kind): Map<string, Assignee[]> {
  const rows = db()
    .prepare(
      `SELECT a.account_id, a.server_id, u.id AS userId, u.username, u.name FROM assignments a
       JOIN users u ON u.id = a.user_id WHERE a.kind = ? ORDER BY u.username`
    )
    .all(kind) as (Assignee & { account_id: number; server_id: string })[]
  const map = new Map<string, Assignee[]>()
  for (const row of rows) {
    const key = `${row.account_id}:${row.server_id}`
    const list = map.get(key) ?? []
    list.push({ userId: row.userId, username: row.username, name: row.name })
    map.set(key, list)
  }
  return map
}

const globalForCache = globalThis as unknown as {
  __lwdockList?: Map<string, { at: number; items: ServerSummary[] }>
}

/** Every server of one kind on one Leaseweb account, cached for a minute. */
export async function listAccountServers(accountId: number, accountName: string, kind: Kind, refresh = false) {
  const cache = (globalForCache.__lwdockList ??= new Map())
  const key = `${accountId}:${kind}`
  const hit = cache.get(key)
  if (!refresh && hit && Date.now() - hit.at < 60_000) return hit.items
  const meta = KIND_META[kind]
  const raw = await lwFetchAll<Record<string, unknown>>(accountId, meta.base, meta.listKey)
  const items = raw.map((r) => summarize(kind, r, { id: accountId, name: accountName }))
  cache.set(key, { at: Date.now(), items })
  return items
}

/** Servers of one kind across all accounts; an account that fails does not hide the others. */
export async function listAllServers(kind: Kind, refresh = false) {
  const accounts = listAccounts()
  const results = await Promise.allSettled(accounts.map((a) => listAccountServers(a.id, a.name, kind, refresh)))
  const servers: ServerSummary[] = []
  const errors: { accountId: number; account: string; message: string }[] = []
  results.forEach((r, i) => {
    if (r.status === "fulfilled") servers.push(...r.value)
    else
      errors.push({
        accountId: accounts[i].id,
        account: accounts[i].name,
        message: r.reason instanceof LeasewebError ? r.reason.message : "Could not load the servers.",
      })
  })
  return { servers, errors }
}

export type UserServer = ServerSummary & { error?: string; nickname?: string | null }

/** The servers assigned to a user, with live details from Leaseweb. */
export async function listUserServers(user: User): Promise<UserServer[]> {
  const rows = db()
    .prepare("SELECT account_id, kind, server_id, label, nickname FROM assignments WHERE user_id = ? ORDER BY created_at")
    .all(user.id) as { account_id: number; kind: Kind; server_id: string; label: string | null; nickname: string | null }[]
  const names = accountNames()

  const results: UserServer[] = []
  const queue = [...rows]
  async function worker() {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const account = { id: row.account_id, name: names.get(row.account_id) ?? "Leaseweb" }
      try {
        const { data } = await lwRequest<Record<string, unknown>>({
          accountId: row.account_id,
          path: `${KIND_META[row.kind].base}/${encodeURIComponent(row.server_id)}`,
        })
        const summary = summarize(row.kind, data, account)
        // The user's own name for the server wins over the Leaseweb reference.
        results.push({ ...summary, name: row.nickname || summary.name, nickname: row.nickname })
      } catch (e) {
        results.push({
          kind: row.kind,
          id: row.server_id,
          accountId: account.id,
          accountName: account.name,
          name: row.nickname || row.label || row.server_id,
          nickname: row.nickname,
          reference: null,
          ip: null,
          location: null,
          country: null,
          spec: null,
          state: null,
          os: null,
          error: e instanceof LeasewebError ? e.message : "Could not load this server.",
        })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, worker))
  const order = new Map(rows.map((r, i) => [`${r.account_id}:${r.kind}:${r.server_id}`, i]))
  return results.sort(
    (a, b) => (order.get(`${a.accountId}:${a.kind}:${a.id}`) ?? 0) - (order.get(`${b.accountId}:${b.kind}:${b.id}`) ?? 0)
  )
}
