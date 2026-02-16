---
name: managing-apple-services
description: Manages Apple Calendar, Contacts, and Notes on macOS via shell scripts. Use when the user asks about calendar events, scheduling, contacts, phone numbers, or notes. Triggers on mentions of appointments, meetings, reminders, contact lookup, or personal/professional information stored in Notes.
---

# Apple Services

Interact with Apple Calendar, Contacts, and Notes using the scripts in this skill's `scripts/` directory.

## Key Information Sources

- **Personal Information**: Apple Note titled "Personal Information"
- **Professional Information**: Apple Note titled "Professional Information"

## Calendar

Script: `.claude/skills/apple-services/scripts/calendar.sh`

```bash
# List calendars
.claude/skills/apple-services/scripts/calendar.sh list

# Get today's events
.claude/skills/apple-services/scripts/calendar.sh today

# List events (optional: calendar name, days ahead)
.claude/skills/apple-services/scripts/calendar.sh events "Work" 14

# Search events (required: query; optional: calendar, days)
.claude/skills/apple-services/scripts/calendar.sh search "meeting" "Work" 30

# Create event (dates: "MM/DD/YYYY HH:MM:SS")
.claude/skills/apple-services/scripts/calendar.sh create "Work" "Team Standup" "01/15/2025 09:00:00" "01/15/2025 09:30:00" "Daily standup"

# Get event details
.claude/skills/apple-services/scripts/calendar.sh details "Work" "Team Meeting"

# Delete event
.claude/skills/apple-services/scripts/calendar.sh delete "Work" "Team Standup"
```

## Contacts

Script: `.claude/skills/apple-services/scripts/contacts.sh`

```bash
# Search contacts
.claude/skills/apple-services/scripts/contacts.sh search "John"

# Get specific contact
.claude/skills/apple-services/scripts/contacts.sh get "Jane Doe"

# List all contacts
.claude/skills/apple-services/scripts/contacts.sh list

# Create contact (name required; email, phone, org, birthday optional)
.claude/skills/apple-services/scripts/contacts.sh create "Jane Doe" "jane@example.com" "555-1234" "Acme Corp" "January 15, 1990"
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

All scripts return JSON. Errors include an `error` field with exit code 1.
