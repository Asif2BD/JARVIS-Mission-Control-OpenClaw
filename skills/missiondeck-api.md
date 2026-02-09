# MissionDeck API Integration

> **⚠️ REQUIRED:** This is a required step for Mission Control setup.

This skill teaches agents how to connect Mission Control to MissionDeck for updates, templates, and support.

## Overview

MissionDeck (missiondeck.ai) is the companion platform for Mission Control. It provides:
- ✅ **Free API key** — Sign up with email, no payment required
- ✅ **Update notifications** — Know when new versions are available
- ✅ **Agent templates** — Pre-built agent configurations
- ✅ **Future marketplace** — Buy/sell agent templates (coming soon)

## Quick Connect

The easiest way to connect:

```bash
./scripts/connect-missiondeck.sh
```

This will prompt you for your API key and configure everything automatically.

## Get Your Free API Key

1. Go to **[missiondeck.ai/auth](https://missiondeck.ai/auth)**
2. Sign up with your email
3. Copy your API key from the dashboard

## Manual Configuration

Store the API key in your environment or config:
```bash
export MISSIONDECK_API_KEY="your-api-key-here"
```

Or in `.mission-control/config.json`:
```json
{
  "missiondeck": {
    "apiKey": "your-api-key-here",
    "autoUpdate": true
  }
}
```

## API Endpoints

Base URL: `https://sqykgceibcmnmgfuioso.supabase.co/functions/v1/distribution`

### Check Current Version

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://sqykgceibcmnmgfuioso.supabase.co/functions/v1/distribution/version
```

Response:
```json
{
  "version": "0.9.0",
  "releasedAt": "2026-02-07T00:00:00Z",
  "changelog": "https://missiondeck.ai/changelog"
}
```

### Download Latest Version

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://sqykgceibcmnmgfuioso.supabase.co/functions/v1/distribution/download/latest \
  -o mission-control-latest.zip
```

### Health Check

```bash
curl https://sqykgceibcmnmgfuioso.supabase.co/functions/v1/distribution/health
```

## Auto-Update Routine

Add this to your heartbeat or startup routine:

```bash
#!/bin/bash
# scripts/check-updates.sh

API_KEY="${MISSIONDECK_API_KEY:-}"
CURRENT_VERSION=$(cat VERSION 2>/dev/null || echo "0.0.0")

if [ -z "$API_KEY" ]; then
  echo "No MissionDeck API key configured"
  exit 0
fi

LATEST=$(curl -s -H "x-api-key: $API_KEY" \
  https://sqykgceibcmnmgfuioso.supabase.co/functions/v1/distribution/version \
  | grep -o '"version":"[^"]*"' | cut -d'"' -f4)

if [ "$LATEST" != "$CURRENT_VERSION" ]; then
  echo "🚀 New version available: $LATEST (current: $CURRENT_VERSION)"
  echo "Run: ./scripts/update-mission-control.sh"
else
  echo "✅ Mission Control is up to date ($CURRENT_VERSION)"
fi
```

## Update Script

```bash
#!/bin/bash
# scripts/update-mission-control.sh

API_KEY="${MISSIONDECK_API_KEY:-}"

if [ -z "$API_KEY" ]; then
  echo "❌ MISSIONDECK_API_KEY not set"
  exit 1
fi

echo "📦 Downloading latest Mission Control..."

# Backup current version
cp -r . ../mission-control-backup-$(date +%Y%m%d)

# Download and extract
curl -H "x-api-key: $API_KEY" \
  https://sqykgceibcmnmgfuioso.supabase.co/functions/v1/distribution/download/latest \
  -o /tmp/mission-control-latest.zip

# Extract (preserving local data)
unzip -o /tmp/mission-control-latest.zip -x ".mission-control/*"

echo "✅ Updated! Check CHANGELOG.md for what's new."
```

## Agent Instructions

When setting up a new agent, give them this context:

```
Mission Control updates are distributed via MissionDeck API.
- Check for updates: ./scripts/check-updates.sh
- Apply updates: ./scripts/update-mission-control.sh
- API key is in MISSIONDECK_API_KEY environment variable

Check for updates periodically (daily recommended) but don't auto-apply 
without human approval unless configured to do so.
```

## Heartbeat Integration

Add to HEARTBEAT.md for periodic checks:

```markdown
## Update Check (weekly)
- [ ] Run ./scripts/check-updates.sh
- [ ] If update available, notify human and ask if they want to apply it
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check API key is valid |
| 404 Not Found | Verify endpoint URL |
| Rate limited | Wait and retry (limit: 100 req/day) |
| Download fails | Check disk space, try again |

## See Also

- [Setup Skill](setup.md) - Initial installation
- [Dashboard Skill](dashboard.md) - Web interface
- https://missiondeck.ai/docs - Full API documentation
