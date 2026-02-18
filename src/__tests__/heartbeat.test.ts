import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { HeartbeatRunner } from '../scheduler/heartbeat.js'
import { SessionStore } from '../sessions/store.js'

// Minimal mock logger
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

// Minimal mock agent
function createMockAgent(response = 'HEARTBEAT_OK') {
  return {
    send: mock.fn(async () => ({ response, sessionId: 'test-session' })),
    // biome-ignore lint/suspicious/noExplicitAny: test mock
  } as any
}

// Minimal mock Slack client
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

describe('HeartbeatRunner', () => {
  const testDbPath = './data/test-heartbeat-sessions.db'
  const testHeartbeatPath = './data/test-heartbeat.md'
  let sessionStore: SessionStore

  beforeEach(() => {
    const dir = path.dirname(testDbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    for (const p of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
    sessionStore = new SessionStore(testDbPath)
    // Set owner so DMs can be delivered
    sessionStore.setSetting('owner_slack_user_id', 'U123')
  })

  afterEach(() => {
    sessionStore.close()
    for (const p of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`, testHeartbeatPath]) {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  it('should skip when heartbeat file is missing', async () => {
    const agent = createMockAgent()
    const runner = new HeartbeatRunner({
      agent,
      slackClient: createMockSlackClient(),
      sessionStore,
      config: {
        enabled: true,
        heartbeatIntervalMinutes: 1,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        heartbeatPath: './data/nonexistent-heartbeat.md',
        schedulerDatabasePath: '',
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    assert.strictEqual(agent.send.mock.callCount(), 0)
  })

  it('should skip when heartbeat file is empty', async () => {
    fs.writeFileSync(testHeartbeatPath, '   \n  ')
    const agent = createMockAgent()
    const runner = new HeartbeatRunner({
      agent,
      slackClient: createMockSlackClient(),
      sessionStore,
      config: {
        enabled: true,
        heartbeatIntervalMinutes: 1,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        heartbeatPath: testHeartbeatPath,
        schedulerDatabasePath: '',
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    assert.strictEqual(agent.send.mock.callCount(), 0)
  })

  it('should suppress HEARTBEAT_OK responses', async () => {
    fs.writeFileSync(testHeartbeatPath, 'Check my calendar')
    const agent = createMockAgent('HEARTBEAT_OK')
    const slackClient = createMockSlackClient()
    const runner = new HeartbeatRunner({
      agent,
      slackClient,
      sessionStore,
      config: {
        enabled: true,
        heartbeatIntervalMinutes: 1,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        heartbeatPath: testHeartbeatPath,
        schedulerDatabasePath: '',
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    assert.strictEqual(agent.send.mock.callCount(), 1)
    assert.strictEqual(slackClient.chat.postMessage.mock.callCount(), 0)
  })

  it('should deliver non-OK responses via DM', async () => {
    fs.writeFileSync(testHeartbeatPath, 'Check my calendar')
    const agent = createMockAgent('You have a meeting in 15 minutes')
    const slackClient = createMockSlackClient()
    const runner = new HeartbeatRunner({
      agent,
      slackClient,
      sessionStore,
      config: {
        enabled: true,
        heartbeatIntervalMinutes: 1,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        heartbeatPath: testHeartbeatPath,
        schedulerDatabasePath: '',
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    assert.strictEqual(agent.send.mock.callCount(), 1)
    assert.strictEqual(slackClient.chat.postMessage.mock.callCount(), 1)
  })

  it('should deduplicate identical responses within 24h', async () => {
    fs.writeFileSync(testHeartbeatPath, 'Check my calendar')
    const agent = createMockAgent('You have a meeting at 3pm')
    const slackClient = createMockSlackClient()
    const runner = new HeartbeatRunner({
      agent,
      slackClient,
      sessionStore,
      config: {
        enabled: true,
        heartbeatIntervalMinutes: 1,
        activeHoursStart: 0,
        activeHoursEnd: 24,
        heartbeatPath: testHeartbeatPath,
        schedulerDatabasePath: '',
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    assert.strictEqual(slackClient.chat.postMessage.mock.callCount(), 1)

    // Second tick with same response should be suppressed
    await runner.tick()
    assert.strictEqual(slackClient.chat.postMessage.mock.callCount(), 1)
  })

  it('should skip outside active hours', async () => {
    fs.writeFileSync(testHeartbeatPath, 'Check my calendar')
    const agent = createMockAgent('Something important')
    const currentHour = new Date().getHours()

    // Set active hours to a window that excludes current hour
    const start = (currentHour + 2) % 24
    const end = (currentHour + 4) % 24

    const runner = new HeartbeatRunner({
      agent,
      slackClient: createMockSlackClient(),
      sessionStore,
      config: {
        enabled: true,
        heartbeatIntervalMinutes: 1,
        activeHoursStart: start,
        activeHoursEnd: end,
        heartbeatPath: testHeartbeatPath,
        schedulerDatabasePath: '',
      },
      logger: createMockLogger(),
    })

    await runner.tick()
    assert.strictEqual(agent.send.mock.callCount(), 0)
  })
})
