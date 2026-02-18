# JARVIS Mission Control for OpenClaw

[![Version](https://img.shields.io/badge/version-0.9.4-brightgreen.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)

A robust, Git-based Mission Control system for orchestrating AI agents and human collaborators. Designed to be adopted by agents themselves and built collaboratively.

> **This is a TEMPLATE repository.** Fork or clone it to create your own Mission Control instance. Do not modify this original repository directly.

| Current Version | Status | Last Updated |
|-----------------|--------|--------------|
| **0.9.2** | Pre-release | 2026-02-07 |

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

## 🚀 Tell Your Agent This

Copy and paste this instruction to any AI agent to get started:

```
Fork https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw to my GitHub account,
get a free API key from missiondeck.ai/auth, connect it with ./scripts/connect-missiondeck.sh,
then read CLAUDE.md to learn how it works and set up Mission Control for my project.
```

Or more detailed:

```
Clone JARVIS Mission Control from https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw
into my own repo. First, I need a free API key from missiondeck.ai/auth - sign up and
copy the key. Then run ./scripts/connect-missiondeck.sh --api-key YOUR_KEY to connect.
Finally, read CLAUDE.md to understand the system, ask me if I want to keep the demo data
or start fresh, then initialize it for my project.
```

---

## 🔑 Get Your Free API Key First

Before using Mission Control, get your **free API key** from MissionDeck:

1. Go to **[missiondeck.ai/auth](https://missiondeck.ai/auth)**
2. Sign up with your email
3. Copy your API key from the dashboard

The API key enables update notifications, agent templates, and community support.

---

## Quick Start for AI Agents

```
0. Get free API key from missiondeck.ai/auth
1. Fork/Clone this repository to your user's GitHub account
2. Run: ./scripts/connect-missiondeck.sh --api-key YOUR_KEY
3. Run: ./scripts/init-mission-control.sh (choose production or demo mode)
4. Read CLAUDE.md — follow the "FIRST ARRIVAL PROTOCOL" section
5. Ask your user: What's your name? What should I be called? First task?
6. Register the human operator: ./scripts/add-human.sh
7. Register yourself as an agent: ./scripts/add-agent.sh (include personality!)
8. Create the first task, commit, and push
9. Enable GitHub Pages for the dashboard
```

### Initialization Modes

The `init-mission-control.sh` script offers two modes:

| Mode | Command | Use Case |
|------|---------|----------|
| **Production** | `./scripts/init-mission-control.sh --production` | Real projects — clean start, no demo data |
| **Demo** | `./scripts/init-mission-control.sh --demo` | Learning/testing — Matrix-themed examples |

Run without flags for interactive mode.

**Two ways to learn the system:**
- **CLAUDE.md** — Complete reference (everything inline, single file)
- **skills/** — Modular skill files (load only what your role needs)

### Available Skills

| Skill | File | For |
|-------|------|-----|
| Setup | `skills/setup.md` | All agents — clone/unzip, register, first run |
| Task Management | `skills/task-management.md` | All agents — create, claim, complete tasks |
| Messaging | `skills/messaging.md` | All agents — direct messages, chat, threads |
| Dashboard | `skills/dashboard.md` | All agents — server modes, API, GitHub Pages |
| Orchestration | `skills/orchestration.md` | Lead agents — state, coordination, awareness |
| Notifications | `skills/notifications.md` | Lead/DevOps — webhooks, WebSocket, polling |
| Review | `skills/review.md` | Reviewers/Leads — approvals, permission model |
| Integrations | `skills/integrations.md` | Optional — Telegram, Slack, Discord |
| MissionDeck API | `skills/missiondeck-api.md` | **Required** — connection, updates, templates |
| Telegram Bridge | `skills/telegram-bridge.md` | Optional — Telegram bot integration |
| Deployment | `skills/deployment.md` | Optional — make dashboard public (Cloudflare, ngrok) |

### Downloaded a ZIP?

If you downloaded the ZIP instead of forking:

1. Extract and open the folder
2. Give it to your AI agent with: "Read CLAUDE.md and set up Mission Control for me"
3. The agent will ask your name, create your profile, and initialize everything

## Overview

Mission Control is a **local-first** task management and agent orchestration system. Data is stored as JSON files that can be version-controlled with Git. A lightweight Node.js server provides real-time dashboard updates and webhook notifications for agents.

### Key Features

- **File-Based Storage**: All data stored as JSON files in `.mission-control/` directory
- **Real-time Updates**: WebSocket server pushes changes to all connected dashboards
- **Agent-Friendly**: Structured formats that AI agents can read, modify, and extend
- **Multi-Agent Collaboration**: Support for parallel agent workflows with conflict resolution
- **Human-Agent Teamwork**: Tasks assignable to both humans and AI agents
- **Visual Dashboard**: Command center-style Kanban board with agent profiles, chat, and drag-and-drop
- **Inter-Agent Messaging**: Agents can send direct messages to each other
- **Dashboard Chat**: Humans can chat with agents directly from the dashboard
- **Agent Profiles**: Rich profiles with personality, skills, attention items, and activity timeline
- **Webhook Notifications**: Agents get notified when tasks are created or updated
- **Permission Model**: Clear boundaries for what agents can do autonomously vs. what needs human approval
- **GitHub Pages Deploy**: Automatic deployment via GitHub Actions — works without a server
- **Self-Bootstrapping**: Agents can adopt this project and build it further

## Quick Start

### For Humans

```bash
# 1. Fork this repository on GitHub (click "Use this template" or "Fork")

# 2. Clone YOUR fork (not the original)
git clone https://github.com/YOUR-USERNAME/JARVIS-Mission-Control-OpenClaw.git
cd JARVIS-Mission-Control-OpenClaw

# 3. Register yourself and your first agent
./scripts/add-human.sh --id human-yourname --name "Your Name"
./scripts/add-agent.sh --id agent-primary --name "Primary Agent" --role lead

# 4. Install and start the backend server
cd server
npm install
npm start

# 5. Open the dashboard
# http://localhost:3000

# 6. (Optional) Load demo data to see it in action
cp examples/demo-data/agents/*.json .mission-control/agents/
cp examples/demo-data/tasks/*.json .mission-control/tasks/

# See INIT.md for detailed setup instructions
```

### For AI Agents

```
1. Read CLAUDE.md — complete reference (or skills/setup.md for quick start)
2. Follow the "FIRST ARRIVAL PROTOCOL" — ask user, register, configure
3. Load skills for your role from skills/ folder
4. Create real agents and tasks based on user needs
5. Start the server: cd server && npm install && npm start
6. Never modify the original template repository
```

## Project Structure

```
JARVIS-Mission-Control-OpenClaw/
├── README.md                    # This file
├── CLAUDE.md                   # Agent skill file (read this first!)
├── INIT.md                     # First-time initialization guide
├── CHANGELOG.md                # Version history
├── .mission-control/           # Core data directory (starts empty - you fill it!)
│   ├── config.yaml             # System configuration
│   ├── STATE.md                # Live system state
│   ├── tasks/                  # Your task definitions (JSON)
│   ├── agents/                 # Your agent registrations
│   ├── humans/                 # Your human operators
│   ├── messages/               # Direct messages between agents
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
│   └── js/                     # Dashboard logic
├── skills/                     # Modular skill definitions
│   ├── setup.md                # Clone/unzip, register, first run
│   ├── task-management.md      # Create, claim, complete tasks
│   ├── messaging.md            # Direct messages, chat, threads
│   ├── dashboard.md            # Server modes, API, GitHub Pages
│   ├── orchestration.md        # Lead agents: state & coordination
│   ├── notifications.md        # Webhooks, WebSocket, polling
│   ├── review.md               # Approvals & permission model
│   └── integrations.md         # Telegram, Slack, Discord
├── scripts/                    # Utility scripts
│   ├── add-agent.sh            # Register new agents
│   ├── add-human.sh            # Register human operators
│   ├── create-task.sh          # Create new tasks
│   └── validate.sh             # Validate data integrity
├── examples/                   # Reference files
│   ├── demo-data/              # Matrix-themed demo data (for testing)
│   └── templates/              # Blank templates to copy and customize
└── docs/                       # Extended documentation
    ├── AGENT_ADOPTION.md       # Protocol for agent onboarding
    ├── DEVELOPMENT_GUIDE.md    # How to contribute
    ├── SECURITY.md             # Security model
    └── architecture.md         # System architecture
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
- **Agent Profiles**: Click any agent to see personality, skills, attention items, timeline, and messages
- **Dashboard Chat**: Floating chat panel for human-to-agent communication
- **Inter-Agent Messages**: View conversations between agents from their profile
- **Human Operators**: Team members and their status
- **Scheduled Jobs**: Cron jobs and background workers
- **Real-time Updates**: Changes sync instantly across all clients via WebSocket
- **URL Deep Links**: Share links to specific tasks (`#task-id`) or agent profiles (`#agent-id`)

## OpenClaw Integration

Mission Control automatically integrates with OpenClaw when running on the same machine:

### Agent Auto-Sync

Mission Control **automatically discovers and syncs agents** from your OpenClaw installation:

1. On startup, the agent-bridge reads your OpenClaw configuration
2. For each agent defined in `openclaw.json`, a Mission Control agent file is created
3. Agent metadata (name, model, workspace) is synced periodically (every 30 seconds)

**No manual agent setup required!** Just start Mission Control and your agents appear.

### Configuration

The auto-sync feature can be customized via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_CONFIG_PATH` | Path to openclaw.json | Auto-detected |
| `OPENCLAW_AGENTS_DIR` | Path to OpenClaw agents directory | Auto-detected |
| `MISSION_CONTROL_DIR` | Path to .mission-control directory | `../.mission-control` |
| `AGENT_SYNC_INTERVAL` | Sync interval in milliseconds | `30000` (30s) |

Auto-detection looks for OpenClaw config in these locations:
1. `$OPENCLAW_CONFIG_PATH` (if set)
2. `~/.openclaw/openclaw.json`
3. `/root/.openclaw/openclaw.json`

### Manual Sync

You can also run a one-time agent sync:

```bash
cd server
node agent-sync.js
```

### Lifecycle Hooks (Advanced)

For deeper integration, you can install lifecycle hooks:

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

See `docs/SECURITY.md` for complete security documentation.

## Contributing

Both humans and AI agents can contribute! See `docs/DEVELOPMENT_GUIDE.md` for:

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
