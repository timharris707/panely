import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DEFAULT_DB_DIR = path.join(process.cwd(), "data");
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, "panely.sqlite");

let db: Database.Database | null = null;

export function getDatabasePath() {
  return process.env.PANELY_DB_PATH || DEFAULT_DB_PATH;
}

export function getDatabase() {
  if (db) return db;

  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS local_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS advisory_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      topic TEXT NOT NULL,
      title TEXT,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      json_mtime_ms INTEGER,
      data_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_advisory_sessions_created_at
      ON advisory_sessions(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_advisory_sessions_user_status
      ON advisory_sessions(user_id, status);

    CREATE VIRTUAL TABLE IF NOT EXISTS advisory_sessions_fts
      USING fts5(id UNINDEXED, topic, title, body);
  `);

  return db;
}
