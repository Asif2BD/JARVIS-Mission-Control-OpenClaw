#!/usr/bin/env bash
# =============================================================
# MissionDeck Cloud Connect
# Connects your local JARVIS Mission Control to MissionDeck.ai
# so your dashboard is live at missiondeck.ai/mission-control/[slug]
# =============================================================

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

MISSIONDECK_URL="${MISSIONDECK_URL:-https://missiondeck.ai}"
# API base: Supabase direct URL (works now). Override once missiondeck.ai proxy is configured.
MISSIONDECK_API_URL="${MISSIONDECK_API_URL:-https://sqykgceibcmnmgfuioso.supabase.co/functions/v1}"
MC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="$MC_DIR/.mission-control/config.yaml"

echo ""
echo -e "${CYAN}${BOLD}☁️  MissionDeck Cloud Connect${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Cloud API status check ─────────────────────────────────────────
echo -e "${YELLOW}Checking cloud API availability...${NC}"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 8 \
  "$MISSIONDECK_API_URL/mc-api/verify" 2>/dev/null || echo "000")

CLOUD_AVAILABLE=false
if [ "$STATUS_CODE" = "200" ] || [ "$STATUS_CODE" = "401" ]; then
  CLOUD_AVAILABLE=true
  echo -e "  ${GREEN}✅ Cloud API is available${NC}"
elif [ "$STATUS_CODE" = "405" ] || [ "$STATUS_CODE" = "404" ] || [ "$STATUS_CODE" = "000" ]; then
  echo -e "  ${YELLOW}⚠️  Cloud sync API not yet deployed (HTTP $STATUS_CODE)${NC}"
  echo ""
  echo -e "  ${BOLD}What this means:${NC}"
  echo -e "  • Your local Mission Control works perfectly (http://localhost:3000)"
  echo -e "  • Cloud sync to missiondeck.ai is not yet available"
  echo -e "  • Your config will be saved — sync will activate when the API goes live"
  echo ""
  echo -e "  ${BOLD}What to do now:${NC}"
  echo -e "  • Re-run this script when cloud sync is announced at missiondeck.ai"
  echo -e "  • For remote access today, see: skills/deployment.md"
  echo -e "  • Your local board at http://localhost:3000 is fully functional"
  echo ""
  read -rp "  Save local config anyway and continue? [y/N]: " CONTINUE
  if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Exiting. Local setup is fully functional without this step.${NC}"
    exit 0
  fi
else
  echo -e "  ${YELLOW}⚠️  Unexpected HTTP $STATUS_CODE — proceeding anyway${NC}"
fi

echo ""
echo "Your cloud dashboard URL (once API is live):"
echo -e "  ${BOLD}missiondeck.ai/mission-control/your-slug${NC}"
echo ""

# ── Step 1: Get API key ────────────────────────────────────────────
echo -e "${YELLOW}Step 1${NC} — Enter your API key"
echo ""
echo "  Get a free key at: ${BOLD}${MISSIONDECK_URL}/settings/api-keys${NC}"
echo ""
if [ -t 0 ]; then
  read -rsp "  Paste API key (or press Enter to skip): " API_KEY
  echo ""
else
  API_KEY="${MISSIONDECK_API_KEY:-}"
fi

if [ -z "$API_KEY" ]; then
  echo -e "  ${YELLOW}ℹ️  No key provided — saving placeholder config${NC}"
  API_KEY="REPLACE_WITH_YOUR_KEY"
fi

# ── Step 2: Workspace slug ─────────────────────────────────────────
WORKSPACE_SLUG=""

if [ "$CLOUD_AVAILABLE" = true ] && [ "$API_KEY" != "REPLACE_WITH_YOUR_KEY" ]; then
  echo ""
  echo -e "${YELLOW}Step 2${NC} — Verifying key..."

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
    -H "Authorization: Bearer $API_KEY" \
    "$MISSIONDECK_API_URL/mc-api/verify" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    VERIFY_BODY=$(curl -s --max-time 8 \
      -H "Authorization: Bearer $API_KEY" \
      "$MISSIONDECK_API_URL/mc-api/verify" 2>/dev/null || echo "{}")
    WORKSPACE_SLUG=$(echo "$VERIFY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug',''))" 2>/dev/null || echo "")
    [ -n "$WORKSPACE_SLUG" ] && echo -e "  ${GREEN}✅ Verified — workspace: ${BOLD}$WORKSPACE_SLUG${NC}"
  fi
fi

if [ -z "$WORKSPACE_SLUG" ]; then
  echo ""
  echo -e "${YELLOW}Step 2${NC} — Workspace slug"
  read -rp "  Enter your username/slug (default: my-workspace): " WORKSPACE_SLUG
  WORKSPACE_SLUG="${WORKSPACE_SLUG:-my-workspace}"
fi

DASHBOARD_URL="$MISSIONDECK_URL/mission-control/$WORKSPACE_SLUG"

# ── Step 3: Save config ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 3${NC} — Saving configuration..."

mkdir -p "$MC_DIR/.mission-control"

if [ -f "$CONFIG_FILE" ]; then
  grep -v "^missiondeck_" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" 2>/dev/null || true
  mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
fi

printf '\n# MissionDeck Cloud (added by connect-missiondeck.sh)\nmissiondeck_enabled: true\nmissiondeck_slug: %s\nmissiondeck_url: %s\n' \
  "$WORKSPACE_SLUG" "$MISSIONDECK_URL" >> "$CONFIG_FILE"

printf 'MISSIONDECK_API_KEY=%s\nMISSIONDECK_URL=%s\nMISSIONDECK_SLUG=%s\nMISSIONDECK_API_URL=%s\n' \
  "$API_KEY" "$MISSIONDECK_URL" "$WORKSPACE_SLUG" "$MISSIONDECK_API_URL" > "$MC_DIR/.missiondeck"
chmod 600 "$MC_DIR/.missiondeck"

echo -e "  ${GREEN}✅ Config saved to .missiondeck${NC}"

# ── Step 4: Sync (only if cloud available) ────────────────────────
if [ "$CLOUD_AVAILABLE" = true ] && [ "$API_KEY" != "REPLACE_WITH_YOUR_KEY" ]; then
  echo ""
  echo -e "${YELLOW}Step 4${NC} — Syncing tasks to cloud..."

  TASKS_DIR="$MC_DIR/.mission-control/tasks"
  TASK_COUNT=0
  [ -d "$TASKS_DIR" ] && TASK_COUNT=$(ls "$TASKS_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ') || true

  if [ "$TASK_COUNT" -gt 0 ]; then
    PAYLOAD=$(python3 -c "
import json, os, glob
tasks = []
for f in glob.glob('$TASKS_DIR/*.json'):
    try:
        tasks.append(json.load(open(f)))
    except: pass
print(json.dumps({'tasks': tasks, 'agents': [], 'deleted_ids': [], 'client_version': '1.0.4'}))
")

    SYNC_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      -X POST \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      "$MISSIONDECK_API_URL/mc-sync" 2>/dev/null || echo "000")

    if [ "$SYNC_CODE" = "200" ]; then
      echo -e "  ${GREEN}✅ $TASK_COUNT tasks synced${NC}"
    else
      echo -e "  ${YELLOW}⚠️  Sync returned HTTP $SYNC_CODE — will retry on server start${NC}"
    fi
  else
    echo -e "  ${YELLOW}ℹ️  No tasks yet — will sync automatically when you create tasks${NC}"
  fi
else
  echo ""
  echo -e "  ${YELLOW}ℹ️  Skipping sync — cloud API not available${NC}"
  echo -e "  Tasks are safe locally. Sync activates when the API goes live."
fi

# ── Step 5: Restart server ─────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 5${NC} — Server restart..."

if pm2 list 2>/dev/null | grep -q "mission-control-server"; then
  pm2 restart mission-control-server --update-env 2>/dev/null && \
    echo -e "  ${GREEN}✅ Server restarted${NC}" || \
    echo -e "  ${YELLOW}⚠️  Restart manually: pm2 restart mission-control-server --update-env${NC}"
else
  echo -e "  ${YELLOW}ℹ️  Restart server to pick up new config:${NC}"
  echo -e "  source .missiondeck && node server/index.js"
fi

# ── Done ────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
if [ "$CLOUD_AVAILABLE" = true ]; then
  echo -e "${GREEN}${BOLD}✅ MissionDeck Cloud connected!${NC}"
  echo -e "  🌐 Dashboard: ${BOLD}$DASHBOARD_URL${NC}"
  echo -e "  🔄 Auto-sync: Active"
else
  echo -e "${YELLOW}${BOLD}Config saved — cloud sync coming soon${NC}"
  echo -e "  🖥️  Local dashboard: ${BOLD}http://localhost:3000${NC}  ← Works now"
  echo -e "  ☁️  Cloud dashboard: ${BOLD}$DASHBOARD_URL${NC}  ← Available when API goes live"
  echo -e ""
  echo -e "  Re-run this script when MissionDeck cloud sync is announced."
  echo -e "  For remote access now: see skills/deployment.md"
fi
echo ""
