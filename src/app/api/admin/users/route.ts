import { z } from "zod"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/crypto"
import { clientIp, HttpError, json, readJson, requireApiAdmin, route } from "@/lib/http"
import { audit } from "@/lib/audit"
import { USERNAME_RE } from "@/lib/validation"
import { listUsers } from "@/lib/users"

export const GET = route(async (req) => {
  requireApiAdmin(req)
  return json({ users: listUsers() })
})

const Body = z.object({
  username: z.string().trim().regex(USERNAME_RE, "3–32 letters, numbers, dots, dashes or underscores"),
  name: z.string().trim().max(80).optional(),
  password: z.string().min(8, "at least 8 characters").max(256),
  role: z.enum(["admin", "user"]).default("user"),
})

export const POST = route(async (req) => {
  const admin = requireApiAdmin(req)
  const body = await readJson(req, Body)
  const exists = db().prepare("SELECT 1 FROM users WHERE username = ?").get(body.username)
  if (exists) throw new HttpError(409, "That username is taken.")
  const now = Date.now()
  const info = db()
    .prepare("INSERT INTO users (username, name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(body.username, body.name || null, await hashPassword(body.password), body.role, now, now)
  audit({ user: admin, action: `Created ${body.role} "${body.username}"`, ip: clientIp(req), status: 200 })
  return json({ ok: true, id: Number(info.lastInsertRowid) })
})
