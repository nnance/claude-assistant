---
name: scheduling
description: Manages scheduled tasks and reminders using a SQLite-backed scheduler. Use when the user asks to set reminders, schedule recurring tasks, or manage timed notifications. Triggers on mentions of "remind me", "schedule", "every morning", "in 5 minutes", "recurring", or time-based task requests.
---

# Scheduling

Create, manage, and query scheduled jobs and reminders. Jobs are persisted in SQLite and executed automatically by the scheduler runner.

**CLI:** `npx tsx src/scheduler/cli.ts <command> [args...]`

## Commands

```bash
# List active jobs
npx tsx src/scheduler/cli.ts list

# List all jobs (including completed, paused, failed)
npx tsx src/scheduler/cli.ts list all

# Create a one-shot job (fires once at the specified ISO timestamp)
npx tsx src/scheduler/cli.ts create "Job Name" one_shot "2025-01-15T09:00:00.000Z" "The prompt to execute"

# Create a recurring job (fires on a cron schedule)
npx tsx src/scheduler/cli.ts create "Morning Briefing" recurring "0 9 * * 1-5" "Check my calendar for today and summarize upcoming meetings"

# Get job details
npx tsx src/scheduler/cli.ts get <job-id>

# Pause a job
npx tsx src/scheduler/cli.ts pause <job-id>

# Resume a paused job
npx tsx src/scheduler/cli.ts resume <job-id>

# Delete a job
npx tsx src/scheduler/cli.ts delete <job-id>
```

## Output Format

All commands return JSON. Errors include an `error` field with exit code 1.

## Time Parsing Guide

When the user says natural language times, convert them as follows:

### One-Shot (ISO timestamps)
- "in 5 minutes" → compute current time + 5 minutes, format as ISO 8601
- "tomorrow at 9am" → next day at 09:00 in user's timezone, convert to UTC ISO
- "next Monday at 2pm" → next Monday 14:00 in user's timezone, convert to UTC ISO
- "January 15 at noon" → 2025-01-15T12:00:00 in user's timezone, convert to UTC ISO

### Recurring (cron expressions)
- "every morning at 9" → `0 9 * * *`
- "every weekday at 9am" → `0 9 * * 1-5`
- "every hour" → `0 * * * *`
- "every 30 minutes" → `*/30 * * * *`
- "every Monday at 10am" → `0 10 * * 1`
- "every day at 6pm" → `0 18 * * *`
- "twice a day at 9am and 5pm" → create two separate jobs

### Cron Format Reference
```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0 and 7 = Sunday)
│ │ │ │ │
* * * * *
```

## Heartbeat Pattern

A heartbeat is a recurring job that checks standing instructions and only notifies when action is needed. The runner auto-creates a heartbeat job on startup. Its prompt instructs the agent to use the Slack messaging skill (`send-dm`) when something needs attention, and do nothing otherwise.

## Delivering Results

Jobs that produce results worth sharing should use the **slack-messaging** skill to deliver them:

```bash
npx tsx src/slack/cli.ts send-dm "Your notification here"
```

The agent decides whether to send a message based on the job's output — no special tokens or conventions needed. If nothing requires attention, the agent simply doesn't send a message.

## Best Practices

- For reminders, use `one_shot` with an ISO timestamp
- For recurring tasks, use `recurring` with a cron expression
- The prompt field should be clear, self-contained instructions for the AI agent
- Include context in the prompt (e.g., "Check my calendar and notify about meetings in the next hour")
- Use the Slack messaging skill to deliver results when the job produces something worth reporting
- When listing jobs for the user, format the output nicely with names, schedules, and status
