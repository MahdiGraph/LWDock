import { z } from "zod"
import { db } from "@/lib/db"
import { deleteUserSessions, type User } from "@/lib/auth"
import { hashPassword } from "@/lib/crypto"
import { clientIp, HttpError, json, readJson, requireApiAdmin, route } from "@/lib/http"
import { audit } from "@/lib/audit"

type Ctx = { params: Promise<{ id: string }> }

function loadUser(id: number) {
  const user = db().prepare("SELECT id, username, role, disabled FROM users WHERE id = ?").get(id) as
    | Pick<User, "id" | "username" | "role" | "disabled">
    | undefined
  if (!user) throw new HttpError(404, "User not found.")
  return user
}

function activeAdminCount(excludeId: number) {
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0 AND id != ?")
    .get(excludeId) as { n: number }
  return row.n
}

const Patch = z.object({
  name: z.string().trim().max(80).nullable().optional(),
  role: z.enum(["admin", "user"]).optional(),
  disabled: z.boolean().optional(),
  password: z.string().min(8, "at least 8 characters").max(256).optional(),
})

export const PATCH = route<Ctx>(async (req, ctx) => {
  const admin = requireApiAdmin(req)
  const id = Number((await ctx.params).id)
  const target = loadUser(id)
  const body = await readJson(req, Patch)

  const losingAdmin =
    target.role === "admin" && !target.disabled && (body.role === "user" || body.disabled === true)
  if (losingAdmin && activeAdminCount(id) === 0) {
    throw new HttpError(400, "Keep at least one active admin.")
  }

  const changes: string[] = []
  const now = Date.now()
  if (body.name !== undefined) {
    db().prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?").run(body.name || null, now, id)
    changes.push("name")
  }
  if (body.role && body.role !== target.role) {
    db().prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(body.role, now, id)
    changes.push(`role → ${body.role}`)
  }
  if (body.disabled !== undefined && Number(body.disabled) !== target.disabled) {
    db().prepare("UPDATE users SET disabled = ?, updated_at = ? WHERE id = ?").run(body.disabled ? 1 : 0, now, id)
    if (body.disabled) deleteUserSessions(id)
    changes.push(body.disabled ? "disabled" : "enabled")
  }
  if (body.password) {
    db().prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(await hashPassword(body.password), now, id)
    if (id !== admin.id) deleteUserSessions(id)
    changes.push("password reset")
  }
  if (changes.length) {
    audit({ user: admin, action: `Updated user "${target.username}" (${changes.join(", ")})`, ip: clientIp(req), status: 200 })
  }
  return json({ ok: true })
})

export const DELETE = route<Ctx>(async (req, ctx) => {
  const admin = requireApiAdmin(req)
  const id = Number((await ctx.params).id)
  const target = loadUser(id)
  if (id === admin.id) throw new HttpError(400, "You cannot delete your own account.")
  if (target.role === "admin" && !target.disabled && activeAdminCount(id) === 0) {
    throw new HttpError(400, "Keep at least one active admin.")
  }
  db().prepare("DELETE FROM users WHERE id = ?").run(id)
  audit({ user: admin, action: `Deleted user "${target.username}"`, ip: clientIp(req), status: 200 })
  return json({ ok: true })
})
