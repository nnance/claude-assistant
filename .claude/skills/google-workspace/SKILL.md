---
name: google-workspace
description: Accesses Google Workspace services including Gmail, Drive, Docs, and Sheets via the gogcli CLI. Use when the user asks about emails, Google documents, spreadsheets, or cloud files. Triggers on mentions of "email", "Gmail", "Google Doc", "spreadsheet", "Google Drive", "send email", "search my drive", "create a doc", or file sharing.
---

# Google Workspace

Interact with Gmail, Google Drive, Docs, and Sheets using `gog` (gogcli).

**Prerequisite:** User must have `gog` installed and authenticated. If commands fail with "command not found", instruct user to install via `brew install steipete/tap/gogcli` and authenticate with `gog auth add <email>`.

## Account Selection

Specify account via `--account` flag or rely on default configured account:
```bash
gog --account user@gmail.com <command>
```

## Gmail

```bash
# Search emails (default: last 50)
gog gmail search 'newer_than:7d'
gog gmail search 'from:boss@company.com subject:urgent'
gog gmail search 'has:attachment filename:pdf'
gog gmail search 'is:unread' --max 20

# Read a specific thread
gog gmail thread get <threadId>
gog gmail thread get <threadId> --download  # includes attachments

# Send email
gog gmail send --to "recipient@example.com" --subject "Subject" --body "Message body"
gog gmail send --to "a@example.com" --cc "b@example.com" --subject "Hi" --body "Hello"

# Reply to a thread
gog gmail send --to "recipient@example.com" --subject "Re: Original" --body "Reply" --thread <threadId>

# Labels
gog gmail labels list
gog gmail labels create "My Label"
gog gmail labels modify <threadId> --add "IMPORTANT" --remove "INBOX"

# Drafts
gog gmail drafts list
gog gmail drafts create --to "user@example.com" --subject "Draft" --body "Content"
```

### Gmail Search Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:user@example.com` | Sender |
| `to:` | `to:me` | Recipient |
| `subject:` | `subject:meeting` | Subject line |
| `has:attachment` | `has:attachment` | Has attachments |
| `filename:` | `filename:pdf` | Attachment type |
| `newer_than:` | `newer_than:7d` | Recent emails (d/m/y) |
| `older_than:` | `older_than:1m` | Older emails |
| `is:unread` | `is:unread` | Unread only |
| `is:starred` | `is:starred` | Starred only |
| `label:` | `label:work` | By label |

## Google Drive

```bash
# List files (default: 20 most recent)
gog drive ls
gog drive ls --max 50
gog drive ls --folder <folderId>

# Search files
gog drive search "quarterly report"
gog drive search "type:document modified:today"
gog drive search "type:spreadsheet"

# Upload file
gog drive upload ./local-file.txt
gog drive upload ./document.pdf --folder <folderId>

# Download file
gog drive download <fileId>
gog drive download <fileId> --output ./local-path.pdf

# Get file info
gog drive info <fileId>

# Create folder
gog drive mkdir "New Folder"
gog drive mkdir "Subfolder" --parent <parentFolderId>

# Share file
gog drive share <fileId> --email "user@example.com" --role writer
gog drive share <fileId> --email "user@example.com" --role reader

# Delete (moves to trash)
gog drive delete <fileId>
```

### Drive Search Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `type:` | `type:document`, `type:spreadsheet`, `type:folder` | File type |
| `owner:` | `owner:me` | Owned by |
| `modified:` | `modified:today`, `modified:2024-01-01` | Modified date |
| `name:` | `name:report` | Filename contains |

## Google Docs

```bash
# Create a new document
gog docs create "Document Title"

# Read document content (plain text)
gog docs get <documentId>
gog docs get <documentId> --json  # structured JSON

# Export document
gog docs export <documentId> --format pdf --output ./doc.pdf
gog docs export <documentId> --format docx --output ./doc.docx
gog docs export <documentId> --format txt --output ./doc.txt

# Append text to document
gog docs append <documentId> "Text to append at the end"

# Insert text at index
gog docs insert <documentId> --index 1 "Text at beginning"
```

### Export Formats

- `pdf` - PDF document
- `docx` - Microsoft Word
- `txt` - Plain text
- `html` - HTML
- `epub` - EPUB ebook
- `odt` - OpenDocument

## Google Sheets

```bash
# Create spreadsheet
gog sheets create "Spreadsheet Title"

# Read data from range
gog sheets get <spreadsheetId> 'Sheet1!A1:D10'
gog sheets get <spreadsheetId> 'Sheet1'  # entire sheet

# Write single value
gog sheets update <spreadsheetId> 'A1' 'New Value'

# Write range (JSON array)
gog sheets update <spreadsheetId> 'A1:B2' '[["A1","B1"],["A2","B2"]]'

# Append row to sheet
gog sheets append <spreadsheetId> 'Sheet1' '[["Col1","Col2","Col3"]]'

# Get spreadsheet metadata
gog sheets info <spreadsheetId>

# List sheets in spreadsheet
gog sheets list <spreadsheetId>

# Export spreadsheet
gog sheets export <spreadsheetId> --format xlsx --output ./sheet.xlsx
gog sheets export <spreadsheetId> --format csv --output ./sheet.csv
gog sheets export <spreadsheetId> --format pdf --output ./sheet.pdf
```

## Output Format

Use `--json` for machine-readable output (default is human-readable tables):
```bash
gog --json gmail search 'is:unread'
gog --json drive ls
```

Use `--plain` for tab-separated values suitable for piping.

## Common Workflows

### Find and read a document
```bash
# Search for it
gog drive search "project proposal"
# Read the content
gog docs get <documentId>
```

### Email with attachment from Drive
```bash
# Find file in Drive
gog drive search "report.pdf"
# Download it
gog drive download <fileId> --output /tmp/report.pdf
# Send email (attach manually or reference Drive link)
gog gmail send --to "boss@company.com" --subject "Report" --body "See attached"
```

### Export spreadsheet data
```bash
# Get the data as JSON for processing
gog --json sheets get <spreadsheetId> 'Data!A:Z'
```

## Error Handling

Commands return JSON on stderr with exit code 1 on failure:
```json
{ "error": "description of what went wrong" }
```

Common errors:
- **Not authenticated**: Run `gog auth add <email>`
- **Permission denied**: User lacks access to the resource
- **Not found**: Invalid file/document ID
- **Rate limited**: Too many requests, wait and retry
