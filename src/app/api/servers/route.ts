import { json, requireApiUser, route } from "@/lib/http"
import { listUserServers } from "@/lib/servers"

/** The servers assigned to the signed-in user. */
export const GET = route(async (req) => {
  const user = requireApiUser(req)
  return json({ servers: await listUserServers(user) })
})
