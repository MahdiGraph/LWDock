import { db } from "./db"
import { decrypt, encrypt } from "./crypto"

/**
 * A Leaseweb account is one API key. Leaseweb issues a separate key for each of
 * its regional companies (for example the Netherlands and Germany), so the panel
 * can hold several and shows the servers of all of them together.
 */

export type Account = { id: number; name: string; created_at: number; updated_at: number }

type Row = Account & { api_key: string; assignments: number }

export function listAccounts() {
  const rows = db()
    .prepare(
      `SELECT id, name, api_key, created_at, updated_at,
         (SELECT COUNT(*) FROM assignments WHERE account_id = accounts.id) AS assignments
       FROM accounts ORDER BY name COLLATE NOCASE, id`
    )
    .all() as Row[]
  return rows.map(({ api_key, ...account }) => {
    const key = decrypt(api_key)
    return { ...account, keyHint: key ? `••••${key.slice(-4)}` : null, unreadable: !key }
  })
}

export type AccountInfo = ReturnType<typeof listAccounts>[number]

export function getAccount(id: number): Account | null {
  return (
    (db().prepare("SELECT id, name, created_at, updated_at FROM accounts WHERE id = ?").get(id) as Account | undefined) ?? null
  )
}

/** The decrypted API key, or null when the account is missing or the key cannot be read. */
export function accountKey(id: number): string | null {
  const row = db().prepare("SELECT api_key FROM accounts WHERE id = ?").get(id) as { api_key: string } | undefined
  return row ? decrypt(row.api_key) : null
}

export function accountNames(): Map<number, string> {
  const rows = db().prepare("SELECT id, name FROM accounts").all() as { id: number; name: string }[]
  return new Map(rows.map((r) => [r.id, r.name]))
}

export function createAccount(name: string, apiKey: string): number {
  const now = Date.now()
  const info = db()
    .prepare("INSERT INTO accounts (name, api_key, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(name, encrypt(apiKey), now, now)
  return Number(info.lastInsertRowid)
}

export function updateAccount(id: number, patch: { name?: string; apiKey?: string }) {
  const now = Date.now()
  if (patch.name !== undefined) db().prepare("UPDATE accounts SET name = ?, updated_at = ? WHERE id = ?").run(patch.name, now, id)
  if (patch.apiKey) db().prepare("UPDATE accounts SET api_key = ?, updated_at = ? WHERE id = ?").run(encrypt(patch.apiKey), now, id)
}

/** Deletes the account and, through the foreign key, every assignment of its servers. */
export function deleteAccount(id: number) {
  db().prepare("DELETE FROM accounts WHERE id = ?").run(id)
}

export function assignmentCount(id: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM assignments WHERE account_id = ?").get(id) as { n: number }).n
}
