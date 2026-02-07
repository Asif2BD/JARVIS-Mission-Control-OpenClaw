# Telegram Bridge Integration

This skill teaches agents how to use Mission Control's Telegram integration for task creation, notifications, and team communication.

## Overview

The Telegram Bridge connects Mission Control to Telegram groups, enabling:
- Create tasks directly from Telegram messages
- Get notifications when tasks change
- Reply to task updates in Telegram
- Coordinate with human operators via chat

## Setup

### 1. Configure Telegram Bot Token

Get a bot token from [@BotFather](https://t.me/botfather) on Telegram.

Add to `.mission-control/config.json`:
```json
{
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN",
    "chatId": "-1234567890",
    "enabled": true
  }
}
```

Or use environment variables:
```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="-1234567890"
```

### 2. Start the Bridge

The Telegram bridge runs alongside the main server:

```bash
# Start with Telegram bridge enabled
node server/index.js --telegram

# Or run bridge separately
node server/telegram-bridge.js
```

## Creating Tasks from Telegram

### Using the Script

```bash
# Create task from command line (posts to Telegram)
./scripts/mc-telegram-task.sh "Fix login bug" "high" "tank"
```

### Message Format

When humans post in Telegram, the bridge can parse task requests:

```
@BotName task: Fix the login page
Priority: high
Assign: @tank
```

The bridge creates a task and replies with confirmation.

## Notification Events

The bridge sends Telegram messages for:

| Event | Message |
|-------|---------|
| Task created | "📋 New task: {title} (assigned to {agent})" |
| Task claimed | "🤚 {agent} claimed: {title}" |
| Task completed | "✅ {agent} completed: {title}" |
| Task blocked | "🚫 {title} is blocked: {reason}" |
| Agent message | "💬 {from} → {to}: {message}" |

## Agent Communication via Telegram

Agents can send messages to the Telegram group:

```javascript
// In your agent code
const { sendTelegramMessage } = require('./server/telegram-bridge');

await sendTelegramMessage({
  text: "I've completed the API refactor. Ready for review.",
  replyToTask: "task-123"
});
```

Or via the messaging system:
```bash
# Post to Telegram channel
./scripts/mc-message.sh --channel telegram "Status update: deployment complete"
```

## Responding to Telegram Commands

The bridge supports these commands:

| Command | Action |
|---------|--------|
| `/tasks` | List open tasks |
| `/task <id>` | Show task details |
| `/claim <id>` | Claim a task |
| `/done <id>` | Mark task complete |
| `/status` | Show agent status |
| `/help` | Show available commands |

## Configuration Options

Full config in `.mission-control/config.json`:

```json
{
  "telegram": {
    "botToken": "BOT_TOKEN",
    "chatId": "-GROUP_CHAT_ID",
    "enabled": true,
    "notifications": {
      "taskCreated": true,
      "taskCompleted": true,
      "taskBlocked": true,
      "agentMessages": true
    },
    "commands": {
      "enabled": true,
      "prefix": "/"
    },
    "quietHours": {
      "enabled": false,
      "start": "23:00",
      "end": "08:00",
      "timezone": "UTC"
    }
  }
}
```

## Multi-Agent Telegram Setup

For teams with multiple agents, each can have their own notification preferences:

```json
{
  "agents": {
    "oracle": {
      "telegram": {
        "directMessages": true,
        "taskNotifications": "assigned-only"
      }
    },
    "tank": {
      "telegram": {
        "directMessages": true,
        "taskNotifications": "all"
      }
    }
  }
}
```

## Best Practices

1. **Don't spam** — Batch notifications when possible
2. **Use threads** — Reply to existing messages for context
3. **Tag humans** — Use @mentions for urgent items
4. **Respect quiet hours** — Don't notify during off-hours
5. **Keep it brief** — Telegram is for alerts, not full reports

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Bot not responding | Check token is valid, bot added to group |
| Messages not sending | Verify chat ID (negative for groups) |
| Missing notifications | Check `notifications` config |
| Rate limited | Reduce notification frequency |

## Example: Daily Standup via Telegram

```javascript
// Post daily standup summary
async function postStandup() {
  const tasks = await getTasksByStatus('in-progress');
  const completed = await getCompletedToday();
  
  const message = `
🌅 *Daily Standup*

*In Progress:*
${tasks.map(t => `• ${t.title} (${t.assignee})`).join('\n')}

*Completed Today:*
${completed.map(t => `✅ ${t.title}`).join('\n')}

*Blockers:* ${blockers.length > 0 ? blockers.join(', ') : 'None'}
  `;
  
  await sendTelegramMessage({ text: message, parseMode: 'Markdown' });
}
```

## See Also

- [Integrations Skill](integrations.md) - Other platform connections
- [Notifications Skill](notifications.md) - Webhook configuration
- [Messaging Skill](messaging.md) - Inter-agent communication
- [docs/TELEGRAM-INTEGRATION.md](../docs/TELEGRAM-INTEGRATION.md) - Full documentation
