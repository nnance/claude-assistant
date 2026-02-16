import * as os from 'node:os'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Logger } from 'pino'
import type { MemoryStore } from './store.js'

export interface SlackContext {
  channelId: string
  threadTs: string
  channelName?: string
}

export interface ExtractionInput {
  userMessage: string
  agentResponse: string
  slackContext: SlackContext
}

export class MemoryExtractor {
  private logger: Logger
  private memoryStore: MemoryStore

  constructor(memoryStore: MemoryStore, logger: Logger) {
    this.memoryStore = memoryStore
    this.logger = logger.child({ component: 'memory-extractor' })
  }

  extractAndStore(input: ExtractionInput): void {
    this.runExtraction(input).catch((error) => {
      this.logger.error({ error }, 'Memory extraction failed')
    })
  }

  private async runExtraction(input: ExtractionInput): Promise<void> {
    const channelLabel = input.slackContext.channelName || input.slackContext.channelId
    const memoryPath = this.memoryStore.dailyDir.replace(/\/daily$/, '')

    const prompt = `Analyze this Slack conversation and extract any important memories.

## Slack Context
- Channel: #${channelLabel}
- Thread: ${input.slackContext.threadTs}

## User Message
${input.userMessage}

## Agent Response
${input.agentResponse}

## Instructions
Use the /memory skill to analyze this conversation and extract memories. The memory path is: ${memoryPath}`

    this.logger.debug({ channelLabel }, 'Starting memory extraction')

    const q = query({
      prompt,
      options: {
        model: 'claude-haiku-4-5-20251001',
        maxTurns: 5,
        permissionMode: 'acceptEdits',
        settingSources: ['user', 'local'],
        additionalDirectories: [os.homedir(), memoryPath],
      },
    })

    for await (const _msg of q) {
      // Drain the async iterator to completion
    }

    this.logger.debug({ channelLabel }, 'Memory extraction complete')
  }
}
