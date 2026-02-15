import assert from 'node:assert/strict'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { logInteraction } from '../tools/vault/log-interaction.js'

const TEST_VAULT_PATH = '/tmp/test-vault-assistant'

describe('vault-log-interaction', () => {
  const todayLogFile = `${new Date().toISOString().split('T')[0]}.md`

  before(async () => {
    await mkdir(join(TEST_VAULT_PATH, '_system', 'logs'), { recursive: true })
    try {
      await rm(join(TEST_VAULT_PATH, '_system', 'logs', todayLogFile), { force: true })
    } catch {
      // File might not exist
    }
  })

  after(async () => {
    await rm(TEST_VAULT_PATH, { recursive: true, force: true })
  })

  describe('logInteraction', () => {
    it('creates log file with header and content', async () => {
      const result = await logInteraction(TEST_VAULT_PATH, {
        input: 'Test message for logging',
      })

      assert.equal(result.success, true)
      assert.ok(result.log_path)
      assert.ok(result.log_path.startsWith('_system/logs/'))
      assert.ok(result.log_path.endsWith('.md'))

      const content = await readFile(join(TEST_VAULT_PATH, result.log_path), 'utf-8')

      assert.ok(content.includes('# Interaction Log:'))
      assert.ok(content.includes('**Input:** "Test message for logging"'))
    })

    it('appends multiple entries to same day file', async () => {
      const result1 = await logInteraction(TEST_VAULT_PATH, {
        input: 'First entry for append test',
      })

      assert.equal(result1.success, true)
      assert.ok(result1.log_path)

      const result2 = await logInteraction(TEST_VAULT_PATH, {
        input: 'Second entry for append test',
      })

      assert.equal(result2.success, true)
      assert.equal(result1.log_path, result2.log_path)

      const content = await readFile(join(TEST_VAULT_PATH, result1.log_path), 'utf-8')

      assert.ok(content.includes('**Input:** "First entry for append test"'))
      assert.ok(content.includes('**Input:** "Second entry for append test"'))
      const headerMatches = content.match(/# Interaction Log:/g) || []
      assert.equal(headerMatches.length, 1)
    })

    it('formats entry with all fields', async () => {
      const result = await logInteraction(TEST_VAULT_PATH, {
        input: 'Follow up with Sarah about security audit',
        category: 'Tasks',
        confidence: 92,
        reasoning: 'Clear action verb, named person, specific topic',
        tags: ['person/sarah', 'project/security-audit', 'priority/high'],
        stored_path: 'Tasks/follow-up-sarah.md',
      })

      assert.equal(result.success, true)
      assert.ok(result.log_path)

      const content = await readFile(join(TEST_VAULT_PATH, result.log_path), 'utf-8')

      assert.ok(content.includes('**Input:** "Follow up with Sarah about security audit"'))
      assert.ok(content.includes('**Categorization:**'))
      assert.ok(content.includes('- Category: Tasks'))
      assert.ok(content.includes('- Confidence: 92%'))
      assert.ok(content.includes('- Reasoning: Clear action verb'))
      assert.ok(content.includes('**Tags assigned:**'))
      assert.ok(content.includes('- person/sarah'))
      assert.ok(content.includes('- project/security-audit'))
      assert.ok(content.includes('- priority/high'))
      assert.ok(content.includes('**Stored:** `Tasks/follow-up-sarah.md`'))
    })

    it('formats entry with minimal fields (input only)', async () => {
      const result = await logInteraction(TEST_VAULT_PATH, {
        input: 'Simple minimal message',
      })

      assert.equal(result.success, true)
      assert.ok(result.log_path)

      const content = await readFile(join(TEST_VAULT_PATH, result.log_path), 'utf-8')

      assert.ok(content.includes('**Input:** "Simple minimal message"'))
    })

    it('formats entry with clarification', async () => {
      const result = await logInteraction(TEST_VAULT_PATH, {
        input: 'interesting article about zero-trust',
        clarification: 'Is this a link to save or a concept to research?',
        user_response: 'link to save',
        category: 'Reference',
        confidence: 95,
        reasoning: 'User clarified this is a link to save',
      })

      assert.equal(result.success, true)
      assert.ok(result.log_path)

      const content = await readFile(join(TEST_VAULT_PATH, result.log_path), 'utf-8')

      assert.ok(content.includes('**Clarification requested:** "Is this a link to save'))
      assert.ok(content.includes('**User response:** "link to save"'))
      assert.ok(content.includes('- Category: Reference'))
      assert.ok(content.includes('- Confidence: 95%'))
    })

    it('returns correct log path format', async () => {
      const result = await logInteraction(TEST_VAULT_PATH, {
        input: 'Test path format',
      })

      assert.equal(result.success, true)
      assert.ok(result.log_path)

      const pathMatch = result.log_path.match(/^_system\/logs\/\d{4}-\d{2}-\d{2}\.md$/)
      assert.ok(pathMatch, 'Log path should match expected format')
    })

    it('includes timestamp in entry', async () => {
      const result = await logInteraction(TEST_VAULT_PATH, {
        input: 'Test timestamp',
      })

      assert.equal(result.success, true)
      assert.ok(result.log_path)

      const content = await readFile(join(TEST_VAULT_PATH, result.log_path), 'utf-8')

      const timeMatch = content.match(/## \d{2}:\d{2}:\d{2}/)
      assert.ok(timeMatch, 'Should have timestamp heading')
    })
  })
})
