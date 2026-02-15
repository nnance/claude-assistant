import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { vaultList } from '../tools/vault/vault-list.js'

const TEST_VAULT_PATH = '/tmp/test-vault-assistant'

describe('vault-list', () => {
  before(async () => {
    await mkdir(join(TEST_VAULT_PATH, 'Tasks'), { recursive: true })
    await mkdir(join(TEST_VAULT_PATH, 'Ideas'), { recursive: true })
    await mkdir(join(TEST_VAULT_PATH, 'Reference'), { recursive: true })

    await writeFile(
      join(TEST_VAULT_PATH, 'Tasks', 'task1.md'),
      `---
created: 2026-01-10T14:00:00Z
tags:
  - person/sarah
  - priority/high
confidence: 90
---

# Follow up with Sarah

Content here.
`,
      'utf-8',
    )

    await writeFile(
      join(TEST_VAULT_PATH, 'Tasks', 'task2.md'),
      `---
created: 2026-01-09T10:00:00Z
tags:
  - person/john
  - priority/low
confidence: 80
---

# Review John's PR

Content here.
`,
      'utf-8',
    )

    await writeFile(
      join(TEST_VAULT_PATH, 'Ideas', 'idea1.md'),
      `---
created: 2026-01-08T08:00:00Z
tags: [topic/ai, priority/high]
confidence: 75
---

# AI-powered automation

Great idea about AI.
`,
      'utf-8',
    )

    await writeFile(
      join(TEST_VAULT_PATH, 'Reference', 'ref1.md'),
      `---
created: 2026-01-07T12:00:00Z
tags: []
confidence: 100
---

# Documentation Link

Reference content.
`,
      'utf-8',
    )
  })

  after(async () => {
    await rm(TEST_VAULT_PATH, { recursive: true, force: true })
  })

  describe('vaultList', () => {
    it('lists all files when no folder specified', async () => {
      const result = await vaultList(TEST_VAULT_PATH, {})

      assert.equal(result.success, true)
      assert.ok(result.files)
      assert.ok(result.files.length >= 4)
    })

    it('lists files from specific folder', async () => {
      const result = await vaultList(TEST_VAULT_PATH, { folder: 'Tasks' })

      assert.equal(result.success, true)
      assert.ok(result.files)
      assert.ok(result.files.length >= 2)
      assert.ok(result.files.every((f) => f.filepath.startsWith('Tasks/')))
    })

    it('filters by single tag', async () => {
      const result = await vaultList(TEST_VAULT_PATH, { tags: ['person/sarah'] })

      assert.equal(result.success, true)
      assert.ok(result.files)
      assert.ok(result.files.length >= 1)
      assert.ok(result.files.every((f) => f.tags.includes('person/sarah')))
    })

    it('filters by multiple tags (AND logic)', async () => {
      const result = await vaultList(TEST_VAULT_PATH, {
        tags: ['person/sarah', 'priority/high'],
      })

      assert.equal(result.success, true)
      assert.ok(result.files)
      assert.ok(result.files.length >= 1)
      assert.ok(
        result.files.every(
          (f) => f.tags.includes('person/sarah') && f.tags.includes('priority/high'),
        ),
      )
    })

    it('respects limit parameter', async () => {
      const result = await vaultList(TEST_VAULT_PATH, { limit: 2 })

      assert.equal(result.success, true)
      assert.ok(result.files)
      assert.equal(result.files.length, 2)
    })

    it('returns empty array for empty folder', async () => {
      await mkdir(join(TEST_VAULT_PATH, 'EmptyTestFolder'), { recursive: true })

      const result = await vaultList(TEST_VAULT_PATH, { folder: 'EmptyTestFolder' })

      assert.equal(result.success, true)
      assert.ok(result.files)
      assert.equal(result.files.length, 0)
    })

    it('handles missing folder gracefully', async () => {
      const result = await vaultList(TEST_VAULT_PATH, { folder: 'NonExistent' })

      assert.equal(result.success, true)
      assert.ok(result.files)
      assert.equal(result.files.length, 0)
    })

    it('sorts by created date (newest first)', async () => {
      const result = await vaultList(TEST_VAULT_PATH, { folder: 'Tasks' })

      assert.equal(result.success, true)
      assert.ok(result.files)
      assert.ok(result.files.length >= 2)

      const dates = result.files.map((f) => new Date(f.created).getTime())
      for (let i = 1; i < dates.length; i++) {
        assert.ok(dates[i - 1]! >= dates[i]!, 'Files should be sorted newest first')
      }
    })

    it('extracts title from H1 heading', async () => {
      const result = await vaultList(TEST_VAULT_PATH, { folder: 'Tasks' })

      assert.equal(result.success, true)
      assert.ok(result.files)

      const sarahTask = result.files.find((f) => f.filepath.includes('task1.md'))
      assert.ok(sarahTask)
      assert.equal(sarahTask.title, 'Follow up with Sarah')
    })

    it('parses inline tag format', async () => {
      const result = await vaultList(TEST_VAULT_PATH, { folder: 'Ideas' })

      assert.equal(result.success, true)
      assert.ok(result.files)

      const idea = result.files.find((f) => f.filepath.includes('idea1.md'))
      assert.ok(idea)
      assert.ok(idea.tags.includes('topic/ai'))
      assert.ok(idea.tags.includes('priority/high'))
    })

    it('blocks path traversal attempts', async () => {
      const result = await vaultList(TEST_VAULT_PATH, { folder: '../etc' })

      assert.equal(result.success, false)
      assert.equal(result.error, 'Invalid folder path: directory traversal not allowed')
    })
  })
})
