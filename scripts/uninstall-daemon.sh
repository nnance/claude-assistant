#!/bin/bash
set -e

PLIST_NAME="com.user.claude-assistant.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "Uninstalling Claude Assistant daemon..."

# Unload the service if running
if launchctl list | grep -q "com.user.claude-assistant"; then
    echo "Stopping daemon..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# Remove the plist file
if [ -f "$PLIST_PATH" ]; then
    echo "Removing launchd plist..."
    rm "$PLIST_PATH"
fi

echo ""
echo "Claude Assistant daemon uninstalled!"
echo ""
echo "Note: Log files are still available at:"
echo "  /tmp/claude-assistant.log"
echo "  /tmp/claude-assistant.error.log"
echo ""
