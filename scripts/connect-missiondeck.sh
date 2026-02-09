#!/bin/bash
#
# connect-missiondeck.sh - Connect Mission Control to MissionDeck
#
# Usage: ./scripts/connect-missiondeck.sh [--api-key KEY]
#
# This script connects your Mission Control installation to MissionDeck.ai
# for updates, agent templates, and future marketplace access.
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           🚀 MissionDeck Connection Setup 🚀               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check for config directory
if [ ! -d ".mission-control" ]; then
  echo -e "${RED}Error: .mission-control directory not found.${NC}"
  echo "Please run this script from the Mission Control root directory."
  exit 1
fi

# Get API key from argument or environment or prompt
API_KEY=""

if [ "$1" == "--api-key" ] && [ -n "$2" ]; then
  API_KEY="$2"
elif [ -n "$MISSIONDECK_API_KEY" ]; then
  API_KEY="$MISSIONDECK_API_KEY"
else
  echo -e "${BLUE}MissionDeck Connection${NC}"
  echo ""
  echo "Connecting to MissionDeck enables:"
  echo "  • Automatic update notifications"
  echo "  • Access to agent templates (free + premium)"
  echo "  • Future marketplace access"
  echo ""
  echo -e "${YELLOW}Get your FREE API key at: https://missiondeck.ai/auth${NC}"
  echo ""
  read -p "Enter your MissionDeck API key: " API_KEY
fi

# Validate key format
if [[ ! "$API_KEY" =~ ^(mdk_live_|jmc_live_) ]]; then
  echo -e "${RED}Error: Invalid API key format.${NC}"
  echo "API keys should start with 'mdk_live_' or 'jmc_live_'"
  echo "Get your key at: https://missiondeck.ai/auth"
  exit 1
fi

# Validate key with API
echo ""
echo -e "${BLUE}Validating API key...${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -H "x-api-key: $API_KEY" \
  "https://missiondeck.ai/api/distribution/version" 2>/dev/null || echo -e "\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✓ API key validated successfully!${NC}"
  VERSION=$(echo "$BODY" | grep -o '"version":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
  echo -e "  Latest version available: ${CYAN}$VERSION${NC}"
elif [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
  echo -e "${RED}✗ Invalid or inactive API key.${NC}"
  echo "Please check your key at: https://missiondeck.ai/dashboard"
  exit 1
elif [ "$HTTP_CODE" == "000" ]; then
  echo -e "${YELLOW}⚠ Could not connect to MissionDeck API.${NC}"
  echo "This may be a network issue. Saving key anyway for offline use."
else
  echo -e "${YELLOW}⚠ Unexpected response (HTTP $HTTP_CODE).${NC}"
  echo "Saving key anyway. You can verify later."
fi

# Save to config
echo ""
echo -e "${BLUE}Saving configuration...${NC}"

# Check if missiondeck section exists in config.yaml
if grep -q "^missiondeck:" .mission-control/config.yaml 2>/dev/null; then
  # Update existing section
  # Using a temporary file approach for compatibility
  if command -v yq &> /dev/null; then
    yq -i ".missiondeck.api_key = \"$API_KEY\" | .missiondeck.connected_at = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" .mission-control/config.yaml
  else
    # Fallback: append to existing section or create new
    echo -e "${YELLOW}Note: yq not found, using simple append method.${NC}"
    # Remove existing missiondeck section if any
    sed -i '/^missiondeck:/,/^[a-z]/{ /^missiondeck:/d; /^  /d; }' .mission-control/config.yaml 2>/dev/null || true
    # Append new section
    cat >> .mission-control/config.yaml << EOF

# MissionDeck Integration
missiondeck:
  api_key: "$API_KEY"
  connected_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  auto_update_check: true
  update_channel: "stable"
EOF
  fi
else
  # Add new section
  cat >> .mission-control/config.yaml << EOF

# MissionDeck Integration
missiondeck:
  api_key: "$API_KEY"
  connected_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  auto_update_check: true
  update_channel: "stable"
EOF
fi

echo -e "${GREEN}✓ Configuration saved to .mission-control/config.yaml${NC}"

# Also export for current session
export MISSIONDECK_API_KEY="$API_KEY"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ MissionDeck Connected Successfully!           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "What's next:"
echo "  • Check for updates:    ./scripts/check-updates.sh"
echo "  • Start the dashboard:  node server/server.js"
echo "  • Read the guide:       cat CLAUDE.md"
echo ""
echo -e "Dashboard: ${CYAN}https://missiondeck.ai/dashboard${NC}"
echo ""
