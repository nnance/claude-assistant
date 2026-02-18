import type { App } from '@slack/bolt'
import type { Logger } from 'pino'
import type { SessionStore } from '../sessions/store.js'

export async function deliverDM(deps: {
  slackClient: App['client']
  sessionStore: SessionStore
  message: string
  logger: Logger
}): Promise<boolean> {
  const { slackClient, sessionStore, message, logger } = deps

  const ownerId = sessionStore.getSetting('owner_slack_user_id')
  if (!ownerId) {
    logger.warn('No owner user ID set yet - skipping DM delivery')
    return false
  }

  try {
    const dmResult = await slackClient.conversations.open({ users: ownerId })
    const dmChannel = dmResult.channel?.id
    if (!dmChannel) {
      logger.error('Failed to open DM channel with owner')
      return false
    }

    await slackClient.chat.postMessage({
      channel: dmChannel,
      text: message,
    })
    return true
  } catch (error) {
    logger.error({ error }, 'Failed to deliver DM to owner')
    return false
  }
}
