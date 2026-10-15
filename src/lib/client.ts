/** Browser-side helpers for talking to the panel's own API. */

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = opts.body !== undefined
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text.slice(0, 300) }
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
      window.location.href = "/login"
    }
    const message = (data as { error?: string } | null)?.error || `Request failed (HTTP ${res.status})`
    throw new ApiError(res.status, message)
  }
  return data as T
}

export const fetcher = <T,>(url: string) => api<T>(url)

type Query = Record<string, string | number | boolean | undefined | null>

function qs(query?: Query) {
  if (!query) return ""
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
  const s = params.toString()
  return s ? `?${s}` : ""
}

export function lwUrl(kind: string, id: string, sub = "", query?: Query) {
  const path = sub ? `/${sub.split("/").map(encodeURIComponent).join("/")}` : ""
  return `/api/lw/${kind}/${encodeURIComponent(id)}${path}${qs(query)}`
}

export function catalogUrl(path: string, query?: Query) {
  return `/api/catalog/${path}${qs(query)}`
}

export function lwCall<T = unknown>(kind: string, id: string, method: "GET" | "POST" | "PUT" | "DELETE", sub = "", body?: unknown) {
  return api<T>(lwUrl(kind, id, sub), { method, body })
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong."
}
