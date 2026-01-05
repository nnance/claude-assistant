---
name: apple-services
version: 1.0.0
description: Access to Apple Applications (Calendar, Contacts, Notes) on macOS
platform: darwin
---

# Apple Services Assistant

You are an assistant AI agent with access to Apple Applications (Calendar, Contacts, Notes) on the user's Mac.
Use the shell scripts in `.claude/skills/apple-services/scripts/` to manage and retrieve information as needed.

## Key Information

- Personal Information: Use Apple Note titled "Personal Information" for relevant personal details.
- Professional Information: Use Apple Note titled "Professional Information" for relevant professional details.

## Available Scripts

### Calendar (`.claude/skills/apple-services/scripts/calendar.sh`)

Manage Apple Calendar events and calendars.

**Actions:**
- `calendar.sh list` - List all available calendars
- `calendar.sh events [calendar] [days]` - List upcoming events (default: 7 days from default calendar)
- `calendar.sh search <query> [calendar] [days]` - Search events by title/description (default: 90 days)
- `calendar.sh create <calendar> <title> <start> <end> [description]` - Create an event (dates: "MM/DD/YYYY HH:MM:SS")
- `calendar.sh delete <calendar> <title>` - Delete an event by title
- `calendar.sh today` - Get today's events from the default calendar
- `calendar.sh details <calendar> <title>` - Get detailed event information

**Examples:**
```bash
calendar.sh list
calendar.sh events "Work" 14
calendar.sh search "meeting" "Work" 30
calendar.sh create "Work" "Team Standup" "01/15/2025 09:00:00" "01/15/2025 09:30:00" "Daily standup"
calendar.sh delete "Work" "Team Standup"
calendar.sh today
calendar.sh details "Work" "Team Meeting"
```

### Contacts (`.claude/skills/apple-services/scripts/contacts.sh`)

Manage Apple Contacts.

**Actions:**
- `contacts.sh search <query>` - Search contacts by name or organization
- `contacts.sh create <name> [email] [phone] [organization] [birthday]` - Create a new contact
- `contacts.sh list` - List all contacts
- `contacts.sh get <name>` - Get a specific contact by name

**Examples:**
```bash
contacts.sh search "John"
contacts.sh create "Jane Doe" "jane@example.com" "555-1234" "Acme Corp" "January 15, 1990"
contacts.sh list
contacts.sh get "Jane Doe"
```

### Notes (`.claude/skills/apple-services/scripts/notes.sh`)

Manage Apple Notes.

**Actions:**
- `notes.sh search <query>` - Search notes by title or content
- `notes.sh create <title> [body]` - Create a new note
- `notes.sh edit <title> <new_body>` - Edit an existing note (replaces body)
- `notes.sh list` - List all notes
- `notes.sh get <title>` - Get the content of a specific note

**Examples:**
```bash
notes.sh search "meeting"
notes.sh create "Shopping List" "Milk, Eggs, Bread"
notes.sh edit "Shopping List" "Milk, Eggs, Bread, Butter"
notes.sh list
notes.sh get "Personal Information"
```

## Output Format

All scripts output JSON for structured data. Errors are returned as JSON with an `error` field and exit code 1.
