import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { DATA_DIR } from "./config"

type DB = Database.Database

const globalForDb = globalThis as unknown as { __lwdockDb?: DB }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  server_id TEXT NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, server_id)
);
CREATE INDEX IF NOT EXISTS assignments_server ON assignments(kind, server_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  kind TEXT,
  server_id TEXT,
  detail TEXT,
  status INTEGER,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS audit_logs_at ON audit_logs(at);
`

/** Schema changes after the first release, applied in order and recorded in user_version. */
const MIGRATIONS: ((db: DB) => void)[] = [
  // 1. Several Leaseweb accounts (API keys) instead of one.
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)
    // The single key of version 0 becomes the first account; it stays encrypted as it was.
    const old = db.prepare("SELECT value FROM settings WHERE key = 'lw.apiKey'").get() as { value: string } | undefined
    let accountId: number | null = null
    if (old) {
      const now = Date.now()
      accountId = Number(
        db
          .prepare("INSERT INTO accounts (name, api_key, created_at, updated_at) VALUES (?, ?, ?, ?)")
          .run("Leaseweb", old.value, now, now).lastInsertRowid
      )
      db.prepare("DELETE FROM settings WHERE key = 'lw.apiKey'").run()
    }
    db.exec(`
      CREATE TABLE assignments_v1 (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        server_id TEXT NOT NULL,
        label TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, account_id, kind, server_id)
      );
    `)
    if (accountId !== null) {
      db.prepare(
        `INSERT INTO assignments_v1 (user_id, account_id, kind, server_id, label, created_at)
         SELECT user_id, ?, kind, server_id, label, created_at FROM assignments`
      ).run(accountId)
    }
    db.exec(`
      DROP TABLE assignments;
      ALTER TABLE assignments_v1 RENAME TO assignments;
      CREATE INDEX assignments_server ON assignments(account_id, kind, server_id);
      ALTER TABLE audit_logs ADD COLUMN account_id INTEGER;
    `)
    if (accountId !== null) db.prepare("UPDATE audit_logs SET account_id = ? WHERE server_id IS NOT NULL").run(accountId)
  },
  // 2. A display name each user can give their own servers; the Leaseweb reference stays untouched.
  (db) => {
    db.exec("ALTER TABLE assignments ADD COLUMN nickname TEXT;")
  },
]

function migrate(db: DB) {
  const version = db.pragma("user_version", { simple: true }) as number
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      MIGRATIONS[v](db)
      db.pragma(`user_version = ${v + 1}`)
    })()
  }
}

function open(): DB {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(path.join(/*turbopackIgnore: true*/ DATA_DIR, "lwdock.db"))
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")
  db.pragma("busy_timeout = 5000")
  db.exec(SCHEMA)
  migrate(db)
  // Drop expired sessions on start.
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now())
  return db
}

export function db(): DB {
  if (!globalForDb.__lwdockDb) globalForDb.__lwdockDb = open()
  return globalForDb.__lwdockDb
}
