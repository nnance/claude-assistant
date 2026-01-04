import type { App } from '@slack/bolt'
import type { Logger } from 'pino'
import type { Agent } from '../agent.js'
import type { SessionStore } from '../sessions/store.js'

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
      // Process with agent (pass existing session ID for resumption)
      const result = await agent.send(messageText, session.agent_session_id)

      // Store the SDK session ID for future resumption
      sessionStore.updateAgentSessionId(session.id, result.sessionId)

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

    try {
      // Process with agent (pass existing session ID for resumption)
      const result = await agent.send(messageText, session.agent_session_id)

      // Store the SDK session ID for future resumption
      sessionStore.updateAgentSessionId(session.id, result.sessionId)

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
