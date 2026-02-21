import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { type SDKAssistantMessage, type SDKMessage, query } from '@anthropic-ai/claude-agent-sdk'
import type { Logger } from 'pino'
import type { AgentConfig } from './config.js'
import type { MemoryExtractor, SlackContext } from './memory/index.js'
import type { MemoryStore } from './memory/index.js'

const PROMPT_FILES = [
  { file: 'SOUL.md', label: 'Soul', description: "Defines the agent's core values and consciousness." },
  { file: 'IDENTITY.md', label: 'Identity', description: "Defines the agent's persona and operating environment." },
  { file: 'AGENTS.md', label: 'Operational Rules', description: "Defines what the agent can do and how to use its tools." },
  { file: 'USER.md', label: 'User Context', description: "Defines who the agent is serving and their preferences." },
]

function loadPromptFiles(logger: Logger): string {
  const sections: string[] = []

  for (const { file, label, description } of PROMPT_FILES) {
    const filePath = path.resolve(process.cwd(), file)
    let content = ''
    try {
      content = fs.readFileSync(filePath, 'utf-8').trim()
    } catch {
      logger.warn({ file: filePath }, `Prompt file not found, skipping section: ${label}`)
    }
    sections.push(`# ${label}\n> ${description}\n${content}`)
  }

  return sections.join('\n\n---\n\n')
}

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
  private promptContent: string

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
    this.promptContent = loadPromptFiles(this.logger)
  }

  private buildSystemPrompt(): string {
    const now = new Date()
    const dateTimeContext = `# Current Date and Time

Today is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
Current time: ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.

---

`

    if (!this.memoryStore) return dateTimeContext + this.promptContent

    const memoryContext = this.memoryStore.getMemoryContext()
    if (!memoryContext) return dateTimeContext + this.promptContent

    return `${dateTimeContext}# Cross-Thread Memory

The following memories were extracted from recent conversations. Use them for context but do not mention the memory system to the user unless asked.

${memoryContext}

---

${this.promptContent}`
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
        // Bypass all permission checks (trusted personal assistant)
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
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
