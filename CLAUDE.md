# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Compile TypeScript to dist/
npm run dev          # Run with hot-reload (tsx watch)
npm run start        # Run compiled version
npm run test         # Run Jest tests
npm run lint         # Check linting with Biome
npm run lint:fix     # Auto-fix linting issues
```

Run a single test file:
```bash
npm test -- src/__tests__/config.test.ts
```

## Design Principles

1. **Prompt-driven over deterministic code** — Agent behavior should be shaped by prompts and skills, not hardcoded logic. Give the agent autonomy to decide what to do. Code should be limited to API interactions (local or remote) exposed as CLI tools.
2. **CLIs over MCP tools** — Expose capabilities as CLI commands that skills invoke via `npx tsx`. This supports progressive disclosure — the agent discovers tools through skills as needed rather than managing a large predefined tool list.
3. **Keep it simple and DRY** — Minimal external dependencies (only add frameworks when they provide significant value like Next.js, React, etc.). Reuse existing skills and code within the project. Prefer the simplest solution that works.

## Architecture

This is a personal AI assistant that runs as a macOS daemon, communicating via Slack and powered by Claude (Anthropic SDK).

### Data Flow

```
Slack (Socket Mode) → Handlers → Session Store → Agent → Claude API
                                     ↓
                              SQLite (sessions.db)
```

### Key Components

- **src/index.ts** - Entry point; initializes all components and handles graceful shutdown
- **src/agent.ts** - Wraps Anthropic SDK; manages conversation contexts per session
- **src/slack/** - Bolt SDK integration with Socket Mode for @mentions and DMs
- **src/sessions/store.ts** - SQLite persistence mapping Slack threads to agent sessions; also stores settings (owner detection)
- **src/scheduler/** - Proactive features: scheduler store, runner (60s tick loop with active hours enforcement), cron utilities
- **src/config.ts** - Environment variable loading with validation

### Session Management

Sessions are keyed by `(slack_channel_id, slack_thread_ts)`. Each thread maintains its own conversation context. Sessions expire after 7 days of inactivity (configurable).

### Proactive Features

When `PROACTIVE_ENABLED=true`, the assistant can act proactively:

- **Scheduler** - AI-managed scheduled tasks persisted in SQLite (`data/scheduler.db`). Supports one-shot (fire once) and recurring (cron-based) jobs. The scheduler runner ticks every 60s, only during active hours (8am-10pm configurable). The agent delivers messages via the Slack messaging skill when results are worth reporting. Jobs auto-disable after 3 consecutive failures.
- **Heartbeat** - Implemented as a recurring scheduled job (not a separate runner). Auto-created on scheduler startup. The agent reads `data/HEARTBEAT.md` for standing instructions and uses the Slack messaging skill to notify when action is needed.
- **Owner Detection** - The first Slack user to interact with the bot is recorded as the owner. Proactive messages are delivered via DM to the owner using the Slack CLI (`src/slack/cli.ts`).

### Daemon Setup

The `scripts/` directory contains launchd plist and install/uninstall scripts for running as a persistent macOS service. Logs go to `/tmp/claude-assistant.log`.

## Configuration

Copy `.env.example` to `.env`. Required variables:
- `ANTHROPIC_API_KEY`
- `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`

See `.env.example` for optional configuration (model, timeouts, session expiry).

## Skills

Skills are located in `.claude/skills/`. Each skill has a `SKILL.md` file with YAML frontmatter and markdown instructions.

**When adding or modifying skills:**
1. Follow [Anthropic's skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
2. Use gerund naming (e.g., `managing-vault`, not `vault`)
3. Write descriptions in third person with trigger phrases
4. Update `SKILLS.md` registry with the new/changed skill details
