#!/bin/bash
# status.sh — Show launchctl status and recent logs for all claude-assistant instances.
#
# Usage: bash scripts/team/status.sh [--lines N]
#   --lines N    Number of recent log lines to show per instance (default: 10)

set -euo pipefail

TAIL_LINES=10

while [[ $# -gt 0 ]]; do
    case "$1" in
        --lines) TAIL_LINES="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

PLIST_DIR="/Library/LaunchDaemons"

# Discover instances
INSTANCES=()
while IFS= read -r plist; do
    username=$(basename "$plist" | sed 's/com\.claude-assistant\.\(.*\)\.plist/\1/')
    INSTANCES+=("$username")
done < <(find "$PLIST_DIR" -name "com.claude-assistant.*.plist" 2>/dev/null | sort)

if [[ ${#INSTANCES[@]} -eq 0 ]]; then
    echo "No claude-assistant instances found in $PLIST_DIR."
    exit 0
fi

for USERNAME in "${INSTANCES[@]}"; do
    SERVICE_LABEL="com.claude-assistant.$USERNAME"
    LOG_FILE="/tmp/claude-assistant.$USERNAME.log"
    ERR_FILE="/tmp/claude-assistant.$USERNAME.error.log"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " Instance: $USERNAME"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # launchctl status
    STATUS_LINE=$(launchctl list 2>/dev/null | grep "$SERVICE_LABEL" || true)
    if [[ -n "$STATUS_LINE" ]]; then
        PID=$(echo "$STATUS_LINE" | awk '{print $1}')
        STATUS=$(echo "$STATUS_LINE" | awk '{print $2}')
        if [[ "$PID" != "-" ]]; then
            echo " Status: RUNNING (PID $PID)"
        else
            echo " Status: STOPPED (last exit: $STATUS)"
        fi
    else
        echo " Status: NOT LOADED"
    fi

    # Recent stdout log
    echo ""
    echo " Recent output ($LOG_FILE):"
    if [[ -f "$LOG_FILE" ]]; then
        tail -n "$TAIL_LINES" "$LOG_FILE" | sed 's/^/   /'
    else
        echo "   (no log file)"
    fi

    # Recent stderr log (only if non-empty)
    if [[ -f "$ERR_FILE" && -s "$ERR_FILE" ]]; then
        echo ""
        echo " Recent errors ($ERR_FILE):"
        tail -n "$TAIL_LINES" "$ERR_FILE" | sed 's/^/   /'
    fi

    echo ""
done
