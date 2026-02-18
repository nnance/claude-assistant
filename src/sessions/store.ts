import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import Database from 'better-sqlite3'
import type { CreateSessionInput, Session, SessionRow } from './types.js'

export class SessionStore {
  private db: Database.Database

  constructor(databasePath: string) {
    const dir = path.dirname(databasePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(databasePath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        slack_thread_ts TEXT NOT NULL,
        slack_channel_id TEXT NOT NULL,
        agent_session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(slack_channel_id, slack_thread_ts)
      );

      CREATE INDEX IF NOT EXISTS idx_thread
        ON sessions(slack_channel_id, slack_thread_ts);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }

  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      slack_thread_ts: row.slack_thread_ts,
      slack_channel_id: row.slack_channel_id,
      agent_session_id: row.agent_session_id,
      created_at: new Date(row.created_at),
      last_active: new Date(row.last_active),
    }
  }

  getByThread(channelId: string, threadTs: string): Session | null {
    const stmt = this.db.prepare<[string, string], SessionRow>(`
      SELECT * FROM sessions
      WHERE slack_channel_id = ? AND slack_thread_ts = ?
    `)
    const row = stmt.get(channelId, threadTs)
    return row ? this.rowToSession(row) : null
  }

  getById(id: string): Session | null {
    const stmt = this.db.prepare<[string], SessionRow>(`
      SELECT * FROM sessions WHERE id = ?
    `)
    const row = stmt.get(id)
    return row ? this.rowToSession(row) : null
  }

  create(input: CreateSessionInput): Session {
    const id = randomUUID()
    const now = new Date().toISOString()

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, slack_thread_ts, slack_channel_id, created_at, last_active)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(id, input.slack_thread_ts, input.slack_channel_id, now, now)

    return {
      id,
      slack_thread_ts: input.slack_thread_ts,
      slack_channel_id: input.slack_channel_id,
      agent_session_id: null,
      created_at: new Date(now),
      last_active: new Date(now),
    }
  }

  getOrCreate(channelId: string, threadTs: string): Session {
    const existing = this.getByThread(channelId, threadTs)
    if (existing) {
      this.updateLastActive(existing.id)
      return existing
    }

    return this.create({
      slack_channel_id: channelId,
      slack_thread_ts: threadTs,
    })
  }

  updateAgentSessionId(id: string, agentSessionId: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET agent_session_id = ?, last_active = ?
      WHERE id = ?
    `)
    stmt.run(agentSessionId, new Date().toISOString(), id)
  }

  updateLastActive(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions SET last_active = ? WHERE id = ?
    `)
    stmt.run(new Date().toISOString(), id)
  }

  deleteExpired(expireDays: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM sessions
      WHERE last_active < datetime('now', '-' || ? || ' days')
    `)
    const result = stmt.run(expireDays)
    return result.changes
  }

  getSetting(key: string): string | null {
    const stmt = this.db.prepare<[string], { value: string }>(`
      SELECT value FROM settings WHERE key = ?
    `)
    const row = stmt.get(key)
    return row ? row.value : null
  }

  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
    `)
    stmt.run(key, value)
  }

  close(): void {
    this.db.close()
  }
}
