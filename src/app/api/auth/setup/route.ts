import { z } from "zod"
import { db } from "@/lib/db"
import { createSession, hasUsers, SESSION_COOKIE } from "@/lib/auth"
import { hashPassword } from "@/lib/crypto"
import { clientIp, HttpError, isHttps, json, readJson, route } from "@/lib/http"
import { audit } from "@/lib/audit"
import { USERNAME_RE } from "@/lib/validation"

const Body = z.object({
  username: z.string().trim().regex(USERNAME_RE, "3–32 letters, numbers, dots, dashes or underscores"),
  name: z.string().trim().max(80).optional(),
  password: z.string().min(8, "at least 8 characters").max(256),
})

/** First run only: creates the first admin account. */
export const POST = route(async (req) => {
  const body = await readJson(req, Body)
  if (hasUsers()) throw new HttpError(409, "Setup is already done. Sign in instead.")

  const now = Date.now()
  const hash = await hashPassword(body.password)
  const info = db()
    .prepare("INSERT INTO users (username, name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?)")
    .run(body.username, body.name || null, hash, now, now)
  const userId = Number(info.lastInsertRowid)
  const ip = clientIp(req)
  const session = createSession(userId, ip, req.headers.get("user-agent"))
  audit({ user: { id: userId, username: body.username }, action: "Created the first admin account", ip, status: 200 })

  const res = json({ ok: true })
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(req),
    path: "/",
    expires: session.expires,
  })
  return res
})
