import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const APP_NAME = "Leaseweb Dock"
export const APP_VERSION = process.env.npm_package_version ?? "1.0.0"

/** Where the SQLite database and the generated secret live. */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR)
  : path.join(/*turbopackIgnore: true*/ process.cwd(), "data")

let cachedKey: Buffer | null = null

/**
 * The 32-byte key used to encrypt secrets (API key, proxy password) at rest.
 * Taken from APP_SECRET when set, otherwise generated once and stored in DATA_DIR.
 */
export function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey
  let secret = process.env.APP_SECRET?.trim() ?? ""
  if (secret.length < 16) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const file = path.join(/*turbopackIgnore: true*/ DATA_DIR, "secret.key")
    if (fs.existsSync(file)) {
      secret = fs.readFileSync(file, "utf8").trim()
    } else {
      secret = crypto.randomBytes(32).toString("hex")
      fs.writeFileSync(file, secret, { mode: 0o600 })
    }
  }
  cachedKey = crypto.createHash("sha256").update(`lwdock:${secret}`).digest()
  return cachedKey
}

/** "auto" (default) marks cookies Secure only when the request came over HTTPS. */
export function cookieSecureMode(): "auto" | boolean {
  const v = process.env.COOKIE_SECURE?.toLowerCase()
  if (v === "true" || v === "1") return true
  if (v === "false" || v === "0") return false
  return "auto"
}
