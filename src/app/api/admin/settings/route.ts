import { z } from "zod"
import { clientIp, json, readJson, requireApiAdmin, route } from "@/lib/http"
import { getProxySettings, publicSettings, saveBaseUrl, saveProxySettings } from "@/lib/settings"
import { audit } from "@/lib/audit"
import { LeasewebInput, ProxyInput } from "@/lib/schemas"

export const GET = route(async (req) => {
  requireApiAdmin(req)
  return json(publicSettings())
})

const Body = z.object({
  leaseweb: LeasewebInput.optional(),
  proxy: ProxyInput.optional(),
})

export const PUT = route(async (req) => {
  const admin = requireApiAdmin(req)
  const body = await readJson(req, Body)
  const ip = clientIp(req)
  if (body.leaseweb) {
    saveBaseUrl(body.leaseweb.baseUrl)
    audit({ user: admin, action: `Set the Leaseweb API address to ${body.leaseweb.baseUrl}`, ip, status: 200 })
  }
  if (body.proxy) {
    const p = body.proxy
    const before = getProxySettings()
    saveProxySettings({
      enabled: p.enabled,
      protocol: p.protocol,
      host: p.host,
      port: p.port,
      username: p.username,
      password: p.password === undefined ? undefined : p.password || null,
    })
    const state = p.enabled ? `on (${p.protocol}://${p.host}:${p.port})` : "off"
    audit({ user: admin, action: `Proxy ${before.enabled === p.enabled ? "updated" : "turned"} ${state}`, ip, status: 200 })
  }
  return json(publicSettings())
})
