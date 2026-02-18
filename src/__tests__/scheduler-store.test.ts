import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { SchedulerStore } from '../scheduler/store.js'

describe('SchedulerStore', () => {
  const testDbPath = './data/test-scheduler.db'
  let store: SchedulerStore

  beforeEach(() => {
    const dir = path.dirname(testDbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    store = new SchedulerStore(testDbPath)
  })

  afterEach(() => {
    store.close()
    for (const suffix of ['', '-wal', '-shm']) {
      const p = `${testDbPath}${suffix}`
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  describe('create', () => {
    it('should create a one-shot job', () => {
      const nextRun = new Date('2025-06-01T09:00:00Z')
      const job = store.create(
        {
          name: 'Test Reminder',
          job_type: 'one_shot',
          schedule: '2025-06-01T09:00:00Z',
          prompt: 'Remind me to check email',
        },
        nextRun,
      )

      assert.ok(job.id)
      assert.strictEqual(job.name, 'Test Reminder')
      assert.strictEqual(job.job_type, 'one_shot')
      assert.strictEqual(job.status, 'active')
      assert.strictEqual(job.prompt, 'Remind me to check email')
      assert.strictEqual(job.failure_count, 0)
    })

    it('should create a recurring job', () => {
      const nextRun = new Date('2025-06-01T09:00:00Z')
      const job = store.create(
        {
          name: 'Morning Briefing',
          job_type: 'recurring',
          schedule: '0 9 * * 1-5',
          prompt: 'Check calendar',
        },
        nextRun,
      )

      assert.strictEqual(job.job_type, 'recurring')
      assert.strictEqual(job.schedule, '0 9 * * 1-5')
    })
  })

  describe('getById', () => {
    it('should return null for non-existent id', () => {
      assert.strictEqual(store.getById('non-existent'), null)
    })

    it('should return job by id', () => {
      const created = store.create(
        { name: 'Test', job_type: 'one_shot', schedule: '2025-06-01T09:00:00Z', prompt: 'test' },
        new Date('2025-06-01T09:00:00Z'),
      )

      const found = store.getById(created.id)
      assert.strictEqual(found?.id, created.id)
      assert.strictEqual(found?.name, 'Test')
    })
  })

  describe('list', () => {
    it('should list only active jobs by default', () => {
      store.create(
        { name: 'Active', job_type: 'one_shot', schedule: '2025-06-01T09:00:00Z', prompt: 'a' },
        new Date('2025-06-01T09:00:00Z'),
      )
      const job2 = store.create(
        { name: 'Paused', job_type: 'one_shot', schedule: '2025-06-02T09:00:00Z', prompt: 'b' },
        new Date('2025-06-02T09:00:00Z'),
      )
      store.updateStatus(job2.id, 'paused')

      const active = store.list()
      assert.strictEqual(active.length, 1)
      assert.strictEqual(active[0]?.name, 'Active')
    })

    it('should list all jobs when includeAll is true', () => {
      store.create(
        { name: 'Active', job_type: 'one_shot', schedule: '2025-06-01T09:00:00Z', prompt: 'a' },
        new Date('2025-06-01T09:00:00Z'),
      )
      const job2 = store.create(
        { name: 'Paused', job_type: 'one_shot', schedule: '2025-06-02T09:00:00Z', prompt: 'b' },
        new Date('2025-06-02T09:00:00Z'),
      )
      store.updateStatus(job2.id, 'paused')

      const all = store.list(true)
      assert.strictEqual(all.length, 2)
    })
  })

  describe('getDueJobs', () => {
    it('should return jobs that are due', () => {
      store.create(
        { name: 'Past', job_type: 'one_shot', schedule: '2025-01-01T00:00:00Z', prompt: 'past' },
        new Date('2025-01-01T00:00:00Z'),
      )
      store.create(
        {
          name: 'Future',
          job_type: 'one_shot',
          schedule: '2099-01-01T00:00:00Z',
          prompt: 'future',
        },
        new Date('2099-01-01T00:00:00Z'),
      )

      const due = store.getDueJobs(new Date('2025-06-01T00:00:00Z'))
      assert.strictEqual(due.length, 1)
      assert.strictEqual(due[0]?.name, 'Past')
    })
  })

  describe('updateAfterRun', () => {
    it('should complete a one-shot job', () => {
      const job = store.create(
        { name: 'Once', job_type: 'one_shot', schedule: '2025-06-01T09:00:00Z', prompt: 'once' },
        new Date('2025-06-01T09:00:00Z'),
      )

      store.updateAfterRun(job.id, null)

      const updated = store.getById(job.id)
      assert.strictEqual(updated?.status, 'completed')
      assert.ok(updated?.last_run_at)
    })

    it('should reschedule a recurring job', () => {
      const job = store.create(
        { name: 'Daily', job_type: 'recurring', schedule: '0 9 * * *', prompt: 'daily' },
        new Date('2025-06-01T09:00:00Z'),
      )

      const nextRun = new Date('2025-06-02T09:00:00Z')
      store.updateAfterRun(job.id, nextRun)

      const updated = store.getById(job.id)
      assert.strictEqual(updated?.status, 'active')
      assert.strictEqual(updated?.next_run_at, nextRun.toISOString())
      assert.ok(updated?.last_run_at)
    })
  })

  describe('incrementFailureCount', () => {
    it('should increment and return failure count', () => {
      const job = store.create(
        { name: 'Failing', job_type: 'one_shot', schedule: '2025-06-01T09:00:00Z', prompt: 'fail' },
        new Date('2025-06-01T09:00:00Z'),
      )

      const count1 = store.incrementFailureCount(job.id)
      assert.strictEqual(count1, 1)

      const count2 = store.incrementFailureCount(job.id)
      assert.strictEqual(count2, 2)
    })
  })

  describe('delete', () => {
    it('should delete a job', () => {
      const job = store.create(
        { name: 'Temp', job_type: 'one_shot', schedule: '2025-06-01T09:00:00Z', prompt: 'temp' },
        new Date('2025-06-01T09:00:00Z'),
      )

      const deleted = store.delete(job.id)
      assert.strictEqual(deleted, true)
      assert.strictEqual(store.getById(job.id), null)
    })

    it('should return false for non-existent job', () => {
      assert.strictEqual(store.delete('non-existent'), false)
    })
  })
})
