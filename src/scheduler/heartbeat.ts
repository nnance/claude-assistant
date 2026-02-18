import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import type { App } from '@slack/bolt'
import type { Logger } from 'pino'
import type { Agent } from '../agent.js'
import type { ProactiveConfig } from '../config.js'
import type { SessionStore } from '../sessions/store.js'
import { deliverDM } from './deliver.js'

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours
const HEARTBEAT_OK = 'HEARTBEAT_OK'

export class HeartbeatRunner {
  private agent: Agent
  private slackClient: App['client']
  private sessionStore: SessionStore
  private config: ProactiveConfig
  private logger: Logger
  private interval: ReturnType<typeof setInterval> | null = null
  private recentHashes = new Map<string, number>() // hash -> timestamp

  constructor(deps: {
    agent: Agent
    slackClient: App['client']
    sessionStore: SessionStore
    config: ProactiveConfig
    logger: Logger
  }) {
    this.agent = deps.agent
    this.slackClient = deps.slackClient
    this.sessionStore = deps.sessionStore
    this.config = deps.config
    this.logger = deps.logger.child({ component: 'heartbeat' })
  }

  start(): void {
    const intervalMs = this.config.heartbeatIntervalMinutes * 60 * 1000
    this.logger.info(
      { intervalMinutes: this.config.heartbeatIntervalMinutes },
      'Heartbeat runner started',
    )
    this.interval = setInterval(() => this.tick(), intervalMs)
    // Run first tick immediately
    this.tick()
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.logger.info('Heartbeat runner stopped')
  }

  private isWithinActiveHours(): boolean {
    const hour = new Date().getHours()
    return hour >= this.config.activeHoursStart && hour < this.config.activeHoursEnd
  }

  private cleanExpiredHashes(): void {
    const cutoff = Date.now() - DEDUP_WINDOW_MS
    for (const [hash, timestamp] of this.recentHashes) {
      if (timestamp < cutoff) {
        this.recentHashes.delete(hash)
      }
    }
  }

  private isDuplicate(response: string): boolean {
    const hash = createHash('sha256').update(response.trim()).digest('hex')
    this.cleanExpiredHashes()

    if (this.recentHashes.has(hash)) {
      return true
    }

    this.recentHashes.set(hash, Date.now())
    return false
  }

  async tick(): Promise<void> {
    try {
      if (!this.isWithinActiveHours()) {
        this.logger.debug('Outside active hours, skipping heartbeat')
        return
      }

      let heartbeatContent: string
      try {
        heartbeatContent = fs.readFileSync(this.config.heartbeatPath, 'utf-8').trim()
      } catch {
        this.logger.debug({ path: this.config.heartbeatPath }, 'No heartbeat file found, skipping')
        return
      }

      if (!heartbeatContent) {
        this.logger.debug('Heartbeat file is empty, skipping')
        return
      }

      const now = new Date()
      const prompt = `# Heartbeat Check

Current time: ${now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

## Standing Instructions

${heartbeatContent}

---

Review the standing instructions above. If any action is needed right now (e.g., upcoming events to notify about, tasks due soon, information to check), provide a concise notification message.

If nothing requires attention right now, respond with exactly: HEARTBEAT_OK`

      this.logger.debug('Running heartbeat check')
      const result = await this.agent.send(prompt)

      if (result.response.trim() === HEARTBEAT_OK) {
        this.logger.debug('Heartbeat returned OK, no notification needed')
        return
      }

      if (this.isDuplicate(result.response)) {
        this.logger.debug('Duplicate heartbeat response suppressed')
        return
      }

      await deliverDM({
        slackClient: this.slackClient,
        sessionStore: this.sessionStore,
        message: result.response,
        logger: this.logger,
      })

      this.logger.info('Heartbeat notification delivered')
    } catch (error) {
      this.logger.error({ error }, 'Error in heartbeat tick')
    }
  }
}
