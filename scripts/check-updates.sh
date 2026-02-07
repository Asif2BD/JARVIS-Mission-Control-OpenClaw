#!/bin/bash
# check-updates.sh - Check for Mission Control updates via MissionDeck API
#
# Usage: ./scripts/check-updates.sh
#
# Requires: MISSIONDECK_API_KEY environment variable or config.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MC_ROOT="$(dirname "$SCRIPT_DIR")"

# Get API key from env or config
API_KEY="${MISSIONDECK_API_KEY:-}"
if [ -z "$API_KEY" ] && [ -f "$MC_ROOT/.mission-control/config.json" ]; then
  API_KEY=$(grep -o '"apiKey"[[:space:]]*:[[:space:]]*"[^"]*"' "$MC_ROOT/.mission-control/config.json" 2>/dev/null | head -1 | cut -d'"' -f4)
fi

if [ -z "$API_KEY" ]; then
  echo "ℹ️  No MissionDeck API key configured"
  echo "   Set MISSIONDECK_API_KEY or add to .mission-control/config.json"
  exit 0
fi

# Get current version
CURRENT_VERSION="0.0.0"
if [ -f "$MC_ROOT/VERSION" ]; then
  CURRENT_VERSION=$(cat "$MC_ROOT/VERSION")
elif [ -f "$MC_ROOT/CHANGELOG.md" ]; then
  CURRENT_VERSION=$(grep -o '\*\*[0-9]*\.[0-9]*\.[0-9]*\*\*' "$MC_ROOT/CHANGELOG.md" | head -1 | tr -d '*')
fi

# Check latest version
API_URL="https://sqykgceibcmnmgfuioso.supabase.co/functions/v1/distribution/version"

echo "🔍 Checking for updates..."
echo "   Current version: $CURRENT_VERSION"

RESPONSE=$(curl -s -H "x-api-key: $API_KEY" "$API_URL" 2>/dev/null || echo '{"error":"failed"}')

if echo "$RESPONSE" | grep -q '"error"'; then
  echo "❌ Failed to check for updates"
  echo "   Response: $RESPONSE"
  exit 1
fi

LATEST=$(echo "$RESPONSE" | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

if [ -z "$LATEST" ]; then
  echo "❌ Could not parse version from response"
  exit 1
fi

echo "   Latest version:  $LATEST"

if [ "$LATEST" != "$CURRENT_VERSION" ]; then
  echo ""
  echo "🚀 New version available: $LATEST"
  echo ""
  echo "To update, run:"
  echo "  ./scripts/update-mission-control.sh"
  echo ""
  echo "Or download manually:"
  echo "  curl -H \"x-api-key: \$MISSIONDECK_API_KEY\" \\"
  echo "    $API_URL/../download/latest -o mission-control.zip"
else
  echo ""
  echo "✅ Mission Control is up to date!"
fi
