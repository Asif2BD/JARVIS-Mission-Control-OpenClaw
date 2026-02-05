# Agent Session Bridge

The Agent Session Bridge connects OpenClaw agent sessions to Mission Control, providing **real-time visibility** into what each agent is doing.

## Features

1. **Auto-Task Creation** - When Oracle delegates via `sessions_spawn`, a task automatically appears in Mission Control
2. **Real-Time Agent Status** - Dashboard shows which agent is idle/working/blocked  
3. **Activity Feed** - Agent progress, tool usage, and completions stream to the activity log
4. **WebSocket Broadcast** - Real-time updates pushed to the dashboard

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   OpenClaw Agents   │     │   Mission Control    │
│  /root/.openclaw/   │     │   Dashboard/API      │
│  agents/{agent}/    │     │                      │
│  sessions/*.jsonl   │────▶│  • REST API          │
└─────────────────────┘     │  • WebSocket (/ws)   │
         │                  │  • Activity Log      │
         │ monitors         └──────────────────────┘
         ▼                           ▲
┌─────────────────────┐              │
│   Agent Bridge      │──────────────┘
│   agent-bridge.js   │   pushes updates
└─────────────────────┘
```

## How It Works

### Session Detection

The bridge monitors these directories:
- `/root/.openclaw/agents/main/sessions/`
- `/root/.openclaw/agents/tank/sessions/`
- `/root/.openclaw/agents/shuri/sessions/`
- `/root/.openclaw/agents/keymaker/sessions/`

It reads `sessions.json` to detect new sessions and parses `*.jsonl` files for activity.

### Task Creation Logic

When a **subagent session** is detected (spawned via `sessions_spawn`):

1. Extracts the initial prompt from the session JSONL
2. Looks for an existing `Task ID:` reference in the prompt
3. If found, links session to existing task (updates status to IN_PROGRESS)
4. If not found, creates a new task with:
   - Title from session label or prompt (first 100 chars)
   - Priority inferred from keywords (critical/high/medium/low)
   - Agent assigned automatically
   - Labels: `openclaw`, `auto-generated`, `{agent-name}`

### Activity Streaming

The bridge logs these events to Mission Control:
- `SESSION_START` - Agent started working
- `SESSION_END` - Agent finished (completed/error)
- `TOOL_USE` - Agent used a tool
- `PROGRESS` - Significant assistant messages
- `TOOL_ERROR` - Tool execution failed
- `TASK_COMPLETE` - Task moved to REVIEW
- `TASK_BLOCKED` - Task blocked due to error

### Status Updates

Agent status is automatically updated:
- **busy** - Agent has an active session
- **idle** - No active sessions

Task status transitions:
- New session → Task created as `IN_PROGRESS`
- Session completes normally → Task moves to `REVIEW`
- Session errors → Task moves to `BLOCKED`

## Running the Bridge

### Quick Start

```bash
cd /root/.openclaw/workspace/agents/tank/mission-control/server

# Run bridge alone (requires MC server to be running)
npm run bridge

# Run everything (server + bridge)
npm run all
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_AGENTS_DIR` | `/root/.openclaw/agents` | Where OpenClaw stores agent sessions |
| `MISSION_CONTROL_DIR` | `../.mission-control` | Mission Control data directory |
| `MC_SERVER_URL` | `http://localhost:3000` | URL of the MC server API |
| `POLL_INTERVAL` | `2000` | Milliseconds between session scans |

### Production Deployment

For production, run the bridge as a background service:

```bash
# Using pm2
pm2 start agent-bridge.js --name "mc-bridge"

# Using systemd (create /etc/systemd/system/mc-bridge.service)
[Unit]
Description=JARVIS Mission Control Agent Bridge
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/.openclaw/workspace/agents/tank/mission-control/server
ExecStart=/usr/bin/node agent-bridge.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Integration with The Oracle

When The Oracle uses `sessions_spawn` to delegate tasks:

1. The spawn creates a new session under `/root/.openclaw/agents/{agent}/sessions/`
2. The bridge detects this within 2 seconds
3. A task is auto-created in Mission Control with the agent assigned
4. The dashboard updates in real-time
5. When the agent completes, the task moves to REVIEW

### Tips for Better Task Tracking

Include a `Task ID:` in your spawn prompts for explicit linking:

```
sessions_spawn("tank", "Task ID: task-20260205-implement-api. Please implement the API endpoint...")
```

Use priority keywords in prompts:
- "CRITICAL" / "URGENT" → critical priority
- "high priority" / "important" → high priority
- "when you have time" → low priority

## Troubleshooting

### Bridge not detecting sessions

1. Check the agents directory exists: `ls /root/.openclaw/agents/`
2. Verify sessions.json is being updated: `cat /root/.openclaw/agents/tank/sessions/sessions.json`
3. Check bridge logs for errors

### Tasks not appearing

1. Ensure MC server is running: `curl http://localhost:3000/api/metrics`
2. Check activity log: `tail -f .mission-control/logs/activity.log`
3. Verify WebSocket connection count in metrics

### Sessions marked as stale prematurely

Adjust the stale threshold in `agent-bridge.js`:
```javascript
const staleThreshold = 10 * 60 * 1000; // 10 minutes instead of 5
```

## API Additions

The bridge uses existing MC API endpoints:
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task status
- `PUT /api/agents/:id` - Update agent status
- `POST /api/logs/activity` - Log activity

All updates are broadcast via WebSocket (`ws://localhost:3000/ws`).
