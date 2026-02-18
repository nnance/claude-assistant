import { execSync } from 'node:child_process'
import type { Logger } from 'pino'
import type { Agent } from '../agent.js'
import type { ProactiveConfig } from '../config.js'
import { computeNextRun } from './cron.js'
import type { SchedulerStore } from './store.js'
import type { ScheduledJob } from './types.js'

const MAX_FAILURES = 3
const TICK_INTERVAL_MS = 60_000
const HEARTBEAT_JOB_NAME = 'Heartbeat'
const HEARTBEAT_CRON = '*/30 * * * *'
const HEARTBEAT_PROMPT =
  'Read the file data/HEARTBEAT.md for standing instructions. Follow them and check if any action is needed right now. If something requires attention, send a DM to the owner using the Slack CLI with a concise notification. If nothing requires attention, do nothing.'

export class SchedulerRunner {
  private agent: Agent
  private schedulerStore: SchedulerStore
  private config: ProactiveConfig
  private logger: Logger
  private interval: ReturnType<typeof setInterval> | null = null
  private runningJobs = new Set<string>()

  constructor(deps: {
    agent: Agent
    schedulerStore: SchedulerStore
    config: ProactiveConfig
    logger: Logger
  }) {
    this.agent = deps.agent
    this.schedulerStore = deps.schedulerStore
    this.config = deps.config
    this.logger = deps.logger.child({ component: 'scheduler-runner' })
  }

  start(): void {
    this.ensureHeartbeatJob()
    this.logger.info('Scheduler runner started (60s tick)')
    this.interval = setInterval(() => this.tick(), TICK_INTERVAL_MS)
    // Run first tick immediately
    this.tick()
  }

  private ensureHeartbeatJob(): void {
    const existing = this.schedulerStore.findByName(HEARTBEAT_JOB_NAME)
    if (existing) return

    const nextRun = computeNextRun(HEARTBEAT_CRON)
    this.schedulerStore.create(
      {
        name: HEARTBEAT_JOB_NAME,
        job_type: 'recurring',
        schedule: HEARTBEAT_CRON,
        prompt: HEARTBEAT_PROMPT,
      },
      nextRun,
    )
    this.logger.info('Heartbeat job created automatically')
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.logger.info('Scheduler runner stopped')
  }

  private isWithinActiveHours(): boolean {
    const hour = new Date().getHours()
    return hour >= this.config.activeHoursStart && hour < this.config.activeHoursEnd
  }

  async tick(): Promise<void> {
    try {
      if (!this.isWithinActiveHours()) {
        this.logger.debug('Outside active hours, skipping tick')
        return
      }

      const dueJobs = this.schedulerStore.getDueJobs(new Date())
      if (dueJobs.length === 0) return

      this.logger.info({ count: dueJobs.length }, 'Found due jobs')

      for (const job of dueJobs) {
        if (this.runningJobs.has(job.id)) {
          this.logger.debug({ jobId: job.id }, 'Job already running, skipping')
          continue
        }
        // Fire and forget - don't block the tick loop
        this.executeJob(job)
      }
    } catch (error) {
      this.logger.error({ error }, 'Error in scheduler tick')
    }
  }

  private async executeJob(job: ScheduledJob): Promise<void> {
    this.runningJobs.add(job.id)
    this.logger.info({ jobId: job.id, name: job.name }, 'Executing scheduled job')

    try {
      await this.agent.send(job.prompt)

      // Update job state
      if (job.job_type === 'recurring') {
        const nextRun = computeNextRun(job.schedule)
        this.schedulerStore.updateAfterRun(job.id, nextRun)
        this.logger.info(
          { jobId: job.id, nextRun: nextRun.toISOString() },
          'Recurring job rescheduled',
        )
      } else {
        this.schedulerStore.updateAfterRun(job.id, null)
        this.logger.info({ jobId: job.id }, 'One-shot job completed')
      }
    } catch (error) {
      this.logger.error({ error, jobId: job.id }, 'Job execution failed')
      const failureCount = this.schedulerStore.incrementFailureCount(job.id)
      if (failureCount >= MAX_FAILURES) {
        this.schedulerStore.updateStatus(job.id, 'failed')
        this.logger.warn({ jobId: job.id, failureCount }, 'Job disabled after max failures')

        try {
          execSync(
            `npx tsx src/slack/cli.ts send-dm "⚠️ *Scheduled job failed: ${job.name}*\nDisabled after ${failureCount} consecutive failures."`,
            { timeout: 15_000, stdio: 'pipe' },
          )
        } catch (dmError) {
          this.logger.error({ error: dmError }, 'Failed to send failure alert DM')
        }
      }
    } finally {
      this.runningJobs.delete(job.id)
    }
  }
}
