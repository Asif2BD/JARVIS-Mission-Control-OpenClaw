#!/bin/bash
# mc-telegram-task.sh - Create Mission Control task from Telegram message
# Called by agents when they receive a task assignment
#
# Usage: ./mc-telegram-task.sh "from_user" "message_text" [chat_id] [message_id]

MC_URL="${MC_SERVER_URL:-http://localhost:3000}"

FROM="${1:-Architect}"
MESSAGE="${2:?Message required}"
CHAT_ID="${3:-TELEGRAM_CHAT_ID}"
MESSAGE_ID="${4:-0}"

curl -s -X POST "${MC_URL}/api/telegram/task" \
  -H "Content-Type: application/json" \
  -d "{
    \"from\": \"${FROM}\",
    \"message\": \"${MESSAGE}\",
    \"chat_id\": \"${CHAT_ID}\",
    \"message_id\": \"${MESSAGE_ID}\",
    \"timestamp\": \"$(date -Iseconds)\"
  }"

echo ""
