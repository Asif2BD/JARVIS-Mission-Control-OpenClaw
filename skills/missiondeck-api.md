# MissionDeck Cloud — Full Platform Guide

> **JARVIS Mission Control is the open-source engine. [MissionDeck.ai](https://missiondeck.ai) is the platform built around it.**

This skill covers everything MissionDeck provides: hosted dashboards, one-click agent deployment, the Agent Builder, and the cloud API.

---

## What MissionDeck Gives You

| Feature | Free | Starter ($20/mo) | Pro ($99/mo) |
|---------|------|-----------------|--------------|
| Hosted dashboard at `missiondeck.ai/workspace/slug` | ✅ | ✅ | ✅ |
| Cloud sync from local Mission Control | ✅ | ✅ | ✅ |
| Agent Builder (visual agent design) | ✅ | ✅ | ✅ |
| One-click OpenClaw deploy to Orgo Cloud | ✅ (1 deploy) | ✅ (5 deploys) | ✅ (unlimited) |
| Deploy to your own VPS (BYOS) | ✅ | ✅ | ✅ |
| Multi-agent team deployment | ✅ | ✅ | ✅ |
| Telegram bot auto-connect | ✅ | ✅ | ✅ |
| Orgo VM specs | 4GB RAM / 4 cores | 8GB RAM / 4 cores | 16GB RAM / 8 cores |
| Update notifications | ✅ | ✅ | ✅ |

---

## Step 0: Get Your Free API Key

1. Go to **[missiondeck.ai/auth](https://missiondeck.ai/auth)**
2. Sign up with your email (no credit card for free tier)
3. Copy your API key from the dashboard

Then connect:
```bash
./scripts/connect-missiondeck.sh --api-key YOUR_KEY
```

---

## Feature 1: Hosted Dashboard

Your local `.mission-control/` data syncs automatically to a live cloud dashboard at:

```
https://missiondeck.ai/workspace/your-slug
```

No servers, no port-forwarding, no DevOps. The `mc-sync` service watches for local file changes and pushes them to MissionDeck within seconds.

### Access Control Options

| Mode | Who Can View |
|------|-------------|
| **Public** | Anyone with the URL |
| **Passcode** | Anyone with the password (Matrix lock screen) |
| **Authenticated** | MissionDeck account required |
| **Private** | Only you |

Configure in **Settings → Workspaces** on missiondeck.ai.

### One-liner sync setup

```bash
./scripts/connect-missiondeck.sh
```

The wizard authenticates, configures auto-sync, and gives you your live URL.

---

## Feature 2: One-Click Agent Deployment

Deploy a fully configured OpenClaw agent in 60 seconds — no SSH, no server setup.

Go to **[missiondeck.ai/deploy](https://missiondeck.ai/deploy)**

The deployment wizard walks you through 5 steps:

### Step 1 — Choose Your Cloud

**Option A: Orgo Cloud (Managed VM)**
- Zero infrastructure to manage
- Free tier available (4GB RAM, 4 cores)
- Connect your Orgo API key from [orgo.host](https://orgo.host/signup?ref=missiondeck)

**Option B: Bring Your Own Server (BYOS)**
- Any Linux VPS or dedicated server
- Works with DigitalOcean, Hetzner, Vultr, Linode, OVH, bare metal — anything
- Enter IP, SSH port, username, password or SSH key
- MissionDeck SSHs in, installs everything, starts the gateway automatically
- AI-assisted recovery if any step fails (Claude rewrites broken shell commands)

### Step 2 — Connect AI Provider

Supported providers:
- Anthropic (Claude)
- OpenAI (GPT-4)
- Google (Gemini)
- xAI (Grok)
- DeepSeek
- Mistral
- OpenRouter
- Perplexity

### Step 3 — Connect Telegram Bot

Enter your bot token (from [@BotFather](https://t.me/BotFather)) and your Telegram user ID. The bot is verified live before deployment proceeds.

### Step 4 — Build Your Agent Team

Use the **Agent Builder** (missiondeck.ai/agent-builder) to visually design your agents, or load a previously saved team. You can deploy:
- A single agent
- An entire multi-agent team (each gets its own workspace, SOUL.md, and Telegram routing)

### Step 5 — Deploy

Click **Deploy Now**. MissionDeck:
1. Provisions your VM (Orgo) or connects to your server (BYOS)
2. Installs Node.js and OpenClaw via npm
3. Writes `openclaw.json` with full multi-agent routing config
4. Creates individual workspaces with `SOUL.md` and `IDENTITY.md` per agent
5. Starts the OpenClaw gateway
6. Verifies your Telegram bot is live
7. Reports back in real-time with deployment logs

**Total time: ~60 seconds (Orgo) or ~2–3 minutes (BYOS)**

---

## Feature 3: Agent Builder

Design your agents visually at **[missiondeck.ai/agent-builder](https://missiondeck.ai/agent-builder)**

- Define agent name, emoji, role, personality, capabilities, greeting
- Build multi-agent teams with one lead and multiple specialists
- Save teams to your account
- Deploy directly from the builder with one click
- Teams auto-generate `SOUL.md` and `IDENTITY.md` for each agent

---

## Feature 4: mc CLI — Cloud Mode

The `mc` CLI auto-detects your MissionDeck connection and switches between local and cloud mode:

```bash
mc status           # Shows: local (localhost:3000) or cloud (missiondeck.ai)
mc tasks            # Works in both modes
mc task:status ID DONE
mc deliver ID "Report" --path ./report.md
mc squad            # All agents — from cloud or local
mc notify "message" # Sends to your connected Telegram
```

**How auto-detection works:** if `.missiondeck` config file exists, `mc` hits `missiondeck.ai/api` instead of `localhost:3000`. No flags needed.

---

## API Reference

### Base URLs

| Environment | Base URL |
|-------------|----------|
| Cloud API | `https://missiondeck.ai/api` |
| Distribution | `https://missiondeck.ai/api/distribution` |

### Check Current Version

```bash
curl -H "x-api-key: YOUR_KEY" \
  https://missiondeck.ai/api/distribution/version
```

```json
{
  "version": "1.0.0",
  "releasedAt": "2026-02-18T00:00:00Z",
  "changelog": "https://missiondeck.ai/changelog"
}
```

### Download Latest Version

```bash
curl -H "x-api-key: YOUR_KEY" \
  https://missiondeck.ai/api/distribution/download/latest \
  -o mission-control-latest.zip
```

### Sync Tasks to Cloud

```bash
curl -X POST \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  https://missiondeck.ai/api/mc/sync \
  -d '{"tasks": [...], "agents": [...]}'
```

---

## Auto-Update Routine

```bash
# Check for updates
./scripts/check-updates.sh

# Apply update safely (backs up first)
./scripts/safe-deploy.sh --pull
```

Add to your weekly heartbeat:

```markdown
## Weekly (Monday)
- [ ] Run ./scripts/check-updates.sh
- [ ] If update available, notify human for approval before applying
```

---

## Pricing & Upgrades

| Plan | Price | Deployments | VM Specs |
|------|-------|-------------|----------|
| **Free** | $0 | 1 active | 4GB RAM, 4 cores |
| **Starter** | $20/mo | 5 active | 8GB RAM, 4 cores |
| **Pro** | $99/mo | Unlimited | 16GB RAM, 8 cores |

Upgrade at **[missiondeck.ai/dashboard](https://missiondeck.ai/dashboard)** → Subscription.

BYOS (Bring Your Own Server) deployments are available on all plans — use your own hardware on the free tier with no VM cost.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | API key invalid or expired — regenerate at missiondeck.ai/auth |
| Sync not updating | Check `server/missiondeck-sync.js` is running |
| BYOS connection failed | Verify IP, port 22 is open, credentials correct |
| Deployment stuck | Check deployment logs at missiondeck.ai/dashboard |
| mc CLI in wrong mode | Run `mc status` — check which URL it's hitting |

---

## See Also

- **[missiondeck.ai](https://missiondeck.ai)** — Platform home
- **[missiondeck.ai/deploy](https://missiondeck.ai/deploy)** — Deploy an agent
- **[missiondeck.ai/agent-builder](https://missiondeck.ai/agent-builder)** — Build your team
- **[missiondeck.ai/changelog](https://missiondeck.ai/changelog)** — What's new
- [Deployment Skill](deployment.md) — Self-hosting options
- [Setup Skill](setup.md) — First-time setup
