---
name: restarting-daemon
description: Restarts the assistant daemon by rebuilding the TypeScript source and triggering a graceful process restart. Use when the user asks the assistant to restart itself, redeploy, reload, or apply code changes. Triggers on "restart yourself", "restart the daemon", "rebuild and restart", "redeploy", or "apply changes".
---

# Restarting the Daemon

Rebuild and restart the assistant daemon in place. launchd will restart the process automatically after the graceful shutdown.

**CLI:** `bash scripts/restart-daemon.sh`

## Steps

1. **Acknowledge first** — Send a Slack message before restarting, since the agent won't be able to respond after the process exits:
   ```
   Rebuilding and restarting — back in a moment.
   ```

2. **Run the restart script:**
   ```bash
   bash scripts/restart-daemon.sh
   ```

## Notes

- The script runs `npm run build` then sends SIGTERM to the daemon via launchctl
- This process will be terminated as part of the restart — nothing after the script runs
- The user should wait ~15 seconds for the daemon to come back up
- Only works when running as the installed launchd daemon (not in `npm run dev` mode)
