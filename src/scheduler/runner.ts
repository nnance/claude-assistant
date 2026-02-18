import type { App } from '@slack/bolt'
import type { Logger } from 'pino'
import type { Agent } from '../agent.js'
import type { SessionStore } from '../sessions/store.js'
import { computeNextRun } from './cron.js'
import { deliverDM } from './deliver.js'
import type { SchedulerStore } from './store.js'
import type { ScheduledJob } from './types.js'

const MAX_FAILURES = 3
const TICK_INTERVAL_MS = 60_000

export class SchedulerRunner {
  private agent: Agent
  private slackClient: App['client']
  private sessionStore: SessionStore
  private schedulerStore: SchedulerStore
  private logger: Logger
  private interval: ReturnType<typeof setInterval> | null = null
  private runningJobs = new Set<string>()

  constructor(deps: {
    agent: Agent
    slackClient: App['client']
    sessionStore: SessionStore
    schedulerStore: SchedulerStore
    logger: Logger
  }) {
    this.agent = deps.agent
    this.slackClient = deps.slackClient
    this.sessionStore = deps.sessionStore
    this.schedulerStore = deps.schedulerStore
    this.logger = deps.logger.child({ component: 'scheduler-runner' })
  }

  start(): void {
    this.logger.info('Scheduler runner started (60s tick)')
    this.interval = setInterval(() => this.tick(), TICK_INTERVAL_MS)
    // Run first tick immediately
    this.tick()
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.logger.info('Scheduler runner stopped')
  }

  private async tick(): Promise<void> {
    try {
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
      const result = await this.agent.send(job.prompt)

      await deliverDM({
        slackClient: this.slackClient,
        sessionStore: this.sessionStore,
        message: `*Scheduled: ${job.name}*\n\n${result.response}`,
        logger: this.logger,
      })

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

        await deliverDM({
          slackClient: this.slackClient,
          sessionStore: this.sessionStore,
          message: `*Scheduled job failed: ${job.name}*\nDisabled after ${failureCount} consecutive failures.`,
          logger: this.logger,
        })
      }
    } finally {
      this.runningJobs.delete(job.id)
    }
  }
}
