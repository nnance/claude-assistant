import { loadConfig, createLogger } from './config.js'
import { createAgent } from './agent.js'
import { createSlackApp } from './slack/app.js'
import { SessionStore } from './sessions/store.js'

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

  // Initialize agent
  const agent = createAgent(config.agent, logger)
  logger.info({ model: config.agent.model }, 'Agent initialized')

  // Initialize Slack app
  const slackApp = createSlackApp({
    config: config.slack,
    agent,
    sessionStore,
    logger,
    logLevel: config.logLevel,
  })

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...')
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
