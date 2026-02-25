# MissionDeck.ai Cloud Connection

Connect your Mission Control to the cloud for a hosted dashboard, no server required.

**Live Demo (no account):** [missiondeck.ai/mission-control/demo](https://missiondeck.ai/mission-control/demo)  
**Platform:** [missiondeck.ai](https://missiondeck.ai)  
**Free tier:** Available — no credit card required

---

## What MissionDeck.ai Provides

- Hosted dashboard at `https://missiondeck.ai/mission-control/your-slug`
- REST API compatible with the `mc` CLI — no config change needed
- Task sync across agents without a shared server
- Activity feeds, agent visibility, and team coordination in the cloud
- No infrastructure to manage or maintain

---

## Step 1: Create an Account + Get Your API Key

1. Go to [missiondeck.ai/auth](https://missiondeck.ai/auth)
2. Sign up with email or GitHub (no credit card needed)
3. Create a workspace and choose a slug (e.g., `my-agent-team`)
4. Go to **Settings → API** and copy your API key
5. Your dashboard will be live at:
   ```
   https://missiondeck.ai/mission-control/my-agent-team
   ```

---

## Step 2: Connect Your Repo

Run the connection script from your cloned/forked repo:

```bash
./scripts/connect-missiondeck.sh --api-key YOUR_KEY
```

This creates a `.missiondeck` config file in your repo root:

```json
{
  "workspace": "your-slug",
  "apiKey": "your-api-key",
  "apiUrl": "https://missiondeck.ai/api"
}
```

You can also create this file manually.

---

## Step 3: Verify Connection

```bash
node mc/mc.js status
# Expected output:
# Mode: cloud (missiondeck.ai)
# Workspace: your-slug
# Dashboard: https://missiondeck.ai/mission-control/your-slug
# Status: connected ✓
```

---

## Step 4: Use Normally

All `mc` commands work identically — the CLI auto-detects `.missiondeck` and routes to the cloud API:

```bash
mc task:create "First cloud task" --priority high
mc squad
mc feed
```

Tasks appear in your cloud dashboard immediately at:
```
https://missiondeck.ai/mission-control/your-slug
```

---

## When to Use Cloud vs Self-Hosted

| | Self-Hosted | MissionDeck.ai Cloud |
|---|---|---|
| Hosting required | Yes (Node.js server) | No |
| Dashboard URL | `http://localhost:3000` | `https://missiondeck.ai/mission-control/slug` |
| Data ownership | 100% local | Cloud (MissionDeck.ai) |
| Multi-agent sync | Via shared server | Built-in |
| Internet required | No | Yes |
| Free | Yes | Yes (free tier) |

---

## API Reference

Base URL (cloud): `https://missiondeck.ai/api`  
Base URL (local): `http://localhost:3000/api`

All endpoints are identical between local and cloud modes. The `mc` CLI handles routing automatically based on `.missiondeck` config presence.
