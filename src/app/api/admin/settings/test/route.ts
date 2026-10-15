import { z } from "zod"
import { json, readJson, requireApiAdmin, route } from "@/lib/http"
import { getBaseUrl, getProxySettings } from "@/lib/settings"
import { accountKey, listAccounts } from "@/lib/accounts"
import { LeasewebError, lwRequest } from "@/lib/leaseweb"
import { ProxyInput } from "@/lib/schemas"

const Body = z.object({
  /** Test a saved account's key. */
  accountId: z.number().int().positive().optional(),
  /** Or a key typed on screen that is not saved yet. */
  apiKey: z.string().trim().max(512).optional(),
  baseUrl: z.string().trim().url().optional(),
  /** Proxy values on screen; the saved proxy is used when left out. */
  proxy: ProxyInput.optional(),
})

/**
 * Tests the connection to Leaseweb with the values on screen. Without any key
 * it still checks the network path (and proxy): Leaseweb answers 401 to a dummy key.
 */
export const POST = route(async (req) => {
  requireApiAdmin(req)
  const body = await readJson(req, Body)
  const savedProxy = getProxySettings()
  const proxy = body.proxy
    ? {
        ...body.proxy,
        username: body.proxy.username ?? "",
        password: body.proxy.password === undefined ? savedProxy.password : body.proxy.password || null,
      }
    : savedProxy

  const firstUsable = listAccounts().find((a) => !a.unreadable)
  const apiKey =
    body.apiKey ||
    (body.accountId ? accountKey(body.accountId) : null) ||
    (body.accountId === undefined && firstUsable ? accountKey(firstUsable.id) : null)
  const probeOnly = !apiKey

  const started = Date.now()
  try {
    const { data } = await lwRequest<{ _metadata?: { totalCount?: number } }>({
      path: "/bareMetals/v2/servers",
      query: { limit: 1 },
      timeoutMs: 20_000,
      override: { apiKey: apiKey || "leaseweb-dock-connectivity-check", baseUrl: body.baseUrl || getBaseUrl(), proxy },
    })
    return json({
      ok: true,
      ms: Date.now() - started,
      viaProxy: proxy.enabled,
      message: `Connected${proxy.enabled ? " through the proxy" : ""}. The account has ${data?._metadata?.totalCount ?? 0} dedicated server(s).`,
    })
  } catch (e) {
    const err = e instanceof LeasewebError ? e : new LeasewebError(500, "Unexpected error")
    // An HTTP answer from Leaseweb means the network path (and proxy) works.
    const reachable = err.status === 401 || err.status === 403
    if (probeOnly && reachable) {
      return json({
        ok: true,
        ms: Date.now() - started,
        viaProxy: proxy.enabled,
        message: `Leaseweb is reachable${proxy.enabled ? " through the proxy" : ""}. Add an API key to finish.`,
      })
    }
    return json({
      ok: false,
      ms: Date.now() - started,
      viaProxy: proxy.enabled,
      reachable,
      message: reachable ? `${proxy.enabled ? "The proxy works and " : ""}Leaseweb answered, but: ${err.message}` : err.message,
    })
  }
})
