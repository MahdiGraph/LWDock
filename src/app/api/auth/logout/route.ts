import { deleteSession, SESSION_COOKIE } from "@/lib/auth"
import { json, route } from "@/lib/http"

export const POST = route(async (req) => {
  deleteSession(req.cookies.get(SESSION_COOKIE)?.value)
  const res = json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
})
