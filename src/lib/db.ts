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

function open(): DB {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(path.join(/*turbopackIgnore: true*/ DATA_DIR, "lwdock.db"))
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")
  db.pragma("busy_timeout = 5000")
  db.exec(SCHEMA)
  // Drop expired sessions on start.
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now())
  return db
}

export function db(): DB {
  if (!globalForDb.__lwdockDb) globalForDb.__lwdockDb = open()
  return globalForDb.__lwdockDb
}
