import fs from "fs";
import path from "path";
import type { AdvisoryEvent, AdvisorySession } from "@/types/advisory";
import { getDatabase } from "@/lib/local-db";

export type AdvisorySessionRecord = AdvisorySession & Record<string, unknown>;

const LEGACY_DATA_DIR = path.join(process.cwd(), "data", "advisory");

type SessionRow = {
  id: string;
  data_json: string;
  json_mtime_ms: number | null;
};

function ensureLegacyDataDir() {
  fs.mkdirSync(LEGACY_DATA_DIR, { recursive: true });
}

export function advisorySessionFilePath(id: string) {
  return path.join(LEGACY_DATA_DIR, `${id}.json`);
}

function sessionJsonMtime(id: string) {
  const filePath = advisorySessionFilePath(id);
  if (!fs.existsSync(filePath)) return null;
  return Math.trunc(fs.statSync(filePath).mtimeMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSession(raw: string): AdvisorySessionRecord | null {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) return null;
  if (typeof parsed.id !== "string" || typeof parsed.topic !== "string") {
    return null;
  }
  return parsed as AdvisorySessionRecord;
}

function normalizeSession(session: AdvisorySessionRecord): AdvisorySessionRecord {
  return {
    ...session,
    mode: session.mode || "roundtable",
    status: session.status || "active",
    agents: Array.isArray(session.agents) ? session.agents : [],
    createdAt: session.createdAt || new Date().toISOString(),
  };
}

function getString(session: AdvisorySessionRecord, key: keyof AdvisorySessionRecord) {
  const value = session[key];
  return typeof value === "string" ? value : null;
}

function getSearchBody(session: AdvisorySessionRecord) {
  const events = Array.isArray(session.events) ? session.events : [];
  return events
    .map((event) => {
      if (!isRecord(event)) return "";
      const speaker = typeof event.speaker === "string" ? event.speaker : "";
      const text = typeof event.text === "string" ? event.text : "";
      return `${speaker} ${text}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

function upsertSession(sessionInput: AdvisorySessionRecord, jsonMtimeMs: number | null) {
  const db = getDatabase();
  const session = normalizeSession(sessionInput);
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(session);

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO advisory_sessions (
        id,
        user_id,
        topic,
        title,
        mode,
        status,
        created_at,
        updated_at,
        completed_at,
        json_mtime_ms,
        data_json
      )
      VALUES (@id, @userId, @topic, @title, @mode, @status, @createdAt, @updatedAt, @completedAt, @jsonMtimeMs, @dataJson)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        topic = excluded.topic,
        title = excluded.title,
        mode = excluded.mode,
        status = excluded.status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at,
        json_mtime_ms = excluded.json_mtime_ms,
        data_json = excluded.data_json
    `).run({
      id: session.id,
      userId: getString(session, "userId"),
      topic: session.topic,
      title: getString(session, "title"),
      mode: session.mode,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: now,
      completedAt: getString(session, "completedAt"),
      jsonMtimeMs,
      dataJson,
    });

    db.prepare("DELETE FROM advisory_sessions_fts WHERE id = ?").run(session.id);
    db.prepare(`
      INSERT INTO advisory_sessions_fts (id, topic, title, body)
      VALUES (?, ?, ?, ?)
    `).run(session.id, session.topic, getString(session, "title") ?? "", getSearchBody(session));
  });

  transaction();
  return session;
}

function readRowSession(row: SessionRow): AdvisorySessionRecord | null {
  try {
    return parseSession(row.data_json);
  } catch {
    return null;
  }
}

export function syncLegacyJsonSessionsToDatabase() {
  ensureLegacyDataDir();

  const files = fs
    .readdirSync(LEGACY_DATA_DIR)
    .filter((file) => file.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(LEGACY_DATA_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const session = parseSession(raw);
      if (!session) continue;

      const currentMtime = Math.trunc(fs.statSync(filePath).mtimeMs);
      const existing = getDatabase()
        .prepare("SELECT json_mtime_ms FROM advisory_sessions WHERE id = ?")
        .get(session.id) as { json_mtime_ms?: number | null } | undefined;

      if (existing?.json_mtime_ms === currentMtime) continue;
      upsertSession(session, currentMtime);
    } catch {
      continue;
    }
  }
}

export function listAdvisorySessions(userId: string) {
  syncLegacyJsonSessionsToDatabase();
  const rows = getDatabase()
    .prepare(`
      SELECT id, data_json, json_mtime_ms
      FROM advisory_sessions
      WHERE user_id IS NULL OR user_id = ?
      ORDER BY datetime(created_at) DESC
    `)
    .all(userId) as SessionRow[];

  return rows
    .map(readRowSession)
    .filter((session): session is AdvisorySessionRecord => Boolean(session))
    .filter((session) => session.archived !== true);
}

export function getAdvisorySession(id: string) {
  syncLegacyJsonSessionsToDatabase();
  const row = getDatabase()
    .prepare("SELECT id, data_json, json_mtime_ms FROM advisory_sessions WHERE id = ?")
    .get(id) as SessionRow | undefined;

  return row ? readRowSession(row) : null;
}

export function saveAdvisorySession(sessionInput: AdvisorySessionRecord) {
  ensureLegacyDataDir();
  const session = normalizeSession(sessionInput);
  return upsertSession(session, sessionJsonMtime(session.id));
}

export function patchAdvisorySession(
  id: string,
  updates: Record<string, unknown>
) {
  const session = getAdvisorySession(id);
  if (!session) return null;
  return saveAdvisorySession({ ...session, ...updates });
}

export function appendAdvisoryEvent(id: string, event: AdvisoryEvent) {
  const session = getAdvisorySession(id);
  if (!session) return null;
  const events = Array.isArray(session.events) ? session.events : [];
  return saveAdvisorySession({
    ...session,
    events: [...events, event],
  });
}

function getSessionIdFromPath(filePath: string) {
  const normalized = path.normalize(filePath);
  const match = normalized.match(/(?:^|\/)data\/advisory\/(session-[^/]+)\.json$/);
  return match?.[1] ?? null;
}

export const sessionFileStore = {
  existsSync(filePath: string) {
    const sessionId = getSessionIdFromPath(filePath);
    if (sessionId) return Boolean(getAdvisorySession(sessionId));
    return fs.existsSync(filePath);
  },

  readFileSync(filePath: string, encoding?: BufferEncoding) {
    const sessionId = getSessionIdFromPath(filePath);
    if (sessionId) {
      const session = getAdvisorySession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      return JSON.stringify(session, null, 2);
    }
    return fs.readFileSync(filePath, encoding ?? "utf-8");
  },

  writeFileSync(filePath: string, data: string | NodeJS.ArrayBufferView, options?: fs.WriteFileOptions) {
    const sessionId = getSessionIdFromPath(filePath);
    if (sessionId) {
      const raw =
        typeof data === "string"
          ? data
          : Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf-8");
      const session = parseSession(raw);
      if (!session) {
        throw new Error(`Invalid advisory session payload for ${sessionId}`);
      }
      saveAdvisorySession(session);
      return;
    }
    fs.writeFileSync(filePath, data, options);
  },

  mkdirSync: fs.mkdirSync,
  appendFileSync: fs.appendFileSync,
  readdirSync: fs.readdirSync,
  statSync: fs.statSync,
};
