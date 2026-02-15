import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { vaultRead } from '../tools/vault/vault-read.js'

const TEST_VAULT_PATH = '/tmp/test-vault-assistant'

describe('vault-read', () => {
  before(async () => {
    await mkdir(join(TEST_VAULT_PATH, 'Tasks'), { recursive: true })
    await mkdir(join(TEST_VAULT_PATH, '_system', 'logs'), { recursive: true })

    await writeFile(
      join(TEST_VAULT_PATH, 'Tasks', 'test-note.md'),
      `---
created: 2026-01-10T14:32:00Z
tags:
  - test
confidence: 85
---

# Test Note

This is test content.
`,
      'utf-8',
    )

    await writeFile(
      join(TEST_VAULT_PATH, '_system', 'logs', '2026-01-10.md'),
      '# Interaction Log: 2026-01-10\n\nLog content here.',
      'utf-8',
    )
  })

  after(async () => {
    await rm(TEST_VAULT_PATH, { recursive: true, force: true })
  })

  describe('vaultRead', () => {
    it('reads existing file successfully', async () => {
      const result = await vaultRead(TEST_VAULT_PATH, {
        filepath: 'Tasks/test-note.md',
      })

      assert.equal(result.success, true)
      assert.ok(result.content)
      assert.ok(result.content.includes('# Test Note'))
    })

    it('returns content with frontmatter intact', async () => {
      const result = await vaultRead(TEST_VAULT_PATH, {
        filepath: 'Tasks/test-note.md',
      })

      assert.equal(result.success, true)
      assert.ok(result.content)
      assert.ok(result.content.includes('---'))
      assert.ok(result.content.includes('created: 2026-01-10T14:32:00Z'))
      assert.ok(result.content.includes('- test'))
      assert.ok(result.content.includes('confidence: 85'))
    })

    it('returns error for non-existent file', async () => {
      const result = await vaultRead(TEST_VAULT_PATH, {
        filepath: 'Tasks/does-not-exist.md',
      })

      assert.equal(result.success, false)
      assert.ok(result.error?.includes('File not found'))
    })

    it('blocks path traversal attempts', async () => {
      const result = await vaultRead(TEST_VAULT_PATH, {
        filepath: '../etc/passwd',
      })

      assert.equal(result.success, false)
      assert.equal(result.error, 'Invalid path: directory traversal not allowed')
    })

    it('blocks path with embedded traversal', async () => {
      const result = await vaultRead(TEST_VAULT_PATH, {
        filepath: 'Tasks/../../../etc/passwd',
      })

      assert.equal(result.success, false)
      assert.equal(result.error, 'Invalid path: directory traversal not allowed')
    })

    it('handles files in nested folders', async () => {
      const result = await vaultRead(TEST_VAULT_PATH, {
        filepath: '_system/logs/2026-01-10.md',
      })

      assert.equal(result.success, true)
      assert.ok(result.content)
      assert.ok(result.content.includes('Interaction Log: 2026-01-10'))
    })
  })
})
