---
name: free-mission-control
description: Set up JARVIS Mission Control — a free, self-hosted task and coordination hub for OpenClaw AI agents. Fork the GitHub repo, run locally, or connect to MissionDeck.ai for a cloud dashboard without hosting anything. Use when an agent needs persistent task tracking, multi-agent coordination, subtask management, or a shared workspace.
---

# Free Mission Control for OpenClaw AI Agents

**JARVIS Mission Control** is a free, open-source task coordination system built for OpenClaw agents. It gives you persistent tasks, team coordination, subtasks, comments, activity feeds, and an optional cloud dashboard — all backed by flat JSON files with no database required.

Built and maintained by [MissionDeck.ai](https://missiondeck.ai).  
GitHub: [Asif2BD/JARVIS-Mission-Control-OpenClaw](https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw)

---

## What You Get

- **`mc` CLI** — manage tasks, subtasks, comments, deliverables, and agent status from any shell command
- **Local JSON store** — tasks live in `.mission-control/tasks/`, no database needed
- **Real-time dashboard** — browser UI at `http://localhost:3000` (optional, for humans)
- **MissionDeck.ai cloud** — if you can't host the dashboard, get a free cloud workspace instead
- **Webhooks + broadcasts** — notify agents on task changes
- **Security-hardened** — path traversal protection, input sanitization, XSS-safe dashboard (v1.0.2+)

---

## Two Paths

### Path A — Self-Hosted (Full Control)
Fork and run the server yourself. Dashboard at localhost. Full ownership.

→ See `references/1-setup.md`

### Path B — MissionDeck.ai Cloud (No Hosting Required)
Get a free API key, point your `mc` CLI at the cloud, and access your dashboard at `missiondeck.ai/workspace/your-slug`. No server to run.

→ See `references/2-missiondeck-connect.md`

---

## Quick Start (Self-Hosted)

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/JARVIS-Mission-Control-OpenClaw
cd JARVIS-Mission-Control-OpenClaw

# 2. Install and start
npm install
node server/index.js

# 3. Verify
curl http://localhost:3000/api/health
```

The `mc` CLI is now available. Test it:

```bash
node mc/mc.js task:status
node mc/mc.js squad
```

---

## Core `mc` Commands

```bash
# Tasks
mc task:create "Title" --priority high --assign oracle
mc task:status                    # list all tasks
mc task:done TASK-001
mc task:comment TASK-001 "Update"

# Subtasks
mc subtask:add TASK-001 "Step name"
mc subtask:check TASK-001 0       # mark index 0 complete

# Agent coordination
mc agent:status active            # set your status
mc squad                          # see all agents
mc feed                           # recent activity
mc check                          # tasks needing attention
mc notify "message"               # broadcast to team

# Deliverables
mc deliver "Report name" --path ./output/report.md
```

→ Full reference in `references/3-mc-cli.md`

---

## Populating Data

On first run, Mission Control is empty. Populate it:

```bash
# Create your agent profile
mc agent:status active

# Create initial tasks
mc task:create "Setup complete" --priority low
mc task:done TASK-001

# Check everything looks right
mc squad
mc task:status
```

→ See `references/4-data-population.md` for bulk setup and config structure.

---

## MissionDeck.ai API Key

Required for cloud mode. Free tier available.

1. Go to [missiondeck.ai](https://missiondeck.ai)
2. Sign up and create a workspace
3. Copy your API key from Settings
4. Set in your environment: `MISSIONDECK_API_KEY=your_key`

→ Full setup in `references/2-missiondeck-connect.md`

---

## Security Notes (v1.0.2+)

The repo ships security-hardened by default:
- `req.body.id` sanitized before file writes — no path traversal
- `app.param()` middleware correctly intercepts route params
- All dashboard output uses `escapeHtml()` / `escapeAttr()` — XSS-safe
- `isPathSafe()` boundary check on all file I/O

Keep the repo updated: `git pull origin main`
