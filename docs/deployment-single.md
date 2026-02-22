# Single-Instance Deployment

This guide covers running one `claude-assistant` as a persistent macOS system daemon using `launchd`. The daemon starts at boot, runs as a dedicated non-admin user, and restarts automatically on failure.

> For running multiple instances on one machine, see [Team Deployment](deployment-team.md).

---

## Prerequisites

- macOS 13+ (Ventura or later)
- Node.js >= 20 installed system-wide (e.g. via [Homebrew](https://brew.sh): `brew install node`)
- A Slack workspace with admin access
- An [Anthropic API key](https://console.anthropic.com)

---

## 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**
2. Enable **Socket Mode** (Settings → Socket Mode → Enable)
3. Generate an App-Level Token with `connections:write` scope
4. Add Bot Token Scopes under OAuth & Permissions:
   - `app_mentions:read`, `chat:write`, `im:history`, `im:read`, `im:write`, `reactions:write`
5. Subscribe to events under Event Subscriptions: `app_mention`, `message.im`
6. Install to workspace and copy the **Bot Token** and **App Token**

---

## 2. Create a Dedicated macOS User

Running the daemon as a non-admin service account isolates its filesystem access.

```bash
# Run as your admin account
sudo dscl . -create /Users/assistant
sudo dscl . -create /Users/assistant UserShell /usr/bin/false
sudo dscl . -create /Users/assistant RealName "Claude Assistant"
sudo dscl . -create /Users/assistant UniqueID 600
sudo dscl . -create /Users/assistant PrimaryGroupID 20
sudo dscl . -create /Users/assistant NFSHomeDirectory /Users/assistant
sudo createhomedir -c -u assistant
```

> **Tip:** `setup-instance.sh` (see step 4) does this automatically.

---

## 3. Clone and Build

```bash
WORK_DIR="/Users/assistant/claude-assistant"
sudo -u assistant git clone https://github.com/nnance/claude-assistant "$WORK_DIR"
sudo -u assistant bash -c "cd $WORK_DIR && npm install && npm run build"
```

---

## 4. Configure `.env`

```bash
sudo cp "$WORK_DIR/.env.example" "$WORK_DIR/.env"
sudo chown assistant "$WORK_DIR/.env"
sudo chmod 600 "$WORK_DIR/.env"
sudo -u assistant nano "$WORK_DIR/.env"
```

Required variables:

```bash
ANTHROPIC_API_KEY=sk-ant-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
```

Optional — set data paths to keep everything under the service account's home:

```bash
SESSION_DATABASE_PATH=/Users/assistant/claude-assistant/data/sessions.db
SCHEDULER_DATABASE_PATH=/Users/assistant/claude-assistant/data/scheduler.db
```

---

## 5. Install System Daemon

The `setup-instance.sh` script handles user creation, clone, build, `.env` scaffolding, and plist installation in one step:

```bash
sudo bash scripts/team/setup-instance.sh assistant
```

After editing `.env`, bootstrap the daemon:

```bash
sudo launchctl bootstrap system /Library/LaunchDaemons/com.claude-assistant.assistant.plist
```

Or do it all at once (if `.env` is already configured):

```bash
sudo bash scripts/team/setup-instance.sh assistant --start
```

---

## 6. Daemon Management

```bash
# Check status
sudo launchctl list | grep com.claude-assistant

# View logs
tail -f /tmp/claude-assistant.assistant.log
tail -f /tmp/claude-assistant.assistant.error.log

# Restart (KeepAlive will relaunch within ~5s)
sudo launchctl kill SIGTERM system/com.claude-assistant.assistant

# Stop
sudo launchctl bootout system/com.claude-assistant.assistant

# Start again
sudo launchctl bootstrap system /Library/LaunchDaemons/com.claude-assistant.assistant.plist

# Full status summary
bash scripts/team/status.sh
```

**Why system LaunchDaemon?** Unlike a `LaunchAgent` (which only runs when a GUI user is logged in), a `LaunchDaemon` with `UserName` starts at boot on a headless Mac Studio or Mac mini, drops to the specified non-admin user automatically, and survives log-out/log-in cycles.

---

## 7. Upgrading

```bash
cd /Users/assistant/claude-assistant
sudo -u assistant git pull
sudo -u assistant npm install && sudo -u assistant npm run build
sudo launchctl kill SIGTERM system/com.claude-assistant.assistant
# launchd restarts the daemon automatically
```

---

## Verification

```bash
# Daemon shows a PID
sudo launchctl list | grep com.claude-assistant

# Log shows startup message
tail /tmp/claude-assistant.assistant.log

# Send a Slack DM to the bot and confirm a response
```
