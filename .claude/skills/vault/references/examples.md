# Vault Skill Examples

## Example 1: High-Confidence Task Capture

**User input**: `/vault save a task to follow up with Sarah about the security audit`

**Analysis**: Clear action verb ("follow up"), named person ("Sarah"), named project ("security audit"). High confidence.

**Note created** at `$VAULT_PATH/Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md`:

```markdown
---
created: 2026-02-15T14:30:00
tags:
  - person/sarah
  - project/security-audit
  - priority/normal
  - status/active
confidence: 92
---

# Follow up with Sarah about the security audit

Follow up with Sarah regarding the security audit. Confirm status and next steps.
```

**Log entry** appended to `$VAULT_PATH/_system/logs/2026-02-15.md`:

```markdown
## 14:30:00

- **Input**: "save a task to follow up with Sarah about the security audit"
- **Category**: Tasks
- **Confidence**: 92
- **Reasoning**: Clear action verb "follow up", named person, named project
- **Tags**: person/sarah, project/security-audit, priority/normal, status/active
- **Stored**: Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md
```

**Response to user**: Created task note at `Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md` with tags: person/sarah, project/security-audit, priority/normal, status/active.

## Example 2: Low-Confidence Input Requiring Clarification

**User input**: `/vault remember the thing about the meeting`

**Analysis**: Vague reference ("the thing"), no specific meeting identified. Low confidence.

**Log entry** appended to `$VAULT_PATH/_system/logs/2026-02-15.md`:

```markdown
## 14:32:00

- **Input**: "remember the thing about the meeting"
- **Action**: Clarification requested
- **Reasoning**: Ambiguous input - unclear what "the thing" refers to, no specific meeting identified
```

**Response to user**: I'd like to capture this, but I need a bit more detail. Which meeting are you referring to, and what specifically should I note down? For example: "Remember to send the agenda before the Friday standup."

## Example 3: Reference Link Storage

**User input**: `/vault save this link about Kubernetes networking: https://example.com/k8s-networking-deep-dive`

**Analysis**: Explicit "save this link", topic identified ("Kubernetes networking"). High confidence for Reference folder.

**Note created** at `$VAULT_PATH/Reference/2026-02-15_kubernetes-networking-deep-dive.md`:

```markdown
---
created: 2026-02-15T15:10:00
tags:
  - topic/kubernetes
  - topic/networking
  - priority/normal
confidence: 90
---

# Kubernetes Networking Deep Dive

Source: https://example.com/k8s-networking-deep-dive

A reference on Kubernetes networking concepts and architecture.
```

**Response to user**: Saved reference note at `Reference/2026-02-15_kubernetes-networking-deep-dive.md` with tags: topic/kubernetes, topic/networking.

## Example 4: Listing and Filtering Notes

**User input**: `/vault list my recent tasks`

**Action**: Use Glob to find all `.md` files in the Tasks folder, sorted by filename (newest first), limited to 20.

```
Glob → $VAULT_PATH/Tasks/*.md
```

**Response to user**:

Recent tasks (3 notes):
1. `Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md` - Follow up with Sarah about the security audit
2. `Tasks/2026-02-14_review-pr-for-auth-module.md` - Review PR for auth module
3. `Tasks/2026-02-13_update-deployment-scripts.md` - Update deployment scripts

**User input**: `/vault list tasks tagged person/sarah`

**Action**: Glob for Tasks, then Read each file's frontmatter to check for `person/sarah` tag.

**Response to user**:

Tasks tagged `person/sarah` (1 note):
1. `Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md` - Follow up with Sarah about the security audit

## Example 5: Reading a Note

**User input**: `/vault read Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md`

**Action**: Read the file at `$VAULT_PATH/Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md`.

**Response to user**: Displays the full note content including frontmatter and body.

## Example 6: Searching Notes

**User input**: `/vault find notes about kubernetes`

**Action**: Use Grep to search for "kubernetes" across all vault notes.

```
Grep → pattern: "kubernetes" in $VAULT_PATH/**/*.md
```

**Response to user**: Lists matching files with the lines containing the search term.

## Example 7: Marking a Task Complete

**User input**: `I finished the follow up with Sarah`

**Analysis**: User is indicating task completion, not creating a new note. Find and update the existing task.

**Action sequence**:
1. Search for the task:
   ```
   Grep → "sarah" in $VAULT_PATH/Tasks/
   ```
2. Read the matching file to confirm it's the right task
3. Update the frontmatter status using Edit:
   ```
   Edit → change "status/active" to "status/done"
   ```
4. Log the completion

**IMPORTANT**: Do NOT create a new note like "met-with-sarah.md" or "sarah-task-completed.md". Always update the original task file in place.

**Log entry** appended to `$VAULT_PATH/_system/logs/2026-02-15.md`:

```markdown
## 16:00:00

- **Input**: "I finished the follow up with Sarah"
- **Action**: Task marked complete
- **Updated**: Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md
- **Change**: status/active → status/done
```

**Response to user**: Marked task complete: `Tasks/2026-02-15_follow-up-with-sarah-about-the-security-audit.md` (status changed to done).
