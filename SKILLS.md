# Skills Registry

This document catalogs all skills built into this project. Skills extend the assistant's capabilities with specialized behaviors and tools.

Optional skills (Apple Services, Google Workspace, Vault, and more) are available in the [claude-assistant-skills](https://github.com/nnance/claude-assistant-skills) registry and can be installed via the `skill-registry` skill.

## Overview

| Skill | Description | Trigger Phrases |
|-------|-------------|-----------------|
| [skill-registry](#skill-registry) | Browse and install skills from the registry | "install skill", "list available skills", "what skills are available" |
| [scheduling](#scheduling) | Scheduled tasks and reminders | "remind me", "schedule", "every morning", "recurring" |
| [slack-messaging](#slack-messaging) | Send Slack DMs and channel messages | "send a message", "notify me", "DM me" |
| [memory](#memory) | Cross-thread memory extraction | (automatic, not user-invoked) |

## Skills

### skill-registry

**Location**: `.claude/skills/skill-registry/`

**Description**: Browses, installs, and updates optional skills from the [claude-assistant-skills](https://github.com/nnance/claude-assistant-skills) GitHub registry using the `gh` CLI.

**Triggers**:
- "install skill", "find a skill", "search for skills"
- "list available skills", "what skills are available"
- "update the vault skill", "upgrade apple-services"

**Capabilities**:
- List all available skills in the registry
- Read a skill's description before installing
- Install any skill by downloading its files into `.claude/skills/`
- Update installed skills to the latest version

**CLI**:
- Uses `gh api` commands against `repos/nnance/claude-assistant-skills`

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

### Built-in skills (this repo)

1. Create a directory under `.claude/skills/<skill-name>/`
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`) and markdown instructions
3. Follow [Anthropic's skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
4. Update this registry with the new skill details

### Registry skills

To contribute an optional skill to the public registry, see the [claude-assistant-skills](https://github.com/nnance/claude-assistant-skills) repo.
