# Mission Control Integrations

This directory contains integration configurations for connecting Mission Control to external communication channels.

## Directory Structure

```
integrations/
├── README.md           # This file
├── telegram.yaml       # Telegram bot configuration
├── webhooks.yaml       # Incoming/outgoing webhook URLs
└── channels/           # Channel-specific configs
    ├── telegram-main.json
    └── slack-team.json
```

## Supported Channels

| Channel | Status | Description |
|---------|--------|-------------|
| Telegram | Supported | Primary channel for OpenClaw agents |
| WhatsApp | Planned | Via WhatsApp Business API |
| Slack | Planned | Team communication |
| Discord | Planned | Community/team servers |
| Email | Planned | Email notifications |
| Custom Webhook | Supported | Any HTTP endpoint |

## How It Works

1. **Incoming Events**: External channels send events to Mission Control webhooks
2. **Task Creation**: Messages/commands create or update tasks
3. **Notifications**: Mission Control sends updates back to relevant channels
4. **Real-time Sync**: All changes are propagated to connected agents/humans

## Quick Setup

1. Copy `telegram.example.yaml` to `telegram.yaml`
2. Add your bot token and chat IDs
3. Configure webhook URLs in your bot settings
4. Mission Control will auto-discover integrations on startup
