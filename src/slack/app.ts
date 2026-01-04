import { App, LogLevel } from '@slack/bolt'
import type { SlackConfig } from '../config.js'
import type { Agent } from '../agent.js'
import type { SessionStore } from '../sessions/store.js'
import type { Logger } from 'pino'
import { registerHandlers } from './handlers.js'

function mapLogLevel(level: string): LogLevel {
  switch (level) {
    case 'debug':
      return LogLevel.DEBUG
    case 'info':
      return LogLevel.INFO
    case 'warn':
      return LogLevel.WARN
    case 'error':
      return LogLevel.ERROR
    default:
      return LogLevel.INFO
  }
}

export interface SlackAppDependencies {
  config: SlackConfig
  agent: Agent
  sessionStore: SessionStore
  logger: Logger
  logLevel: string
}

export function createSlackApp(deps: SlackAppDependencies): App {
  const { config, agent, sessionStore, logger, logLevel } = deps
  const slackLogger = logger.child({ component: 'slack' })

  const app = new App({
    token: config.botToken,
    appToken: config.appToken,
    signingSecret: config.signingSecret,
    socketMode: config.socketMode,
    logLevel: mapLogLevel(logLevel),
  })

  // Global error handler
  app.error(async (error) => {
    slackLogger.error({ error }, 'Slack app error')
  })

  // Test auth on startup
  app.client.auth.test().then((result) => {
    slackLogger.info({ botId: result.user_id, team: result.team }, 'Slack auth verified')
  }).catch((error) => {
    slackLogger.error({ error }, 'Slack auth failed - check your SLACK_BOT_TOKEN')
  })

  // Log all incoming events for debugging
  app.use(async (args) => {
    const payload = args.payload as { type?: string } | undefined
    if (payload?.type) {
      slackLogger.debug({ eventType: payload.type }, 'Received Slack event')
    }
    await args.next()
  })

  // Register event handlers
  registerHandlers(app, {
    agent,
    sessionStore,
    logger: slackLogger,
  })

  slackLogger.info('Slack app created')

  return app
}
