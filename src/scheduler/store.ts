import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import Database from 'better-sqlite3'
import type { CreateJobInput, JobStatus, ScheduledJob } from './types.js'

export class SchedulerStore {
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
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        job_type TEXT NOT NULL,
        schedule TEXT NOT NULL,
        next_run_at TEXT NOT NULL,
        last_run_at TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        prompt TEXT NOT NULL,
        failure_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_next_run ON scheduled_jobs(next_run_at);
      CREATE INDEX IF NOT EXISTS idx_status ON scheduled_jobs(status);
    `)
  }

  create(input: CreateJobInput, nextRunAt: Date): ScheduledJob {
    const id = randomUUID()
    const now = new Date().toISOString()

    const stmt = this.db.prepare(`
      INSERT INTO scheduled_jobs (id, name, description, job_type, schedule, next_run_at, status, prompt, failure_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 0, ?, ?)
    `)
    stmt.run(
      id,
      input.name,
      input.description ?? null,
      input.job_type,
      input.schedule,
      nextRunAt.toISOString(),
      input.prompt,
      now,
      now,
    )

    // biome-ignore lint/style/noNonNullAssertion: row was just inserted
    return this.getById(id)!
  }

  getById(id: string): ScheduledJob | null {
    const stmt = this.db.prepare<[string], ScheduledJob>(`
      SELECT * FROM scheduled_jobs WHERE id = ?
    `)
    return stmt.get(id) ?? null
  }

  findByName(name: string): ScheduledJob | null {
    const stmt = this.db.prepare<[string], ScheduledJob>(`
      SELECT * FROM scheduled_jobs WHERE name = ? AND status = 'active' LIMIT 1
    `)
    return stmt.get(name) ?? null
  }

  list(includeAll = false): ScheduledJob[] {
    if (includeAll) {
      return this.db
        .prepare<[], ScheduledJob>('SELECT * FROM scheduled_jobs ORDER BY next_run_at')
        .all()
    }
    return this.db
      .prepare<[], ScheduledJob>(
        "SELECT * FROM scheduled_jobs WHERE status = 'active' ORDER BY next_run_at",
      )
      .all()
  }

  getDueJobs(now: Date): ScheduledJob[] {
    const stmt = this.db.prepare<[string], ScheduledJob>(`
      SELECT * FROM scheduled_jobs
      WHERE status = 'active' AND next_run_at <= ?
      ORDER BY next_run_at
    `)
    return stmt.all(now.toISOString())
  }

  updateAfterRun(id: string, nextRunAt: Date | null): void {
    const now = new Date().toISOString()
    if (nextRunAt) {
      // Recurring job - update next run time and reset failure count
      const stmt = this.db.prepare(`
        UPDATE scheduled_jobs
        SET last_run_at = ?, next_run_at = ?, failure_count = 0, updated_at = ?
        WHERE id = ?
      `)
      stmt.run(now, nextRunAt.toISOString(), now, id)
    } else {
      // One-shot job - mark as completed
      const stmt = this.db.prepare(`
        UPDATE scheduled_jobs
        SET last_run_at = ?, status = 'completed', updated_at = ?
        WHERE id = ?
      `)
      stmt.run(now, now, id)
    }
  }

  incrementFailureCount(id: string): number {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      UPDATE scheduled_jobs
      SET failure_count = failure_count + 1, updated_at = ?
      WHERE id = ?
    `)
    stmt.run(now, id)

    const job = this.getById(id)
    return job?.failure_count ?? 0
  }

  updateStatus(id: string, status: JobStatus): void {
    const stmt = this.db.prepare(`
      UPDATE scheduled_jobs SET status = ?, updated_at = ? WHERE id = ?
    `)
    stmt.run(status, new Date().toISOString(), id)
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM scheduled_jobs WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  close(): void {
    this.db.close()
  }
}
