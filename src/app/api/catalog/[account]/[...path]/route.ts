import { HttpError, json, requireApiUser, route } from "@/lib/http"
import { allowedCatalogPath, safeSegments } from "@/lib/permissions"
import { lwFetchAll, lwRequest } from "@/lib/leaseweb"
import { getAccount } from "@/lib/accounts"
import { db } from "@/lib/db"

type Ctx = { params: Promise<{ account: string; path: string[] }> }

const globalForCatalog = globalThis as unknown as { __lwdockCatalog?: Map<string, { at: number; data: unknown }> }

/**
 * Read-only lists shared by every server: operating systems, control panels,
 * rescue images, ISOs. `?all=<key>` follows pagination and returns every item.
 */
export const GET = route<Ctx>(async (req, ctx) => {
  const user = requireApiUser(req)
  const params = await ctx.params
  const accountId = Number(params.account)
  if (!Number.isInteger(accountId) || !getAccount(accountId)) throw new HttpError(404, "Unknown Leaseweb account.")
  // Users may only read lists through an account that holds one of their servers.
  if (user.role !== "admin" && !db().prepare("SELECT 1 FROM assignments WHERE user_id = ? AND account_id = ?").get(user.id, accountId)) {
    throw new HttpError(404, "Unknown Leaseweb account.")
  }
  const segments = safeSegments(params.path)
  if (!segments) throw new HttpError(400, "Invalid path.")
  const path = segments.join("/")
  if (!allowedCatalogPath(path)) throw new HttpError(404, "Not available.")

  const query = new URLSearchParams(req.nextUrl.searchParams)
  const all = query.get("all")
  query.delete("all")
  const cacheKey = `${accountId}:${path}?${query.toString()}&all=${all ?? ""}`
  const cache = (globalForCatalog.__lwdockCatalog ??= new Map())
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < 10 * 60_000) return json(hit.data)

  let data: unknown
  if (all && /^[A-Za-z]+$/.test(all)) {
    const items = await lwFetchAll(accountId, `/${path}`, all, Object.fromEntries(query))
    data = { [all]: items }
  } else {
    data = (await lwRequest({ accountId, path: `/${path}`, query })).data
  }
  cache.set(cacheKey, { at: Date.now(), data })
  return json(data)
})
