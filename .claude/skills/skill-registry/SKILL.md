---
name: skill-registry
description: Browses, installs, and updates optional skills from the claude-assistant-skills GitHub registry. Use when the user asks to find, install, or update skills. Triggers on "install skill", "find skill", "search skills", "update skill", "list available skills", or "what skills are available".
---

# Skill Registry

Browse and install optional skills from the [claude-assistant-skills](https://github.com/nnance/claude-assistant-skills) registry using the `gh` CLI.

**Prerequisite:** `gh` CLI must be installed and authenticated (`gh auth login`).

## List Available Skills

```bash
gh api repos/nnance/claude-assistant-skills/contents/skills \
  --jq '.[].name'
```

## Read a Skill's Description

```bash
gh api repos/nnance/claude-assistant-skills/contents/skills/<name>/SKILL.md \
  --jq '.content' | base64 --decode
```

## Install a Skill

To install a skill, fetch all its files from the registry and write them to `.claude/skills/<name>/`:

### Step 1: List the skill's files

```bash
gh api "repos/nnance/claude-assistant-skills/git/trees/main?recursive=1" \
  --jq '.tree[] | select(.path | startswith("skills/<name>/")) | {path: .path, url: .url}'
```

### Step 2: For each file, fetch content and write to disk

```bash
# Get file content (base64-encoded)
gh api repos/nnance/claude-assistant-skills/contents/<file-path> \
  --jq '.content' | base64 --decode > .claude/skills/<local-path>
```

### Step 3: Make shell scripts executable (if any)

```bash
chmod +x .claude/skills/<name>/scripts/*.sh
```

### Example: Install apple-services

```bash
# List files
gh api "repos/nnance/claude-assistant-skills/git/trees/main?recursive=1" \
  --jq '.tree[] | select(.path | startswith("skills/apple-services/")) | .path'

# Install SKILL.md
mkdir -p .claude/skills/apple-services
gh api repos/nnance/claude-assistant-skills/contents/skills/apple-services/SKILL.md \
  --jq '.content' | base64 --decode > .claude/skills/apple-services/SKILL.md

# Install scripts
mkdir -p .claude/skills/apple-services/scripts
for script in _common.sh calendar.sh contacts.sh notes.sh; do
  gh api "repos/nnance/claude-assistant-skills/contents/skills/apple-services/scripts/$script" \
    --jq '.content' | base64 --decode > ".claude/skills/apple-services/scripts/$script"
done
chmod +x .claude/skills/apple-services/scripts/*.sh
```

## Update an Installed Skill

Re-run the install steps above to overwrite existing files with the latest version from the registry.

## Check Installed Skills

```bash
ls .claude/skills/
```

## Available Skills Summary

See the [registry README](https://github.com/nnance/claude-assistant-skills) for the full list of available skills with descriptions and setup instructions.

Current registry skills:
- **apple-services** - macOS Calendar, Contacts, and Notes
- **google-workspace** - Gmail, Drive, Docs, and Sheets via gogcli
- **vault** - Obsidian vault note management
