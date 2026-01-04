import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
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

      expect(session.id).toBeDefined()
      expect(session.slack_channel_id).toBe('C123')
      expect(session.slack_thread_ts).toBe('1234567890.123456')
      expect(session.agent_session_id).toBeNull()
      expect(session.created_at).toBeInstanceOf(Date)
      expect(session.last_active).toBeInstanceOf(Date)
    })
  })

  describe('getByThread', () => {
    it('should return null for non-existent session', () => {
      const session = store.getByThread('C123', '1234567890.123456')
      expect(session).toBeNull()
    })

    it('should return session by thread', () => {
      const created = store.create({
        slack_channel_id: 'C123',
        slack_thread_ts: '1234567890.123456',
      })

      const found = store.getByThread('C123', '1234567890.123456')

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
    })
  })

  describe('getById', () => {
    it('should return null for non-existent id', () => {
      const session = store.getById('non-existent-id')
      expect(session).toBeNull()
    })

    it('should return session by id', () => {
      const created = store.create({
        slack_channel_id: 'C123',
        slack_thread_ts: '1234567890.123456',
      })

      const found = store.getById(created.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
    })
  })

  describe('getOrCreate', () => {
    it('should create new session if not exists', () => {
      const session = store.getOrCreate('C123', '1234567890.123456')

      expect(session.id).toBeDefined()
      expect(session.slack_channel_id).toBe('C123')
    })

    it('should return existing session if exists', () => {
      const first = store.getOrCreate('C123', '1234567890.123456')
      const second = store.getOrCreate('C123', '1234567890.123456')

      expect(second.id).toBe(first.id)
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
      expect(updated?.agent_session_id).toBe('agent-session-123')
    })
  })

  describe('deleteExpired', () => {
    it('should not delete recent sessions', () => {
      store.create({
        slack_channel_id: 'C123',
        slack_thread_ts: '1234567890.123456',
      })

      const deleted = store.deleteExpired(7)

      expect(deleted).toBe(0)
      expect(store.getByThread('C123', '1234567890.123456')).not.toBeNull()
    })
  })
})
