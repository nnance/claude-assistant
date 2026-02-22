#!/bin/bash
# update-all.sh — Pull latest code and restart all claude-assistant instances.
# Must be run as root (sudo).
#
# Usage: sudo bash scripts/team/update-all.sh

set -euo pipefail

log()  { echo "[update-all] $*"; }
die()  { echo "[error] $*" >&2; exit 1; }

[[ "$EUID" -eq 0 ]] || die "This script must be run as root (sudo)."

# Discover all installed instances by scanning LaunchDaemon plists
PLIST_DIR="/Library/LaunchDaemons"
INSTANCES=()

while IFS= read -r plist; do
    username=$(basename "$plist" | sed 's/com\.claude-assistant\.\(.*\)\.plist/\1/')
    INSTANCES+=("$username")
done < <(find "$PLIST_DIR" -name "com.claude-assistant.*.plist" 2>/dev/null | sort)

if [[ ${#INSTANCES[@]} -eq 0 ]]; then
    die "No claude-assistant instances found in $PLIST_DIR."
fi

log "Found ${#INSTANCES[@]} instance(s): ${INSTANCES[*]}"
echo ""

FAILED=()

for USERNAME in "${INSTANCES[@]}"; do
    WORK_DIR="/Users/$USERNAME/claude-assistant"
    SERVICE="system/com.claude-assistant.$USERNAME"

    echo "── $USERNAME ──────────────────────────────────────────────"

    if [[ ! -d "$WORK_DIR" ]]; then
        log "  SKIP: working directory not found: $WORK_DIR"
        FAILED+=("$USERNAME")
        continue
    fi

    # Pull latest code as the instance user
    log "  Pulling latest code..."
    if ! sudo -u "$USERNAME" git -C "$WORK_DIR" pull --ff-only; then
        log "  WARN: git pull failed — skipping $USERNAME"
        FAILED+=("$USERNAME")
        continue
    fi

    # Rebuild
    log "  Rebuilding..."
    if ! sudo -u "$USERNAME" bash -c "cd '$WORK_DIR' && npm install && npm run build"; then
        log "  WARN: build failed — skipping restart for $USERNAME"
        FAILED+=("$USERNAME")
        continue
    fi

    # Restart via SIGTERM (KeepAlive will relaunch)
    log "  Restarting daemon..."
    if launchctl list | grep -q "com.claude-assistant.$USERNAME"; then
        launchctl kill SIGTERM "$SERVICE" || true
        log "  Sent SIGTERM — launchd will restart automatically."
    else
        log "  Daemon not running — no restart needed."
    fi

    echo ""
done

# Summary
if [[ ${#FAILED[@]} -gt 0 ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " UPDATE COMPLETE with failures: ${FAILED[*]}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " All ${#INSTANCES[@]} instance(s) updated successfully."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi
