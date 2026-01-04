import Anthropic from '@anthropic-ai/sdk'
import type { AgentConfig } from './config.js'
import type { Logger } from 'pino'

const SYSTEM_PROMPT = `You are a personal AI assistant with full access to a macOS computer.
You can read and write files, execute shell commands, and browse the web.
You are helpful, direct, and security-conscious.
Always confirm before destructive operations (deleting files, etc).`

interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ConversationContext {
  messages: AgentMessage[]
}

export interface AgentResponse {
  response: string
  sessionId: string
}

export class Agent {
  private client: Anthropic
  private config: AgentConfig
  private logger: Logger
  private conversations: Map<string, ConversationContext>

  constructor(config: AgentConfig, logger: Logger) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    })
    this.config = config
    this.logger = logger.child({ component: 'agent' })
    this.conversations = new Map()
  }

  private getOrCreateConversation(sessionId: string): ConversationContext {
    let conversation = this.conversations.get(sessionId)
    if (!conversation) {
      conversation = { messages: [] }
      this.conversations.set(sessionId, conversation)
    }
    return conversation
  }

  async send(sessionId: string, message: string): Promise<AgentResponse> {
    const conversation = this.getOrCreateConversation(sessionId)

    conversation.messages.push({
      role: 'user',
      content: message,
    })

    this.logger.info({ sessionId, messageLength: message.length }, 'Sending message to Claude')

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: conversation.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      })

      const assistantContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')

      conversation.messages.push({
        role: 'assistant',
        content: assistantContent,
      })

      // Trim conversation history if too long
      if (conversation.messages.length > this.config.maxTurns * 2) {
        conversation.messages = conversation.messages.slice(-this.config.maxTurns * 2)
      }

      this.logger.info(
        { sessionId, responseLength: assistantContent.length },
        'Received response from Claude'
      )

      return {
        response: assistantContent,
        sessionId,
      }
    } catch (error) {
      this.logger.error({ sessionId, error }, 'Error calling Claude API')
      throw error
    }
  }

  clearConversation(sessionId: string): void {
    this.conversations.delete(sessionId)
    this.logger.info({ sessionId }, 'Cleared conversation')
  }

  hasConversation(sessionId: string): boolean {
    return this.conversations.has(sessionId)
  }
}

export function createAgent(config: AgentConfig, logger: Logger): Agent {
  return new Agent(config, logger)
}
