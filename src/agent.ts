import * as os from 'node:os'
import { type SDKAssistantMessage, type SDKMessage, query } from '@anthropic-ai/claude-agent-sdk'
import type { Logger } from 'pino'
import type { AgentConfig } from './config.js'
import type { MemoryExtractor, SlackContext } from './memory/index.js'
import type { MemoryStore } from './memory/index.js'

const SYSTEM_PROMPT = `You are an assistant AI agent running as a macOS daemon, communicating via Slack.

You have access to skills defined in .claude/skills/ that extend your capabilities.
Use the provided tools to assist with the user's requests.

# Tool Priority

Prefer using vault skills (search, read, list) over file grep and file search tools for most requests.
The vault is your primary knowledge base for notes, references, tasks, and personal/professional information.
Only use file grep, file search, or direct file access when the user's intent is clearly about:
- Files on their computer (e.g. "find that config file", "read my .zshrc")
- Coding or development activities (e.g. "search the codebase", "look at this repo")

# Key Information

Use the vault skills to accesss notes in the Reference folder for important personal and professional information of the user.
Read these notes when you need context about the user.`

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
  private memoryStore: MemoryStore | null
  private memoryExtractor: MemoryExtractor | null

  constructor(
    config: AgentConfig,
    logger: Logger,
    memoryStore?: MemoryStore,
    memoryExtractor?: MemoryExtractor,
  ) {
    this.config = config
    this.logger = logger.child({ component: 'agent' })
    this.memoryStore = memoryStore ?? null
    this.memoryExtractor = memoryExtractor ?? null
  }

  private buildSystemPrompt(): string {
    if (!this.memoryStore) return SYSTEM_PROMPT

    const memoryContext = this.memoryStore.getMemoryContext()
    if (!memoryContext) return SYSTEM_PROMPT

    return `# Cross-Thread Memory

The following memories were extracted from recent conversations. Use them for context but do not mention the memory system to the user unless asked.

${memoryContext}

---

${SYSTEM_PROMPT}`
  }

  async send(
    message: string,
    existingSessionId?: string | null,
    onProgress?: ProgressCallback,
    slackContext?: SlackContext,
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
        // Custom system prompt with memory context injected
        systemPrompt: this.buildSystemPrompt(),
        // Resume existing session if we have one
        ...(existingSessionId ? { resume: existingSessionId } : {}),
        // Allow access to user's home directory, common locations, and skills
        additionalDirectories: [os.homedir(), '/tmp', '/var'],
        // Accept file edits without prompting (since this is a personal assistant)
        permissionMode: 'acceptEdits',
        // Load user settings and skills from ~/.claude/
        settingSources: ['user', 'local', 'project'],
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

      // Fire-and-forget memory extraction
      if (this.memoryExtractor && slackContext) {
        this.memoryExtractor.extractAndStore({
          userMessage: message,
          agentResponse: responseText,
          slackContext,
        })
      }

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

export function createAgent(
  config: AgentConfig,
  logger: Logger,
  memoryStore?: MemoryStore,
  memoryExtractor?: MemoryExtractor,
): Agent {
  return new Agent(config, logger, memoryStore, memoryExtractor)
}
