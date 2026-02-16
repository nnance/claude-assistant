---
name: managing-vault
description: "Captures, organizes, and retrieves notes in an Obsidian vault. Use when the user says: 'save a note', 'capture this', 'remember that', 'add to vault', 'list notes', 'read note', 'find in vault', 'show my tasks', or 'log this'."
allowed-tools: Read, Write, Glob, Grep, Bash
---

# Obsidian Vault Management

## Vault Path

All operations use `$VAULT_PATH`. If unset, ask user to configure it.

## Quick Reference

| Folder       | Content                                    |
| ------------ | ------------------------------------------ |
| Tasks        | Actionable items with action verbs         |
| Ideas        | Thoughts, concepts, creative sparks        |
| Reference    | Links, articles, facts, quotes             |
| Projects     | Multi-note project initiatives             |
| Inbox        | Genuinely ambiguous items only             |
| Archive      | Completed items                            |
| _system/logs | Daily interaction logs (auto-managed)      |

**Tag system**: See [references/tags.md](references/tags.md)
**Note format**: See [references/note-format.md](references/note-format.md)
**Examples**: See [references/examples.md](references/examples.md)

## Operations

### Write Note

1. Choose folder based on content
2. Generate filename: `YYYY-MM-DD_slug.md`
3. Check collisions: `Glob → $VAULT_PATH/<folder>/YYYY-MM-DD_slug*.md`
4. Write with frontmatter (created, tags, confidence)
5. Log to `$VAULT_PATH/_system/logs/YYYY-MM-DD.md`

### Read Note

```
Read → $VAULT_PATH/<path>
```

If path is ambiguous, use Glob to find matches.

### List Notes

```
Glob → $VAULT_PATH/<folder>/**/*.md
```

For tag filtering: Read each file's frontmatter, use AND logic. Default limit: 20.

### Search Notes

```
Grep → pattern in $VAULT_PATH/**/*.md
```

## Decision Logic

**Store directly** (confidence 85-95):
- Clear action verbs: "follow up", "schedule", "review"
- Explicit hints: "save this link", "I have an idea"
- Named entities: people, projects, companies

**Ask first** (low confidence):
- Multiple valid folders
- Ambiguous category
- Missing context
- Very brief input

Always log interactions, even when clarifying.

## Workflow

1. **Analyze**: What does the user want to capture or retrieve?
2. **Decide**: High confidence → store. Low confidence → clarify.
3. **Act**: Create note + log, or ask for detail.
4. **Confirm**: Report file path, folder, and tags assigned.
