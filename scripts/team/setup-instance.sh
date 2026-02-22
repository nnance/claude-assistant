#!/bin/bash
# setup-instance.sh — Create and install a new claude-assistant instance.
# Must be run as root (sudo).
#
# Usage:
#   sudo bash scripts/team/setup-instance.sh <username> [--repo <git-url>] [--start]
#
# Options:
#   <username>      macOS user account to create (e.g. assistant1)
#   --repo <url>    Git repo URL (default: current repo's remote origin)
#   --start         Bootstrap the daemon immediately after .env is configured
#
# Example:
#   sudo bash scripts/team/setup-instance.sh assistant1 --start

set -euo pipefail

# ── Helpers ──────────────────────────────────────────────────────────────────

log()  { echo "[setup] $*"; }
die()  { echo "[error] $*" >&2; exit 1; }

require_root() {
    [[ "$EUID" -eq 0 ]] || die "This script must be run as root (sudo)."
}

# ── Argument parsing ──────────────────────────────────────────────────────────

USERNAME=""
REPO_URL=""
AUTO_START=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo) REPO_URL="$2"; shift 2 ;;
        --start) AUTO_START=true; shift ;;
        -*) die "Unknown option: $1" ;;
        *) USERNAME="$1"; shift ;;
    esac
done

[[ -n "$USERNAME" ]] || die "Usage: sudo bash scripts/team/setup-instance.sh <username> [--repo <url>] [--start]"

# Derive repo URL from current remote if not provided
if [[ -z "$REPO_URL" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_URL="$(git -C "$(dirname "$(dirname "$SCRIPT_DIR")")" remote get-url origin 2>/dev/null)" \
        || die "Could not determine repo URL. Pass --repo <url> explicitly."
fi

HOME_DIR="/Users/$USERNAME"
WORK_DIR="$HOME_DIR/claude-assistant"
PLIST_TEMPLATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/com.claude-assistant.plist.template"
PLIST_DEST="/Library/LaunchDaemons/com.claude-assistant.$USERNAME.plist"

# ── Preflight ─────────────────────────────────────────────────────────────────

require_root
[[ -f "$PLIST_TEMPLATE" ]] || die "Plist template not found: $PLIST_TEMPLATE"

# ── Step 1: Create macOS user account ────────────────────────────────────────

log "Step 1: Creating macOS user account '$USERNAME'..."

if dscl . -read "/Users/$USERNAME" &>/dev/null; then
    log "  User '$USERNAME' already exists — skipping creation."
else
    # Find next available UID (start above 500 for service accounts)
    LAST_UID=$(dscl . -list /Users UniqueID | awk '{print $2}' | sort -n | tail -1)
    NEW_UID=$((LAST_UID + 1))

    dscl . -create "/Users/$USERNAME"
    dscl . -create "/Users/$USERNAME" UserShell /usr/bin/false
    dscl . -create "/Users/$USERNAME" RealName "Claude Assistant ($USERNAME)"
    dscl . -create "/Users/$USERNAME" UniqueID "$NEW_UID"
    dscl . -create "/Users/$USERNAME" PrimaryGroupID 20
    dscl . -create "/Users/$USERNAME" NFSHomeDirectory "$HOME_DIR"
    createhomedir -c -u "$USERNAME" &>/dev/null
    log "  Created user '$USERNAME' (UID $NEW_UID)."
fi

# ── Step 2: Clone repository ──────────────────────────────────────────────────

log "Step 2: Cloning repository..."

if [[ -d "$WORK_DIR/.git" ]]; then
    log "  Repo already exists at $WORK_DIR — skipping clone."
else
    sudo -u "$USERNAME" git clone "$REPO_URL" "$WORK_DIR"
    log "  Cloned into $WORK_DIR."
fi

# ── Step 3: Install dependencies and build ────────────────────────────────────

log "Step 3: Installing dependencies and building..."
sudo -u "$USERNAME" bash -c "cd '$WORK_DIR' && npm install && npm run build"
log "  Build complete."

# ── Step 4: Create data directory and .env ────────────────────────────────────

log "Step 4: Setting up .env..."
sudo -u "$USERNAME" mkdir -p "$WORK_DIR/data"

if [[ -f "$WORK_DIR/.env" ]]; then
    log "  .env already exists — skipping."
else
    sudo cp "$WORK_DIR/.env.example" "$WORK_DIR/.env"
    chown "$USERNAME" "$WORK_DIR/.env"
    chmod 600 "$WORK_DIR/.env"
    log "  Created $WORK_DIR/.env from .env.example."
fi

# ── Step 5: Install plist ────────────────────────────────────────────────────

log "Step 5: Installing LaunchDaemon plist..."
sed \
    -e "s|__USERNAME__|$USERNAME|g" \
    -e "s|__WORKING_DIR__|$WORK_DIR|g" \
    "$PLIST_TEMPLATE" > "$PLIST_DEST"
chmod 644 "$PLIST_DEST"
log "  Plist written to $PLIST_DEST."

# ── Step 6: Bootstrap (optional) ─────────────────────────────────────────────

if $AUTO_START; then
    log "Step 6: Bootstrapping daemon..."
    launchctl bootstrap system "$PLIST_DEST"
    log "  Daemon started."
    echo ""
    echo "Instance '$USERNAME' is running."
    echo "  Logs:   tail -f /tmp/claude-assistant.$USERNAME.log"
    echo "  Errors: tail -f /tmp/claude-assistant.$USERNAME.error.log"
    echo "  Stop:   sudo launchctl bootout system/com.claude-assistant.$USERNAME"
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " NEXT STEP — configure .env before starting the daemon"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Edit: $WORK_DIR/.env"
    echo ""
    echo "  Required:"
    echo "    ANTHROPIC_API_KEY=sk-ant-..."
    echo "    SLACK_BOT_TOKEN=xoxb-..."
    echo "    SLACK_APP_TOKEN=xapp-..."
    echo "    SLACK_SIGNING_SECRET=..."
    echo ""
    echo "  Then start the daemon:"
    echo "    sudo launchctl bootstrap system $PLIST_DEST"
    echo ""
fi
