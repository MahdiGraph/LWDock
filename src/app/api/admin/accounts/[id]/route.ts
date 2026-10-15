import { z } from "zod"
import { clientIp, HttpError, json, readJson, requireApiAdmin, route } from "@/lib/http"
import { assignmentCount, deleteAccount, getAccount, listAccounts, updateAccount } from "@/lib/accounts"
import { AccountName, ApiKey } from "@/lib/schemas"
import { audit } from "@/lib/audit"

type Ctx = { params: Promise<{ id: string }> }

async function load(ctx: Ctx) {
  const account = getAccount(Number((await ctx.params).id))
  if (!account) throw new HttpError(404, "Account not found.")
  return account
}

const Patch = z.object({ name: AccountName.optional(), apiKey: ApiKey.optional() })

export const PATCH = route<Ctx>(async (req, ctx) => {
  const admin = requireApiAdmin(req)
  const account = await load(ctx)
  const body = await readJson(req, Patch)
  if (body.name && listAccounts().some((a) => a.id !== account.id && a.name.toLowerCase() === body.name!.toLowerCase())) {
    throw new HttpError(409, "An account with that name already exists.")
  }
  updateAccount(account.id, body)
  const changes = [body.name && body.name !== account.name ? `renamed to "${body.name}"` : null, body.apiKey ? "new API key" : null]
  audit({
    user: admin,
    action: `Updated Leaseweb account "${account.name}" (${changes.filter(Boolean).join(", ") || "no changes"})`,
    ip: clientIp(req),
    status: 200,
  })
  return json({ ok: true, accounts: listAccounts() })
})

export const DELETE = route<Ctx>(async (req, ctx) => {
  const admin = requireApiAdmin(req)
  const account = await load(ctx)
  const assigned = assignmentCount(account.id)
  deleteAccount(account.id)
  audit({
    user: admin,
    action: `Removed Leaseweb account "${account.name}"${assigned ? ` and ${assigned} assignment(s)` : ""}`,
    ip: clientIp(req),
    status: 200,
  })
  return json({ ok: true, accounts: listAccounts() })
})
