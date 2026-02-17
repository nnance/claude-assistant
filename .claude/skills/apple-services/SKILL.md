---
name: managing-apple-services
description: Manages Apple Calendar, Contacts, and Notes on macOS via shell scripts and a native CLI. Use when the user asks about calendar events, scheduling, contacts, phone numbers, or notes. Triggers on mentions of appointments, meetings, reminders, contact lookup, or personal/professional information stored in Notes.
---

# Apple Services

Interact with Apple Calendar, Contacts, and Notes. Calendar and Contacts use a native Swift CLI (`apple-services`) for performance, with shell script fallbacks. Notes uses shell scripts.

**Execution rule:** For Calendar and Contacts commands, try the binary first. If it fails with "command not found" or is not installed, fall back to the corresponding shell script. The argument signatures are identical.

## Key Information Sources

- **Personal Information**: Apple Note titled "Personal Information"
- **Professional Information**: Apple Note titled "Professional Information"

## Calendar

Binary: `apple-services calendar <action> [args...]`
Fallback: `.claude/skills/apple-services/scripts/calendar.sh <action> [args...]`

```bash
# List calendars
apple-services calendar list

# Get today's events
apple-services calendar today

# List events (optional: calendar name, days ahead)
apple-services calendar events "Work" 14

# Search events (required: query; optional: calendar, days)
apple-services calendar search "meeting" "Work" 30

# Create event (dates: "MM/DD/YYYY HH:MM:SS")
apple-services calendar create "Work" "Team Standup" "01/15/2025 09:00:00" "01/15/2025 09:30:00" "Daily standup"

# Get event details
apple-services calendar details "Work" "Team Meeting"

# Delete event
apple-services calendar delete "Work" "Team Standup"
```

## Contacts

Binary: `apple-services contacts <action> [args...]`
Fallback: `.claude/skills/apple-services/scripts/contacts.sh <action> [args...]`

```bash
# Search contacts
apple-services contacts search "John"

# Get specific contact
apple-services contacts get "Jane Doe"

# List all contacts
apple-services contacts list

# Create contact (name required; email, phone, org, birthday optional)
apple-services contacts create "Jane Doe" "jane@example.com" "555-1234" "Acme Corp" "January 15, 1990"

# Delete contact by name
apple-services contacts delete "Jane Doe"
```

## Notes

Script: `.claude/skills/apple-services/scripts/notes.sh`

```bash
# Get note content
.claude/skills/apple-services/scripts/notes.sh get "Personal Information"

# Search notes
.claude/skills/apple-services/scripts/notes.sh search "meeting"

# List all notes
.claude/skills/apple-services/scripts/notes.sh list

# Create note
.claude/skills/apple-services/scripts/notes.sh create "Shopping List" "Milk, Eggs, Bread"

# Edit note (replaces body)
.claude/skills/apple-services/scripts/notes.sh edit "Shopping List" "Milk, Eggs, Bread, Butter"
```

## Output Format

All commands return JSON. Errors include an `error` field with exit code 1.
