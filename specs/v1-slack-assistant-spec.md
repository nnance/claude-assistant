# Personal AI Assistant v1 - Slack Integration

**Version**: 1.0
**Status**: MVP Specification

---

## Overview

A self-hosted personal AI assistant built on the Claude Agent SDK, running as a daemon on macOS. This initial version focuses on a **single agent** integrated exclusively with **Slack** for communication.

### MVP Scope

- Single Claude agent (no sub-agents)
- Slack as the only communication channel
- Full computer access (filesystem, shell, browser)
- Session persistence across restarts
- Always-on daemon

### Out of Scope (Future Versions)

- Linear integration
- iMessage/SMS integration
- Gmail monitoring
- Multi-agent architecture
- Knowledge base / RAG

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    macOS Daemon                      │
│                   (launchd service)                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐      ┌─────────────────────────┐  │
│  │  Slack Bot   │◄────►│    Claude Agent SDK     │  │
│  │  (Bolt SDK)  │      │    (Opus 4.5 Model)     │  │
│  └──────────────┘      └───────────┬─────────────┘  │
│                                    │                 │
│                        ┌───────────┴───────────┐    │
│                        │        Tools          │    │
│                        ├───────────────────────┤    │
│                        │ • Filesystem (R/W)    │    │
│                        │ • Shell Commands      │    │
│                        │ • Browser Automation  │    │
│                        │ • Web Search          │    │
│                        └───────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              Session Store (SQLite)           │   │
│  │   Maps Slack threads → Agent session IDs      │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Project Structure

```
claude-assistant/
├── src/
│   ├── index.ts              # Entry point / daemon startup
│   ├── agent.ts              # Claude Agent SDK wrapper
│   ├── slack/
│   │   ├── app.ts            # Slack Bolt app initialization
│   │   └── handlers.ts       # Event and message handlers
│   ├── sessions/
│   │   ├── store.ts          # SQLite session persistence
│   │   └── types.ts          # Session type definitions
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── filesystem.ts     # File read/write operations
│   │   ├── shell.ts          # Shell command execution
│   │   └── browser.ts        # Browser automation wrapper
│   └── config.ts             # Configuration loading
├── config/
│   └── settings.yaml         # Runtime configuration
├── scripts/
│   ├── install-daemon.sh     # launchd installation
│   └── uninstall-daemon.sh   # launchd removal
├── .env.example              # Environment variable template
├── package.json
└── tsconfig.json
```

---

## Slack Integration

### Setup Requirements

1. Create Slack App at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Socket Mode** (no public URL needed)
3. Generate App-Level Token with `connections:write` scope
4. Install app to workspace

### Required Bot Token Scopes

```
app_mentions:read    # Detect @mentions
chat:write           # Send messages
im:history           # Read DM history
im:read              # Access DM metadata
im:write             # Send DMs
```

### Event Subscriptions

```
app_mention          # When bot is @mentioned in channels
message.im           # Direct messages to the bot
```

### Interaction Flow

```
User @mentions bot in channel or sends DM
              │
              ▼
┌─────────────────────────────┐
│  Slack Event (via Socket)   │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Look up session by thread  │
│  (create new if none)       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Send "thinking" indicator  │
│  (typing or reaction)       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Claude Agent processes     │
│  message with tools         │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Post response to thread    │
└─────────────────────────────┘
```

---

## Agent Configuration

### Model

```typescript
const AGENT_CONFIG = {
  model: 'claude-opus-4-5-20250929',
  systemPrompt: `You are a personal AI assistant with full access to a macOS computer.
You can read and write files, execute shell commands, and browse the web.
You are helpful, direct, and security-conscious.
Always confirm before destructive operations (deleting files, etc).`
}
```

### Available Tools

| Tool | Description | Safety |
|------|-------------|--------|
| `read_file` | Read file contents | Safe |
| `write_file` | Write/create files | Confirm overwrites |
| `list_directory` | List directory contents | Safe |
| `execute_shell` | Run shell commands | Log all commands |
| `browse_web` | Navigate and extract web content | Whitelisted sites for forms |
| `search_web` | Web search via API | Safe |

---

## Session Management

### Session Store Schema

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- UUID
  slack_thread_ts TEXT UNIQUE,      -- Slack thread timestamp
  slack_channel_id TEXT NOT NULL,   -- Channel or DM ID
  agent_session_id TEXT,            -- Claude Agent SDK session ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_thread ON sessions(slack_channel_id, slack_thread_ts);
```

### Session Lifecycle

1. **New conversation**: Create session, store mapping
2. **Thread reply**: Look up existing session, resume agent context
3. **Daemon restart**: Reconnect to Slack, resume sessions on demand
4. **Cleanup**: Expire sessions after 7 days of inactivity

---

## Daemon Service

### launchd Configuration

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.claude-assistant</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/YOU/claude-assistant/dist/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>/Users/YOU/claude-assistant</string>
    <key>StandardOutPath</key>
    <string>/tmp/claude-assistant.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/claude-assistant.error.log</string>
</dict>
</plist>
```

### Installation Script

```bash
#!/bin/bash
# scripts/install-daemon.sh

PLIST_NAME="com.user.claude-assistant.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"

# Build the project
npm run build

# Copy and load the plist
cp ./scripts/$PLIST_NAME "$PLIST_PATH"
launchctl load "$PLIST_PATH"

echo "Daemon installed and started"
```

---

## Configuration

### Environment Variables (.env)

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...   # For Socket Mode
SLACK_SIGNING_SECRET=...

# Optional
LOG_LEVEL=info
```

### Runtime Config (config/settings.yaml)

```yaml
agent:
  model: claude-opus-4-5-20250929
  max_turns: 50  # Prevent infinite loops

slack:
  socket_mode: true

sessions:
  database_path: ./data/sessions.db
  expire_days: 7

tools:
  shell:
    allowed_commands: ["*"]  # Or restrict to specific commands
    timeout_ms: 30000
  browser:
    whitelist:
      - "*.google.com"
      - "*.github.com"
      - "*.stackoverflow.com"
```

---

## Implementation

### Entry Point (src/index.ts)

```typescript
import { loadConfig } from './config'
import { createAgent } from './agent'
import { createSlackApp } from './slack/app'
import { SessionStore } from './sessions/store'

async function main() {
  const config = loadConfig()
  const sessionStore = new SessionStore(config.sessions.database_path)
  const agent = createAgent(config.agent)
  const slackApp = createSlackApp(config.slack, agent, sessionStore)

  await slackApp.start()
  console.log('Claude Assistant is running')
}

main().catch(console.error)
```

### Slack App (src/slack/app.ts)

```typescript
import { App } from '@slack/bolt'

export function createSlackApp(config, agent, sessionStore) {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
  })

  // Handle @mentions
  app.event('app_mention', async ({ event, say }) => {
    const session = await sessionStore.getOrCreate(
      event.channel,
      event.thread_ts || event.ts
    )

    // Show typing indicator
    await say({ text: '...', thread_ts: event.thread_ts || event.ts })

    // Process with agent
    const response = await agent.send(session.agent_session_id, event.text)

    await say({ text: response, thread_ts: event.thread_ts || event.ts })
  })

  // Handle DMs
  app.event('message', async ({ event, say }) => {
    if (event.channel_type !== 'im') return

    const session = await sessionStore.getOrCreate(event.channel, event.ts)
    const response = await agent.send(session.agent_session_id, event.text)

    await say({ text: response })
  })

  return app
}
```

### Agent Wrapper (src/agent.ts)

```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession
} from '@anthropic-ai/claude-agent-sdk'

export function createAgent(config) {
  const sessions = new Map()

  return {
    async send(sessionId: string | null, message: string) {
      let session = sessionId ? sessions.get(sessionId) : null

      if (!session && sessionId) {
        // Try to resume existing session
        session = unstable_v2_resumeSession(sessionId, {
          model: config.model
        })
        sessions.set(sessionId, session)
      }

      if (!session) {
        // Create new session
        session = unstable_v2_createSession({
          model: config.model
        })
      }

      await session.send(message)

      let response = ''
      for await (const msg of session.receive()) {
        if (msg.type === 'assistant') {
          response = msg.message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('')
        }
      }

      return { response, sessionId: session.id }
    }
  }
}
```

---

## Dependencies

```json
{
  "name": "claude-assistant",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "@slack/bolt": "^4.0.0",
    "better-sqlite3": "^11.0.0",
    "yaml": "^2.5.0",
    "dotenv": "^16.4.0",
    "pino": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@biomejs/biome": "^1.9.0",
    "tsx": "^4.0.0"
  }
}
```

---

## Getting Started

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create New App → From scratch
3. Enable Socket Mode (Settings → Socket Mode → Enable)
4. Generate App-Level Token with `connections:write`
5. Add Bot Token Scopes under OAuth & Permissions
6. Subscribe to events under Event Subscriptions
7. Install to workspace
8. Copy Bot Token and App Token

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your tokens
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run in Development

```bash
npm run dev
```

### 5. Install as Daemon (Production)

```bash
npm run build
./scripts/install-daemon.sh
```

---

## Usage Examples

**Ask a question:**
> @assistant what's in my Downloads folder?

**Execute a task:**
> @assistant find all TODO comments in ~/Developer/myproject

**Web research:**
> @assistant search for the latest TypeScript 5.6 features and summarize them

**File operations:**
> @assistant create a new file at ~/notes/meeting.md with today's date as the header

---

## Future Enhancements (v2+)

- [ ] Linear integration for issue tracking
- [ ] iMessage/SMS for urgent notifications
- [ ] Gmail monitoring and triage
- [ ] Knowledge base with local embeddings
- [ ] Multi-agent architecture with specialized sub-agents
- [ ] Smart model routing (Haiku/Sonnet/Opus)
