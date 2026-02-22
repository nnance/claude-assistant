#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "Building..."
npm run build

echo "Sending SIGTERM to daemon..."
launchctl kill SIGTERM "gui/$(id -u)/com.user.claude-assistant"
