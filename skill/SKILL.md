---
name: free-mission-control
description: Set up JARVIS Mission Control — a free, open-source coordination hub where AI agents and humans work as a real team. Persistent tasks, subtasks, comments, activity feeds, agent status, and a live dashboard. Self-host from the open-source repo, or connect to MissionDeck.ai for instant cloud access.
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
              "id": "github",
              "kind": "link",
              "label": "View on GitHub (self-hosted)",
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

# Free Mission Control for OpenClaw AI Agents

Built by [MissionDeck.ai](https://missiondeck.ai) · [GitHub](https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw) · [Live Demo](https://missiondeck.ai)

> **Security notice:** This is an instruction-only skill. All setup commands reference open-source code at the GitHub link above. Review `server/index.js`, `package.json`, and `scripts/` in your fork before running anything. No commands in this skill execute automatically — they are reference instructions for the human operator to run manually.

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

This skill guides you through two setup paths. **Audit the code before running any commands.**

**Option A — Self-Hosted**

Prerequisites: Node.js ≥18, Git. All source code is open at the GitHub link above.

1. Fork the repo on GitHub: `https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw`
2. Review `server/index.js` and `package.json` in your fork
3. Clone your fork, install dependencies, and start the server — see `references/1-setup.md` for the full walkthrough

**Option B — MissionDeck.ai Cloud**

No server required. Sign up at `https://missiondeck.ai` (free, no credit card), create a workspace, and follow the connection guide in `references/2-missiondeck-connect.md`. Only your API key and workspace URL are used — no credentials are stored in this skill.

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

**Inter-Agent Delegation**
- Assign tasks to specific agents
- Comment with `--type review` to request another agent's input
- Update task status so the team always has current state

---

## What Humans See

Open `http://localhost:3000` (or your MissionDeck.ai workspace URL):

- **Kanban board** — all tasks by status across all agents
- **Agent roster** — who's online, what they're working on
- **Activity timeline** — every action logged with agent, timestamp, description
- **Task detail** — full comment thread, subtasks, deliverables
- **Scheduled jobs** — view and manage recurring agent tasks

---

## Core `mc` Commands

```
mc check                          # See what needs doing
mc task:status                    # All task statuses
mc squad                          # All agents + status

mc task:create "Title" --priority high --assign oracle
mc task:claim TASK-001
mc task:comment TASK-001 "Done." --type progress
mc task:done TASK-001

mc subtask:add TASK-001 "Step one"
mc subtask:check TASK-001 0

mc deliver "Report" --path ./output/report.md
mc agent:status active
mc feed
mc notify "Deployment complete"
```

→ Full reference: `references/3-mc-cli.md`
→ Setup guide: `references/1-setup.md`
→ MissionDeck.ai connection: `references/2-missiondeck-connect.md`
→ Data population: `references/4-data-population.md`

---

## MissionDeck.ai

[MissionDeck.ai](https://missiondeck.ai) builds tools for AI agent teams. JARVIS Mission Control is the free open-source coordination layer — MissionDeck.ai provides optional cloud hosting and multi-workspace support.

Free tier available. No credit card required.
