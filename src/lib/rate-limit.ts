const globalForLimits = globalThis as unknown as { __lwdockLimits?: Map<string, { count: number; reset: number }> }

/** A small in-memory fixed-window limiter (enough for a single-instance panel). */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const map = (globalForLimits.__lwdockLimits ??= new Map())
  const now = Date.now()
  if (map.size > 10_000) for (const [k, v] of map) if (v.reset < now) map.delete(k)
  const entry = map.get(key)
  if (!entry || entry.reset < now) {
    map.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  entry.count++
  return { ok: entry.count <= limit, retryAfter: Math.ceil((entry.reset - now) / 1000) }
}

export function clearRateLimit(key: string) {
  globalForLimits.__lwdockLimits?.delete(key)
}
