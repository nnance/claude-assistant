import type { App } from '@slack/bolt'
import type { Agent } from '../agent.js'
import type { SessionStore } from '../sessions/store.js'
import type { Logger } from 'pino'

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
  logger: Logger
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
  logger: Logger
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

    try {
      // Process with agent
      const result = await agent.send(session.id, messageText)

      // Update session with agent session ID if needed
      if (!session.agent_session_id) {
        sessionStore.updateAgentSessionId(session.id, result.sessionId)
      }

      // Remove thinking reaction
      await removeThinkingReaction(client, mentionEvent.channel, mentionEvent.ts, handlerLogger)

      // Send response in thread
      await client.chat.postMessage({
        channel: mentionEvent.channel,
        thread_ts: threadTs,
        text: result.response,
      })

      handlerLogger.info('Sent response')
    } catch (error) {
      handlerLogger.error({ error }, 'Error processing message')

      // Remove thinking reaction
      await removeThinkingReaction(client, mentionEvent.channel, mentionEvent.ts, handlerLogger)

      // Send error message
      await client.chat.postMessage({
        channel: mentionEvent.channel,
        thread_ts: threadTs,
        text: 'Sorry, I encountered an error processing your request. Please try again.',
      })
    }
  })

  // Handle direct messages
  app.event('message', async ({ event, client }) => {
    const messageEvent = event as MessageEvent

    // Only handle DMs
    if (messageEvent.channel_type !== 'im') {
      return
    }

    // Ignore bot messages and message changes
    if (messageEvent.subtype) {
      return
    }

    const handlerLogger = logger.child({
      handler: 'direct_message',
      channel: messageEvent.channel,
      user: messageEvent.user,
    })

    handlerLogger.info('Received direct message')

    const messageText = messageEvent.text?.trim()
    if (!messageText) {
      handlerLogger.info('Empty message, ignoring')
      return
    }

    // For DMs, use the message ts as the thread
    const threadTs = messageEvent.thread_ts || messageEvent.ts
    const session = sessionStore.getOrCreate(messageEvent.channel, threadTs)
    handlerLogger.info({ sessionId: session.id }, 'Using session')

    // Add thinking reaction
    await addThinkingReaction(client, messageEvent.channel, messageEvent.ts, handlerLogger)

    try {
      // Process with agent
      const result = await agent.send(session.id, messageText)

      // Update session with agent session ID if needed
      if (!session.agent_session_id) {
        sessionStore.updateAgentSessionId(session.id, result.sessionId)
      }

      // Remove thinking reaction
      await removeThinkingReaction(client, messageEvent.channel, messageEvent.ts, handlerLogger)

      // Send response (in thread if replying to thread, otherwise as new message)
      await client.chat.postMessage({
        channel: messageEvent.channel,
        thread_ts: messageEvent.thread_ts,
        text: result.response,
      })

      handlerLogger.info('Sent response')
    } catch (error) {
      handlerLogger.error({ error }, 'Error processing message')

      // Remove thinking reaction
      await removeThinkingReaction(client, messageEvent.channel, messageEvent.ts, handlerLogger)

      // Send error message
      await client.chat.postMessage({
        channel: messageEvent.channel,
        thread_ts: messageEvent.thread_ts,
        text: 'Sorry, I encountered an error processing your request. Please try again.',
      })
    }
  })

  logger.info('Slack handlers registered')
}
