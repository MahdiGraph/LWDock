import { z } from "zod"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE, type User } from "@/lib/auth"
import { getDummyHash, verifyPassword } from "@/lib/crypto"
import { clientIp, HttpError, isHttps, json, readJson, route } from "@/lib/http"
import { clearRateLimit, rateLimit } from "@/lib/rate-limit"
import { audit } from "@/lib/audit"

const Body = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
})

export const POST = route(async (req) => {
  const { username, password } = await readJson(req, Body)
  const ip = clientIp(req) ?? "unknown"

  const byIp = rateLimit(`login-ip:${ip}`, 30, 15 * 60_000)
  const byUser = rateLimit(`login-user:${username.toLowerCase()}`, 10, 15 * 60_000)
  if (!byIp.ok || !byUser.ok) {
    throw new HttpError(429, `Too many attempts. Try again in ${Math.max(byIp.retryAfter, byUser.retryAfter)} seconds.`)
  }

  const row = db()
    .prepare("SELECT id, username, name, role, disabled, password_hash FROM users WHERE username = ?")
    .get(username) as (User & { password_hash: string }) | undefined

  const valid = await verifyPassword(password, row?.password_hash ?? (await getDummyHash()))
  if (!row || !valid) {
    audit({ user: null, action: `Failed sign-in for "${username}"`, ip, status: 401 })
    throw new HttpError(401, "Wrong username or password.")
  }
  if (row.disabled) throw new HttpError(403, "This account is disabled. Ask your admin.")

  clearRateLimit(`login-user:${username.toLowerCase()}`)
  const session = createSession(row.id, ip, req.headers.get("user-agent"))
  audit({ user: row, action: "Signed in", ip, status: 200 })

  const res = json({ ok: true, role: row.role })
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(req),
    path: "/",
    expires: session.expires,
  })
  return res
})
