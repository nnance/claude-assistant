# Note Format Reference

## Frontmatter

```yaml
---
created: 2026-02-15T14:30:00
tags:
  - person/sarah-chen
  - priority/high
  - status/active
confidence: 90
---
```

| Field      | Required | Description                                |
| ---------- | -------- | ------------------------------------------ |
| created    | yes      | ISO 8601 timestamp (`YYYY-MM-DDTHH:MM:SS`) |
| tags       | yes      | Array of hierarchical tags                 |
| confidence | yes      | 0-100 categorization certainty             |

Confidence thresholds:
- 85-95: Clear intent, store directly
- 60-84: Reasonable guess
- Below 60: Ask for clarification

## Filename

```
YYYY-MM-DD_slug.md
```

**Slug rules**: Lowercase, alphanumeric + hyphens only, max 50 chars.

**Collision handling**: Append `-1`, `-2`, etc.

## Log Entry Format

Log file: `$VAULT_PATH/_system/logs/YYYY-MM-DD.md`

**For stored notes:**
```markdown
## HH:MM:SS

- **Input**: User's request
- **Category**: Folder chosen
- **Confidence**: Score
- **Reasoning**: Why this categorization
- **Tags**: tag1, tag2
- **Stored**: relative/path/to/note.md
```

**For clarifications:**
```markdown
## HH:MM:SS

- **Input**: User's request
- **Action**: Clarification requested
- **Reasoning**: Why clarification was needed
```

If log file doesn't exist, create with heading: `# Vault Log - YYYY-MM-DD`
