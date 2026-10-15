import https from "node:https"
import { HttpsProxyAgent } from "https-proxy-agent"
import { SocksProxyAgent } from "socks-proxy-agent"
import { APP_VERSION } from "./config"
import { accountKey } from "./accounts"
import { getBaseUrl, getProxySettings, type ProxySettings } from "./settings"

/**
 * Every request to the Leaseweb API goes through this module. When the proxy is
 * enabled the request is sent through it and only through it: there is no direct
 * fallback, so a broken proxy fails loudly instead of leaking traffic.
 */

export class LeasewebError extends Error {
  status: number
  code?: string
  correlationId?: string
  details?: unknown

  constructor(status: number, message: string, extra?: { code?: string; correlationId?: string; details?: unknown }) {
    super(message)
    this.status = status
    this.code = extra?.code
    this.correlationId = extra?.correlationId
    this.details = extra?.details
  }
}

type Query = Record<string, string | number | boolean | undefined | null> | URLSearchParams

export type LwRequest = {
  /** The Leaseweb account (API key) to use. */
  accountId?: number
  method?: "GET" | "POST" | "PUT" | "DELETE"
  /** Path below the base URL, starting with a slash, e.g. /bareMetals/v2/servers */
  path: string
  query?: Query
  body?: unknown
  timeoutMs?: number
  /** Use these values instead of the saved ones (for "test connection"). */
  override?: { apiKey: string | null; baseUrl: string; proxy: ProxySettings }
}

export type LwResponse<T> = { status: number; data: T }

export function proxyUrl(p: ProxySettings, redact = false): string {
  const user = p.username
    ? `${encodeURIComponent(p.username)}${p.password ? `:${redact ? "***" : encodeURIComponent(p.password)}` : ""}@`
    : ""
  const host = p.host.includes(":") && !p.host.startsWith("[") ? `[${p.host}]` : p.host
  return `${p.protocol}://${user}${host}:${p.port}`
}

function createAgent(p: ProxySettings): https.Agent {
  if (!p.enabled) return new https.Agent({ keepAlive: true, maxSockets: 16 })
  if (!p.host || !p.port) {
    throw new LeasewebError(503, "The proxy is enabled but its host or port is missing. Fix it under Settings.")
  }
  const url = proxyUrl(p)
  if (p.protocol.startsWith("socks")) return new SocksProxyAgent(url, { keepAlive: true, timeout: 20_000 })
  return new HttpsProxyAgent(url, { keepAlive: true })
}

const globalForAgent = globalThis as unknown as { __lwdockAgent?: { key: string; agent: https.Agent } }

function sharedAgent(p: ProxySettings) {
  const key = JSON.stringify(p)
  const cached = globalForAgent.__lwdockAgent
  if (cached?.key === key) return cached.agent
  cached?.agent.destroy()
  const agent = createAgent(p)
  globalForAgent.__lwdockAgent = { key, agent }
  return agent
}

function networkMessage(err: NodeJS.ErrnoException, proxy: ProxySettings): string {
  const where = proxy.enabled ? `the ${proxy.protocol.toUpperCase()} proxy at ${proxy.host}:${proxy.port}` : "the Leaseweb API"
  const code = err.code ?? ""
  const text = err.message ?? ""
  if (code === "ECONNREFUSED" || text.includes("ECONNREFUSED")) return `Connection refused by ${where}.`
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || text.includes("ENOTFOUND")) return `A host name could not be resolved while connecting to ${where}.`
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || /timed? ?out/i.test(text)) return `Timed out while talking to ${where}.`
  if (code === "ECONNRESET" || text.includes("ECONNRESET")) return `The connection to ${where} was reset.`
  if (code === "EPROTO" || code.startsWith("ERR_SSL") || /SSL|TLS/i.test(text)) return `The TLS handshake with ${where} failed. Check the protocol.`
  if (/authentication/i.test(text)) return `${where.charAt(0).toUpperCase() + where.slice(1)} rejected the username or password.`
  return proxy.enabled ? `${text || "Network error"} (via ${where}).` : `${text || "Network error"}.`
}

function errorFromResponse(status: number, data: unknown): LeasewebError {
  const body = (data ?? {}) as Record<string, unknown>
  if (status === 407) return new LeasewebError(502, "The proxy rejected the credentials (HTTP 407).")
  const message =
    (typeof body.errorMessage === "string" && body.errorMessage) ||
    (typeof body.userMessage === "string" && body.userMessage) ||
    (status === 401
      ? "Leaseweb rejected the API key (HTTP 401)."
      : status === 403
        ? "The API key is not allowed to do this (HTTP 403)."
        : status === 404
          ? "Not found at Leaseweb (HTTP 404)."
          : `Leaseweb returned HTTP ${status}.`)
  return new LeasewebError(status, message, {
    code: typeof body.errorCode === "string" ? body.errorCode : undefined,
    correlationId: typeof body.correlationId === "string" ? body.correlationId : undefined,
    details: body.errorDetails,
  })
}

export async function lwRequest<T = unknown>(req: LwRequest): Promise<LwResponse<T>> {
  const baseUrl = req.override?.baseUrl ?? getBaseUrl()
  const proxy = req.override?.proxy ?? getProxySettings()
  const apiKey = req.override ? req.override.apiKey : req.accountId !== undefined ? accountKey(req.accountId) : null
  if (!apiKey) {
    throw new LeasewebError(
      503,
      req.override || req.accountId === undefined
        ? "No Leaseweb API key was given."
        : "This Leaseweb account has no usable API key. An admin can fix it under Settings."
    )
  }

  const url = new URL(baseUrl.replace(/\/+$/, "") + req.path)
  if (url.protocol !== "https:") throw new LeasewebError(500, "The API base URL must use https.")
  if (req.query) {
    const entries = req.query instanceof URLSearchParams ? [...req.query.entries()] : Object.entries(req.query)
    for (const [k, v] of entries) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
  }

  const agent = req.override ? createAgent(proxy) : sharedAgent(proxy)
  const payload = req.body === undefined ? undefined : Buffer.from(JSON.stringify(req.body))
  const method = req.method ?? "GET"

  try {
    return await new Promise<LwResponse<T>>((resolve, reject) => {
      const request = https.request(
        url,
        {
          method,
          agent,
          timeout: req.timeoutMs ?? 30_000,
          headers: {
            "X-LSW-Auth": apiKey,
            Accept: "application/json",
            "User-Agent": `LeasewebDock/${APP_VERSION}`,
            ...(payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on("data", (c: Buffer) => chunks.push(c))
          res.on("error", (err) => reject(new LeasewebError(502, networkMessage(err, proxy))))
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8")
            let data: unknown = null
            if (text) {
              try {
                data = JSON.parse(text)
              } catch {
                data = { raw: text.slice(0, 2000) }
              }
            }
            const status = res.statusCode ?? 0
            if (status >= 400) reject(errorFromResponse(status, data))
            else resolve({ status, data: data as T })
          })
        }
      )
      request.on("timeout", () => {
        const err = new Error("timeout") as NodeJS.ErrnoException
        err.code = "ETIMEDOUT"
        request.destroy(err)
      })
      request.on("error", (err: NodeJS.ErrnoException) => {
        reject(err instanceof LeasewebError ? err : new LeasewebError(502, networkMessage(err, proxy)))
      })
      if (payload) request.write(payload)
      request.end()
    })
  } finally {
    if (req.override) agent.destroy()
  }
}

/** Follows limit/offset pagination and returns every item of a list endpoint. */
export async function lwFetchAll<T>(
  accountId: number,
  path: string,
  key: string,
  query: Record<string, string> = {},
  max = 5000
): Promise<T[]> {
  const items: T[] = []
  const limit = 50
  for (let offset = 0; offset < max; offset += limit) {
    const { data } = await lwRequest<Record<string, unknown>>({ accountId, path, query: { ...query, limit, offset } })
    const page = (Array.isArray(data?.[key]) ? data[key] : []) as T[]
    items.push(...page)
    const meta = data?._metadata as { totalCount?: number } | undefined
    const total = typeof meta?.totalCount === "number" ? meta.totalCount : undefined
    if (page.length < limit || (total !== undefined && items.length >= total)) break
  }
  return items
}
