import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { logInteraction } from './log-interaction.js'
import { vaultList } from './vault-list.js'
import { vaultRead } from './vault-read.js'
import { vaultWrite } from './vault-write.js'

const VaultFolderEnum = z.enum(['Tasks', 'Ideas', 'Reference', 'Projects', 'Inbox', 'Archive'])

export function createVaultTools(vaultPath: string) {
  const vaultWriteTool = tool(
    'vault_write',
    'Create a new note in the Obsidian vault with YAML frontmatter, tags, and confidence score',
    {
      folder: VaultFolderEnum.describe('Target folder for the note'),
      title: z.string().describe('Title of the note'),
      content: z
        .string()
        .describe('Markdown content of the note (excluding frontmatter and title)'),
      tags: z
        .array(z.string())
        .describe('Hierarchical tags (e.g., person/sarah, priority/high, topic/ai)'),
      confidence: z
        .number()
        .min(0)
        .max(100)
        .describe('Confidence score for the categorization (0-100)'),
    },
    async (args) => {
      const result = await vaultWrite(vaultPath, args)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      }
    },
  )

  const vaultReadTool = tool(
    'vault_read',
    'Read the contents of a note from the Obsidian vault by its relative path',
    {
      filepath: z
        .string()
        .describe('Path relative to vault root (e.g., "Tasks/2026-01-10_follow-up.md")'),
    },
    async (args) => {
      const result = await vaultRead(vaultPath, args)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      }
    },
  )

  const vaultListTool = tool(
    'vault_list',
    'List and filter notes in the Obsidian vault by folder, tags, or both',
    {
      folder: z.string().optional().describe('Folder to list (all content folders if omitted)'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Filter by tags (AND logic - must have all specified tags)'),
      limit: z.number().optional().describe('Max results (default 20)'),
    },
    async (args) => {
      const result = await vaultList(vaultPath, args)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      }
    },
  )

  const vaultLogInteractionTool = tool(
    'vault_log_interaction',
    'Log an interaction to the vault audit log for tracking categorization decisions',
    {
      input: z.string().describe("User's original message"),
      category: z.string().optional().describe('Assigned category (Tasks, Ideas, etc.)'),
      confidence: z.number().optional().describe('Confidence score (0-100)'),
      reasoning: z.string().optional().describe('Why this categorization was chosen'),
      tags: z.array(z.string()).optional().describe('Assigned tags'),
      stored_path: z.string().optional().describe('Where the note was stored'),
      clarification: z.string().optional().describe('Clarification question asked (if any)'),
      user_response: z.string().optional().describe("User's response to clarification (if any)"),
    },
    async (args) => {
      const result = await logInteraction(vaultPath, args)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      }
    },
  )

  return [vaultWriteTool, vaultReadTool, vaultListTool, vaultLogInteractionTool]
}

export function createVaultMcpServer(vaultPath: string) {
  return createSdkMcpServer({
    name: 'vault-tools',
    version: '1.0.0',
    tools: createVaultTools(vaultPath),
  })
}

// Re-export types and functions for direct usage/testing
export type { VaultFolder, VaultWriteParams, VaultWriteResult } from './vault-write.js'
export { generateSlug, vaultWrite } from './vault-write.js'
export type { VaultReadParams, VaultReadResult } from './vault-read.js'
export { vaultRead } from './vault-read.js'
export type { VaultFileInfo, VaultListParams, VaultListResult } from './vault-list.js'
export { vaultList } from './vault-list.js'
export type { LogInteractionParams, LogInteractionResult } from './log-interaction.js'
export { logInteraction } from './log-interaction.js'
