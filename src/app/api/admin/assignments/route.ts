import { z } from "zod"
import { db } from "@/lib/db"
import { clientIp, json, readJson, requireApiAdmin, route } from "@/lib/http"
import { KINDS, KIND_META } from "@/lib/kinds"
import { audit } from "@/lib/audit"

const Put = z.object({
  kind: z.enum(KINDS),
  serverId: z.string().min(1).max(64),
  label: z.string().max(200).nullable().optional(),
  userIds: z.array(z.number().int().positive()).max(500),
})

/** Replaces the list of users a server is assigned to. */
export const PUT = route(async (req) => {
  const admin = requireApiAdmin(req)
  const body = await readJson(req, Put)
  const current = db()
    .prepare("SELECT user_id FROM assignments WHERE kind = ? AND server_id = ?")
    .all(body.kind, body.serverId) as { user_id: number }[]
  const before = new Set(current.map((r) => r.user_id))
  const after = new Set(body.userIds)
  const users = new Map(
    (db().prepare("SELECT id, username FROM users").all() as { id: number; username: string }[]).map((u) => [u.id, u.username])
  )

  const added: string[] = []
  const removed: string[] = []
  const tx = db().transaction(() => {
    for (const id of after) {
      if (!users.has(id)) continue
      if (!before.has(id)) {
        db()
          .prepare("INSERT INTO assignments (user_id, kind, server_id, label, created_at) VALUES (?, ?, ?, ?, ?)")
          .run(id, body.kind, body.serverId, body.label ?? null, Date.now())
        added.push(users.get(id)!)
      } else if (body.label) {
        db()
          .prepare("UPDATE assignments SET label = ? WHERE user_id = ? AND kind = ? AND server_id = ?")
          .run(body.label, id, body.kind, body.serverId)
      }
    }
    for (const id of before) {
      if (!after.has(id)) {
        db().prepare("DELETE FROM assignments WHERE user_id = ? AND kind = ? AND server_id = ?").run(id, body.kind, body.serverId)
        removed.push(users.get(id) ?? `#${id}`)
      }
    }
  })
  tx()

  const name = `${KIND_META[body.kind].label} ${body.label || body.serverId}`
  if (added.length) audit({ user: admin, action: `Assigned ${name} to ${added.join(", ")}`, kind: body.kind, serverId: body.serverId, ip: clientIp(req), status: 200 })
  if (removed.length) audit({ user: admin, action: `Unassigned ${name} from ${removed.join(", ")}`, kind: body.kind, serverId: body.serverId, ip: clientIp(req), status: 200 })
  return json({ ok: true })
})

const Delete = z.object({
  kind: z.enum(KINDS),
  serverId: z.string().min(1).max(64),
  userId: z.number().int().positive(),
})

/** Removes one assignment (used from the Users screen). */
export const DELETE = route(async (req) => {
  const admin = requireApiAdmin(req)
  const body = await readJson(req, Delete)
  const user = db().prepare("SELECT username FROM users WHERE id = ?").get(body.userId) as { username: string } | undefined
  db()
    .prepare("DELETE FROM assignments WHERE user_id = ? AND kind = ? AND server_id = ?")
    .run(body.userId, body.kind, body.serverId)
  audit({
    user: admin,
    action: `Unassigned ${KIND_META[body.kind].label} ${body.serverId} from ${user?.username ?? `#${body.userId}`}`,
    kind: body.kind,
    serverId: body.serverId,
    ip: clientIp(req),
    status: 200,
  })
  return json({ ok: true })
})
