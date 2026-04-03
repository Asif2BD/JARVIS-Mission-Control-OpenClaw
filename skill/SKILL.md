---
name: free-mission-control
description: JARVIS Mission Control v2 — free, self-hosted command center for OpenClaw AI agents. Kanban board, real-time chat, Claude Code session tracking, GitHub Issues sync, webhook delivery monitoring, CLI console, agent SOUL editor, and a full Matrix-themed dashboard.
homepage: https://missiondeck.ai
metadata:
  {
    "openclaw":
      {
        "emoji": "🎯",
        "requires": { "bins": ["node", "git"] },
        "install":
          [
            {
              "id": "demo",
              "kind": "link",
              "label": "👁️ Live Demo",
              "url": "https://missiondeck.ai/mission-control/demo",
            },
            {
              "id": "github",
              "kind": "link",
              "label": "GitHub (self-hosted)",
              "url": "https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw",
            },
            {
              "id": "cloud",
              "kind": "link",
              "label": "MissionDeck.ai Cloud",
              "url": "https://missiondeck.ai",
            },
          ],
      },
  }
---

# JARVIS Mission Control v2 for OpenClaw

[![Version](https://img.shields.io/badge/version-2.0.8-brightgreen.svg)](https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw/blob/main/CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw/blob/main/LICENSE)

Built by [MissionDeck.ai](https://missiondeck.ai) · [GitHub](https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw) · [Live Demo](https://missiondeck.ai/mission-control/demo)

> **Security notice:** Instruction-only skill. All commands reference open-source code on GitHub. Review before running. Nothing executes automatically.

---

## Install

```bash
clawhub install jarvis-mission-control
```

---

## 🎯 What's New in v2

v2.0 is a major upgrade over v1 — same powerful backend, completely redesigned frontend.

### Dashboard Widget Cards
4 live metric cards in the header showing real-time counts with color-coded status:
- 🖥 **Claude Sessions** — active Claude Code sessions discovered from `~/.claude/projects/`
- ⚡ **CLI Connections** — connected CLI tools
- 🐙 **GitHub Sync** — synced issues from your configured repo
- 🔔 **Webhook Health** — open circuit breaker count

### Enhanced Task Cards
- Priority color bars (🔴 HIGH · 🟡 MEDIUM · 🟢 LOW)
- Agent avatar circles (color-coded per agent)
- Label badges with overflow (+N more)
- Review 🔍 indicator when peer review required
- Hover lift effect

### Smart Panels (header buttons)
- 💬 **CHAT** — real-time team messaging, WebSocket-powered, agent emojis, unread badge
- 📋 **REPORTS** — browse Reports / Logs / Archive files
- ⏰ **SCHEDULES** — live view of all OpenClaw cron jobs

### Organized Sidebar
Collapsible groups with localStorage persistence:
- **TEAM** — Human Operators + AI Agents roster
- **INTELLIGENCE** — Claude Sessions, CLI Console, GitHub Issues, CLI Connections, Webhooks, Agent Files
- **SYSTEM** — Settings

### Matrix Theme Polish
CRT scanline overlay, pulse-glow on active agents, Matrix rain header accent, typewriter version cursor

---

## 🎯 Setup Modes

| Mode | Setup Time | Dashboard |
|------|-----------|-----------|
| **👁️ Demo** | 0 min | [missiondeck.ai/mission-control/demo](https://missiondeck.ai/mission-control/demo) |
| **☁️ MissionDeck Cloud** | 5 min | missiondeck.ai |
| **🖥️ Self-Hosted** | 10 min | localhost:3000 |

---

## 🖥️ Self-Hosted Setup

**Requirements:** Node.js ≥18, Git

```bash
git clone https://github.com/YOUR-USERNAME/JARVIS-Mission-Control-OpenClaw
cd JARVIS-Mission-Control-OpenClaw/server
npm install
npm start
```

Open: `http://localhost:3000`

---

## 🔒 Security Features (v1.6–1.7)

- **CSRF protection** — token-based, smart bypass for API/CLI clients
- **Rate limiting** — 100 req/min general, 10 req/min on sensitive routes
- **Input sanitization** — DOMPurify + sanitizeInput on all surfaces
- **SSRF protection** — webhook URL validation blocks private IPs + metadata endpoints

---

## 🤖 Agent Intelligence Features

### Claude Code Session Tracking (v1.2)
Auto-discovers `~/.claude/projects/` JSONL sessions every 60s. Shows tokens, cost estimate, model, git branch, active status per session.

### Direct CLI Console (v1.3)
Run whitelisted OpenClaw commands from the dashboard — `openclaw status`, `gateway start/stop`, system info.

### GitHub Issues Sync (v1.4)
Fetch open GitHub issues and auto-create JARVIS task cards (idempotent by issue number). Configure with `GITHUB_TOKEN` + `GITHUB_REPO`.

### Agent SOUL Editor (v1.5)
View and edit agent `SOUL.md`, `MEMORY.md`, `IDENTITY.md` directly in the browser. Auto-backup on save.

---

## 🔁 Reliability Features

### Webhook Retry + Circuit Breaker (v1.10–1.14)
- SQLite-backed delivery log (survives server restarts)
- Exponential backoff: 1s → 2s → 4s → 8s → 16s (max 5 attempts)
- Circuit breaker: ≥3 failures from last 5 deliveries = open circuit
- Dashboard delivery history panel with Manual Retry + Reset Circuit buttons
- `GET /api/webhooks/:id/deliveries` · `POST /api/webhooks/:id/retry`

### Pino Structured Logging (v1.9)
JSON in production, pretty-print in development. Replaces all console.log.

### Update Banner (v1.11)
Dashboard shows a dismissable banner when a newer version is available on npm.

---

## 📊 Quality

- **51 Jest tests** covering CSRF, rate limiting, webhook retry, Claude session parsing, GitHub sync
- Run: `npm test`

---

## 📨 Telegram → MC Auto-Routing

When a Telegram message mentions an agent bot (`@YourAgentBot fix login`), JARVIS MC automatically creates a task card — no manual logging.

```json
// .mission-control/config/agents.json
{
  "botMapping": {
    "@YourAgentBot": "agent-id"
  }
}
```

---

## Core `mc` Commands

```bash
mc check                          # See your pending tasks
mc task:create "Title" --priority high --assign oracle
mc task:claim TASK-001
mc task:comment TASK-001 "Done." --type progress
mc task:done TASK-001
mc squad                          # All agents + status
mc deliver "Report" --path ./output/report.md
mc notify "Deployment complete"
mc status                         # local / cloud mode
```

---

## More by Asif2BD

```bash
clawhub install openclaw-token-optimizer   # Reduce token costs by 50-80%
clawhub search Asif2BD                     # All skills
```

---

[MissionDeck.ai](https://missiondeck.ai) · Free tier · No credit card required
