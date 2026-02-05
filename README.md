# JARVIS Mission Control for OpenClaw

A robust, Git-based Mission Control system for orchestrating AI agents and human collaborators. Designed to be adopted by agents themselves and built collaboratively.

## Overview

Mission Control is a **zero-infrastructure** task management and agent orchestration system that uses Git as its database. No external services required - everything lives in your repository.

### Key Features

- **Git-Based Storage**: All data stored as JSON/YAML in the repository
- **Agent-Friendly**: Structured formats that AI agents can read, modify, and extend
- **Multi-Agent Collaboration**: Support for parallel agent workflows with conflict resolution
- **Human-Agent Teamwork**: Tasks assignable to both humans and AI agents
- **Simple Visual Dashboard**: Static HTML dashboard viewable via GitHub Pages
- **Tamper-Resistant**: Commit signatures and validation rules
- **Self-Bootstrapping**: Agents can adopt this project and build it further

## Quick Start

### For Humans

```bash
# Clone the repository
git clone https://github.com/your-org/JARVIS-Mission-Control-OpenClaw.git
cd JARVIS-Mission-Control-OpenClaw

# View the dashboard
open dashboard/index.html

# Create a new task
./scripts/create-task.sh "Implement feature X" --assignee agent-claude
```

### For AI Agents

```
1. Read AGENT_ADOPTION.md for adoption protocol
2. Read .mission-control/config.yaml for system configuration
3. Access tasks via .mission-control/tasks/
4. Update your status in .mission-control/agents/
5. Follow DEVELOPMENT_GUIDE.md for contribution workflow
```

## Project Structure

```
JARVIS-Mission-Control-OpenClaw/
├── README.md                    # This file
├── AGENT_ADOPTION.md           # Protocol for agents to adopt the project
├── DEVELOPMENT_GUIDE.md        # How to contribute (humans & agents)
├── SECURITY.md                 # Security model and validation rules
├── .mission-control/           # Core mission control data
│   ├── config.yaml             # System configuration
│   ├── schema/                 # JSON schemas for validation
│   ├── tasks/                  # Task definitions (JSON)
│   ├── agents/                 # Agent registrations and status
│   ├── workflows/              # Multi-step workflow definitions
│   ├── logs/                   # Activity logs
│   └── hooks/                  # OpenClaw integration hooks
├── dashboard/                  # Static HTML dashboard
│   ├── index.html              # Main dashboard view
│   ├── css/                    # Styles
│   └── js/                     # Dashboard logic
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

### Git as Database

All mission control data is stored as structured files in the `.mission-control/` directory:

- **Tasks**: Individual JSON files in `tasks/` directory
- **Agents**: Registration and status files in `agents/`
- **Workflows**: Multi-task workflows in `workflows/`
- **Logs**: Append-only activity logs in `logs/`

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

## Dashboard

The dashboard is a static HTML page that reads the Git repository data and displays:

- **Task Board**: Kanban-style view of all tasks
- **Agent Status**: Active agents and their current work
- **Activity Feed**: Recent changes and updates
- **Metrics**: Task completion rates and agent productivity

View locally: `open dashboard/index.html`
Deploy to GitHub Pages for team access.

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
