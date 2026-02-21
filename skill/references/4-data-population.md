# Data Population Guide

Mission Control stores all data as JSON files in `.mission-control/`. On first run the directory is empty. This guide covers how to populate it correctly.

---

## Directory Structure

```
.mission-control/
├── tasks/          ← one JSON file per task (TASK-001.json, etc.)
├── agents.json     ← agent registry
├── humans.json     ← human team members (optional)
├── queue/          ← scheduled jobs
├── messages/       ← inter-agent messages
└── logs/
    └── activity.log
```

---

## Step 1: Register Agents

Edit `.mission-control/agents.json` (create it if it doesn't exist):

```json
[
  {
    "id": "oracle",
    "name": "The Oracle",
    "role": "orchestrator",
    "status": "active",
    "channels": ["telegram"],
    "capabilities": ["planning", "delegation", "analysis"],
    "current_tasks": []
  },
  {
    "id": "tank",
    "name": "Tank",
    "role": "developer",
    "status": "active",
    "channels": ["telegram"],
    "capabilities": ["coding", "deployment", "debugging"],
    "current_tasks": []
  }
]
```

Or via CLI after server is running:
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"oracle","name":"The Oracle","role":"orchestrator","status":"active"}'
```

---

## Step 2: Create Initial Tasks

```bash
# Via mc CLI
mc task:create "Set up infrastructure" --priority high --assign oracle
mc task:create "Write initial documentation" --priority medium --assign tank

# Via API
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"First task","priority":"high","assignee":"oracle","status":"todo"}'
```

---

## Task JSON Schema

```json
{
  "id": "TASK-001",
  "title": "Task title",
  "description": "Optional longer description",
  "status": "todo | in_progress | review | done | blocked",
  "priority": "critical | high | medium | low",
  "assignee": "agent-id",
  "labels": ["backend", "urgent"],
  "subtasks": [
    { "title": "Step 1", "completed": false },
    { "title": "Step 2", "completed": true }
  ],
  "comments": [
    {
      "id": "c1",
      "author": "oracle",
      "content": "Started work",
      "type": "progress",
      "timestamp": "2026-02-21T06:00:00Z"
    }
  ],
  "deliverables": [],
  "created_at": "2026-02-21T06:00:00Z",
  "updated_at": "2026-02-21T06:00:00Z"
}
```

---

## Step 3: Verify Data

```bash
# List all tasks
mc task:status

# See all agents
mc squad

# Check activity log
mc feed
```

Dashboard (if running locally): `http://localhost:3000`

---

## Bulk Import

To migrate existing tasks from another system, write JSON files directly to `.mission-control/tasks/`:

```bash
# Each file = one task
echo '{"id":"TASK-001","title":"Migrated task","status":"todo","priority":"medium"}' \
  > .mission-control/tasks/TASK-001.json
```

The server reads files on demand — no restart needed.

---

## Resetting Data

```bash
# Clear all tasks (keeps agent config)
rm .mission-control/tasks/*.json

# Full reset
rm -rf .mission-control/
# Restart server to recreate directory structure
```
