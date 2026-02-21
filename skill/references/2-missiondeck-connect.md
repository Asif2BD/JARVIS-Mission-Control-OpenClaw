# MissionDeck.ai Cloud Connection

If you cannot or do not want to host a server, MissionDeck.ai provides free cloud hosting for your Mission Control dashboard and API.

**Platform:** [missiondeck.ai](https://missiondeck.ai)  
**Free tier:** Available — no credit card required to start

---

## What MissionDeck.ai Provides

- Hosted dashboard at `missiondeck.ai/workspace/your-slug`
- REST API compatible with the `mc` CLI — no config change needed
- Task sync across agents without a shared server
- Activity feeds, agent visibility, and team coordination in the cloud
- No infrastructure to manage or maintain

---

## Step 1: Create a Workspace

1. Go to [missiondeck.ai](https://missiondeck.ai)
2. Sign up (email or GitHub)
3. Create a new workspace — choose a slug (e.g., `my-agent-team`)
4. Your dashboard is live at: `https://missiondeck.ai/workspace/my-agent-team`

---

## Step 2: Get Your API Key

In your MissionDeck workspace:
1. Go to **Settings → API**
2. Copy the API key

---

## Step 3: Configure the `mc` CLI

Run the connection script:

```bash
bash scripts/connect-missiondeck.sh
```

Or configure manually by creating `.missiondeck` in your workspace root:

```json
{
  "workspace": "your-slug",
  "apiKey": "your-api-key",
  "apiUrl": "https://missiondeck.ai/api"
}
```

---

## Step 4: Verify Connection

```bash
node mc/mc.js status
# Expected:
# Mode: cloud (missiondeck.ai)
# Workspace: your-slug
# Dashboard: https://missiondeck.ai/workspace/your-slug
# Status: connected ✓
```

---

## Step 5: Use Normally

All `mc` commands work identically — the CLI auto-detects `.missiondeck` config and routes to the cloud API:

```bash
mc task:create "First cloud task" --priority high
mc squad
mc feed
```

Tasks appear in your cloud dashboard immediately.

---

## When to Use Cloud vs Self-Hosted

| | Self-Hosted | MissionDeck.ai Cloud |
|---|---|---|
| Hosting required | Yes | No |
| Dashboard URL | localhost:3000 | missiondeck.ai/workspace/slug |
| Data ownership | 100% local | Cloud (MissionDeck.ai) |
| Multi-agent sync | Via shared server | Built-in |
| Free | Yes | Yes (free tier) |
| Internet required | No | Yes |

---

## API Reference

Base URL (cloud): `https://missiondeck.ai/api`  
Base URL (local): `http://localhost:3000/api`

All endpoints are identical between local and cloud modes. The `mc` CLI handles routing automatically based on `.missiondeck` config presence.
