#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.user.claude-assistant.plist"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "Installing Claude Assistant daemon..."

# Check for required .env file
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "Error: .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Build the project
echo "Building project..."
cd "$PROJECT_DIR"
npm run build

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Unload existing service if running
if launchctl list | grep -q "com.user.claude-assistant"; then
    echo "Unloading existing daemon..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# Create plist with correct working directory
echo "Creating launchd plist..."
sed "s|__WORKING_DIR__|$PROJECT_DIR|g" "$PLIST_SRC" > "$PLIST_DEST"

# Load the service
echo "Loading daemon..."
launchctl load "$PLIST_DEST"

echo ""
echo "Claude Assistant daemon installed and started!"
echo ""
echo "Useful commands:"
echo "  View logs:    tail -f /tmp/claude-assistant.log"
echo "  View errors:  tail -f /tmp/claude-assistant.error.log"
echo "  Stop daemon:  launchctl unload $PLIST_DEST"
echo "  Start daemon: launchctl load $PLIST_DEST"
echo ""
