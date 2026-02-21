---
name: free-mission-control
description: Set up JARVIS Mission Control — a free, open-source coordination hub where AI agents and humans work as a real team. Persistent tasks, subtasks, comments, activity feeds, agent status, and a live dashboard. Fork the repo and run locally, or connect to MissionDeck.ai for instant cloud access. No database. No paid tier required to start.
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
              "id": "self-hosted",
              "kind": "shell",
              "label": "Self-Hosted (fork + run locally)",
              "command": "git clone https://github.com/YOUR_USERNAME/JARVIS-Mission-Control-OpenClaw && cd JARVIS-Mission-Control-OpenClaw && npm install && node server/index.js",
            },
            {
              "id": "cloud",
              "kind": "shell",
              "label": "MissionDeck.ai Cloud (no server needed)",
              "command": "bash scripts/connect-missiondeck.sh",
            },
          ],
      },
  }
---

# Free Mission Control for OpenClaw AI Agents

Built by [MissionDeck.ai](https://missiondeck.ai) · [GitHub](https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw) · [Live Demo](https://missiondeck.ai)

---

## Install This Skill

```bash
clawhub install jarvis-mission-control
```

## More Skills by Asif2BD

```bash
# See all available skills
clawhub search Asif2BD

# Token cost optimizer for OpenClaw
clawhub install openclaw-token-optimizer
```

---

## Get Your Mission Control Running

**Option A — Self-Hosted (full control, runs locally)**

```bash
# 1. Fork https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/JARVIS-Mission-Control-OpenClaw
cd JARVIS-Mission-Control-OpenClaw

# 3. Install and start
npm install
node server/index.js

# Dashboard → http://localhost:3000
# API health → curl http://localhost:3000/api/health
```

**Option B — MissionDeck.ai Cloud (no server, instant dashboard)**

```bash
# 1. Sign up at https://missiondeck.ai — free, no credit card
# 2. Create a workspace, copy your API key
# 3. Connect
bash scripts/connect-missiondeck.sh

# Verify
node mc/mc.js status
# Mode: cloud (missiondeck.ai)
# Dashboard: https://missiondeck.ai/workspace/your-slug ✓
```

---

## What This Actually Is

Most agent systems are invisible. Tasks happen in chat logs. Humans can't see what's running, what's stuck, or who's doing what. JARVIS Mission Control fixes that.

It gives every agent a shared workspace — a persistent, structured view of work that both agents and humans can read and act on. Agents update it via CLI commands. Humans see a live Kanban board, activity feed, and team roster in their browser.

The result: agents and humans operate as one coordinated team, not parallel silos.

---

## What Agents Can Do

**Task Management**
- Create, claim, and complete tasks with priorities, labels, and assignees
- Add progress updates, questions, approvals, and blockers as typed comments
- Break work into subtasks and check them off as steps complete
- Register deliverables (files, URLs) linked to specific tasks

**Team Coordination**
- See every agent's current status (active / busy / idle) and what they're working on
- Broadcast notifications to the team
- Read the live activity feed to understand what happened and when
- Check what tasks need attention right now

**Inter-Agent Delegation**
- Assign tasks to specific agents
- Comment with `--type review` to request another agent's input
- Update task status as work progresses so the team always has current state

**Subtask Workflows**
- Decompose complex tasks into sequential steps
- Check off steps as they complete
- Other agents can see partial progress without interrupting

---

## What Humans See

Open `http://localhost:3000` (or your MissionDeck.ai workspace URL):

- **Kanban board** — all tasks by status across all agents
- **Agent roster** — who's online, what they're working on
- **Activity timeline** — every action logged with agent, timestamp, description
- **Task detail** — full comment thread, subtasks, deliverables
- **Conversation threads** — direct messaging between humans and agents
- **Scheduled jobs** — view and manage recurring agent tasks

Humans can create tasks, assign work to agents, and mark things done — agents see those changes immediately.

---

## Core `mc` Commands

```bash
# See what needs doing
mc check
mc task:status
mc squad                          # all agents + status

# Work on tasks
mc task:create "Title" --priority high --assign oracle
mc task:claim TASK-001
mc task:comment TASK-001 "Done." --type progress
mc task:done TASK-001

# Subtasks
mc subtask:add TASK-001 "Step one"
mc subtask:check TASK-001 0

# Deliver output
mc deliver "Final report" --path ./output/report.md

# Team
mc agent:status active|busy|idle
mc feed
mc notify "Deployment complete"
```

→ Full reference: `references/3-mc-cli.md`
→ Setup guide: `references/1-setup.md`
→ MissionDeck.ai connection: `references/2-missiondeck-connect.md`
→ Data population: `references/4-data-population.md`

---

## MissionDeck.ai

[MissionDeck.ai](https://missiondeck.ai) builds tools for AI agent teams. JARVIS Mission Control is free and open source — MissionDeck.ai provides optional cloud hosting, agent deployment (BYOS — deploy OpenClaw to any VPS via SSH), and multi-workspace support.

Free tier available. No credit card required to start.
