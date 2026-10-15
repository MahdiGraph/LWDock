import type { NextRequest } from "next/server"
import { clientIp, HttpError, json, requireApiUser, route } from "@/lib/http"
import { isKind, KIND_META } from "@/lib/kinds"
import { canAccess } from "@/lib/servers"
import { allowedServerCall, describeCall, safeDetail, safeSegments, stripBilling } from "@/lib/permissions"
import { LeasewebError, lwRequest } from "@/lib/leaseweb"
import { audit } from "@/lib/audit"
import { getAccount } from "@/lib/accounts"

type Ctx = { params: Promise<{ account: string; kind: string; id: string; path?: string[] }> }

function decode(segments: string[]): string[] | null {
  try {
    return safeSegments(segments.map((s) => decodeURIComponent(s)))
  } catch {
    return null
  }
}

/**
 * The single gateway between panel users and the Leaseweb API for one server.
 * It checks the session, the assignment and the endpoint allow-list, then
 * forwards the call (through the proxy when enabled) and logs what changed.
 */
async function handle(req: NextRequest, ctx: Ctx) {
  const user = requireApiUser(req)
  const params = await ctx.params
  if (!isKind(params.kind)) throw new HttpError(404, "Unknown server type.")
  const kind = params.kind
  const accountId = Number(params.account)
  if (!Number.isInteger(accountId) || !getAccount(accountId)) throw new HttpError(404, "Unknown Leaseweb account.")
  const segments = decode([params.id, ...(params.path ?? [])])
  if (!segments) throw new HttpError(400, "Invalid path.")
  const [serverId, ...rest] = segments
  const sub = rest.join("/")
  const method = req.method as "GET" | "POST" | "PUT" | "DELETE"

  if (!canAccess(user, accountId, kind, serverId)) throw new HttpError(404, "This server is not assigned to you.")
  const allowed = allowedServerCall(kind, method, sub, user.role === "admin")
  if (allowed === "unknown") throw new HttpError(404, "This action is not available in Leaseweb Dock.")
  if (allowed === "forbidden") throw new HttpError(403, "Only admins can do this.")

  let body: unknown = undefined
  if (method !== "GET") {
    const text = await req.text()
    if (text.length > 512 * 1024) throw new HttpError(413, "Request body is too large.")
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        throw new HttpError(400, "Invalid JSON body.")
      }
    }
  }

  const path = `${KIND_META[kind].base}/${[serverId, ...rest].map(encodeURIComponent).join("/")}`
  const description = describeCall(method, sub)
  const log = (status: number) =>
    description &&
    audit({
      user,
      action: description,
      accountId,
      kind,
      serverId,
      detail: safeDetail(body),
      status,
      ip: clientIp(req),
    })

  try {
    const res = await lwRequest({
      accountId,
      method,
      path,
      query: req.nextUrl.searchParams,
      body,
      timeoutMs: method === "GET" ? 45_000 : 60_000,
    })
    log(res.status)
    const data = user.role === "admin" ? res.data : stripBilling(res.data)
    return json(data ?? { ok: true }, res.status === 204 ? 200 : res.status)
  } catch (e) {
    if (e instanceof LeasewebError) log(e.status)
    throw e
  }
}

export const GET = route<Ctx>(handle)
export const POST = route<Ctx>(handle)
export const PUT = route<Ctx>(handle)
export const DELETE = route<Ctx>(handle)
