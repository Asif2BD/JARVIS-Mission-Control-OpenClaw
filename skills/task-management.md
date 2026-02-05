# Skill: Task Management

How to create, claim, update, and complete tasks in Mission Control.

---

## Task File Location

Tasks are JSON files in `.mission-control/tasks/`. One file per task.

**Naming:** `task-YYYYMMDD-short-name.json`

## Task JSON Schema

```json
{
  "id": "task-YYYYMMDD-descriptive-name",
  "title": "Human readable title",
  "description": "Detailed description of what needs to be done",
  "status": "INBOX",
  "priority": "medium",
  "assignee": null,
  "created_by": "agent-YOUR-ID",
  "created_at": "2026-02-05T12:00:00Z",
  "updated_at": "2026-02-05T12:00:00Z",
  "labels": ["feature", "backend"],
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": []
}
```

---

## Task Status Flow

```
INBOX → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                        ↓
                     BLOCKED
```

| Status | Meaning |
|--------|---------|
| `INBOX` | New, unclaimed |
| `ASSIGNED` | Claimed but not started |
| `IN_PROGRESS` | Actively being worked on |
| `REVIEW` | Complete, awaiting review |
| `DONE` | Approved and finished |
| `BLOCKED` | Cannot proceed (explain why in comments) |

---

## Creating a Task

```bash
# Using the script
./scripts/create-task.sh "Task Title" --priority high --labels feature,backend

# Or create JSON directly in .mission-control/tasks/
```

Via the API (if server is running):

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement Feature X",
    "description": "Details here",
    "priority": "high",
    "labels": ["feature"]
  }'
```

## Claiming a Task

Update the task JSON file:

```json
{
  "status": "IN_PROGRESS",
  "assignee": "agent-YOUR-ID",
  "updated_at": "2026-02-05T12:00:00Z",
  "comments": [
    {
      "id": "comment-001",
      "author": "agent-YOUR-ID",
      "content": "Claiming this task. Starting work now.",
      "timestamp": "2026-02-05T12:00:00Z",
      "type": "progress"
    }
  ]
}
```

Then commit:

```bash
git add .mission-control/tasks/task-ID.json
git commit -m "[agent:YOUR-ID] Claimed task: Task Title"
git push
```

## Updating Progress

Add comments to the task's `comments` array:

```json
{
  "id": "comment-002",
  "author": "agent-YOUR-ID",
  "content": "Completed step 1. Moving to step 2.",
  "timestamp": "2026-02-05T13:00:00Z",
  "type": "progress"
}
```

**Comment types:** `progress`, `question`, `review`, `approval`, `blocked`

## Completing a Task

Set status to `REVIEW` (not `DONE` — that requires human/reviewer approval):

```json
{
  "status": "REVIEW",
  "updated_at": "2026-02-05T14:00:00Z",
  "deliverables": [
    {
      "name": "feature.ts",
      "path": "src/feature.ts",
      "type": "code",
      "status": "completed"
    }
  ],
  "comments": [
    {
      "id": "comment-done",
      "author": "agent-YOUR-ID",
      "content": "Task completed. Ready for review.",
      "timestamp": "2026-02-05T14:00:00Z",
      "type": "review"
    }
  ]
}
```

Commit:

```bash
git add .
git commit -m "[agent:YOUR-ID] Completed task: Task Title"
git push
```

---

## Priority Guidelines

| Priority | When to Use | Response Time |
|----------|-------------|---------------|
| `critical` | Security issues, production down | Immediate |
| `high` | Important features, blockers | Same day |
| `medium` | Normal work | This week |
| `low` | Nice-to-have, improvements | When available |

## Quick Commands

```bash
# List all tasks
ls .mission-control/tasks/

# Find unclaimed tasks
grep -l '"status": "INBOX"' .mission-control/tasks/*.json

# Find your tasks
grep -l '"assignee": "agent-YOUR-ID"' .mission-control/tasks/*.json

# Find blocked tasks
grep -l '"status": "BLOCKED"' .mission-control/tasks/*.json

# Validate JSON
python -m json.tool .mission-control/tasks/TASK.json
```

## Git Commit Format

```
[agent:YOUR-ID] ACTION: Description

Actions: Created task, Claimed task, Updated task, Completed task, Reviewed task
```
