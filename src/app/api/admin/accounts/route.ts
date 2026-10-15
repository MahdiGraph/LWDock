import { z } from "zod"
import { clientIp, HttpError, json, readJson, requireApiAdmin, route } from "@/lib/http"
import { createAccount, listAccounts } from "@/lib/accounts"
import { AccountName, ApiKey } from "@/lib/schemas"
import { audit } from "@/lib/audit"

export const GET = route(async (req) => {
  requireApiAdmin(req)
  return json({ accounts: listAccounts() })
})

const Body = z.object({ name: AccountName, apiKey: ApiKey })

export const POST = route(async (req) => {
  const admin = requireApiAdmin(req)
  const body = await readJson(req, Body)
  if (listAccounts().some((a) => a.name.toLowerCase() === body.name.toLowerCase())) {
    throw new HttpError(409, "An account with that name already exists.")
  }
  const id = createAccount(body.name, body.apiKey)
  audit({ user: admin, action: `Added Leaseweb account "${body.name}"`, ip: clientIp(req), status: 200 })
  return json({ ok: true, id, accounts: listAccounts() })
})
