import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { SessionStore } from '../sessions/store.js'

describe('SessionStore', () => {
  const testDbPath = './data/test-sessions.db'
  let store: SessionStore

  beforeEach(() => {
    const dir = path.dirname(testDbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    store = new SessionStore(testDbPath)
  })

  afterEach(() => {
    store.close()
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    const walPath = `${testDbPath}-wal`
    const shmPath = `${testDbPath}-shm`
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath)
    }
    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath)
    }
  })

  describe('create', () => {
    it('should create a new session', () => {
      const session = store.create({
        slack_channel_id: 'C123',
        slack_thread_ts: '1234567890.123456',
      })

      assert.ok(session.id !== undefined, 'session.id should be defined')
      assert.strictEqual(session.slack_channel_id, 'C123')
      assert.strictEqual(session.slack_thread_ts, '1234567890.123456')
      assert.strictEqual(session.agent_session_id, null)
      assert.ok(session.created_at instanceof Date)
      assert.ok(session.last_active instanceof Date)
    })
  })

  describe('getByThread', () => {
    it('should return null for non-existent session', () => {
      const session = store.getByThread('C123', '1234567890.123456')
      assert.strictEqual(session, null)
    })

    it('should return session by thread', () => {
      const created = store.create({
        slack_channel_id: 'C123',
        slack_thread_ts: '1234567890.123456',
      })

      const found = store.getByThread('C123', '1234567890.123456')

      assert.notStrictEqual(found, null)
      assert.strictEqual(found?.id, created.id)
    })
  })

  describe('getById', () => {
    it('should return null for non-existent id', () => {
      const session = store.getById('non-existent-id')
      assert.strictEqual(session, null)
    })

    it('should return session by id', () => {
      const created = store.create({
        slack_channel_id: 'C123',
        slack_thread_ts: '1234567890.123456',
      })

      const found = store.getById(created.id)

      assert.notStrictEqual(found, null)
      assert.strictEqual(found?.id, created.id)
    })
  })

  describe('getOrCreate', () => {
    it('should create new session if not exists', () => {
      const session = store.getOrCreate('C123', '1234567890.123456')

      assert.ok(session.id !== undefined, 'session.id should be defined')
      assert.strictEqual(session.slack_channel_id, 'C123')
    })

    it('should return existing session if exists', () => {
      const first = store.getOrCreate('C123', '1234567890.123456')
      const second = store.getOrCreate('C123', '1234567890.123456')

      assert.strictEqual(second.id, first.id)
    })
  })

  describe('updateAgentSessionId', () => {
    it('should update agent session id', () => {
      const session = store.create({
        slack_channel_id: 'C123',
        slack_thread_ts: '1234567890.123456',
      })

      store.updateAgentSessionId(session.id, 'agent-session-123')

      const updated = store.getById(session.id)
      assert.strictEqual(updated?.agent_session_id, 'agent-session-123')
    })
  })

  describe('deleteExpired', () => {
    it('should not delete recent sessions', () => {
      store.create({
        slack_channel_id: 'C123',
        slack_thread_ts: '1234567890.123456',
      })

      const deleted = store.deleteExpired(7)

      assert.strictEqual(deleted, 0)
      assert.notStrictEqual(store.getByThread('C123', '1234567890.123456'), null)
    })
  })
})
