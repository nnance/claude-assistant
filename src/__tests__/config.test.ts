import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { loadConfig } from '../config.js'

describe('loadConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      SLACK_BOT_TOKEN: 'xoxb-test-token',
      SLACK_APP_TOKEN: 'xapp-test-token',
      SLACK_SIGNING_SECRET: 'test-secret',
      ANTHROPIC_API_KEY: 'sk-ant-test-key',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should load config with required environment variables', () => {
    const config = loadConfig()

    expect(config.slack.botToken).toBe('xoxb-test-token')
    expect(config.slack.appToken).toBe('xapp-test-token')
    expect(config.slack.signingSecret).toBe('test-secret')
  })

  it('should use default values when optional variables are not set', () => {
    // Clear AGENT_MODEL to test default value
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['AGENT_MODEL'] = undefined
    const config = loadConfig()

    expect(config.agent.model).toBe('claude-sonnet-4-5-20250929')
    expect(config.agent.maxTurns).toBe(50)
    expect(config.sessions.databasePath).toBe('./data/sessions.db')
    expect(config.sessions.expireDays).toBe(7)
    expect(config.logLevel).toBe('info')
  })

  it('should parse comma-separated tool config', () => {
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['TOOL_SHELL_ALLOWED_COMMANDS'] = 'git,npm,ls'
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['TOOL_BROWSER_WHITELIST'] = '*.example.com,*.test.com'

    const config = loadConfig()

    expect(config.tools.shellAllowedCommands).toEqual(['git', 'npm', 'ls'])
    expect(config.tools.browserWhitelist).toEqual(['*.example.com', '*.test.com'])
  })

  it('should handle wildcard for shell commands', () => {
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['TOOL_SHELL_ALLOWED_COMMANDS'] = '*'

    const config = loadConfig()

    expect(config.tools.shellAllowedCommands).toEqual(['*'])
  })

  it('should throw error for missing required environment variables', () => {
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['SLACK_BOT_TOKEN'] = undefined

    expect(() => loadConfig()).toThrow('Missing required environment variable: SLACK_BOT_TOKEN')
  })
})
