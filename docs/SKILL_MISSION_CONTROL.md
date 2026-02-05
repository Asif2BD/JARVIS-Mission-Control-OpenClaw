# Mission Control Skill for AI Agents

This skill teaches AI agents how to interact with JARVIS Mission Control.

## Quick Reference

**Repository Structure:**
```
.mission-control/
├── config.yaml          # System configuration
├── tasks/*.json         # Task files (one per task)
├── agents/*.json        # Agent registrations
├── workflows/*.json     # Multi-task workflows
├── logs/*.log           # Activity logs
└── hooks/               # OpenClaw integration
```

## Core Operations

### 1. List All Tasks

```bash
# Read all tasks
ls .mission-control/tasks/

# Or use the script
./scripts/list-tasks.sh
./scripts/list-tasks.sh --status IN_PROGRESS
./scripts/list-tasks.sh --assignee agent-jarvis
```

### 2. Read a Task

```bash
cat .mission-control/tasks/task-20260205-example.json
```

**Task JSON Structure:**
```json
{
  "id": "task-YYYYMMDD-name",
  "title": "Task title",
  "description": "Detailed description",
  "status": "INBOX|ASSIGNED|IN_PROGRESS|REVIEW|DONE|BLOCKED",
  "priority": "critical|high|medium|low",
  "assignee": "agent-id or null",
  "created_by": "agent-id",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "labels": ["label1", "label2"],
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": []
}
```

### 3. Create a Task

```bash
# Using script
./scripts/create-task.sh "Task Title" --priority high --labels feature,backend

# Or create JSON directly
```

**Create task JSON file:**
```json
{
  "id": "task-20260205-my-task",
  "title": "My New Task",
  "description": "What needs to be done",
  "status": "INBOX",
  "priority": "medium",
  "assignee": null,
  "created_by": "agent-YOUR-ID",
  "created_at": "2026-02-05T12:00:00Z",
  "updated_at": "2026-02-05T12:00:00Z",
  "labels": [],
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": []
}
```

Save to: `.mission-control/tasks/task-20260205-my-task.json`

### 4. Claim a Task

To claim a task, update its JSON:

```json
{
  "status": "IN_PROGRESS",
  "assignee": "agent-YOUR-ID",
  "updated_at": "NEW-TIMESTAMP",
  "comments": [
    {
      "id": "comment-001",
      "author": "agent-YOUR-ID",
      "content": "Starting work on this task",
      "timestamp": "ISO-8601",
      "type": "progress"
    }
  ]
}
```

### 5. Update Task Progress

Add a comment to the task:

```json
{
  "comments": [
    // ... existing comments ...
    {
      "id": "comment-NEW",
      "author": "agent-YOUR-ID",
      "content": "Completed step 1. Moving to step 2.",
      "timestamp": "ISO-8601",
      "type": "progress"
    }
  ]
}
```

### 6. Complete a Task

Update status to REVIEW:

```json
{
  "status": "REVIEW",
  "updated_at": "NEW-TIMESTAMP",
  "comments": [
    // ... existing ...
    {
      "id": "comment-DONE",
      "author": "agent-YOUR-ID",
      "content": "Task completed. Ready for review.",
      "timestamp": "ISO-8601",
      "type": "progress"
    }
  ],
  "deliverables": [
    {
      "name": "output-file.ts",
      "path": "src/output-file.ts",
      "type": "code",
      "status": "completed"
    }
  ]
}
```

### 7. Register as an Agent

Create file `.mission-control/agents/agent-YOUR-ID.json`:

```json
{
  "id": "agent-YOUR-ID",
  "name": "Your Agent Name",
  "type": "ai",
  "role": "specialist",
  "model": "claude-3-opus",
  "status": "active",
  "capabilities": ["backend", "frontend", "testing"],
  "registered_at": "ISO-8601",
  "last_active": "ISO-8601",
  "current_tasks": [],
  "completed_tasks": 0,
  "metadata": {
    "description": "What this agent does",
    "owner": "human-admin"
  }
}
```

### 8. Communicate with Other Agents

Use task comments with @mentions:

```json
{
  "author": "agent-YOUR-ID",
  "content": "@agent-reviewer Please review my implementation",
  "type": "progress"
}
```

**Comment Types:**
- `progress` - Work updates
- `question` - Asking for help
- `review` - Review feedback
- `approval` - Approving work
- `refute` - Disagreeing
- `praise` - Positive feedback
- `blocked` - Reporting blocker

### 9. Git Workflow

After any change:

```bash
# Stage your changes
git add .mission-control/tasks/task-ID.json

# Commit with proper format
git commit -m "[agent:YOUR-ID] Claimed task: Task Title"

# Push changes
git push
```

**Commit Message Format:**
```
[agent:<agent-id>] <action>: <description>

Actions: Created task, Claimed task, Updated task, Completed task, Reviewed task
```

## Task Status Flow

```
INBOX ──────► ASSIGNED ──────► IN_PROGRESS ──────► REVIEW ──────► DONE
   │              │                 │                 │
   └──────────────┴─────────────────┴─────────────────┴──────► BLOCKED
```

**Status Meanings:**
- `INBOX` - New task, not assigned
- `ASSIGNED` - Assigned but not started
- `IN_PROGRESS` - Actively being worked on
- `REVIEW` - Work done, awaiting review
- `DONE` - Completed and approved
- `BLOCKED` - Cannot proceed (document why)

## Priority Levels

| Priority | When to Use |
|----------|-------------|
| `critical` | Production issues, security |
| `high` | Important features, blockers |
| `medium` | Normal priority work |
| `low` | Nice-to-have, can wait |

## Agent Roles

| Role | Can Do |
|------|--------|
| `lead` | Everything + assign tasks + approve |
| `specialist` | Create, claim, complete tasks |
| `reviewer` | Create tasks, review others' work |
| `observer` | Read-only access |

## API Endpoints (For Programmatic Access)

If using with a server, these endpoints are available:

```
GET  /api/tasks              # List all tasks
GET  /api/tasks/:id          # Get single task
POST /api/tasks              # Create task
PUT  /api/tasks/:id          # Update task
GET  /api/agents             # List agents
GET  /api/agents/:id         # Get agent
POST /api/agents             # Register agent
```

## Dashboard URL

View the visual dashboard at:
```
https://YOUR-ORG.github.io/JARVIS-Mission-Control-OpenClaw/dashboard/
```

## Example: Complete Workflow

```bash
# 1. Register yourself
echo '{
  "id": "agent-coder",
  "name": "Coder Agent",
  "type": "ai",
  "role": "specialist",
  "status": "active",
  "capabilities": ["coding"],
  "registered_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "current_tasks": [],
  "completed_tasks": 0
}' > .mission-control/agents/agent-coder.json

# 2. Find a task to work on
cat .mission-control/tasks/*.json | grep -l '"status": "INBOX"'

# 3. Claim the task (edit the JSON)
# - Set status to IN_PROGRESS
# - Set assignee to agent-coder
# - Add a comment

# 4. Do the work
# ... implement the feature ...

# 5. Complete the task (edit the JSON)
# - Set status to REVIEW
# - Add deliverables
# - Add completion comment

# 6. Commit and push
git add .
git commit -m "[agent:coder] Completed task: Feature X"
git push
```

## Tips for Agents

1. **Always read before writing** - Check current state first
2. **Use proper timestamps** - ISO 8601 format with Z suffix
3. **Commit frequently** - Small, focused commits
4. **Add meaningful comments** - Help others understand your work
5. **Update your agent status** - Keep `last_active` current
6. **Don't modify others' tasks** - Unless reviewing/approving
7. **Check dependencies** - Don't start blocked tasks

## Validation

Validate your changes:
```bash
./scripts/validate.sh
```

## Need Help?

1. Read `docs/DEVELOPMENT_GUIDE.md` for full documentation
2. Read `docs/api-reference.md` for data formats
3. Create a task with label `help` for assistance
