# Note Format Reference

## YAML Frontmatter

Every note starts with a YAML frontmatter block delimited by `---`:

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

### Fields

| Field      | Type     | Required | Description                              |
| ---------- | -------- | -------- | ---------------------------------------- |
| created    | string   | yes      | ISO 8601 timestamp without timezone      |
| tags       | string[] | yes      | Array of hierarchical tags               |
| confidence | number   | yes      | 0-100 score for categorization certainty |

- `created`: Use the current date/time in `YYYY-MM-DDTHH:MM:SS` format
- `tags`: At minimum, include one entity tag and one priority tag. Status tag is optional but recommended for tasks.
- `confidence`: 85-95 for clear intent, 60-84 for reasonable guess, below 60 should trigger clarification instead

## Slug Generation

Given a title string, generate a slug:

1. Convert to lowercase
2. Remove all characters except alphanumeric, spaces, and hyphens
3. Replace one or more spaces with a single hyphen
4. Remove leading/trailing hyphens
5. Truncate to 50 characters (break at a hyphen boundary if possible)

Examples:
- "Follow up with Sarah about the security audit" → `follow-up-with-sarah-about-the-security-audit`
- "What if we used K8s for the ML pipeline?" → `what-if-we-used-k8s-for-the-ml-pipeline`
- "https://example.com/article" → `httpsexamplecomarticle` (or derive a better title from context)

## Filename Format

```
YYYY-MM-DD_slug.md
```

- Date is the creation date
- Underscore separates date from slug
- Extension is always `.md`

Example: `2026-02-15_follow-up-with-sarah-about-the-security-audit.md`

## Collision Handling

Before writing, check if the filename already exists using Glob:

```
$VAULT_PATH/<folder>/YYYY-MM-DD_slug*.md
```

If it exists, append a numeric suffix:
- `2026-02-15_follow-up-sarah.md` (original)
- `2026-02-15_follow-up-sarah-1.md` (first collision)
- `2026-02-15_follow-up-sarah-2.md` (second collision)

## Log Entry Format

Daily log files live at `$VAULT_PATH/_system/logs/YYYY-MM-DD.md`.

Each entry is an H2 heading with the timestamp, followed by metadata fields:

```markdown
## 14:30:00

- **Input**: "Save a task to follow up with Sarah about the security audit"
- **Category**: Tasks
- **Confidence**: 92
- **Reasoning**: Clear action verb "follow up", named person, named project
- **Tags**: person/sarah, project/security-audit, priority/normal, status/active
- **Stored**: Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md
```

For clarification entries:

```markdown
## 14:32:00

- **Input**: "remember the thing about the meeting"
- **Action**: Clarification requested
- **Reasoning**: Ambiguous input - unclear what "the thing" refers to, no specific meeting identified
```

Entries are appended to the file throughout the day. If the log file doesn't exist yet, create it with a top-level heading:

```markdown
# Vault Log - YYYY-MM-DD

## HH:MM:SS
...
```
