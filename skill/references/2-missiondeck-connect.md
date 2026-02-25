# MissionDeck.ai Cloud Connection

Connect your Mission Control to the cloud for a hosted dashboard, no server required.

> ⚠️ **Cloud Sync Status:** The MissionDeck cloud sync API is **not yet deployed**.
> Running `connect-missiondeck.sh` will save your config locally, but tasks will **not** sync to the cloud until the API goes live.
> Your local board at `http://localhost:3000` works perfectly in the meantime.
> Re-run the script when cloud sync is announced at [missiondeck.ai](https://missiondeck.ai).

**Live Demo (no account):** [missiondeck.ai/mission-control/demo](https://missiondeck.ai/mission-control/demo)  
**Platform:** [missiondeck.ai](https://missiondeck.ai)  
**Free tier:** Available — no credit card required

---

## What MissionDeck.ai Will Provide (When Live)

- Hosted dashboard at `https://missiondeck.ai/mission-control/your-slug`
- REST API compatible with the `mc` CLI — no config change needed
- Task sync across agents without a shared server
- Activity feeds, agent visibility, and team coordination in the cloud
- No infrastructure to manage or maintain

---

## Setup Steps (For When Cloud API Is Available)

### Step 1: Create an Account + Get Your API Key

1. Go to [missiondeck.ai/settings/api-keys](https://missiondeck.ai/settings/api-keys)
2. Sign up with email or GitHub (no credit card needed)
3. Create a workspace and choose a slug (e.g., `my-agent-team`)
4. Copy your API key
5. Your dashboard will be at:
   ```
   https://missiondeck.ai/mission-control/my-agent-team
   ```

### Step 2: Connect Your Repo

```bash
./scripts/connect-missiondeck.sh --api-key YOUR_KEY
```

The script now checks if the cloud API is live before proceeding. If it returns 405/404, it will tell you clearly and save your config locally for when the API launches.

### Step 3: Verify Connection

```bash
node mc/mc.js status
# Expected when connected:
# Mode: cloud (missiondeck.ai)
# Workspace: your-slug
# Dashboard: https://missiondeck.ai/mission-control/your-slug
# Status: connected ✓
#
# Expected when cloud unavailable:
# Mode: local
# Dashboard: http://localhost:3000
# Status: cloud API not yet available
```

---

## What To Do Right Now (Cloud Not Available)

Your local setup is complete and fully functional:

| | Self-Hosted (Now) | MissionDeck Cloud (Coming Soon) |
|---|---|---|
| Dashboard | `http://localhost:3000` | `https://missiondeck.ai/mission-control/slug` |
| Data | 100% local | Cloud-synced |
| Works offline | Yes | No |
| Multi-device | Via reverse proxy | Built-in |
| Status | ✅ Available now | ⏳ Coming soon |

**For remote access right now:** See `skills/deployment.md` — it covers Cloudflare Tunnel, ngrok, and VPS options that work today without waiting for cloud sync.

---

## When Cloud Sync Is Available

The `connect-missiondeck.sh` script will detect it automatically:

```bash
# Re-run when ready — script auto-detects availability
./scripts/connect-missiondeck.sh
```

No other changes needed. The `mc` CLI auto-routes to cloud once `.missiondeck` config is valid.
