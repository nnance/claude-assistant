import {
  type SDKAssistantMessage,
  type SDKMessage,
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from '@anthropic-ai/claude-agent-sdk'
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

    const session = existingSessionId
      ? unstable_v2_resumeSession(existingSessionId, {
          model: this.config.model,
        })
      : unstable_v2_createSession({
          model: this.config.model,
        })

    try {
      await session.send(message)

      let sdkSessionId: string | undefined
      let responseText = ''

      for await (const msg of session.stream()) {
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
    } finally {
      session.close()
    }
  }
}

export function createAgent(config: AgentConfig, logger: Logger): Agent {
  return new Agent(config, logger)
}
