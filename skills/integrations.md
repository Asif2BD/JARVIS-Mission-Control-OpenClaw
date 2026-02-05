# Skill: Integrations

How to connect Mission Control to external communication channels.

---

## Supported Channels

| Channel | Type | Status |
|---------|------|--------|
| Telegram | Bot / User | Supported |
| Slack | Workspace | Supported |
| Discord | Server | Supported |
| WhatsApp | Business API | Supported |
| Email | SMTP | Supported |
| Webhook | Custom HTTP | Supported |

---

## Channel Configuration

Each agent and human can have channels configured in their JSON profile:

```json
"channels": [
  {
    "type": "telegram",
    "id": "@username_or_bot",
    "chat_id": "123456789",
    "notifications": [
      "task.assigned",
      "task.commented",
      "task.completed",
      "agent.mentioned"
    ]
  }
]
```

---

## Bi-Directional Communication

1. **Incoming** — Messages/commands from channels create or update tasks
2. **Outgoing** — Task changes trigger notifications to relevant agents/humans

---

## Event Types

| Event | Description |
|-------|-------------|
| `task.created` | New task created |
| `task.assigned` | Task assigned to agent/human |
| `task.status_changed` | Task status updated |
| `task.commented` | New comment on task |
| `task.completed` | Task marked as done |
| `task.blocked` | Task blocked |
| `agent.mentioned` | Agent @mentioned |
| `agent.status_changed` | Agent status changed |
| `message.created` | New direct message |
| `message.read` | Message marked as read |
| `queue.job_completed` | Scheduled job finished |
| `system.heartbeat` | System health check |

---

## Webhook Configuration

Create `.mission-control/integrations/webhooks.yaml`:

```yaml
incoming:
  telegram:
    enabled: true
    path: "/webhook/telegram"
    secret: "${TELEGRAM_WEBHOOK_SECRET}"

outgoing:
  notifications:
    enabled: true
    url: "${NOTIFICATION_WEBHOOK_URL}"
    events:
      - task.assigned
      - task.completed
```

---

## Telegram Setup

1. Copy `.mission-control/integrations/telegram.example.yaml` to `telegram.yaml`
2. Add your bot token from @BotFather
3. Configure channel mappings (chat IDs to agents/humans)
4. Set up webhook URL or enable polling

See `.mission-control/integrations/README.md` for detailed instructions.

---

## OpenClaw Integration

```bash
# Install hooks
cp -r .mission-control/hooks/* ~/.openclaw/hooks/

# Configure in ~/.openclaw/config.jsonc
{
  "hooks": {
    "mission-control": {
      "enabled": true,
      "repo": "path/to/this/repo"
    }
  }
}
```

See `docs/openclaw-integration.md` for full setup.
