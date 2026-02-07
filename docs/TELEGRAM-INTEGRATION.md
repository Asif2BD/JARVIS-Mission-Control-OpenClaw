# Telegram → Mission Control Integration

## Overview

Automatically creates Mission Control tasks when agents are @mentioned in Telegram group messages.

## Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Telegram   │────▶│    OpenClaw     │────▶│  Mission Control │
│   Group      │     │  (Agent Bridge) │     │   (Tasks API)    │
└──────────────┘     └─────────────────┘     └──────────────────┘
```

**Approach: Option C - Agent Bridge Extension**

We extend the existing `agent-bridge.js` which already monitors OpenClaw sessions.
When it sees user messages with @mentions, it creates Mission Control tasks.

### Why This Approach?

| Approach | Verdict |
|----------|---------|
| OpenClaw Plugin | ❌ Too invasive - requires core changes |
| Direct Telegram Webhook | ❌ More moving parts - separate service |
| **Agent Bridge Extension** | ✅ Uses existing infrastructure |

## Components

### 1. `server/telegram-bridge.js`

Core functions for parsing mentions and creating tasks.

```javascript
// Parse @mentions from message text
parseMentions("@TankMatrixZ_Bot fix the bug")
// Returns: ['tank']

// Extract task title
extractTitle("@TankMatrixZ_Bot fix the dashboard bug")
// Returns: "Fix the dashboard bug"

// Create task
createTaskFromTelegram({
    from: "M Asif Rahman",
    message: "@TankMatrixZ_Bot fix the dashboard",
    chat_id: "TELEGRAM_CHAT_ID",
    message_id: "123"
})
// Creates: .mission-control/tasks/task-tg-1770445678.json
```

### 2. `server/agent-bridge.js` (Modified)

Monitors OpenClaw sessions. When processing user messages:
- Detects @mentions
- Filters self-mentions (agent won't create task for itself)
- Calls `telegram-bridge.createTaskFromTelegram()`

### 3. API Endpoint

```
POST /api/telegram/task
Content-Type: application/json

{
    "from": "M Asif Rahman",
    "message": "@TankMatrixZ_Bot fix the dashboard",
    "chat_id": "TELEGRAM_CHAT_ID",
    "message_id": "123",
    "timestamp": "2026-02-07T06:41:00Z"
}

Response:
{
    "ok": true,
    "taskId": "task-tg-1770445678"
}
```

## Agent Mapping

| Bot Username | Agent ID |
|--------------|----------|
| @OracleM_Bot | oracle |
| @TankMatrixZ_Bot | tank |
| @MorpheusMatrixZ_Bot | morpheus |
| @ShuriMatrixZ_Bot | shuri |
| @KeymakerMatrixZ_Bot | keymaker |

## Deduplication

Tasks are deduplicated by:
- Same message content
- Same source (telegram)
- Within 5 minute window

Prevents duplicate tasks when multiple agents see the same group message.

## Task Structure

```json
{
    "id": "task-tg-1770445678",
    "title": "Fix the dashboard bug",
    "description": "@TankMatrixZ_Bot fix the dashboard bug",
    "status": "pending",
    "priority": "normal",
    "assignee": "tank",
    "mentions": ["tank"],
    "source": "telegram",
    "sourceData": {
        "chat_id": "TELEGRAM_CHAT_ID",
        "message_id": "123",
        "from": "M Asif Rahman"
    },
    "createdAt": "2026-02-07T06:41:00Z",
    "createdBy": "M Asif Rahman",
    "progress": 0
}
```

## CLI Usage

```bash
# Create task manually
./scripts/mc-telegram-task.sh "Architect" "@TankMatrixZ_Bot fix X"

# With custom chat/message IDs
./scripts/mc-telegram-task.sh "User" "@MorpheusMatrixZ_Bot review PR" "TELEGRAM_CHAT_ID" "456"
```

## Testing

1. Start Mission Control server:
   ```bash
   node server/index.js
   ```

2. Start agent bridge:
   ```bash
   node server/agent-bridge.js
   ```

3. Send message in Telegram group with @mention

4. Check tasks:
   ```bash
   ls .mission-control/tasks/task-tg-*.json
   ```

## Limitations

- Only detects mentions in messages processed by agent-bridge
- Requires agent-bridge to be running
- Won't catch messages sent directly to Telegram (only via OpenClaw)

## Future Enhancements

- Direct Telegram webhook (if needed for real-time without OpenClaw)
- Task status updates back to Telegram
- Inline buttons for task actions

---

*Implemented by Morpheus | 2026-02-07*
