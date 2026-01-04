import * as os from 'node:os'
import { type SDKAssistantMessage, type SDKMessage, query } from '@anthropic-ai/claude-agent-sdk'
import type { Logger } from 'pino'
import type { AgentConfig } from './config.js'

export interface AgentResponse {
  response: string
  sessionId: string
}

function extractTextFromMessage(msg: SDKMessage): string {
  if (msg.type !== 'assistant') return ''
  const assistantMsg = msg as SDKAssistantMessage
  const content = assistantMsg.message.content
  let text = ''
  for (const block of content) {
    if (block.type === 'text') {
      text += block.text
    }
  }
  return text
}

export class Agent {
  private config: AgentConfig
  private logger: Logger

  constructor(config: AgentConfig, logger: Logger) {
    this.config = config
    this.logger = logger.child({ component: 'agent' })
  }

  async send(message: string, existingSessionId?: string | null): Promise<AgentResponse> {
    const isResume = !!existingSessionId
    this.logger.info(
      { existingSessionId, isResume, messageLength: message.length },
      isResume ? 'Resuming session' : 'Creating new session',
    )

    const q = query({
      prompt: message,
      options: {
        model: this.config.model,
        maxTurns: this.config.maxTurns,
        // Resume existing session if we have one
        ...(existingSessionId ? { resume: existingSessionId } : {}),
        // Allow access to user's home directory and common locations
        additionalDirectories: [os.homedir(), '/tmp', '/var'],
        // Accept file edits without prompting (since this is a personal assistant)
        permissionMode: 'acceptEdits',
        // Load user settings from ~/.claude/settings.json
        settingSources: ['user'],
      },
    })

    try {
      let sdkSessionId: string | undefined
      let responseText = ''

      for await (const msg of q) {
        sdkSessionId = msg.session_id
        responseText += extractTextFromMessage(msg)
      }

      if (!sdkSessionId) {
        throw new Error('No session ID received from SDK')
      }

      this.logger.info(
        { sessionId: sdkSessionId, responseLength: responseText.length },
        'Received response from Claude',
      )

      return {
        response: responseText,
        sessionId: sdkSessionId,
      }
    } catch (error) {
      this.logger.error({ error, existingSessionId }, 'Error during agent interaction')
      throw error
    }
  }
}

export function createAgent(config: AgentConfig, logger: Logger): Agent {
  return new Agent(config, logger)
}
