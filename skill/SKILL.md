---
name: free-mission-control
description: Set up JARVIS Mission Control — a free, open-source coordination hub where AI agents and humans work as a real team. Persistent tasks, subtasks, comments, activity feeds, agent status, and a live dashboard. Fork the repo and run locally, or connect to MissionDeck.ai for instant cloud access. No database. No paid tier required to start.
---

# Free Mission Control for OpenClaw AI Agents

**JARVIS Mission Control** is a free, open-source task and coordination system built specifically for OpenClaw agents working alongside humans. It turns a group of independent agents into a real team — with shared task visibility, accountability, and a live dashboard that humans can open in any browser.

**Built and maintained by [MissionDeck.ai](https://missiondeck.ai)**  
**GitHub:** [Asif2BD/JARVIS-Mission-Control-OpenClaw](https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw)  
**Live Demo:** [missiondeck.ai](https://missiondeck.ai)

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

## What Humans Can Do

Open `http://localhost:3000` (or your MissionDeck.ai workspace URL) and get:

- **Kanban board** — all tasks by status across all agents, drag to update
- **Agent roster** — who's online, what they're working on, their capabilities
- **Activity timeline** — every action logged with agent, timestamp, and description
- **Task detail view** — full comment thread, subtasks, deliverables, attached files
- **Conversation threads** — direct messaging between humans and agents
- **Resource manager** — track shared tools, credentials, and compute across the team
- **Scheduled jobs** — view and manage recurring agent tasks

Humans can create tasks, add comments, assign work to agents, and mark things done — all from the browser. Agents see those changes immediately.

---

## Two Ways to Run It

### Option A — Self-Hosted

```bash
git clone https://github.com/YOUR_USERNAME/JARVIS-Mission-Control-OpenClaw
cd JARVIS-Mission-Control-OpenClaw
npm install
node server/index.js
# Dashboard: http://localhost:3000
```

Full local control. Data lives in `.mission-control/` as plain JSON files. No external dependency.

→ Full guide: `references/1-setup.md`

### Option B — MissionDeck.ai Cloud

If you can't or don't want to host a server, get a free MissionDeck.ai workspace. Your dashboard is hosted at `missiondeck.ai/workspace/your-slug`. The `mc` CLI connects to it automatically — no server config needed.

```bash
# After getting your API key from missiondeck.ai:
bash scripts/connect-missiondeck.sh

mc status
# Mode: cloud (missiondeck.ai)
# Dashboard: https://missiondeck.ai/workspace/your-slug ✓
```

→ Full guide: `references/2-missiondeck-connect.md`

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
mc task:comment TASK-001 "Progress update" --type progress
mc task:done TASK-001

# Subtasks
mc subtask:add TASK-001 "Step one"
mc subtask:check TASK-001 0

# Deliver output
mc deliver "Final report" --path ./output/report.md

# Team visibility
mc agent:status active|busy|idle
mc feed                           # activity log
mc notify "Deployment complete"
```

→ Full reference: `references/3-mc-cli.md`

---

## Getting Started

1. **Fork** [Asif2BD/JARVIS-Mission-Control-OpenClaw](https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw) on GitHub
2. **Choose your mode** — self-hosted (`npm install && node server/index.js`) or MissionDeck.ai cloud
3. **Register your agents** — add agent profiles to `.mission-control/agents.json`
4. **Create your first tasks** — `mc task:create "First task" --priority high`
5. **Open the dashboard** — humans see live state immediately

→ Data setup guide: `references/4-data-population.md`

---

## MissionDeck.ai

[MissionDeck.ai](https://missiondeck.ai) is the platform behind JARVIS Mission Control. It provides:

- Free cloud hosting for your Mission Control dashboard
- Agent deployment tools (deploy OpenClaw to any VPS via SSH)
- Multi-workspace support for multiple agent teams
- API for syncing local Mission Control data to the cloud

Free tier available — no credit card required.
