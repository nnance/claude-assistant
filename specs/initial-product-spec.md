# Personal AI Assistant - Product Specification

**Version**: 1.0
**Last Updated**: January 2026
**Status**: Draft

---

## Executive Summary

A self-hosted personal AI assistant built on the Claude Agent SDK, running as an always-on daemon on macOS. The assistant uses a **hybrid architecture**: a primary orchestrator agent that can spawn specialized sub-agents for complex tasks (coding, email, research).

### Key Capabilities

- **Multi-channel communication**: Slack, Linear, iMessage/SMS
- **Concurrent long-running tasks**: Coding, email monitoring, bug investigation, Q&A
- **Full computer access**: Browser automation, file system, shell commands
- **Configurable autonomy**: Some tasks run autonomously, others require approval

---

## Architecture

### Hybrid Agent Model

```
                    +------------------+
                    |   Orchestrator   |
                    |   (Primary Agent)|
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                   |                   |
    +----v----+        +-----v-----+       +-----v-----+
    | Coding  |        |   Email   |       | Research  |
    | Agent   |        |   Agent   |       |   Agent   |
    +---------+        +-----------+       +-----------+
```

**Orchestrator Agent**: Handles all communication channels, routes requests, manages context, and spawns sub-agents when needed.

**Sub-Agents**: Specialized for specific task types:
- **Coding Agent**: Bug investigation, code implementation, PR creation
- **Email Agent**: Gmail monitoring, triage, drafting responses
- **Research Agent**: Web search, document analysis, Q&A

### Communication Channels

| Channel | Direction | Implementation |
|---------|-----------|----------------|
| Slack | Bidirectional | Bolt SDK + Events API |
| Linear | Bidirectional | GraphQL SDK + Webhooks |
| iMessage/SMS | Bidirectional | AppleScript + Messages.app |

---

## Project Structure

```
claude-assistant/
├── src/
│   ├── core/
│   │   ├── orchestrator.ts      # Primary agent coordination
│   │   ├── session-manager.ts   # Multi-session handling
│   │   ├── task-queue.ts        # Concurrent task management
│   │   └── config.ts            # Configuration management
│   ├── agents/
│   │   ├── coding-agent.ts      # Code-focused sub-agent
│   │   ├── email-agent.ts       # Email-focused sub-agent
│   │   └── research-agent.ts    # Q&A and research sub-agent
│   ├── channels/
│   │   ├── slack/
│   │   │   ├── bot.ts           # Slack Bolt app
│   │   │   ├── events.ts        # Event handlers
│   │   │   └── commands.ts      # Slash commands
│   │   ├── linear/
│   │   │   ├── client.ts        # Linear SDK wrapper
│   │   │   ├── webhooks.ts      # Webhook handlers
│   │   │   └── agent-api.ts     # Linear Agent API integration
│   │   └── messages/
│   │       ├── bridge.ts        # AppleScript bridge
│   │       └── handlers.ts      # Message handlers
│   ├── integrations/
│   │   ├── gmail/
│   │   │   ├── client.ts        # Gmail API client
│   │   │   ├── monitor.ts       # Email monitoring
│   │   │   └── actions.ts       # Send, reply, label, archive
│   │   ├── browser/
│   │   │   ├── automation.ts    # Claude Agent SDK browser tool
│   │   │   └── whitelist.ts     # Allowed sites config
│   │   └── knowledge/
│   │       ├── indexer.ts       # Document indexing
│   │       └── retrieval.ts     # RAG implementation
│   ├── daemon/
│   │   ├── service.ts           # Background service
│   │   ├── health.ts            # Health monitoring
│   │   └── recovery.ts          # Crash recovery
│   └── tools/
│       ├── filesystem.ts        # File operations
│       ├── git.ts               # Git operations
│       └── shell.ts             # Shell command execution
├── config/
│   ├── browser-whitelist.yaml   # Allowed browser automation sites
│   ├── knowledge-sources.yaml   # Knowledge base paths
│   └── task-policies.yaml       # Autonomous vs approval tasks
└── scripts/
    ├── install-daemon.sh        # launchd service setup
    └── setup-credentials.sh     # OAuth flow helpers
```

---

## Integration Details

### 1. Slack Integration

**Implementation**: Using `@slack/bolt` (recommended over deprecated `@slack/events-api`)

**Required Bot Token Scopes**:
- `app_mentions:read` - Detect when mentioned
- `chat:write` - Send messages
- `im:history` - Read DM history
- `im:write` - Send DMs
- `channels:history` - Read channel messages
- `files:read` / `files:write` - File attachments

**Event Subscriptions**:
- `app_mention` - When @mentioned
- `message.im` - Direct messages
- `message.channels` - Channel messages (optional)

**Key Technical Considerations**:
- Slack requires response within 3 seconds; use `waitUntil()` pattern for async processing
- Socket Mode for local development (no public URL needed)
- HTTP Mode for production with ngrok or Cloudflare tunnel

**References**:
- [Slack Bolt SDK](https://slack.dev/bolt-js/concepts)
- [Slack Events API](https://docs.slack.dev/apis/events-api/)
- [AI SDK Slackbot Guide](https://ai-sdk.dev/cookbook/guides/slackbot)

---

### 2. Linear Integration

**Implementation**: Using `@linear/sdk` (GraphQL-based TypeScript SDK)

**Authentication**: OAuth 2.0 for user context, API key for service operations

**Webhook Events to Subscribe**:
- `Issue` - Create, update, delete
- `Comment` - New comments on issues
- `IssueLabel` - Label changes
- `Project` - Project updates

**Agent API Integration** (Linear's May 2025 agent platform):
- Register as a Linear Agent
- Receive issue delegations via `@mention` or assignment
- Post agent conversation updates to issue comments
- Update issue status programmatically

**Capabilities**:
- Create issues from Slack conversations
- Auto-triage new issues (categorize, suggest assignee)
- Investigate bugs: read code, reproduce, propose fixes
- Create PRs linked to Linear issues

**Rate Limits**:
- API key: 1,500 requests/hour/user
- OAuth: 500 requests/hour/user/app

**References**:
- [Linear SDK](https://linear.app/developers/sdk)
- [Linear Webhooks](https://linear.app/developers/webhooks)
- [Linear Agents](https://linear.app/developers/agents)
- [Linear OAuth 2.0](https://linear.app/developers/oauth-2-0-authentication)

---

### 3. iMessage/SMS Integration

**Implementation**: AppleScript bridge to Messages.app

**Sending Messages**:
```applescript
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+1234567890" of targetService
    send "Hello from agent" to targetBuddy
end tell
```

**Receiving Messages**:
- Read from `~/Library/Messages/chat.db` using SQLite
- Requires Full Disk Access permission
- Poll database or use file system watcher for new messages

**Considerations**:
- No official API; relies on macOS automation
- Requires granting accessibility permissions
- Works for iMessage and SMS (if iPhone linked via Continuity)

---

### 4. Gmail Integration

**Implementation**: Google Workspace API with OAuth 2.0

**Required Scopes**:
- `gmail.readonly` - Read emails
- `gmail.send` - Send emails
- `gmail.modify` - Archive, label, mark read

**Features**:
- Watch for new emails via push notifications (Pub/Sub)
- Triage: categorize, prioritize, draft responses
- Full send capability with user approval for sensitive recipients

**OAuth Setup**:
1. Create Google Cloud project
2. Enable Gmail API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials
5. Implement token refresh flow

---

### 5. Browser Automation

**Implementation**: Claude Agent SDK built-in browser tool

**Whitelist Approach**:
```yaml
# config/browser-whitelist.yaml
full_automation:
  - gmail.com
  - calendar.google.com
  - linear.app
  - github.com
  - docs.google.com

read_only:
  - "*"  # All other sites
```

**Capabilities**:
- Navigate to URLs
- Click elements, fill forms
- Extract page content
- Take screenshots
- Execute JavaScript

---

### 6. Knowledge Base

**Custom Knowledge Sources**:
```yaml
# config/knowledge-sources.yaml
sources:
  - path: ~/Documents/notes
    type: markdown
    name: "Personal Notes"
  - path: ~/Developer/projects
    type: code
    name: "Code Projects"
  - path: ~/Documents/work
    type: mixed
    name: "Work Documents"
```

**Implementation** (for < 1GB corpus):
- Local embeddings with `@xenova/transformers` (runs entirely on-device)
- SQLite with `sqlite-vss` extension for vector storage
- Full re-index on startup (fast enough for small corpus)
- File watcher (`chokidar`) for incremental updates during runtime

---

## Task Execution Model

### Task Policies

```yaml
# config/task-policies.yaml
autonomous:
  - email_triage
  - issue_categorization
  - code_analysis
  - document_search
  - status_updates

requires_approval:
  - send_email
  - create_pr
  - merge_code
  - assign_issue
  - delete_files
  - browser_form_submission

user_decides:  # Agent asks when detected
  - concurrent_same_repo
  - destructive_operations
  - external_api_calls
```

### Conflict Resolution

When concurrent tasks might conflict (e.g., two coding requests in the same repo):
1. Agent detects potential conflict (same repo, same file, etc.)
2. Notifies user via preferred channel (Slack DM)
3. Presents options: queue, branch isolation, or cancel
4. Waits for user decision before proceeding

---

## Daemon Architecture

### launchd Service

```xml
<!-- ~/Library/LaunchAgents/com.user.claude-assistant.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.claude-assistant</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/claude-assistant/dist/daemon/service.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/claude-assistant.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/claude-assistant.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
```

### Health Monitoring

- Heartbeat endpoint for external monitoring
- Auto-restart on crash (launchd KeepAlive)
- Session recovery: resume interrupted tasks
- Memory/CPU limits to prevent runaway processes

---

## Session Management

Using Claude Agent SDK V2's session model:

```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession
} from '@anthropic-ai/claude-agent-sdk'

// Create persistent session per conversation context
const session = unstable_v2_createSession({
  model: 'claude-opus-4-5-20250929'
})

// Resume across daemon restarts
const resumedSession = unstable_v2_resumeSession(sessionId, {
  model: 'claude-opus-4-5-20250929'
})
```

**Session Persistence**:
- Store session IDs in local SQLite database
- Map sessions to: Slack threads, Linear issues, iMessage conversations
- Resume context after daemon restart

---

## Interaction Patterns

### Immediate Response Flow (Slack/Linear mention)

1. User @mentions agent
2. Agent acknowledges immediately ("Looking into this...")
3. Agent processes request (may spawn sub-agent)
4. Agent posts progress updates if long-running
5. Agent posts final response/result

### Email Triage Flow

1. Gmail push notification triggers webhook
2. Email agent analyzes content, sender, urgency
3. Agent categorizes and labels automatically
4. If action needed: drafts response, awaits approval
5. Posts summary to Slack (if configured)

### Coding Task Flow

1. User assigns Linear issue to agent (or delegates via @mention)
2. Agent reads issue, gathers codebase context
3. Agent spawns coding sub-agent with issue context
4. Coding agent: reads code, proposes solution
5. If PR needed: creates branch, commits, opens PR
6. Agent comments on Linear issue with results
7. Awaits user review for merge

### Escalation Flow

```typescript
async function escalate(message: Message, urgency: 'low' | 'medium' | 'high') {
  // Always notify via Slack DM
  await slackClient.sendDM(message)

  if (urgency === 'high') {
    // Set timer for iMessage escalation
    setTimeout(async () => {
      const acknowledged = await checkSlackResponse(message.id)
      if (!acknowledged) {
        await imessageBridge.send(message.summary)
      }
    }, 5 * 60 * 1000) // 5 minute window before SMS
  }
}
```

---

## Security

### Credentials Management

**Phase 1 (Initial)**: Environment variables in `.env`
```bash
ANTHROPIC_API_KEY=sk-ant-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...  # For Socket Mode
LINEAR_API_KEY=lin_api_...
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

**Phase 2 (Future)**: macOS Keychain integration
```typescript
import keytar from 'keytar'

// Store credential
await keytar.setPassword('claude-assistant', 'anthropic-api-key', apiKey)

// Retrieve credential
const apiKey = await keytar.getPassword('claude-assistant', 'anthropic-api-key')
```

### Sandboxing

- Run agent processes in user space (not root)
- Filesystem access limited to designated directories
- Network egress restricted to known services
- Browser automation restricted to whitelisted domains

---

## Model Configuration

**Primary Model**: Claude Opus 4.5 (`claude-opus-4-5-20250929`)
- Used for: Complex reasoning, code generation, multi-step tasks

**Future Optimization** (Smart Model Routing):
- Haiku for simple acknowledgments, routing decisions
- Sonnet for moderate complexity tasks
- Opus for complex analysis, code review, planning

---

## Environment Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Slack Workspace | Personal | Full admin control, can install custom apps |
| Linear Access | Full Admin | Can configure webhooks, register agents |
| Knowledge Base | Small (< 1GB) | Simple local embeddings sufficient |
| Escalation | Slack DM → iMessage | Two-tier: DM first, SMS if no response after 5 min |

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Project setup (TypeScript, ESLint, build system)
- [ ] Daemon service with launchd
- [ ] Orchestrator agent with basic tools
- [ ] Session management and persistence (SQLite)
- [ ] Configuration system (YAML files)

### Phase 2: Communication Channels
- [ ] Slack bot (Bolt SDK, Socket Mode)
- [ ] Linear integration (SDK + webhooks)
- [ ] iMessage bridge (AppleScript)

### Phase 3: Task Agents
- [ ] Coding sub-agent with git/filesystem tools
- [ ] Gmail monitoring and triage
- [ ] Knowledge base indexing and Q&A

### Phase 4: Advanced Features
- [ ] Browser automation (whitelisted sites)
- [ ] Smart model routing
- [ ] Keychain credential storage
- [ ] Conflict detection and resolution UI

---

## Dependencies

```json
{
  "name": "claude-assistant",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "@slack/bolt": "^4.0.0",
    "@linear/sdk": "^26.0.0",
    "googleapis": "^140.0.0",
    "better-sqlite3": "^11.0.0",
    "@xenova/transformers": "^2.17.0",
    "chokidar": "^4.0.0",
    "yaml": "^2.5.0",
    "dotenv": "^16.4.0",
    "pino": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "tsx": "^4.0.0",
    "vitest": "^2.0.0"
  }
}
```

---

## macOS Permissions Required

The assistant requires the following macOS permissions:

1. **Accessibility** - For AppleScript automation
2. **Full Disk Access** - To read Messages.app database
3. **Automation** - To control Messages.app
4. **Network** - Outbound HTTPS to API endpoints

Grant via: System Preferences → Privacy & Security → [Permission Type]

---

## API References

- [Claude Agent SDK V2 (Preview)](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview.md)
- [Claude Agent SDK Hosting](https://platform.claude.com/docs/en/agent-sdk/hosting.md)
- [Linear SDK](https://linear.app/developers/sdk)
- [Linear Webhooks](https://linear.app/developers/webhooks)
- [Linear Agents](https://linear.app/developers/agents)
- [Slack Bolt SDK](https://slack.dev/bolt-js/)
- [Gmail API](https://developers.google.com/gmail/api)
