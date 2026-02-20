# Claude Assistant

A self-hosted personal AI assistant running as a macOS daemon with Slack integration. Built on the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-agent-sdk) — a battle-tested agent harness with a zero-trust permission model, built-in tools (file editing, shell access, web search), skills, and sub-agent support. This project layers a thin runtime on top of the SDK, keeping application code minimal and letting the agent drive behavior through prompts and skills.

## Features

- **Claude Agent SDK** - Zero-trust agent harness with built-in tools, skills, sub-agents, and session management
- **Slack Integration** - Communicate via @mentions in channels or direct messages
- **Persistent Sessions** - Conversations maintain context within threads, backed by the SDK's session resumption
- **Proactive Scheduling** - AI-managed scheduled tasks with automatic heartbeat monitoring
- **macOS Daemon** - Runs as a launchd service with automatic restart
- **Extensible Skills** - Apple services, Obsidian vault, Slack messaging, and more (see [SKILLS.md](SKILLS.md))

## Design Principles

This project follows three core principles that guide all contributions:

1. **Prompt-driven over deterministic code** — Agent behavior should be shaped by prompts and skills, not hardcoded logic. The agent gets autonomy to decide what to do. Code should be limited to API interactions (local or remote) exposed as CLI tools.

2. **CLIs over MCP tools** — Expose capabilities as CLI commands that skills invoke via `npx tsx`. This supports progressive disclosure — the agent discovers tools through skills as needed rather than managing a large predefined tool list.

3. **Keep it simple and DRY** — Minimal external dependencies (only add frameworks when they provide significant value). Reuse existing skills and code within the project. Prefer the simplest solution that works.

## Prerequisites

- Node.js >= 20.0.0
- macOS (for daemon functionality)
- Slack workspace with admin access

## Setup

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create New App → From scratch
3. Enable **Socket Mode** (Settings → Socket Mode → Enable)
4. Generate App-Level Token with `connections:write` scope
5. Add Bot Token Scopes under OAuth & Permissions:
   - `app_mentions:read`
   - `chat:write`
   - `im:history`
   - `im:read`
   - `im:write`
   - `reactions:write`
6. Subscribe to events under Event Subscriptions:
   - `app_mention`
   - `message.im`
7. Install to workspace
8. Copy Bot Token and App Token

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
ANTHROPIC_API_KEY=sk-ant-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run

**Development (with hot-reload):**
```bash
npm run dev
```

**Production (as daemon):**
```bash
npm run build
./scripts/install-daemon.sh
```

## Usage

**In Slack channels:**
```
@assistant what's in my Downloads folder?
```

**In direct messages:**
```
find all TODO comments in ~/Developer/myproject
```

Conversations within a thread share context, allowing follow-up questions.

## Daemon Management

```bash
# View logs
tail -f /tmp/claude-assistant.log
tail -f /tmp/claude-assistant.error.log

# Stop daemon
launchctl unload ~/Library/LaunchAgents/com.user.claude-assistant.plist

# Start daemon
launchctl load ~/Library/LaunchAgents/com.user.claude-assistant.plist

# Uninstall
./scripts/uninstall-daemon.sh
```

## Configuration Options

See `.env.example` for all options:

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_MODEL` | `claude-opus-4-5` | Claude model to use |
| `AGENT_MAX_TURNS` | `50` | Max conversation turns |
| `SESSION_DATABASE_PATH` | `./data/sessions.db` | SQLite database location |
| `SESSION_EXPIRE_DAYS` | `7` | Days until session cleanup |
| `LOG_LEVEL` | `info` | Logging verbosity |

## Development

```bash
npm run build      # Compile TypeScript
npm run test       # Run tests
npm run lint       # Check code style
npm run lint:fix   # Auto-fix style issues
```

## License

MIT
