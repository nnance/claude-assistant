import { createAgent } from './agent.js'
import { createLogger, loadConfig } from './config.js'
import { MemoryExtractor, MemoryStore } from './memory/index.js'
import { HeartbeatRunner, SchedulerRunner, SchedulerStore } from './scheduler/index.js'
import { SessionStore } from './sessions/store.js'
import { createSlackApp } from './slack/app.js'

async function main() {
  const config = loadConfig()
  const logger = createLogger(config)

  logger.info('Starting Claude Assistant')

  // Initialize session store
  const sessionStore = new SessionStore(config.sessions.databasePath)
  logger.info({ databasePath: config.sessions.databasePath }, 'Session store initialized')

  // Clean up expired sessions
  const expiredCount = sessionStore.deleteExpired(config.sessions.expireDays)
  if (expiredCount > 0) {
    logger.info({ expiredCount }, 'Cleaned up expired sessions')
  }

  // Initialize memory system
  let memoryStore: MemoryStore | undefined
  let memoryExtractor: MemoryExtractor | undefined

  if (config.memory.enabled) {
    memoryStore = new MemoryStore(config.memory.memoryPath)
    memoryStore.ensureDirectories()
    memoryExtractor = new MemoryExtractor(memoryStore, logger)
    logger.info({ memoryPath: config.memory.memoryPath }, 'Memory system initialized')
  }

  // Initialize agent
  const agent = createAgent(config.agent, logger, memoryStore, memoryExtractor)
  logger.info({ model: config.agent.model }, 'Agent initialized')

  // Initialize Slack app
  const slackApp = createSlackApp({
    config: config.slack,
    agent,
    sessionStore,
    logger,
    logLevel: config.logLevel,
  })

  // Initialize proactive systems
  let schedulerStore: SchedulerStore | undefined
  let schedulerRunner: SchedulerRunner | undefined
  let heartbeatRunner: HeartbeatRunner | undefined

  if (config.proactive.enabled) {
    schedulerStore = new SchedulerStore(config.proactive.schedulerDatabasePath)
    logger.info(
      { databasePath: config.proactive.schedulerDatabasePath },
      'Scheduler store initialized',
    )

    schedulerRunner = new SchedulerRunner({
      agent,
      slackClient: slackApp.client,
      sessionStore,
      schedulerStore,
      logger,
    })

    heartbeatRunner = new HeartbeatRunner({
      agent,
      slackClient: slackApp.client,
      sessionStore,
      config: config.proactive,
      logger,
    })

    schedulerRunner.start()
    heartbeatRunner.start()
    logger.info('Proactive systems enabled')
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...')
    schedulerRunner?.stop()
    heartbeatRunner?.stop()
    schedulerStore?.close()
    sessionStore.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Start the Slack app
  await slackApp.start()

  logger.info('Claude Assistant is running')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
