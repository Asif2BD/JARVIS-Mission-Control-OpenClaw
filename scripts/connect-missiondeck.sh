#!/usr/bin/env bash
# =============================================================
# MissionDeck Cloud Connect
# Connects your local JARVIS Mission Control to MissionDeck.ai
# so your dashboard is live at missiondeck.ai/workspace/[slug]
# =============================================================

set -euo pipefail

# Colours
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

MISSIONDECK_URL="${MISSIONDECK_URL:-https://missiondeck.ai}"
MC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="$MC_DIR/.mission-control/config.yaml"

echo ""
echo -e "${CYAN}${BOLD}☁️  MissionDeck Cloud Connect${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "This will connect your local Mission Control to MissionDeck.ai"
echo "so your board is live at: ${BOLD}missiondeck.ai/workspace/your-slug${NC}"
echo ""

# ── Step 1: Get API key ────────────────────────────────────────────
echo -e "${YELLOW}Step 1${NC} — Get your API key"
echo ""
echo "  1. Go to ${BOLD}${MISSIONDECK_URL}/settings/api-keys${NC}"
echo "  2. Click 'Create Mission Control Key'"
echo "  3. Paste it below"
echo ""
read -rsp "  Paste API key: " API_KEY
echo ""

if [ -z "$API_KEY" ]; then
  echo -e "${RED}❌ No API key provided. Exiting.${NC}"
  exit 1
fi

# ── Step 2: Verify key with MissionDeck ───────────────────────────
echo ""
echo -e "${YELLOW}Step 2${NC} — Verifying key with MissionDeck..."

VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  "$MISSIONDECK_URL/functions/v1/mc-api/verify" 2>/dev/null || true)

HTTP_CODE=$(echo "$VERIFY_RESPONSE" | tail -1)
VERIFY_BODY=$(echo "$VERIFY_RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
  WORKSPACE_SLUG=$(echo "$VERIFY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug',''))" 2>/dev/null || echo "")
  echo -e "  ${GREEN}✅ Verified — workspace slug: ${BOLD}$WORKSPACE_SLUG${NC}"
else
  # Fallback: ask for slug manually if endpoint not yet deployed
  echo -e "  ${YELLOW}⚠️  Could not verify automatically — what is your MissionDeck username?${NC}"
  echo ""
  read -rp "  Username/slug: " WORKSPACE_SLUG
fi

if [ -z "$WORKSPACE_SLUG" ]; then
  echo -e "${RED}❌ Could not determine workspace slug. Exiting.${NC}"
  exit 1
fi

DASHBOARD_URL="$MISSIONDECK_URL/workspace/$WORKSPACE_SLUG"

# ── Step 3: Save config ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 3${NC} — Saving configuration..."

mkdir -p "$MC_DIR/.mission-control"

# Write or update config.yaml
if [ -f "$CONFIG_FILE" ]; then
  # Remove existing missiondeck config if present
  grep -v "^missiondeck_" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" || true
  mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
fi

cat >> "$CONFIG_FILE" << EOF

# MissionDeck Cloud (added by connect-missiondeck.sh)
missiondeck_enabled: true
missiondeck_slug: $WORKSPACE_SLUG
missiondeck_url: $MISSIONDECK_URL
EOF

# Also write .env-missiondeck for server to pick up
cat > "$MC_DIR/.missiondeck" << EOF
MISSIONDECK_API_KEY=$API_KEY
MISSIONDECK_URL=$MISSIONDECK_URL
MISSIONDECK_SLUG=$WORKSPACE_SLUG
EOF
chmod 600 "$MC_DIR/.missiondeck"

echo -e "  ${GREEN}✅ Config saved${NC}"

# ── Step 4: Initial sync ───────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 4${NC} — Syncing tasks to MissionDeck..."

TASKS_DIR="$MC_DIR/.mission-control/tasks"
TASK_COUNT=0

if [ -d "$TASKS_DIR" ]; then
  TASK_COUNT=$(ls "$TASKS_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
fi

if [ "$TASK_COUNT" -gt 0 ]; then
  # Build JSON payload
  PAYLOAD=$(python3 - << PYEOF
import json, os, glob

tasks_dir = "$TASKS_DIR"
tasks = []
for f in glob.glob(os.path.join(tasks_dir, "*.json")):
    try:
        with open(f) as fp:
            tasks.append(json.load(fp))
    except:
        pass

print(json.dumps({"tasks": tasks, "agents": [], "deleted_ids": [], "client_version": "0.9.5"}))
PYEOF
)

  SYNC_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$MISSIONDECK_URL/functions/v1/mc-sync" 2>/dev/null || true)

  SYNC_CODE=$(echo "$SYNC_RESPONSE" | tail -1)
  SYNC_BODY=$(echo "$SYNC_RESPONSE" | head -1)

  if [ "$SYNC_CODE" = "200" ]; then
    SYNCED=$(echo "$SYNC_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tasks_upserted',0))" 2>/dev/null || echo "$TASK_COUNT")
    echo -e "  ${GREEN}✅ $SYNCED tasks synced${NC}"
  else
    echo -e "  ${YELLOW}⚠️  Sync returned HTTP $SYNC_CODE — tasks will sync when server restarts${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠️  No tasks found yet — will sync automatically when you create tasks${NC}"
fi

# ── Step 5: Restart server ─────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 5${NC} — Activating sync in server..."

# Load the new env and restart if PM2 is running
if pm2 list 2>/dev/null | grep -q "mission-control-server"; then
  export $(cat "$MC_DIR/.missiondeck" | xargs) 2>/dev/null || true
  pm2 restart mission-control-server --update-env 2>/dev/null && \
    echo -e "  ${GREEN}✅ Server restarted with MissionDeck sync enabled${NC}" || \
    echo -e "  ${YELLOW}⚠️  Please restart the server manually: pm2 restart mission-control-server --update-env${NC}"
else
  echo -e "  ${YELLOW}ℹ️  Server not running via PM2 — restart with: source .missiondeck && node server/index.js${NC}"
fi

# ── Done ────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}${BOLD}✅ MissionDeck Cloud is live!${NC}"
echo ""
echo -e "  🌐 Dashboard:  ${BOLD}$DASHBOARD_URL${NC}"
echo -e "  🔄 Auto-sync:  Every time you change a task"
echo -e "  ⚙️  Settings:  ${BOLD}$MISSIONDECK_URL/settings/workspaces${NC}"
echo ""
echo -e "  To change access control (public/password/private):"
echo -e "  Go to ${BOLD}$MISSIONDECK_URL/settings/workspaces/$WORKSPACE_SLUG${NC}"
echo ""
