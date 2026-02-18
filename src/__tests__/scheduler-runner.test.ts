import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { SchedulerRunner } from '../scheduler/runner.js'
import { SchedulerStore } from '../scheduler/store.js'
import { SessionStore } from '../sessions/store.js'

function createMockLogger() {
  const noop = () => {}
  const logger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    child: () => logger,
  }
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  return logger as any
}

function createMockAgent(response = 'Test response') {
  return {
    send: mock.fn(async () => ({ response, sessionId: 'test-session' })),
    // biome-ignore lint/suspicious/noExplicitAny: test mock
  } as any
}

function createMockSlackClient() {
  return {
    conversations: {
      open: mock.fn(async () => ({ channel: { id: 'D123' } })),
    },
    chat: {
      postMessage: mock.fn(async () => ({})),
    },
    // biome-ignore lint/suspicious/noExplicitAny: test mock
  } as any
}

describe('SchedulerRunner', () => {
  const testSessionDbPath = './data/test-runner-sessions.db'
  const testSchedulerDbPath = './data/test-runner-scheduler.db'
  let sessionStore: SessionStore
  let schedulerStore: SchedulerStore

  beforeEach(() => {
    const dir = path.dirname(testSessionDbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    for (const p of [testSessionDbPath, testSchedulerDbPath]) {
      for (const suffix of ['', '-wal', '-shm']) {
        const full = `${p}${suffix}`
        if (fs.existsSync(full)) fs.unlinkSync(full)
      }
    }
    sessionStore = new SessionStore(testSessionDbPath)
    sessionStore.setSetting('owner_slack_user_id', 'U123')
    schedulerStore = new SchedulerStore(testSchedulerDbPath)
  })

  afterEach(() => {
    sessionStore.close()
    schedulerStore.close()
    for (const p of [testSessionDbPath, testSchedulerDbPath]) {
      for (const suffix of ['', '-wal', '-shm']) {
        const full = `${p}${suffix}`
        if (fs.existsSync(full)) fs.unlinkSync(full)
      }
    }
  })

  it('should skip tick outside active hours', async () => {
    const agent = createMockAgent()
    const currentHour = new Date().getHours()
    const start = (currentHour + 2) % 24
    const end = (currentHour + 4) % 24

    // Create a due job to verify it's not executed
    schedulerStore.create(
      { name: 'Test', job_type: 'one_shot', schedule: '2025-01-01T00:00:00Z', prompt: 'test' },
      new Date('2025-01-01T00:00:00Z'),
    )

    const runner = new SchedulerRunner({
      agent,
      slackClient: createMockSlackClient(),
      sessionStore,
      schedulerStore,
      config: {
        enabled: true,
        activeHoursStart: start,
        activeHoursEnd: end,
        schedulerDatabasePath: testSchedulerDbPath,
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    assert.strictEqual(agent.send.mock.callCount(), 0)
  })

  it('should suppress NO_ACTION responses', async () => {
    const agent = createMockAgent('NO_ACTION')
    const slackClient = createMockSlackClient()

    schedulerStore.create(
      { name: 'Check', job_type: 'one_shot', schedule: '2025-01-01T00:00:00Z', prompt: 'check' },
      new Date('2025-01-01T00:00:00Z'),
    )

    const runner = new SchedulerRunner({
      agent,
      slackClient,
      sessionStore,
      schedulerStore,
      config: {
        enabled: true,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        schedulerDatabasePath: testSchedulerDbPath,
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    // Wait for async executeJob to complete
    await new Promise((resolve) => setTimeout(resolve, 50))

    assert.strictEqual(agent.send.mock.callCount(), 1)
    assert.strictEqual(slackClient.chat.postMessage.mock.callCount(), 0)
  })

  it('should deliver non-NO_ACTION responses via DM', async () => {
    const agent = createMockAgent('You have a meeting in 15 minutes')
    const slackClient = createMockSlackClient()

    schedulerStore.create(
      {
        name: 'Alert',
        job_type: 'one_shot',
        schedule: '2025-01-01T00:00:00Z',
        prompt: 'check calendar',
      },
      new Date('2025-01-01T00:00:00Z'),
    )

    const runner = new SchedulerRunner({
      agent,
      slackClient,
      sessionStore,
      schedulerStore,
      config: {
        enabled: true,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        schedulerDatabasePath: testSchedulerDbPath,
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    await new Promise((resolve) => setTimeout(resolve, 50))

    assert.strictEqual(agent.send.mock.callCount(), 1)
    assert.strictEqual(slackClient.chat.postMessage.mock.callCount(), 1)
  })

  it('should mark one-shot jobs as completed after execution', async () => {
    const agent = createMockAgent('Done')
    const slackClient = createMockSlackClient()

    const job = schedulerStore.create(
      {
        name: 'Once',
        job_type: 'one_shot',
        schedule: '2025-01-01T00:00:00Z',
        prompt: 'remind me',
      },
      new Date('2025-01-01T00:00:00Z'),
    )

    const runner = new SchedulerRunner({
      agent,
      slackClient,
      sessionStore,
      schedulerStore,
      config: {
        enabled: true,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        schedulerDatabasePath: testSchedulerDbPath,
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    await new Promise((resolve) => setTimeout(resolve, 50))

    const updated = schedulerStore.getById(job.id)
    assert.strictEqual(updated?.status, 'completed')
  })

  it('should reschedule recurring jobs after execution', async () => {
    const agent = createMockAgent('Report ready')
    const slackClient = createMockSlackClient()

    const job = schedulerStore.create(
      {
        name: 'Daily',
        job_type: 'recurring',
        schedule: '0 9 * * *',
        prompt: 'daily report',
      },
      new Date('2025-01-01T09:00:00Z'),
    )

    const runner = new SchedulerRunner({
      agent,
      slackClient,
      sessionStore,
      schedulerStore,
      config: {
        enabled: true,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        schedulerDatabasePath: testSchedulerDbPath,
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    await new Promise((resolve) => setTimeout(resolve, 50))

    const updated = schedulerStore.getById(job.id)
    assert.strictEqual(updated?.status, 'active')
    assert.ok(updated?.last_run_at)
    // next_run_at should be updated to a future time
    assert.ok(updated?.next_run_at)
    assert.notStrictEqual(updated?.next_run_at, '2025-01-01T09:00:00.000Z')
  })

  it('should disable jobs after 3 consecutive failures', async () => {
    const agent = {
      send: mock.fn(async () => {
        throw new Error('Agent error')
      }),
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any
    const slackClient = createMockSlackClient()

    const job = schedulerStore.create(
      {
        name: 'Failing',
        job_type: 'one_shot',
        schedule: '2025-01-01T00:00:00Z',
        prompt: 'will fail',
      },
      new Date('2025-01-01T00:00:00Z'),
    )

    // Pre-set failure count to 2 so next failure triggers disable
    schedulerStore.incrementFailureCount(job.id)
    schedulerStore.incrementFailureCount(job.id)

    const runner = new SchedulerRunner({
      agent,
      slackClient,
      sessionStore,
      schedulerStore,
      config: {
        enabled: true,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        schedulerDatabasePath: testSchedulerDbPath,
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    await new Promise((resolve) => setTimeout(resolve, 50))

    const updated = schedulerStore.getById(job.id)
    assert.strictEqual(updated?.status, 'failed')
  })
})
