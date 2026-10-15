import crypto from "node:crypto"
import { encryptionKey } from "./config"

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 64

function scrypt(password: string, salt: Buffer, keylen: number, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, KEY_LEN, SCRYPT_N, SCRYPT_R, SCRYPT_P)
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64"), key.toString("base64")].join("$")
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split("$")
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false
  const expected = Buffer.from(keyB64, "base64")
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, Number(n), Number(r), Number(p))
  return key.length === expected.length && crypto.timingSafeEqual(key, expected)
}

/** A real hash of a random password, used to keep login timing even for unknown users. */
let dummyHash: Promise<string> | null = null
export function getDummyHash() {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex"))
  return dummyHash
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":")
}

/** Returns null when the value cannot be decrypted (for example after APP_SECRET changed). */
export function decrypt(payload: string): string | null {
  try {
    const [v, ivB64, tagB64, dataB64] = payload.split(":")
    if (v !== "v1") return null
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url")
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}
