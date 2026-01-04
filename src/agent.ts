import * as os from 'node:os'
import { type SDKAssistantMessage, type SDKMessage, query } from '@anthropic-ai/claude-agent-sdk'
import type { Logger } from 'pino'
import type { AgentConfig } from './config.js'
import { createAppleServicesMcpServer } from './tools/index.js'

export interface AgentResponse {
  response: string
  sessionId: string
}

export interface ProgressUpdate {
  type: 'tool_start' | 'tool_progress'
  toolName: string
  toolInput?: Record<string, unknown>
  elapsedSeconds?: number
}

export type ProgressCallback = (update: ProgressUpdate) => void

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

interface ToolUseInfo {
  name: string
  input: Record<string, unknown>
}

function extractToolUsesFromMessage(msg: SDKMessage): ToolUseInfo[] {
  if (msg.type !== 'assistant') return []
  const assistantMsg = msg as SDKAssistantMessage
  const content = assistantMsg.message.content
  const tools: ToolUseInfo[] = []
  for (const block of content) {
    if (block.type === 'tool_use') {
      tools.push({
        name: block.name,
        input: block.input as Record<string, unknown>,
      })
    }
  }
  return tools
}

export class Agent {
  private config: AgentConfig
  private logger: Logger
  private appleServicesMcp: ReturnType<typeof createAppleServicesMcpServer>

  constructor(config: AgentConfig, logger: Logger) {
    this.config = config
    this.logger = logger.child({ component: 'agent' })
    this.appleServicesMcp = createAppleServicesMcpServer()
  }

  async send(
    message: string,
    existingSessionId?: string | null,
    onProgress?: ProgressCallback,
  ): Promise<AgentResponse> {
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
        // Register Apple services MCP server for Calendar, Contacts, Notes tools
        mcpServers: {
          'apple-services': this.appleServicesMcp,
        },
      },
    })

    try {
      let sdkSessionId: string | undefined
      let responseText = ''

      for await (const msg of q) {
        sdkSessionId = msg.session_id
        responseText += extractTextFromMessage(msg)

        // Report tool progress
        if (onProgress) {
          // Check for tool_progress messages
          if (msg.type === 'tool_progress') {
            const progressMsg = msg as { tool_name: string; elapsed_time_seconds: number }
            onProgress({
              type: 'tool_progress',
              toolName: progressMsg.tool_name,
              elapsedSeconds: progressMsg.elapsed_time_seconds,
            })
          }

          // Check for tool_use in assistant messages
          const toolUses = extractToolUsesFromMessage(msg)
          for (const tool of toolUses) {
            onProgress({
              type: 'tool_start',
              toolName: tool.name,
              toolInput: tool.input,
            })
          }
        }
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
