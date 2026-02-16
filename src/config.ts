import { config as dotenvConfig } from 'dotenv'
import pino from 'pino'

dotenvConfig()

export interface SlackConfig {
  botToken: string
  appToken: string
  signingSecret: string
  socketMode: boolean
}

export interface AgentConfig {
  model: string
  maxTurns: number
}

export interface SessionConfig {
  databasePath: string
  expireDays: number
}

export interface ToolConfig {
  shellAllowedCommands: string[]
  shellTimeoutMs: number
  browserWhitelist: string[]
}

export interface MemoryConfig {
  memoryPath: string
  enabled: boolean
}

export interface Config {
  slack: SlackConfig
  agent: AgentConfig
  sessions: SessionConfig
  tools: ToolConfig
  memory: MemoryConfig
  logLevel: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue
}

function parseCommaSeparated(value: string): string[] {
  if (value === '*') {
    return ['*']
  }
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function loadConfig(): Config {
  // Validate that ANTHROPIC_API_KEY is set (the SDK reads it directly from env)
  requireEnv('ANTHROPIC_API_KEY')

  return {
    slack: {
      botToken: requireEnv('SLACK_BOT_TOKEN'),
      appToken: requireEnv('SLACK_APP_TOKEN'),
      signingSecret: requireEnv('SLACK_SIGNING_SECRET'),
      socketMode: optionalEnv('SLACK_SOCKET_MODE', 'true') === 'true',
    },
    agent: {
      model: optionalEnv('AGENT_MODEL', 'claude-sonnet-4-5-20250929'),
      maxTurns: Number.parseInt(optionalEnv('AGENT_MAX_TURNS', '50'), 10),
    },
    sessions: {
      databasePath: optionalEnv('SESSION_DATABASE_PATH', './data/sessions.db'),
      expireDays: Number.parseInt(optionalEnv('SESSION_EXPIRE_DAYS', '7'), 10),
    },
    tools: {
      shellAllowedCommands: parseCommaSeparated(optionalEnv('TOOL_SHELL_ALLOWED_COMMANDS', '*')),
      shellTimeoutMs: Number.parseInt(optionalEnv('TOOL_SHELL_TIMEOUT_MS', '30000'), 10),
      browserWhitelist: parseCommaSeparated(
        optionalEnv('TOOL_BROWSER_WHITELIST', '*.google.com,*.github.com,*.stackoverflow.com'),
      ),
    },
    memory: {
      memoryPath: optionalEnv('MEMORY_PATH', 'data/memory'),
      enabled: optionalEnv('MEMORY_ENABLED', 'true') === 'true',
    },
    logLevel: optionalEnv('LOG_LEVEL', 'info'),
  }
}

export function createLogger(config: Config) {
  return pino({
    level: config.logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  })
}
