import { HttpError, json, requireApiAdmin, route } from "@/lib/http"
import { isKind } from "@/lib/kinds"
import { assignmentsFor, listAllServers } from "@/lib/servers"

/** All servers of one kind on every Leaseweb account, with who they are assigned to. */
export const GET = route(async (req) => {
  requireApiAdmin(req)
  const kind = req.nextUrl.searchParams.get("kind") ?? "dedicated"
  if (!isKind(kind)) throw new HttpError(400, "Unknown server type.")
  const refresh = req.nextUrl.searchParams.get("refresh") === "1"
  const { servers, errors } = await listAllServers(kind, refresh)
  const assigned = assignmentsFor(kind)
  return json({
    servers: servers.map((s) => ({ ...s, assignees: assigned.get(`${s.accountId}:${s.id}`) ?? [] })),
    errors,
  })
})
