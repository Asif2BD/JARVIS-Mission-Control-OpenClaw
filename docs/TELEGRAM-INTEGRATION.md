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

The `agent-bridge.js` monitors OpenClaw sessions. When it sees user messages with @mentions, it creates Mission Control tasks.

## Configuration

### Agent Bot Mapping

Map your Telegram bot usernames to agent IDs. Three options:

**Option 1: Environment Variable**
```bash
export AGENT_MAP='{"@MyAgentBot":"agent-one","@OtherBot":"agent-two"}'
```

**Option 2: Config File**
```bash
# .mission-control/config/agents.json
{
  "botMapping": {
    "@MyAgentBot": "agent-one",
    "@OtherBot": "agent-two"
  }
}
```

**Option 3: Default (edit source)**
Edit `server/telegram-bridge.js` directly.

## Components

### `server/telegram-bridge.js`

Core functions for parsing mentions and creating tasks.

```javascript
// Parse @mentions from message text
parseMentions("@MyAgentBot fix the bug")
// Returns: ['agent-one']

// Extract task title
extractTitle("@MyAgentBot fix the dashboard bug")
// Returns: "Fix the dashboard bug"

// Create task
createTaskFromTelegram({
    from: "User Name",
    message: "@MyAgentBot fix the dashboard",
    chat_id: "-123456789",
    message_id: "123"
})
// Creates: .mission-control/tasks/task-tg-1234567890.json
```

### `server/agent-bridge.js`

Monitors OpenClaw sessions. When processing user messages:
- Detects @mentions
- Filters self-mentions (agent won't create task for itself)
- Calls `telegram-bridge.createTaskFromTelegram()`

### API Endpoint

```
POST /api/telegram/task
Content-Type: application/json

{
    "from": "User Name",
    "message": "@MyAgentBot fix the dashboard",
    "chat_id": "-123456789",
    "message_id": "123",
    "timestamp": "2026-02-07T06:41:00Z"
}

Response:
{
    "ok": true,
    "taskId": "task-tg-1234567890"
}
```

## Deduplication

Tasks are deduplicated by:
- Same message content
- Same source (telegram)
- Within 5 minute window

Prevents duplicate tasks when multiple agents see the same group message.

## Task Structure

```json
{
    "id": "task-tg-1234567890",
    "title": "Fix the dashboard bug",
    "description": "@MyAgentBot fix the dashboard bug",
    "status": "pending",
    "priority": "normal",
    "assignee": "agent-one",
    "mentions": ["agent-one"],
    "source": "telegram",
    "sourceData": {
        "chat_id": "-123456789",
        "message_id": "123",
        "from": "User Name"
    },
    "createdAt": "2026-02-07T06:41:00Z",
    "createdBy": "User Name",
    "progress": 0
}
```

## CLI Usage

```bash
# Create task manually
./scripts/mc-telegram-task.sh "User" "@MyAgentBot fix something"

# With custom chat/message IDs
./scripts/mc-telegram-task.sh "User" "@AgentBot review PR" "-123456789" "456"
```

## Testing

1. Configure your bot mapping (see Configuration above)

2. Start Mission Control server:
   ```bash
   node server/index.js
   ```

3. Start agent bridge:
   ```bash
   node server/agent-bridge.js
   ```

4. Send message in Telegram group with @mention

5. Check tasks:
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
