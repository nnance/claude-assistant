import type { App } from '@slack/bolt'
import type { Logger } from 'pino'
import type { Agent, ProgressCallback, ProgressUpdate } from '../agent.js'
import type { SessionStore } from '../sessions/store.js'
import { formatMarkdownForSlack } from './formatter.js'

// Map tool names to user-friendly descriptions
const TOOL_DESCRIPTIONS: Record<string, string> = {
  Read: 'Reading file',
  Write: 'Writing file',
  Edit: 'Editing file',
  Bash: 'Running command',
  Glob: 'Searching files',
  Grep: 'Searching content',
  LS: 'Listing directory',
  Task: 'Running subtask',
  WebFetch: 'Fetching URL',
  WebSearch: 'Searching web',
  TodoRead: 'Reading todos',
  TodoWrite: 'Updating todos',
}

function getToolDescription(toolName: string): string {
  return TOOL_DESCRIPTIONS[toolName] || `Using ${toolName}`
}

// Maximum length for context strings to keep log entries concise
const MAX_CONTEXT_LENGTH = 60

function truncate(str: string | undefined, maxLen: number): string {
  if (!str) return ''
  if (str.length <= maxLen) return str
  return `${str.substring(0, maxLen - 3)}...`
}

function escapeSlackText(text: string): string {
  // Escape characters that have special meaning in Slack mrkdwn
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/`/g, "'") // Replace backticks to avoid breaking code formatting
}

function formatToolContext(toolName: string, input?: Record<string, unknown>): string {
  if (!input) return ''

  let context = ''

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
      context = (input['file_path'] as string) || ''
      break

    case 'Bash':
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
      context = (input['command'] as string) || ''
      break

    case 'Grep':
    case 'Glob':
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
      context = (input['pattern'] as string) || ''
      break

    case 'WebFetch':
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
      context = (input['url'] as string) || ''
      break

    case 'WebSearch':
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
      context = (input['query'] as string) || ''
      break

    case 'Task':
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
      context = (input['description'] as string) || truncate(input['prompt'] as string, 40) || ''
      break

    default:
      return ''
  }

  return truncate(escapeSlackText(context), MAX_CONTEXT_LENGTH)
}

interface AppMentionEvent {
  type: 'app_mention'
  user: string
  text: string
  ts: string
  channel: string
  thread_ts?: string
}

interface MessageEvent {
  type: 'message'
  subtype?: string
  user?: string
  text?: string
  ts: string
  channel: string
  channel_type?: string
  thread_ts?: string
}

interface HandlerDependencies {
  agent: Agent
  sessionStore: SessionStore
  logger: Logger
}

function extractMessageText(text: string, botUserId?: string): string {
  // Remove the bot mention from the message
  if (botUserId) {
    return text.replace(new RegExp(`<@${botUserId}>\\s*`, 'g'), '').trim()
  }
  return text.trim()
}

async function addThinkingReaction(
  client: App['client'],
  channel: string,
  timestamp: string,
  logger: Logger,
): Promise<void> {
  try {
    await client.reactions.add({
      channel,
      timestamp,
      name: 'thinking_face',
    })
  } catch (error) {
    logger.warn({ error }, 'Failed to add thinking reaction')
  }
}

async function removeThinkingReaction(
  client: App['client'],
  channel: string,
  timestamp: string,
  logger: Logger,
): Promise<void> {
  try {
    await client.reactions.remove({
      channel,
      timestamp,
      name: 'thinking_face',
    })
  } catch (error) {
    logger.warn({ error }, 'Failed to remove thinking reaction')
  }
}

interface ToolLogEntry {
  toolName: string
  context: string
}

interface ProgressMessageState {
  messageTs: string | null
  logEntries: ToolLogEntry[]
  lastUpdate: number
}

// Minimum time between message updates (ms) to avoid rate limiting
const UPDATE_THROTTLE_MS = 1000

// Slack message character limit (safe threshold)
const MAX_MESSAGE_LENGTH = 3500

// Maximum number of log entries to keep
const MAX_LOG_ENTRIES = 20

function createProgressUpdater(
  client: App['client'],
  channel: string,
  threadTs: string,
  logger: Logger,
): { callback: ProgressCallback; getMessageTs: () => string | null } {
  const state: ProgressMessageState = {
    messageTs: null,
    logEntries: [],
    lastUpdate: 0,
  }

  const formatLogMessage = (): string => {
    if (state.logEntries.length === 0) {
      return '_Working..._'
    }

    const lines = state.logEntries.map((entry) => {
      const description = getToolDescription(entry.toolName)
      if (entry.context) {
        return `• ${description}: \`${entry.context}\``
      }
      return `• ${description}`
    })

    let message = `_Working..._\n${lines.join('\n')}`

    // If message is too long, truncate oldest entries
    while (message.length > MAX_MESSAGE_LENGTH && state.logEntries.length > 1) {
      state.logEntries.shift()
      const updatedLines = state.logEntries.map((entry) => {
        const description = getToolDescription(entry.toolName)
        if (entry.context) {
          return `• ${description}: \`${entry.context}\``
        }
        return `• ${description}`
      })
      message = `_Working..._\n_(earlier entries truncated)_\n${updatedLines.join('\n')}`
    }

    return message
  }

  const updateMessage = async () => {
    const now = Date.now()
    if (now - state.lastUpdate < UPDATE_THROTTLE_MS) {
      return // Throttle updates
    }
    state.lastUpdate = now

    const statusText = formatLogMessage()

    try {
      if (!state.messageTs) {
        // Post initial status message
        const result = await client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: statusText,
        })
        state.messageTs = result.ts || null
      } else {
        // Update existing message
        await client.chat.update({
          channel,
          ts: state.messageTs,
          text: statusText,
        })
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to update progress message')
    }
  }

  const callback: ProgressCallback = (update: ProgressUpdate) => {
    if (update.type === 'tool_start') {
      const context = formatToolContext(update.toolName, update.toolInput)

      state.logEntries.push({
        toolName: update.toolName,
        context,
      })

      // Cap the number of entries
      if (state.logEntries.length > MAX_LOG_ENTRIES) {
        state.logEntries.shift()
      }

      // Fire and forget - don't block the agent
      updateMessage()
    }
  }

  return {
    callback,
    getMessageTs: () => state.messageTs,
  }
}

async function deleteMessage(
  client: App['client'],
  channel: string,
  ts: string,
  logger: Logger,
): Promise<void> {
  try {
    await client.chat.delete({ channel, ts })
  } catch (error) {
    logger.warn({ error }, 'Failed to delete progress message')
  }
}

export function registerHandlers(app: App, deps: HandlerDependencies): void {
  const { agent, sessionStore, logger } = deps

  // Handle @mentions in channels
  app.event('app_mention', async ({ event, client, context }) => {
    const mentionEvent = event as AppMentionEvent
    const handlerLogger = logger.child({
      handler: 'app_mention',
      channel: mentionEvent.channel,
      user: mentionEvent.user,
    })

    handlerLogger.info('Received app mention')

    const threadTs = mentionEvent.thread_ts || mentionEvent.ts
    const messageText = extractMessageText(mentionEvent.text, context.botUserId)

    if (!messageText) {
      handlerLogger.info('Empty message after extracting text, ignoring')
      return
    }

    // Get or create session
    const session = sessionStore.getOrCreate(mentionEvent.channel, threadTs)
    handlerLogger.info({ sessionId: session.id }, 'Using session')

    // Add thinking reaction
    await addThinkingReaction(client, mentionEvent.channel, mentionEvent.ts, handlerLogger)

    // Create progress updater for status messages
    const progressUpdater = createProgressUpdater(
      client,
      mentionEvent.channel,
      threadTs,
      handlerLogger,
    )

    try {
      // Process with agent (pass existing session ID for resumption)
      const result = await agent.send(
        messageText,
        session.agent_session_id,
        progressUpdater.callback,
        { channelId: mentionEvent.channel, threadTs: threadTs },
      )

      // Store the SDK session ID for future resumption
      sessionStore.updateAgentSessionId(session.id, result.sessionId)

      // Remove thinking reaction
      await removeThinkingReaction(client, mentionEvent.channel, mentionEvent.ts, handlerLogger)

      // Delete the progress message if one was created
      const progressTs = progressUpdater.getMessageTs()
      if (progressTs) {
        await deleteMessage(client, mentionEvent.channel, progressTs, handlerLogger)
      }

      // Send response in thread (formatted for Slack)
      await client.chat.postMessage({
        channel: mentionEvent.channel,
        thread_ts: threadTs,
        text: formatMarkdownForSlack(result.response),
      })

      handlerLogger.info('Sent response')
    } catch (error) {
      handlerLogger.error({ error }, 'Error processing message')

      // Remove thinking reaction
      await removeThinkingReaction(client, mentionEvent.channel, mentionEvent.ts, handlerLogger)

      // Delete the progress message if one was created
      const progressTs = progressUpdater.getMessageTs()
      if (progressTs) {
        await deleteMessage(client, mentionEvent.channel, progressTs, handlerLogger)
      }

      // Send error message
      await client.chat.postMessage({
        channel: mentionEvent.channel,
        thread_ts: threadTs,
        text: 'Sorry, I encountered an error processing your request. Please try again.',
      })
    }
  })

  // Handle direct messages and thread replies
  app.event('message', async ({ event, client, context }) => {
    const messageEvent = event as MessageEvent

    // Debug logging to trace message handling
    logger.debug(
      {
        channel: messageEvent.channel,
        channel_type: messageEvent.channel_type,
        user: messageEvent.user,
        botUserId: context.botUserId,
        subtype: messageEvent.subtype,
        thread_ts: messageEvent.thread_ts,
        hasText: !!messageEvent.text,
      },
      'Message event received',
    )

    // Ignore bot messages and message changes
    if (messageEvent.subtype) {
      logger.debug({ subtype: messageEvent.subtype }, 'Ignoring message with subtype')
      return
    }

    // Ignore messages from the bot itself
    if (messageEvent.user === context.botUserId) {
      logger.debug('Ignoring message from bot itself')
      return
    }

    const isDM = messageEvent.channel_type === 'im'

    // For non-DM messages, only respond if it's a thread reply with an existing session
    if (!isDM) {
      const threadTs = messageEvent.thread_ts
      if (!threadTs) {
        // Not a thread reply in a channel - ignore (require @mention for new conversations)
        return
      }
      // Check if we have an existing session for this thread
      const existingSession = sessionStore.getByThread(messageEvent.channel, threadTs)
      if (!existingSession) {
        // No existing session for this thread - ignore (wasn't started with @mention)
        return
      }
    }

    const handlerLogger = logger.child({
      handler: isDM ? 'direct_message' : 'thread_reply',
      channel: messageEvent.channel,
      user: messageEvent.user,
    })

    handlerLogger.info(isDM ? 'Received direct message' : 'Received thread reply')

    const messageText = messageEvent.text?.trim()
    if (!messageText) {
      handlerLogger.info('Empty message, ignoring')
      return
    }

    // For DMs, use the message ts as the thread; for thread replies, use the thread_ts
    const threadTs = messageEvent.thread_ts || messageEvent.ts
    const session = sessionStore.getOrCreate(messageEvent.channel, threadTs)
    handlerLogger.info({ sessionId: session.id }, 'Using session')

    // Add thinking reaction
    await addThinkingReaction(client, messageEvent.channel, messageEvent.ts, handlerLogger)

    // Create progress updater for status messages
    const progressUpdater = createProgressUpdater(
      client,
      messageEvent.channel,
      threadTs,
      handlerLogger,
    )

    try {
      // Process with agent (pass existing session ID for resumption)
      const result = await agent.send(
        messageText,
        session.agent_session_id,
        progressUpdater.callback,
        { channelId: messageEvent.channel, threadTs: threadTs },
      )

      // Store the SDK session ID for future resumption
      sessionStore.updateAgentSessionId(session.id, result.sessionId)

      // Remove thinking reaction
      await removeThinkingReaction(client, messageEvent.channel, messageEvent.ts, handlerLogger)

      // Delete the progress message if one was created
      const progressTs = progressUpdater.getMessageTs()
      if (progressTs) {
        await deleteMessage(client, messageEvent.channel, progressTs, handlerLogger)
      }

      // Send response in thread (matches session key for context continuity)
      await client.chat.postMessage({
        channel: messageEvent.channel,
        thread_ts: threadTs,
        text: formatMarkdownForSlack(result.response),
      })

      handlerLogger.info('Sent response')
    } catch (error) {
      handlerLogger.error({ error }, 'Error processing message')

      // Remove thinking reaction
      await removeThinkingReaction(client, messageEvent.channel, messageEvent.ts, handlerLogger)

      // Delete the progress message if one was created
      const progressTs = progressUpdater.getMessageTs()
      if (progressTs) {
        await deleteMessage(client, messageEvent.channel, progressTs, handlerLogger)
      }

      // Send error message
      await client.chat.postMessage({
        channel: messageEvent.channel,
        thread_ts: threadTs,
        text: 'Sorry, I encountered an error processing your request. Please try again.',
      })
    }
  })

  logger.info('Slack handlers registered')
}
