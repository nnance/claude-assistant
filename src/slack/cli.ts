import { WebClient } from '@slack/web-api'
import { SessionStore } from '../sessions/store.js'

// biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
const SLACK_BOT_TOKEN = process.env['SLACK_BOT_TOKEN']
// biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
const SESSION_DATABASE_PATH = process.env['SESSION_DATABASE_PATH'] || './data/sessions.db'

function jsonError(message: string): never {
  console.error(JSON.stringify({ error: message }))
  process.exit(1)
}

function jsonOut(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

if (!SLACK_BOT_TOKEN) {
  jsonError('SLACK_BOT_TOKEN environment variable is required')
}

const client = new WebClient(SLACK_BOT_TOKEN)
const sessionStore = new SessionStore(SESSION_DATABASE_PATH)
const [command, ...args] = process.argv.slice(2)

try {
  switch (command) {
    case 'send-dm': {
      const message = args[0]
      if (!message) jsonError('Usage: send-dm <message>')

      const ownerId = sessionStore.getSetting('owner_slack_user_id')
      if (!ownerId) jsonError('No owner user ID set yet — nobody has messaged the bot')

      const dmResult = await client.conversations.open({ users: ownerId })
      const dmChannel = dmResult.channel?.id
      if (!dmChannel) jsonError('Failed to open DM channel with owner')

      const result = await client.chat.postMessage({ channel: dmChannel, text: message })
      jsonOut({ ok: true, channel: dmChannel, ts: result.ts })
      break
    }

    case 'send': {
      const [channelId, message] = args
      if (!channelId || !message) jsonError('Usage: send <channel-id> <message>')

      const result = await client.chat.postMessage({ channel: channelId, text: message })
      jsonOut({ ok: true, channel: channelId, ts: result.ts })
      break
    }

    default:
      jsonError(`Unknown command: ${command ?? '(none)'}. Available: send-dm, send`)
  }
} finally {
  sessionStore.close()
}
