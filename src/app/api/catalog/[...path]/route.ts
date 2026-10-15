import { HttpError, json, requireApiUser, route } from "@/lib/http"
import { allowedCatalogPath, safeSegments } from "@/lib/permissions"
import { lwFetchAll, lwRequest } from "@/lib/leaseweb"

type Ctx = { params: Promise<{ path: string[] }> }

const globalForCatalog = globalThis as unknown as { __lwdockCatalog?: Map<string, { at: number; data: unknown }> }

/**
 * Read-only lists shared by every server: operating systems, control panels,
 * rescue images, ISOs. `?all=<key>` follows pagination and returns every item.
 */
export const GET = route<Ctx>(async (req, ctx) => {
  requireApiUser(req)
  const segments = safeSegments((await ctx.params).path)
  if (!segments) throw new HttpError(400, "Invalid path.")
  const path = segments.join("/")
  if (!allowedCatalogPath(path)) throw new HttpError(404, "Not available.")

  const params = new URLSearchParams(req.nextUrl.searchParams)
  const all = params.get("all")
  params.delete("all")
  const cacheKey = `${path}?${params.toString()}&all=${all ?? ""}`
  const cache = (globalForCatalog.__lwdockCatalog ??= new Map())
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < 10 * 60_000) return json(hit.data)

  let data: unknown
  if (all && /^[A-Za-z]+$/.test(all)) {
    const items = await lwFetchAll(`/${path}`, all, Object.fromEntries(params))
    data = { [all]: items }
  } else {
    data = (await lwRequest({ path: `/${path}`, query: params })).data
  }
  cache.set(cacheKey, { at: Date.now(), data })
  return json(data)
})
