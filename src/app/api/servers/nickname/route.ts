import { z } from "zod"
import { db } from "@/lib/db"
import { clientIp, HttpError, json, readJson, requireApiUser, route } from "@/lib/http"
import { KINDS, KIND_META } from "@/lib/kinds"
import { audit } from "@/lib/audit"

const Body = z.object({
  accountId: z.number().int().positive(),
  kind: z.enum(KINDS),
  serverId: z.string().min(1).max(64),
  /** Empty or null goes back to the Leaseweb reference. */
  nickname: z.string().trim().max(80).nullable(),
})

/**
 * Sets the name a user sees for one of their servers. It is stored only in the
 * panel, for that user; the reference at Leaseweb is never changed.
 */
export const PUT = route(async (req) => {
  const user = requireApiUser(req)
  const body = await readJson(req, Body)
  const nickname = body.nickname || null
  const result = db()
    .prepare("UPDATE assignments SET nickname = ? WHERE user_id = ? AND account_id = ? AND kind = ? AND server_id = ?")
    .run(nickname, user.id, body.accountId, body.kind, body.serverId)
  if (result.changes === 0) throw new HttpError(404, "Only the users a server is assigned to can give it their own name.")
  audit({
    user,
    action: nickname
      ? `Named ${KIND_META[body.kind].label.toLowerCase()} "${nickname}" for themselves`
      : `Reset their name for this ${KIND_META[body.kind].label.toLowerCase()}`,
    accountId: body.accountId,
    kind: body.kind,
    serverId: body.serverId,
    ip: clientIp(req),
    status: 200,
  })
  return json({ ok: true, nickname })
})
