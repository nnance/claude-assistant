---
name: slack-messaging
description: Sends Slack messages to the bot owner or specific channels. Use when the assistant needs to proactively notify the user, deliver scheduled job results, or send messages. Triggers on "send a message", "notify me", "DM me", or when a scheduled job produces results that should be delivered.
---

# Slack Messaging

Send messages to the bot owner via DM or to specific Slack channels.

**CLI:** `npx tsx src/slack/cli.ts <command> [args...]`

## Commands

```bash
# Send a DM to the bot owner
npx tsx src/slack/cli.ts send-dm "Your message here"

# Send to a specific channel
npx tsx src/slack/cli.ts send <channel-id> "Your message here"
```

## Output Format

All commands return JSON on success:
```json
{ "ok": true, "channel": "D123ABC", "ts": "1234567890.123456" }
```

Errors return JSON on stderr with exit code 1:
```json
{ "error": "description of what went wrong" }
```

## When to Use

- **Scheduled jobs**: When a job produces results worth reporting, send them via `send-dm`
- **Proactive notifications**: When the assistant detects something the owner should know about
- **Any skill or conversation**: Whenever the agent needs to message the owner outside of a Slack thread

## Best Practices

- Keep messages concise and actionable
- Use Slack markdown formatting: `*bold*`, `_italic_`, `\n` for newlines
- If nothing needs to be communicated, simply don't send a message — no special tokens needed
- Prefix scheduled job results with the job name for context (e.g., `*Daily Briefing*\n\n...`)
