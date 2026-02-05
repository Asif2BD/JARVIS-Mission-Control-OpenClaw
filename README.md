# JARVIS Mission Control for OpenClaw

[![Version](https://img.shields.io/badge/version-0.7.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)

A robust, Git-based Mission Control system for orchestrating AI agents and human collaborators. Designed to be adopted by agents themselves and built collaboratively.

> **This is a TEMPLATE repository.** Fork or clone it to create your own Mission Control instance. Do not modify this original repository directly.

| Current Version | Status | Last Updated |
|-----------------|--------|--------------|
| **0.7.0** | Pre-release | 2026-02-05 |

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

## 🚀 Tell Your Agent This

Copy and paste this instruction to any AI agent to get started:

```
Fork https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw to my GitHub account,
read CLAUDE.md to learn how it works, and set up Mission Control for my project.
```

Or more detailed:

```
Clone JARVIS Mission Control from https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw
into my own repo, read CLAUDE.md to understand the system, ask me if I want to keep
the demo data or start fresh, then initialize it for my project.
```

---

## Quick Start for AI Agents

```
1. Fork/Clone this repository to your user's GitHub account
2. Read CLAUDE.md (your skill file)
3. Read INIT.md (initialization guide)
4. Ask your user: "Keep demo data or start fresh?"
5. Initialize: Clear demo data, create real agents/tasks
6. Commit and push to user's repository
7. Enable GitHub Pages for dashboard
```

## Overview

Mission Control is a **local-first** task management and agent orchestration system. Data is stored as JSON files that can be version-controlled with Git. A lightweight Node.js server provides real-time dashboard updates and webhook notifications for agents.

### Key Features

- **File-Based Storage**: All data stored as JSON files in `.mission-control/` directory
- **Real-time Updates**: WebSocket server pushes changes to all connected dashboards
- **Agent-Friendly**: Structured formats that AI agents can read, modify, and extend
- **Multi-Agent Collaboration**: Support for parallel agent workflows with conflict resolution
- **Human-Agent Teamwork**: Tasks assignable to both humans and AI agents
- **Visual Dashboard**: Command center-style Kanban board with drag-and-drop
- **Webhook Notifications**: Agents get notified when tasks are created or updated
- **Self-Bootstrapping**: Agents can adopt this project and build it further

## Quick Start

### For Humans

```bash
# 1. Fork this repository on GitHub (click "Use this template" or "Fork")

# 2. Clone YOUR fork (not the original)
git clone https://github.com/YOUR-USERNAME/JARVIS-Mission-Control-OpenClaw.git
cd JARVIS-Mission-Control-OpenClaw

# 3. Install and start the backend server
cd server
npm install
npm start

# 4. Open the dashboard
# http://localhost:3000

# 5. (Optional) Clear demo data and initialize
rm .mission-control/tasks/*.json
rm .mission-control/agents/*.json

# 6. Create your first agent and task
# (see INIT.md for detailed instructions)
```

### For AI Agents

```
1. Read CLAUDE.md - Your skill file (teaches you everything)
2. Read INIT.md - First-time setup guide
3. Ask user: Keep demo data or start fresh?
4. Initialize the Mission Control for this specific project
5. Create real agents and tasks based on user needs
6. Never modify the original template repository
```

## Project Structure

```
JARVIS-Mission-Control-OpenClaw/
├── README.md                    # This file
├── CLAUDE.md                   # Agent skill file (read this first!)
├── INIT.md                     # First-time initialization guide
├── AGENT_ADOPTION.md           # Protocol for agents to adopt the project
├── DEVELOPMENT_GUIDE.md        # How to contribute (humans & agents)
├── SECURITY.md                 # Security model and validation rules
├── .mission-control/           # Core mission control data (JSON database)
│   ├── config.yaml             # System configuration
│   ├── STATE.md                # Live system state
│   ├── tasks/                  # Task definitions (JSON)
│   ├── agents/                 # Agent registrations and status
│   ├── humans/                 # Human operator registrations
│   ├── queue/                  # Scheduled jobs and cron tasks
│   ├── workflows/              # Multi-step workflow definitions
│   ├── logs/                   # Activity logs
│   └── integrations/           # Channel configs (Telegram, Slack, etc.)
├── server/                     # Backend server
│   ├── package.json            # Node.js dependencies
│   └── index.js                # Express + WebSocket server
├── dashboard/                  # Web dashboard
│   ├── index.html              # Main dashboard view
│   ├── css/                    # Styles
│   └── js/                     # Dashboard logic (API client, app)
├── scripts/                    # Utility scripts
│   ├── create-task.sh          # Create new tasks
│   ├── validate.sh             # Validate data integrity
│   └── sync-status.sh          # Sync agent status
└── docs/                       # Extended documentation
    ├── architecture.md         # System architecture
    ├── api-reference.md        # Data format reference
    └── examples/               # Example configurations
```

## How It Works

### File-Based Database

All mission control data is stored as JSON files in the `.mission-control/` directory:

- **Tasks**: Individual JSON files in `tasks/` (one file per task)
- **Agents**: Registration and status files in `agents/`
- **Humans**: Human operator profiles in `humans/`
- **Queue**: Scheduled jobs and cron tasks in `queue/`
- **Logs**: Append-only activity logs in `logs/`

When agents work via Git, they modify these JSON files directly. The server's file watcher detects changes and broadcasts updates to all connected dashboards via WebSocket.

### Task Lifecycle

```
INBOX → ASSIGNED → IN_PROGRESS → REVIEW → DONE
  │         │           │           │        │
  └─────────┴───────────┴───────────┴────────┴── Can move to BLOCKED at any point
```

### Multi-Agent Coordination

1. Agents register in `.mission-control/agents/`
2. Tasks are assigned via `assignee` field
3. Agents claim tasks by updating status to `IN_PROGRESS`
4. Progress is logged in task comments
5. Completion triggers workflow advancement

## Dashboard & Server

The dashboard is powered by a local Node.js backend server that provides:

- **REST API**: CRUD operations for tasks, agents, humans, and queue
- **WebSocket**: Real-time updates pushed to all connected dashboards
- **File Watcher**: Detects when agents modify files via Git
- **Webhooks**: Notify agents of task changes and assignments

### Starting the Server

```bash
cd server
npm install
npm start
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `http://localhost:3000` | Dashboard UI |
| `http://localhost:3000/api` | REST API |
| `ws://localhost:3000/ws` | WebSocket for real-time updates |

### Dashboard Features

- **Task Board**: Kanban-style view with drag-and-drop
- **Agent Status**: Active agents and their current work
- **Human Operators**: Team members and their status
- **Scheduled Jobs**: Cron jobs and background workers
- **Real-time Updates**: Changes sync instantly across all clients

## OpenClaw Integration

Mission Control integrates with OpenClaw through lifecycle hooks:

```bash
# Install hooks
cp -r .mission-control/hooks/* ~/.openclaw/hooks/

# Configure webhook (in ~/.openclaw/config.jsonc)
{
  "hooks": {
    "mission-control": {
      "enabled": true,
      "repo": "path/to/this/repo"
    }
  }
}
```

See `docs/openclaw-integration.md` for detailed setup.

## Security Model

- **Commit Validation**: Pre-commit hooks validate data integrity
- **Schema Enforcement**: All data must match JSON schemas
- **Audit Trail**: All changes tracked in Git history
- **Access Control**: Branch protection and CODEOWNERS
- **Agent Authentication**: Agents must be registered before operating

See `SECURITY.md` for complete security documentation.

## Contributing

Both humans and AI agents can contribute! See `DEVELOPMENT_GUIDE.md` for:

- Code style and formatting
- Commit message conventions
- Pull request workflow
- Task claiming process
- Conflict resolution

## License

Apache 2.0 - See LICENSE file

## Acknowledgments

Inspired by:
- [OpenClaw Mission Control by manish-raana](https://github.com/manish-raana/openclaw-mission-control)
- The OpenClaw community
- Claude and other AI assistants building the future of agent collaboration
