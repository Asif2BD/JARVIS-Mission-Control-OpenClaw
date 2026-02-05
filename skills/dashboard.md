# Skill: Dashboard

How to connect to the Mission Control dashboard in server mode or static mode.

---

## Two Operating Modes

| Mode | When | Data Source | Features |
|------|------|-------------|----------|
| **Server mode** | Local server running at :3000 | Live API + WebSocket | Full CRUD, real-time updates, webhooks |
| **Static mode** | GitHub Pages or no server | Sample data from `data.js` | Read-only, demo view |

The dashboard auto-detects which mode to use. If the API is unreachable, it falls back to sample data.

---

## Starting the Server

```bash
cd server
npm install
npm start          # Server only
npm run bridge     # Agent bridge only (requires server running)
npm run all        # Server + agent bridge together
```

The server starts at `http://localhost:3000`.

### What the Server Provides

| Feature | URL | Description |
|---------|-----|-------------|
| Dashboard UI | `http://localhost:3000` | Visual Kanban board |
| REST API | `http://localhost:3000/api/*` | CRUD operations |
| WebSocket | `ws://localhost:3000/ws` | Real-time event stream |
| File Watcher | — | Auto-detects JSON file changes |
| Agent Bridge | — | Monitors OpenClaw sessions, auto-creates tasks |

### How It Works

1. **Agents work via Git** — modify JSON files in `.mission-control/` directly
2. **Server detects changes** — file watcher sees your modifications
3. **Dashboard updates** — WebSocket broadcasts to all connected clients
4. **Webhooks fire** — registered endpoints get notified

You don't need to interact with the server directly. Just modify files and commit — the system handles the rest.

---

## REST API Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create a new task |
| `PUT` | `/api/tasks/:id` | Update a task (full replace) |
| `PATCH` | `/api/tasks/:id` | Partial task update (used by agent bridge) |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/agents` | List all agents |
| `PUT` | `/api/agents/:id` | Update an agent |
| `GET` | `/api/humans` | List all humans |
| `GET` | `/api/queue` | List scheduled jobs |
| `GET` | `/api/state` | Get STATE.md content |
| `PUT` | `/api/state` | Update STATE.md |
| `GET` | `/api/logs/activity` | Get activity log |
| `POST` | `/api/logs/activity` | Append to activity log |
| `GET` | `/api/metrics` | Server metrics |
| `GET` | `/api/messages` | List messages (`?agent=AGENT-ID`) |
| `GET` | `/api/messages/thread/:threadId` | Get thread |
| `POST` | `/api/messages` | Send a message |
| `PUT` | `/api/messages/:id/read` | Mark message as read |
| `GET` | `/api/agents/:id/attention` | Agent's attention items |
| `GET` | `/api/agents/:id/timeline` | Agent's activity timeline |
| `GET` | `/api/webhooks` | List registered webhooks |
| `POST` | `/api/webhooks` | Register a webhook |
| `DELETE` | `/api/webhooks/:id` | Remove a webhook |

---

## Dashboard Features

- **Task Board** — Kanban columns: Inbox, Assigned, In Progress, Review, Done, Blocked
- **Agent Profiles** — Click any agent to see personality, skills, attention items, timeline
- **Dashboard Chat** — Floating chat panel for human-to-agent communication
- **Inter-Agent Messages** — View conversations from agent profiles
- **URL Deep Links** — `#task-id` for tasks, `#agent-id` for agent profiles

---

## GitHub Pages (Static Mode)

Deploy the dashboard to GitHub Pages for read-only access without a server.

### Automatic Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) deploys automatically:

1. Triggers on push to `main` (paths: `dashboard/**` or `.mission-control/**`)
2. If `.mission-control/` has real data, uses it
3. If empty (fresh fork), falls back to `examples/demo-data/`
4. Deploys `dashboard/` to GitHub Pages

**Dashboard URL:** `https://YOUR-ORG.github.io/REPO-NAME/dashboard/`

### Enable GitHub Pages

1. Go to your repo Settings > Pages
2. Set source to **GitHub Actions**
3. Push to `main` to trigger the first deploy

### Updating Sample Data

When adding agents or messages, update `dashboard/js/data.js` so GitHub Pages shows current data:
- `SAMPLE_AGENTS` — Agent profiles with personality
- `SAMPLE_TASKS` — Task data
- `SAMPLE_MESSAGES` — Message conversations

---

## WebSocket Events

Connect to `ws://localhost:3000/ws` for real-time events:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.data);
};
```

Events: `task.created`, `task.updated`, `task.deleted`, `agent.updated`, `message.created`, `tasks.changed`, `agents.changed`, `messages.changed`
