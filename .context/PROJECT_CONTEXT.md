# JARVIS Mission Control - Project Context

> **Read this file first** when starting work on this project. It contains all the context an AI agent needs to understand and continue development.

---

## Project Overview

**JARVIS Mission Control** is a local-first task management and multi-agent orchestration system. It enables humans and AI agents to collaborate on tasks using a file-based approach.

### Core Philosophy

1. **File-Based Database** - JSON files ARE the database. No external DB needed.
2. **Git as Sync** - Agents work via Git, humans use the dashboard
3. **Real-time Updates** - WebSocket pushes changes to all connected clients
4. **Webhook Notifications** - Agents register webhooks to get notified of task changes

---

## Current Version

**v0.7.0** (2026-02-05)

See [CHANGELOG.md](../CHANGELOG.md) for full version history.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        HUMANS                                │
│                    (Web Dashboard)                           │
│                  http://localhost:3000                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    NODE.JS SERVER                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  REST API   │ │  WebSocket  │ │  File Watcher       │   │
│  │  /api/*     │ │  /ws        │ │  (chokidar)         │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              WEBHOOK SYSTEM                          │   │
│  │  POST /api/webhooks to register                      │   │
│  │  Triggers on: task.created, task.updated, etc.       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   .mission-control/                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ tasks/   │ │ agents/  │ │ humans/  │ │ queue/   │       │
│  │ *.json   │ │ *.json   │ │ *.json   │ │ *.json   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ logs/    │ │ STATE.md │ │config.yaml│                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI AGENTS                               │
│                   (Work via Git)                             │
│  1. Clone repo                                               │
│  2. Edit JSON files in .mission-control/                     │
│  3. Commit and push                                          │
│  4. Server detects changes, broadcasts via WebSocket         │
│  5. Webhooks notify other agents                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | **Primary agent instructions** - Read this for how to work |
| `README.md` | Project overview for humans |
| `CHANGELOG.md` | Version history |
| `server/index.js` | Backend server (Express + WebSocket + File Watcher) |
| `dashboard/index.html` | Main dashboard UI |
| `dashboard/js/app.js` | Dashboard logic |
| `dashboard/js/api.js` | API client for dashboard |
| `dashboard/js/data.js` | Data management |
| `dashboard/css/styles.css` | Matrix-style dark theme |

---

## API Endpoints

Server runs at `http://localhost:3000`

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/agents` | List agents |
| PUT | `/api/agents/:id` | Update agent |
| GET | `/api/humans` | List humans |
| GET | `/api/queue` | List scheduled jobs |
| GET | `/api/webhooks` | List webhooks |
| **POST** | **`/api/webhooks`** | **Register webhook** |
| DELETE | `/api/webhooks/:id` | Remove webhook |
| GET | `/api/state` | Get STATE.md |
| PUT | `/api/state` | Update STATE.md |
| GET | `/api/logs/activity` | Get activity log |
| POST | `/api/logs/activity` | Append to log |
| GET | `/api/metrics` | Server metrics |

### WebSocket

Connect to `ws://localhost:3000/ws` for real-time events.

### Webhook Events

| Event | When Triggered |
|-------|----------------|
| `task.created` | New task created |
| `task.updated` | Task modified |
| `task.deleted` | Task removed |
| `agent.updated` | Agent changed |
| `*` | All events |

---

## Design Decisions Made

### 1. Local File-Based Over GitHub API
- **Decision**: Use local JSON files instead of GitHub API
- **Reason**: Simpler architecture, no external dependencies, works offline
- **Date**: 2026-02-05

### 2. WebSocket for Real-time
- **Decision**: WebSocket for dashboard updates instead of polling
- **Reason**: Instant updates, lower server load
- **Date**: 2026-02-05

### 3. Webhooks for Agent Notifications
- **Decision**: Agents must register webhooks to receive notifications
- **Reason**: Agents need to know when tasks are assigned to them
- **Date**: 2026-02-05

### 4. Matrix Dark Theme as Default
- **Decision**: Dark "command center" theme with Orbitron/Rajdhani fonts
- **Reason**: User preference, fits the JARVIS aesthetic
- **Date**: 2026-02-05

### 5. Semantic Versioning
- **Decision**: Use semver (MAJOR.MINOR.PATCH)
- **Reason**: Clear version tracking, professional release management
- **Date**: 2026-02-05

### 6. URL Routing for Tasks
- **Decision**: Each task has shareable URL (#task-id)
- **Reason**: Deep linking, bookmarking, sharing specific tasks
- **Date**: 2026-02-05

---

## Recent Changes (v0.7.0)

1. **URL Routing** - Tasks have shareable URLs
2. **Human Operators UI** - Horizontal compact layout
3. **Jobs Section** - Better styling with status indicators
4. **Versioning System** - CHANGELOG.md added
5. **Version Badges** - README shows version

---

## Known Issues / TODO

- [ ] Telegram/WhatsApp integration not yet implemented
- [ ] Human notification channels need webhook integration
- [ ] Task comments need real-time sync
- [ ] Mobile responsive improvements needed

---

## How to Continue Development

1. **Read CLAUDE.md** - Full agent instructions
2. **Start server**: `cd server && npm install && npm start`
3. **Open dashboard**: http://localhost:3000
4. **Check git status**: Make sure you're on the right branch
5. **Update CHANGELOG.md** when making changes
6. **Bump version** in package.json, index.html, README.md

---

## Human Operators

| Name | Role | Status |
|------|------|--------|
| Asif | Admin | Active |
| Nobin | Reviewer | Active |
| Jewel | Observer | Active |
| Cipher | Admin | Active |
| Tony | Specialist | Active |

---

## Agent Identities (Matrix Theme)

| Agent ID | Name | Role |
|----------|------|------|
| agent-architect | The Architect | Lead |
| agent-morpheus | Morpheus | Lead |
| agent-neo | Neo | Specialist |
| agent-trinity | Trinity | Specialist |
| agent-oracle | The Oracle | Reviewer |

---

## Commands Reference

```bash
# Start development
cd server && npm install && npm start

# Check status
git status
git log --oneline -5

# Create task via API
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Task", "description": "...", "priority": "medium"}'

# Register webhook
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"id": "agent-neo", "url": "http://localhost:8080/webhook", "events": ["task.created", "task.updated"]}'

# Check webhooks
curl http://localhost:3000/api/webhooks
```

---

## File Structure

```
JARVIS-Mission-Control-OpenClaw/
├── .context/                    # AI context files (THIS DIRECTORY)
│   └── PROJECT_CONTEXT.md       # This file
├── .mission-control/            # Data directory (JSON database)
│   ├── tasks/*.json
│   ├── agents/*.json
│   ├── humans/*.json
│   ├── queue/*.json
│   ├── logs/
│   └── STATE.md
├── server/                      # Backend
│   ├── package.json
│   └── index.js
├── dashboard/                   # Frontend
│   ├── index.html
│   ├── css/styles.css
│   └── js/
├── CLAUDE.md                    # Agent instructions
├── README.md                    # Project overview
└── CHANGELOG.md                 # Version history
```

---

*Last updated: 2026-02-05 by Claude (v0.7.0)*
