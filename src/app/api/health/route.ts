import { db } from "@/lib/db"
import { json } from "@/lib/http"

export function GET() {
  db().prepare("SELECT 1").get()
  return json({ ok: true })
}
