# 📐 MC Rules — Task Schemas, Entities, Permissions, API Patterns

> Load this when working with the Mission Control data layer.

---

## Task JSON Schema

```json
{
  "id": "task-YYYYMMDD-descriptive-name",
  "title": "Human readable title",
  "description": "Detailed description",
  "status": "INBOX|ASSIGNED|IN_PROGRESS|REVIEW|DONE|BLOCKED",
  "priority": "critical|high|medium|low",
  "assignee": "agent-id or null",
  "created_by": "agent-id",
  "created_at": "2026-02-05T12:00:00Z",
  "updated_at": "2026-02-05T12:00:00Z",
  "labels": ["label1", "label2"],
  "comments": [],
  "deliverables": [],
  "dependencies": ["task-id-1"],
  "blocked_by": []
}
```

### Task Status Flow

```
INBOX → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                        ↓
                     BLOCKED
```

| Status | Meaning |
|--------|---------|
| INBOX | New, unclaimed |
| ASSIGNED | Claimed but not started |
| IN_PROGRESS | Actively being worked on |
| REVIEW | Complete, awaiting review |
| DONE | Approved and finished |
| BLOCKED | Cannot proceed — explain why in a comment |

### Claiming a Task

Update the task JSON file:
```json
{
  "status": "IN_PROGRESS",
  "assignee": "agent-YOUR-ID",
  "updated_at": "ISO-TIMESTAMP",
  "comments": [
    {
      "id": "comment-UNIQUE-ID",
      "author": "agent-YOUR-ID",
      "content": "Claiming this task. Starting work now.",
      "timestamp": "ISO-TIMESTAMP",
      "type": "progress"
    }
  ]
}
```

### Comment Types

`progress` | `question` | `review` | `approval` | `blocked`

### Priority Guidelines

| Priority | Use When | Response Time |
|----------|----------|---------------|
| `critical` | Security issues, production down | Immediate |
| `high` | Important features, blockers | Same day |
| `medium` | Normal work | This week |
| `low` | Nice-to-have | When available |

---

## Entity Types

### Human Operator
```json
{
  "id": "human-admin",
  "name": "Project Owner",
  "type": "human",
  "role": "admin",
  "email": "owner@example.com",
  "status": "online",
  "capabilities": ["all", "override", "approve"]
}
```
Roles: `admin` | `reviewer` | `observer`

### AI Agent
```json
{
  "id": "agent-neo",
  "name": "Neo",
  "type": "ai",
  "role": "specialist",
  "model": "claude-opus-4",
  "status": "active",
  "parent_agent": null,
  "sub_agents": [],
  "capabilities": ["coding", "debugging"],
  "personality": {
    "about": "...",
    "tone": "focused",
    "traits": ["analytical", "detail-oriented"],
    "greeting": "Ready to work."
  }
}
```
Roles: `lead` | `specialist` | `reviewer` | `observer`
Clearance: `OMEGA` (full) | `ALPHA` (high) | `BETA` (standard) | `ORACLE` (advisory)

### Sub-Agent
Same structure as Agent but with `"role": "sub-agent"` and `"parent_agent": "agent-neo"`.

---

## Permission Model

### Agents Can Do Autonomously

- Claim INBOX tasks matching their capabilities
- Add comments to assigned tasks
- Move tasks to IN_PROGRESS / REVIEW
- Send direct messages to other agents
- Update own agent profile
- Log activity
- Create sub-tasks under assigned tasks

### Requires Human Permission (STOP and ask)

| Action | Why |
|--------|-----|
| Delete any task | Destructive |
| Move task directly to DONE | Requires human/reviewer approval |
| Change task priority to `critical` | Human judgment required |
| Register new agents | Resource allocation |
| Modify `.mission-control/config.yaml` | System-wide settings |
| Push to `main` | Production deployment |
| Modify dashboard code | UI changes need approval |
| Access external APIs/webhooks | Security boundary |

**When in doubt, ask. Always.**

---

## REST API Quick Reference

Server: `http://localhost:3000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/:id` | Update task (full replace) |
| PATCH | `/api/tasks/:id` | Partial update |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/agents` | List agents |
| PUT | `/api/agents/:id` | Update agent |
| GET | `/api/messages` | List messages (`?agent=ID`) |
| POST | `/api/messages` | Send a message |
| PUT | `/api/messages/:id/read` | Mark read |
| GET | `/api/state` | Read STATE.md |
| PUT | `/api/state` | Update STATE.md |
| POST | `/api/logs/activity` | Append to activity log |
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Register webhook |
| DELETE | `/api/webhooks/:id` | Remove webhook |

WebSocket: `ws://localhost:3000/ws`

---

## Webhook Setup (Agents Must Do This)

```bash
# Register your webhook listener
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "agent-YOUR-ID",
    "url": "http://YOUR-HOST:PORT/webhook",
    "events": ["task.created", "task.updated", "task.assigned"]
  }'

# Verify registration
curl http://localhost:3000/api/webhooks
```

### Webhook Payload Format
```json
{
  "event": "task.updated",
  "timestamp": "2026-02-05T12:00:00Z",
  "data": { ...full task object... }
}
```

### Key Events
`task.created` | `task.updated` | `task.deleted` | `agent.updated` | `message.created` | `system.heartbeat`

---

## Messaging Schema

```json
{
  "id": "msg-YYYYMMDD-001",
  "from": "agent-neo",
  "to": "agent-trinity",
  "content": "Message text (supports @mentions)",
  "timestamp": "2026-02-05T12:00:00Z",
  "thread_id": "thread-neo-trinity",
  "read": false,
  "type": "direct"
}
```

Types: `direct` (agent-to-agent) | `chat` (dashboard visible to humans)

Thread naming: `thread-AGENT1-AGENT2` | `thread-AGENT1-AGENT2-TOPIC` | `chat-general`

---

## STATE.md Format

Keep `.mission-control/STATE.md` current (main agent responsibility):

```markdown
# Mission Control State
Last Updated: 2026-02-05T12:00:00Z
Updated By: agent-architect

## Current Status: OPERATIONAL

## Active Alerts
- [ ] Any critical items here

## Task Summary
| Status | Count |
|--------|-------|
| INBOX | 2 |
| IN_PROGRESS | 3 |
| BLOCKED | 0 |

## Agent Status
| Agent | Status | Current Task |
|-------|--------|--------------|
| Tank | busy | Fix dashboard |

## Recent Activity
- 12:00 - Tank claimed fix-dashboard task

## Notes for Next Session
- Any handoff notes here
```

---

## Git Commit Format

```
[agent:YOUR-ID] ACTION: Description
```

Actions: `Created task` | `Claimed task` | `Updated task` | `Completed task` | `Reviewed task`

Examples:
```
[agent:tank] Claimed task: Fix dashboard card opening bug
[agent:tank] Completed task: File download route fix
```
