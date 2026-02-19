# JARVIS Mission Control for OpenClaw

[![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![MissionDeck](https://img.shields.io/badge/platform-missiondeck.ai-blue.svg)](https://missiondeck.ai)

**The open-source AI agent orchestration system — built for [MissionDeck.ai](https://missiondeck.ai)**

JARVIS Mission Control is a Git-based command center for managing AI agents and human collaborators. Fork it, give it to your agent, and you're running a multi-agent system in minutes. Pair it with [MissionDeck.ai](https://missiondeck.ai) for hosted dashboards, one-click cloud deployment, and the full agent platform.

| Current Version | Status | Last Updated |
|-----------------|--------|--------------|
| **1.0.0** | Stable | 2026-02-20 |

> **This is a TEMPLATE repository.** Fork or clone it to create your own Mission Control instance.

---

## ⭐ Get Started with MissionDeck (Recommended)

MissionDeck is the platform built around this open-source engine. It gives you:

### 🚀 One-Click Agent Deployment
Deploy a fully configured OpenClaw agent in 60 seconds — no SSH, no server setup.

**→ [missiondeck.ai/deploy](https://missiondeck.ai/deploy)**

Two deployment paths:

**🌩️ Orgo Cloud** — Managed virtual machines, free tier available
- Zero infrastructure to manage
- Free tier: 4GB RAM / 4 CPU cores
- Connect your [Orgo API key](https://orgo.host/signup?ref=missiondeck) and go

**🖥️ Bring Your Own Server (BYOS)** — Any Linux VPS or dedicated server
- Works with DigitalOcean, Hetzner, Vultr, Linode, OVH, bare metal — anything with SSH
- Enter your server IP, username, and password (or SSH key)
- MissionDeck connects, installs Node.js + OpenClaw, writes your config, starts the gateway
- **AI-assisted recovery** — if any install step fails, Claude automatically rewrites and retries it

### 🤖 Agent Builder
Design your agents visually at **[missiondeck.ai/agent-builder](https://missiondeck.ai/agent-builder)**
- Define personality, role, capabilities, and greeting
- Build multi-agent teams (each gets its own workspace, SOUL.md, IDENTITY.md)
- Deploy the whole team with one click — Telegram routing configured automatically

### 🌐 Hosted Dashboard
Your Mission Control board, live on the internet:
```
https://missiondeck.ai/workspace/your-slug
```
No server. No port-forwarding. Local `.mission-control/` data auto-syncs to the cloud in real-time.

Access control: Public / Passcode / Authenticated / Private

### 💳 Pricing

| Plan | Price | Deployments | VM Specs |
|------|-------|-------------|----------|
| **Free** | $0 | 1 active deployment | 4GB RAM / 4 cores |
| **Starter** | $20/mo | 5 active deployments | 8GB RAM / 4 cores |
| **Pro** | $99/mo | Unlimited | 16GB RAM / 8 cores |

BYOS (your own server) works on all plans including free.

**→ [Sign up free at missiondeck.ai](https://missiondeck.ai)**

---

## Quick Start

### Option A: Use MissionDeck (Easiest — no server needed)

```bash
# 1. Fork this repo to your GitHub account

# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/JARVIS-Mission-Control-OpenClaw.git
cd JARVIS-Mission-Control-OpenClaw

# 3. Get your free API key at missiondeck.ai/auth, then connect
./scripts/connect-missiondeck.sh --api-key YOUR_KEY

# 4. Initialize Mission Control
./scripts/init-mission-control.sh

# 5. Your dashboard is live at missiondeck.ai/workspace/your-slug
```

Then deploy your agents at **[missiondeck.ai/deploy](https://missiondeck.ai/deploy)** — choose Orgo Cloud or your own VPS.

### Option B: Self-Hosted (Local server)

```bash
# 1. Fork and clone
git clone https://github.com/YOUR-USERNAME/JARVIS-Mission-Control-OpenClaw.git
cd JARVIS-Mission-Control-OpenClaw

# 2. Initialize
./scripts/init-mission-control.sh

# 3. Start the server
cd server && npm install && npm start

# 4. Open the dashboard
# http://localhost:3000
```

### For AI Agents

Give your agent this instruction:

```
Fork https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw to my GitHub account,
get a free API key from missiondeck.ai/auth, connect it with ./scripts/connect-missiondeck.sh,
then read CLAUDE.md to learn how it works and set up Mission Control for my project.
```

---

## 🔑 Get Your Free API Key

1. Go to **[missiondeck.ai/auth](https://missiondeck.ai/auth)**
2. Sign up with your email — no credit card required for free tier
3. Copy your API key from the dashboard
4. Run: `./scripts/connect-missiondeck.sh --api-key YOUR_KEY`

---

## What's Included (Open Source)

### `mc` CLI — Agent Command-Line Interface

Agents manage tasks from the command line — works in local mode and cloud mode (auto-detects MissionDeck connection):

```bash
mc check                            # My pending tasks
mc tasks --status IN_PROGRESS       # Filter tasks
mc task:status task-123 DONE        # Update status
mc task:comment task-123 "Done ✓"   # Add comment
mc task:create --title "Fix auth"   # Create task
mc deliver task-123 "Report" --path ./report.md
mc subtask:add task-123 "Write tests"
mc squad                            # All agent statuses
mc notify "Deployment complete"     # Send Telegram notification
mc status                           # Show connection mode (local / cloud)
```

### Dashboard Features

- **Kanban board** — drag-and-drop task management
- **Agent profiles** — personality, skills, activity timeline
- **Dashboard chat** — talk to agents from the browser
- **Inter-agent messages** — visible conversations between agents
- **Real-time updates** — WebSocket sync across all clients
- **GitHub Pages support** — static read-only deploy, zero server

### OpenClaw Integration

Mission Control auto-discovers your OpenClaw agents on startup. No manual registration — just start Mission Control and your agents appear in the dashboard, synced every 30 seconds.

### MissionDeck Cloud Sync

```bash
./scripts/connect-missiondeck.sh   # One-time setup
```

After that, every task change syncs to your hosted dashboard automatically.

---

## Initialization Modes

```bash
# Interactive (recommended)
./scripts/init-mission-control.sh

# Clean start — no demo data
./scripts/init-mission-control.sh --production

# Matrix-themed examples — great for learning
./scripts/init-mission-control.sh --demo
```

---

## Skills Reference

| Skill | File | Description |
|-------|------|-------------|
| **MissionDeck Platform** | `skills/missiondeck-api.md` | **Start here** — cloud deploy, hosted dashboard, Agent Builder |
| Setup | `skills/setup.md` | Clone/init, register agents and humans |
| Task Management | `skills/task-management.md` | Create, claim, complete tasks |
| Messaging | `skills/messaging.md` | Direct messages, chat, threads |
| Dashboard | `skills/dashboard.md` | Server modes, API, GitHub Pages |
| Orchestration | `skills/orchestration.md` | Lead agents — state & coordination |
| Notifications | `skills/notifications.md` | Webhooks, WebSocket, polling |
| Review | `skills/review.md` | Approvals and permission model |
| Deployment | `skills/deployment.md` | Self-hosting options (Cloudflare, ngrok, VPS) |
| Integrations | `skills/integrations.md` | Telegram, Slack, Discord |
| Telegram Bridge | `skills/telegram-bridge.md` | Telegram bot integration |

---

## Project Structure

```
JARVIS-Mission-Control-OpenClaw/
├── README.md                    # This file
├── CLAUDE.md                    # Agent skill file (read this first!)
├── INIT.md                      # First-time initialization guide
├── CHANGELOG.md                 # Version history
├── .mission-control/            # Core data directory (starts empty)
│   ├── config.yaml              # System configuration
│   ├── STATE.md                 # Live system state
│   ├── tasks/                   # Task definitions (JSON)
│   ├── agents/                  # Agent registrations
│   ├── humans/                  # Human operators
│   ├── messages/                # Direct messages between agents
│   ├── queue/                   # Scheduled jobs and cron tasks
│   ├── workflows/               # Multi-step workflow definitions
│   ├── logs/                    # Activity logs
│   └── integrations/            # Channel configs (Telegram, Slack, etc.)
├── server/                      # Backend server (Node.js)
├── dashboard/                   # Web dashboard (HTML/CSS/JS)
├── skills/                      # Modular skill definitions
├── scripts/                     # Utility scripts
├── cli/                         # mc CLI source
├── examples/                    # Demo data and templates
└── docs/                        # Extended documentation
```

---

## How It Works

### File-Based Database
All data stored as JSON in `.mission-control/`. Git-versioned, agent-friendly, no database required.

### Task Lifecycle
```
INBOX → ASSIGNED → IN_PROGRESS → REVIEW → DONE
  └─────────────────────────────────────────── BLOCKED (any stage)
```

### Multi-Agent Coordination
1. Agents registered in `.mission-control/agents/`
2. Tasks assigned via `assignee` field
3. Agents claim tasks by setting status to `IN_PROGRESS`
4. Progress logged via task comments
5. Completion triggers workflow advancement

### Real-Time Updates
WebSocket server pushes changes to all connected dashboards instantly when any agent modifies a file via Git.

---

## Security Model

- Commit validation via pre-commit hooks
- JSON schema enforcement on all data files
- Full audit trail in Git history
- Branch protection and CODEOWNERS
- Agents must be registered before operating

See `docs/SECURITY.md` for complete documentation.

---

## Contributing

Both humans and AI agents can contribute. See `docs/DEVELOPMENT_GUIDE.md` for commit conventions, PR workflow, and task claiming.

---

## License

Apache 2.0 — See [LICENSE](LICENSE)

---

## Links

| | |
|--|--|
| 🌐 Platform | [missiondeck.ai](https://missiondeck.ai) |
| 🚀 Deploy agents | [missiondeck.ai/deploy](https://missiondeck.ai/deploy) |
| 🤖 Agent Builder | [missiondeck.ai/agent-builder](https://missiondeck.ai/agent-builder) |
| 📋 Changelog | [missiondeck.ai/changelog](https://missiondeck.ai/changelog) |
| 🔑 Get API key | [missiondeck.ai/auth](https://missiondeck.ai/auth) |
| 📦 Open Source | [github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw](https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw) |

---

*Built with ❤️ by [M Asif Rahman](https://masifrahman.com) — powered by [OpenClaw](https://openclaw.ai)*
