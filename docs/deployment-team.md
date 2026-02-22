# Team Deployment — Multi-Instance on Mac Studio

This guide covers running 3–5 isolated `claude-assistant` instances on a single Mac Studio, each connected to a separate Slack bot, each siloed at the OS level under its own macOS user account.

> For a single instance, see [Single-Instance Deployment](deployment-single.md) — it's the same approach with N=1.

---

## Architecture

```
Admin user (you)
  └── /Library/LaunchDaemons/
        com.claude-assistant.assistant1.plist  (UserName: assistant1)
        com.claude-assistant.assistant2.plist  (UserName: assistant2)
        com.claude-assistant.assistant3.plist  (UserName: assistant3)

assistant1  (/Users/assistant1/claude-assistant/)
  ├── dist/          ← compiled TypeScript
  ├── .env           ← unique Slack tokens, ANTHROPIC_API_KEY
  └── data/          ← sessions.db, scheduler.db  (fully isolated)

assistant2  (/Users/assistant2/claude-assistant/)
  ├── dist/
  ├── .env           ← different Slack bot tokens
  └── data/
```

**Why system LaunchDaemon?**
- Starts at boot — no GUI login required
- `UserName` key drops each daemon to its own non-admin account
- `KeepAlive` restarts on crash; SIGTERM triggers a clean rebuild cycle
- Each instance has a fully isolated home directory, database, and credentials

---

## Prerequisites

- macOS 13+ (Ventura or later)
- Node.js >= 20 installed system-wide (`brew install node`)
- Admin account on the Mac Studio
- One Slack app (bot) per instance — see [Create a Slack App](#create-a-slack-app)
- One Anthropic API key per instance (or a shared key — your choice)

---

## Create a Slack App

Repeat for each bot. Each app needs its own workspace install or can target the same workspace as a different bot user.

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**
2. Enable **Socket Mode** → generate App-Level Token with `connections:write`
3. Bot Token Scopes: `app_mentions:read`, `chat:write`, `im:history`, `im:read`, `im:write`, `reactions:write`
4. Event Subscriptions: `app_mention`, `message.im`
5. Install to workspace → copy **Bot Token** and **App Token**

---

## One-Time System Setup

### 1. Install Node.js (system-wide)

```bash
brew install node
# Verify
node --version   # >= 20
```

---

## Creating Instances

Run `setup-instance.sh` once per bot. The script:
1. Creates a macOS service account
2. Clones the repo into that account's home
3. Installs dependencies and builds
4. Scaffolds `.env` from `.env.example`
5. Installs the `LaunchDaemon` plist

```bash
# Create instance 1
sudo bash scripts/team/setup-instance.sh assistant1

# Create instance 2
sudo bash scripts/team/setup-instance.sh assistant2

# Create instance 3
sudo bash scripts/team/setup-instance.sh assistant3
```

Each script pauses after step 4 and prints the path to edit. Fill in each instance's unique tokens:

```bash
sudo -u assistant1 nano /Users/assistant1/claude-assistant/.env
sudo -u assistant2 nano /Users/assistant2/claude-assistant/.env
sudo -u assistant3 nano /Users/assistant3/claude-assistant/.env
```

Minimum required in each `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
SLACK_BOT_TOKEN=xoxb-...       # unique per instance
SLACK_APP_TOKEN=xapp-...       # unique per instance
SLACK_SIGNING_SECRET=...       # unique per instance
```

### Start All Instances

```bash
for N in 1 2 3; do
  sudo launchctl bootstrap system \
    /Library/LaunchDaemons/com.claude-assistant.assistant${N}.plist
done
```

---

## Managing All Instances

### Status

```bash
bash scripts/team/status.sh
# Optional: show more log lines
bash scripts/team/status.sh --lines 20
```

Sample output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Instance: assistant1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Status: RUNNING (PID 1234)

 Recent output (/tmp/claude-assistant.assistant1.log):
   Claude Assistant is running
   Connected to Slack
```

### Update All (pull + rebuild + restart)

```bash
sudo bash scripts/team/update-all.sh
```

This discovers every installed instance, pulls the latest code, rebuilds, and sends SIGTERM so `launchd` restarts each daemon.

### Restart a Single Instance

```bash
sudo launchctl kill SIGTERM system/com.claude-assistant.assistant1
# launchd restarts it automatically within ~5s
```

### Stop / Remove an Instance

```bash
# Stop
sudo launchctl bootout system/com.claude-assistant.assistant1

# Remove plist (uninstall)
sudo rm /Library/LaunchDaemons/com.claude-assistant.assistant1.plist
```

---

## Upgrading

```bash
sudo bash scripts/team/update-all.sh
```

To upgrade a single instance manually:

```bash
USERNAME=assistant1
WORK_DIR="/Users/$USERNAME/claude-assistant"
sudo -u "$USERNAME" git -C "$WORK_DIR" pull
sudo -u "$USERNAME" bash -c "cd $WORK_DIR && npm install && npm run build"
sudo launchctl kill SIGTERM "system/com.claude-assistant.$USERNAME"
```

---

## Verification Checklist

```bash
# 1. All instances show PIDs
sudo launchctl list | grep com.claude-assistant

# 2. Each log shows startup message
tail /tmp/claude-assistant.assistant1.log
tail /tmp/claude-assistant.assistant2.log

# 3. Data directories are separate
ls /Users/assistant1/claude-assistant/data/
ls /Users/assistant2/claude-assistant/data/

# 4. Reboot test — SSH in without logging in to the GUI
sudo reboot
# After restart:
sudo launchctl list | grep com.claude-assistant

# 5. Send a Slack DM to each bot — confirm independent responses

# 6. Restart recovers within ~15s
sudo launchctl kill SIGTERM system/com.claude-assistant.assistant1
sleep 15
sudo launchctl list | grep assistant1   # should show new PID
```
