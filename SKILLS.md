# Skills Registry

This document catalogs all skills available in this project. Skills extend the assistant's capabilities with specialized behaviors and tools.

## Overview

| Skill | Description | Trigger Phrases |
|-------|-------------|-----------------|
| [managing-apple-services](#managing-apple-services) | macOS Calendar, Contacts, Notes | "calendar", "schedule", "contacts", "notes" |
| [managing-vault](#managing-vault) | Obsidian vault note management | "save a note", "add to vault", "show my tasks" |
| [scheduling](#scheduling) | Scheduled tasks and reminders | "remind me", "schedule", "every morning", "recurring" |
| [slack-messaging](#slack-messaging) | Send Slack DMs and channel messages | "send a message", "notify me", "DM me" |
| [memory](#memory) | Cross-thread memory extraction | (automatic, not user-invoked) |

## Skills

### managing-apple-services

**Location**: `.claude/skills/apple-services/`

**Description**: Manages Apple Calendar, Contacts, and Notes on macOS via shell scripts.

**Triggers**:
- Calendar: "what's on my calendar", "schedule a meeting", "upcoming events"
- Contacts: "find contact", "phone number for", "email for"
- Notes: "personal information", "professional information", mentions of Apple Notes

**Capabilities**:
- List, search, create, and delete calendar events
- Search, list, and create contacts
- Read, search, create, and edit Apple Notes

**Scripts**:
- `scripts/calendar.sh` - Calendar operations
- `scripts/contacts.sh` - Contacts operations
- `scripts/notes.sh` - Notes operations

---

### managing-vault

**Location**: `.claude/skills/vault/`

**Description**: Captures, organizes, and retrieves notes in an Obsidian vault.

**Triggers**:
- "save a note", "capture this", "remember that"
- "add to vault", "list notes", "read note"
- "find in vault", "show my tasks", "log this"

**Capabilities**:
- Create notes with automatic folder classification (Tasks, Ideas, Reference, Projects)
- Search and retrieve notes by content or tags
- Maintain daily interaction logs

**Configuration**: Requires `$VAULT_PATH` environment variable pointing to Obsidian vault.

**Reference Files**:
- `references/tags.md` - Tag system documentation
- `references/note-format.md` - Note formatting standards
- `references/examples.md` - Usage examples

---

### scheduling

**Location**: `.claude/skills/scheduling/`

**Description**: Manages scheduled tasks and reminders using a SQLite-backed scheduler.

**Triggers**:
- "remind me in 5 minutes", "remind me tomorrow at 9am"
- "schedule a recurring task", "every weekday morning"
- "show my scheduled jobs", "pause that reminder"

**Capabilities**:
- Create one-shot reminders (fire once at a specific time)
- Create recurring jobs (fire on a cron schedule)
- List, pause, resume, and delete scheduled jobs

**CLI**:
- `npx tsx src/scheduler/cli.ts` - CRUD operations via the SchedulerStore

**Configuration**: Requires `PROACTIVE_ENABLED=true` in environment.

---

### slack-messaging

**Location**: `.claude/skills/slack-messaging/`

**Description**: Sends Slack messages to the bot owner or specific channels via CLI.

**Triggers**:
- "send a message", "notify me", "DM me"
- When a scheduled job produces results worth delivering
- Any context where the agent needs to proactively message the owner

**Capabilities**:
- Send DM to bot owner (`send-dm`)
- Send message to a specific channel (`send`)

**CLI**:
- `npx tsx src/slack/cli.ts` - Send messages via Slack Web API

**Configuration**: Requires `SLACK_BOT_TOKEN` in environment and owner set in `sessions.db`.

---

### memory

**Location**: `.claude/skills/memory/`

**Description**: Cross-thread memory extraction for persistent context across conversations.

**Triggers**: Automatic (not user-invoked). Runs after conversations to extract important details.

**Capabilities**:
- Extracts decisions, tasks, preferences, facts, and entities from conversations
- Stores daily memory logs in markdown format
- Deduplicates entries within daily logs

**What Gets Extracted**:
- **decision** - Choices made ("We decided to use PostgreSQL")
- **task** - Action items ("Send the proposal by Friday")
- **preference** - User preferences ("Prefers TypeScript over JavaScript")
- **fact** - Concrete facts ("Production server is at 10.0.1.50")
- **entity** - Important people/projects ("Sarah Chen is PM for Project Atlas")

**Storage**: `<memory_path>/daily/YYYY-MM-DD.md`

---

## Adding New Skills

1. Create a directory under `.claude/skills/<skill-name>/`
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`) and markdown instructions
3. Follow [Anthropic's skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
4. Update this registry with the new skill details
