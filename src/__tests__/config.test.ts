import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { loadConfig } from '../config.js'

describe('loadConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
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

    assert.strictEqual(config.slack.botToken, 'xoxb-test-token')
    assert.strictEqual(config.slack.appToken, 'xapp-test-token')
    assert.strictEqual(config.slack.signingSecret, 'test-secret')
  })

  it('should use default values when optional variables are not set', () => {
    // Clear AGENT_MODEL to test default value
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['AGENT_MODEL'] = undefined
    const config = loadConfig()

    assert.strictEqual(config.agent.model, 'claude-sonnet-4-5-20250929')
    assert.strictEqual(config.agent.maxTurns, 50)
    assert.strictEqual(config.sessions.databasePath, './data/sessions.db')
    assert.strictEqual(config.sessions.expireDays, 7)
  })

  it('should parse comma-separated tool config', () => {
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['TOOL_SHELL_ALLOWED_COMMANDS'] = 'git,npm,ls'
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['TOOL_BROWSER_WHITELIST'] = '*.example.com,*.test.com'

    const config = loadConfig()

    assert.deepStrictEqual(config.tools.shellAllowedCommands, ['git', 'npm', 'ls'])
    assert.deepStrictEqual(config.tools.browserWhitelist, ['*.example.com', '*.test.com'])
  })

  it('should handle wildcard for shell commands', () => {
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['TOOL_SHELL_ALLOWED_COMMANDS'] = '*'

    const config = loadConfig()

    assert.deepStrictEqual(config.tools.shellAllowedCommands, ['*'])
  })

  it('should throw error for missing required environment variables', () => {
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    process.env['SLACK_BOT_TOKEN'] = undefined

    assert.throws(() => loadConfig(), {
      message: /Missing required environment variable: SLACK_BOT_TOKEN/,
    })
  })
})
