import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "./db"
import { randomToken, sha256 } from "./crypto"

export const SESSION_COOKIE = "lwdock_session"
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type Role = "admin" | "user"

export type User = {
  id: number
  username: string
  name: string | null
  role: Role
  disabled: number
  created_at: number
  last_login_at: number | null
}

export function hasUsers(): boolean {
  return !!db().prepare("SELECT 1 FROM users LIMIT 1").get()
}

export function createSession(userId: number, ip: string | null, userAgent: string | null) {
  const token = randomToken()
  const now = Date.now()
  db()
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)")
    .run(sha256(token), userId, now, now + SESSION_TTL_MS, ip, userAgent?.slice(0, 300) ?? null)
  db().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, userId)
  return { token, expires: new Date(now + SESSION_TTL_MS) }
}

export function deleteSession(token: string | undefined) {
  if (token) db().prepare("DELETE FROM sessions WHERE id = ?").run(sha256(token))
}

export function deleteUserSessions(userId: number, exceptToken?: string) {
  if (exceptToken) {
    db().prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").run(userId, sha256(exceptToken))
  } else {
    db().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId)
  }
}

export function userFromToken(token: string | undefined | null): User | null {
  if (!token) return null
  const row = db()
    .prepare(
      `SELECT u.id, u.username, u.name, u.role, u.disabled, u.created_at, u.last_login_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
    )
    .get(sha256(token)) as (User & { expires_at: number }) | undefined
  if (!row || row.expires_at < Date.now() || row.disabled) return null
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { expires_at, ...user } = row
  return user
}

/** For server components and pages. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies()
  return userFromToken(store.get(SESSION_COOKIE)?.value)
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect(hasUsers() ? "/login" : "/setup")
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (user.role !== "admin") redirect("/servers")
  return user
}
