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
- **src/sessions/store.ts** - SQLite persistence mapping Slack threads to agent sessions
- **src/config.ts** - Environment variable loading with validation

### Session Management

Sessions are keyed by `(slack_channel_id, slack_thread_ts)`. Each thread maintains its own conversation context. Sessions expire after 7 days of inactivity (configurable).

### Daemon Setup

The `scripts/` directory contains launchd plist and install/uninstall scripts for running as a persistent macOS service. Logs go to `/tmp/claude-assistant.log`.

## Configuration

Copy `.env.example` to `.env`. Required variables:
- `ANTHROPIC_API_KEY`
- `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`

See `.env.example` for optional configuration (model, timeouts, session expiry).
