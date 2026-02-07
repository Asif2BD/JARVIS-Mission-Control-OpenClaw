#!/bin/bash
# update-mission-control.sh - Download and apply Mission Control updates
#
# Usage: ./scripts/update-mission-control.sh [--force]
#
# Options:
#   --force    Skip confirmation prompt
#
# Requires: MISSIONDECK_API_KEY environment variable or config.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MC_ROOT="$(dirname "$SCRIPT_DIR")"

FORCE=false
if [ "$1" = "--force" ]; then
  FORCE=true
fi

# Get API key
API_KEY="${MISSIONDECK_API_KEY:-}"
if [ -z "$API_KEY" ] && [ -f "$MC_ROOT/.mission-control/config.json" ]; then
  API_KEY=$(grep -o '"apiKey"[[:space:]]*:[[:space:]]*"[^"]*"' "$MC_ROOT/.mission-control/config.json" 2>/dev/null | head -1 | cut -d'"' -f4)
fi

if [ -z "$API_KEY" ]; then
  echo "❌ No MissionDeck API key configured"
  echo "   Set MISSIONDECK_API_KEY or add to .mission-control/config.json"
  exit 1
fi

API_BASE="https://sqykgceibcmnmgfuioso.supabase.co/functions/v1/distribution"

# Get latest version info
echo "🔍 Checking latest version..."
VERSION_INFO=$(curl -s -H "x-api-key: $API_KEY" "$API_BASE/version")
LATEST=$(echo "$VERSION_INFO" | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

if [ -z "$LATEST" ]; then
  echo "❌ Could not get version info"
  exit 1
fi

echo "   Latest version: $LATEST"

# Confirm update
if [ "$FORCE" != "true" ]; then
  echo ""
  read -p "📦 Download and apply update? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

# Create backup
BACKUP_DIR="$MC_ROOT/../mission-control-backup-$(date +%Y%m%d-%H%M%S)"
echo ""
echo "💾 Creating backup at: $BACKUP_DIR"
cp -r "$MC_ROOT" "$BACKUP_DIR"

# Download update
TEMP_ZIP="/tmp/mission-control-$LATEST.zip"
echo "⬇️  Downloading Mission Control $LATEST..."
curl -s -H "x-api-key: $API_KEY" "$API_BASE/download/latest" -o "$TEMP_ZIP"

if [ ! -f "$TEMP_ZIP" ] || [ ! -s "$TEMP_ZIP" ]; then
  echo "❌ Download failed"
  exit 1
fi

# Extract (preserve local data)
echo "📂 Extracting update..."
cd "$MC_ROOT"

# Extract everything except local data
unzip -o "$TEMP_ZIP" -x ".mission-control/agents/*" ".mission-control/tasks/*" ".mission-control/humans/*" ".mission-control/messages/*" ".mission-control/config.json" ".mission-control/logs/*" 2>/dev/null || true

# Update VERSION file
echo "$LATEST" > VERSION

# Cleanup
rm -f "$TEMP_ZIP"

echo ""
echo "✅ Updated to Mission Control $LATEST!"
echo ""
echo "📋 What's new: Check CHANGELOG.md"
echo "🔙 Backup at: $BACKUP_DIR"
echo ""
echo "Note: Your local data (.mission-control/agents, tasks, etc.) was preserved."
