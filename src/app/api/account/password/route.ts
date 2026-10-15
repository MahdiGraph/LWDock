import { z } from "zod"
import { db } from "@/lib/db"
import { deleteUserSessions, SESSION_COOKIE } from "@/lib/auth"
import { hashPassword, verifyPassword } from "@/lib/crypto"
import { clientIp, HttpError, json, readJson, requireApiUser, route } from "@/lib/http"
import { audit } from "@/lib/audit"

const Body = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8, "at least 8 characters").max(256),
})

export const POST = route(async (req) => {
  const user = requireApiUser(req)
  const body = await readJson(req, Body)
  const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string }
  if (!(await verifyPassword(body.currentPassword, row.password_hash))) {
    throw new HttpError(400, "Your current password is not correct.")
  }
  db()
    .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .run(await hashPassword(body.newPassword), Date.now(), user.id)
  // Sign out every other device.
  deleteUserSessions(user.id, req.cookies.get(SESSION_COOKIE)?.value)
  audit({ user, action: "Changed own password", ip: clientIp(req), status: 200 })
  return json({ ok: true })
})
