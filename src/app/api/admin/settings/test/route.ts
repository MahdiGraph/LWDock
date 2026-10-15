import { z } from "zod"
import { json, readJson, requireApiAdmin, route } from "@/lib/http"
import { getLeasewebSettings, getProxySettings } from "@/lib/settings"
import { LeasewebError, lwRequest } from "@/lib/leaseweb"
import { LeasewebInput, ProxyInput } from "@/lib/schemas"

const Body = z.object({
  leaseweb: LeasewebInput.optional(),
  proxy: ProxyInput.optional(),
})

/**
 * Tests the connection with the values on screen (unsaved), falling back to the
 * saved secrets when a secret field was left empty.
 */
export const POST = route(async (req) => {
  requireApiAdmin(req)
  const body = await readJson(req, Body)
  const saved = getLeasewebSettings()
  const savedProxy = getProxySettings()

  const leaseweb = {
    apiKey: body.leaseweb?.apiKey || saved.apiKey,
    baseUrl: body.leaseweb?.baseUrl || saved.baseUrl,
  }
  const proxy = body.proxy
    ? {
        ...body.proxy,
        username: body.proxy.username ?? "",
        password: body.proxy.password === undefined ? savedProxy.password : body.proxy.password || null,
      }
    : savedProxy

  const started = Date.now()
  try {
    const { data } = await lwRequest<{ _metadata?: { totalCount?: number } }>({
      path: "/bareMetals/v2/servers",
      query: { limit: 1 },
      timeoutMs: 20_000,
      override: { leaseweb, proxy },
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
    return json({
      ok: false,
      ms: Date.now() - started,
      viaProxy: proxy.enabled,
      reachable,
      message: reachable
        ? `${proxy.enabled ? "The proxy works and " : ""}Leaseweb answered, but: ${err.message}`
        : err.message,
    })
  }
})
