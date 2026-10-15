import { NextResponse, type NextRequest } from "next/server"
import type { z } from "zod"
import { SESSION_COOKIE, userFromToken, type User } from "./auth"
import { cookieSecureMode } from "./config"
import { LeasewebError } from "./leaseweb"

export class HttpError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })
}

export function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null
}

export function isHttps(req: NextRequest) {
  const mode = cookieSecureMode()
  if (mode !== "auto") return mode
  return req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" || req.nextUrl.protocol === "https:"
}

export function sessionUser(req: NextRequest): User | null {
  return userFromToken(req.cookies.get(SESSION_COOKIE)?.value)
}

export function requireApiUser(req: NextRequest): User {
  const user = sessionUser(req)
  if (!user) throw new HttpError(401, "You are not signed in.")
  return user
}

export function requireApiAdmin(req: NextRequest): User {
  const user = requireApiUser(req)
  if (user.role !== "admin") throw new HttpError(403, "Only admins can do this.")
  return user
}

/**
 * Cross-site request protection: browsers tag requests from other sites with
 * Sec-Fetch-Site: cross-site, and mutating calls must carry a JSON body type,
 * which a plain HTML form on another site cannot send.
 */
function guardCrossSite(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Cross-site request refused.")
  const type = req.headers.get("content-type") ?? ""
  const hasBody = req.headers.get("content-length") !== "0" && req.headers.has("content-type")
  if (hasBody && !type.includes("application/json")) throw new HttpError(415, "Send JSON.")
}

export async function readJson<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    const text = await req.text()
    if (text.length > 256 * 1024) throw new HttpError(413, "Request body is too large.")
    raw = text ? JSON.parse(text) : {}
  } catch (e) {
    if (e instanceof HttpError) throw e
    throw new HttpError(400, "Invalid JSON body.")
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new HttpError(400, first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request.")
  }
  return parsed.data
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>

export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      guardCrossSite(req)
      return await fn(req, ctx)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, details: e.details }, e.status)
      if (e instanceof LeasewebError) {
        const status = e.status >= 400 && e.status < 600 ? e.status : 502
        return json({ error: e.message, code: e.code, correlationId: e.correlationId, details: e.details }, status)
      }
      console.error(e)
      return json({ error: "Something went wrong on the server." }, 500)
    }
  }
}
