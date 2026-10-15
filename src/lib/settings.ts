import { db } from "./db"
import { decrypt, encrypt } from "./crypto"

export const PROXY_PROTOCOLS = ["http", "https", "socks4", "socks5", "socks5h"] as const
export type ProxyProtocol = (typeof PROXY_PROTOCOLS)[number]

export const DEFAULT_BASE_URL = "https://api.leaseweb.com"

export type LeasewebSettings = {
  apiKey: string | null
  baseUrl: string
}

export type ProxySettings = {
  enabled: boolean
  protocol: ProxyProtocol
  host: string
  port: number | null
  username: string
  password: string | null
}

function get(key: string): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined
  return row?.value ?? null
}

function set(key: string, value: string | null) {
  if (value === null) db().prepare("DELETE FROM settings WHERE key = ?").run(key)
  else
    db()
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, value)
}

function getSecret(key: string): string | null {
  const raw = get(key)
  return raw ? decrypt(raw) : null
}

export function getLeasewebSettings(): LeasewebSettings {
  return {
    apiKey: getSecret("lw.apiKey"),
    baseUrl: get("lw.baseUrl") || DEFAULT_BASE_URL,
  }
}

export function getProxySettings(): ProxySettings {
  const protocol = (get("proxy.protocol") as ProxyProtocol) || "socks5h"
  const port = Number(get("proxy.port"))
  return {
    enabled: get("proxy.enabled") === "1",
    protocol: PROXY_PROTOCOLS.includes(protocol) ? protocol : "socks5h",
    host: get("proxy.host") ?? "",
    port: Number.isInteger(port) && port > 0 ? port : null,
    username: get("proxy.username") ?? "",
    password: getSecret("proxy.password"),
  }
}

/** `apiKey: undefined` keeps the stored key, `null` removes it. */
export function saveLeasewebSettings(input: { apiKey?: string | null; baseUrl: string }) {
  if (input.apiKey !== undefined) set("lw.apiKey", input.apiKey ? encrypt(input.apiKey) : null)
  set("lw.baseUrl", input.baseUrl === DEFAULT_BASE_URL ? null : input.baseUrl)
}

/** `password: undefined` keeps the stored password, `null` removes it. */
export function saveProxySettings(input: Omit<ProxySettings, "password"> & { password?: string | null }) {
  set("proxy.enabled", input.enabled ? "1" : "0")
  set("proxy.protocol", input.protocol)
  set("proxy.host", input.host || null)
  set("proxy.port", input.port ? String(input.port) : null)
  set("proxy.username", input.username || null)
  if (input.password !== undefined) set("proxy.password", input.password ? encrypt(input.password) : null)
}

/** What the admin settings screen is allowed to see: never the secrets themselves. */
export function publicSettings() {
  const lw = getLeasewebSettings()
  const rawKey = get("lw.apiKey")
  const proxy = getProxySettings()
  return {
    leaseweb: {
      configured: !!lw.apiKey,
      unreadable: !!rawKey && !lw.apiKey,
      apiKeyHint: lw.apiKey ? `••••${lw.apiKey.slice(-4)}` : null,
      baseUrl: lw.baseUrl,
    },
    proxy: {
      enabled: proxy.enabled,
      protocol: proxy.protocol,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      hasPassword: !!proxy.password,
    },
  }
}

export type PublicSettings = ReturnType<typeof publicSettings>
