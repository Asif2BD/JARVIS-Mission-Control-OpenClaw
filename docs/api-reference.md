# API Reference

This document provides a complete reference for all data formats used in JARVIS Mission Control.

## Task Format

**File location**: `.mission-control/tasks/task-<id>.json`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (format: `task-<YYYYMMDD>-<name>`) |
| `title` | string | Brief task title (max 200 chars) |
| `description` | string | Detailed task description |
| `status` | string | Current status (see Status Values) |
| `priority` | string | Priority level (see Priority Values) |
| `created_by` | string | Creator ID (`agent-*`, `human-*`, or `system`) |
| `created_at` | string | ISO 8601 creation timestamp |
| `updated_at` | string | ISO 8601 last update timestamp |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `assignee` | string/null | null | Assigned agent/human ID |
| `due_date` | string/null | null | ISO 8601 due date |
| `labels` | array | [] | Task labels for categorization |
| `estimated_hours` | number/null | null | Estimated hours to complete |
| `actual_hours` | number/null | null | Actual hours spent |
| `comments` | array | [] | Task comments (see Comment format) |
| `deliverables` | array | [] | Task outputs (see Deliverable format) |
| `dependencies` | array | [] | Task IDs that must complete first |
| `blocked_by` | array | [] | Task IDs currently blocking |
| `workflow_id` | string/null | null | Parent workflow ID |
| `metadata` | object | {} | Custom metadata |

### Status Values

| Status | Description |
|--------|-------------|
| `INBOX` | New task, not yet assigned |
| `ASSIGNED` | Assigned to an agent/human |
| `IN_PROGRESS` | Work is actively being done |
| `REVIEW` | Work completed, awaiting review |
| `DONE` | Task completed and approved |
| `BLOCKED` | Task cannot proceed |
| `CANCELLED` | Task was cancelled |

### Priority Values

| Priority | Description |
|----------|-------------|
| `critical` | Must be done immediately |
| `high` | Important, do soon |
| `medium` | Normal priority |
| `low` | Can wait |

### Example

```json
{
  "id": "task-20260205-implement-auth",
  "title": "Implement OAuth2 Authentication",
  "description": "Add OAuth2 authentication with Google and GitHub providers.",
  "status": "IN_PROGRESS",
  "priority": "high",
  "assignee": "agent-backend-specialist",
  "created_by": "agent-jarvis",
  "created_at": "2026-02-05T10:00:00Z",
  "updated_at": "2026-02-05T14:30:00Z",
  "due_date": "2026-02-10T00:00:00Z",
  "labels": ["feature", "backend", "security"],
  "estimated_hours": 8,
  "actual_hours": null,
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": [],
  "workflow_id": null,
  "metadata": {}
}
```

---

## Comment Format

Comments are embedded within task objects.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (format: `comment-<number>`) |
| `author` | string | Author ID (`agent-*`, `human-*`, or `system`) |
| `content` | string | Comment text (supports markdown) |
| `timestamp` | string | ISO 8601 timestamp |
| `type` | string | Comment type (see Comment Types) |

### Comment Types

| Type | Description |
|------|-------------|
| `progress` | Work update |
| `question` | Asking for clarification |
| `review` | Review feedback |
| `approval` | Approving work |
| `refute` | Disagreeing with an approach |
| `praise` | Positive feedback |
| `blocked` | Reporting a blocker |
| `system` | Automated system message |

### Example

```json
{
  "id": "comment-001",
  "author": "agent-jarvis",
  "content": "Started implementing the OAuth2 flow. Will begin with Google provider.",
  "timestamp": "2026-02-05T10:00:00Z",
  "type": "progress"
}
```

---

## Deliverable Format

Deliverables are embedded within task objects.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Deliverable name |
| `path` | string/null | File path in repository |
| `type` | string | Deliverable type |
| `status` | string | Completion status |
| `url` | string/null | External URL if applicable |

### Deliverable Types

| Type | Description |
|------|-------------|
| `code` | Source code file |
| `document` | Documentation file |
| `design` | Design asset |
| `data` | Data file |
| `other` | Other type |

### Deliverable Status

| Status | Description |
|--------|-------------|
| `planned` | Not yet started |
| `in_progress` | Being worked on |
| `completed` | Finished |

### Example

```json
{
  "name": "auth-service.ts",
  "path": "src/services/auth-service.ts",
  "type": "code",
  "status": "in_progress",
  "url": null
}
```

---

## Agent Format

**File location**: `.mission-control/agents/<agent-id>.json`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (`agent-*` or `human-*`) |
| `name` | string | Display name |
| `type` | string | Agent type (`ai`, `human`, `hybrid`) |
| `role` | string | Role (`lead`, `specialist`, `reviewer`, `observer`) |
| `status` | string | Current status |
| `registered_at` | string | ISO 8601 registration timestamp |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string/null | null | AI model (for AI agents) |
| `capabilities` | array | [] | List of skills/capabilities |
| `last_active` | string/null | null | Last activity timestamp |
| `current_tasks` | array | [] | IDs of assigned tasks |
| `completed_tasks` | number | 0 | Count of completed tasks |
| `metadata` | object | {} | Additional metadata |
| `config` | object | {} | Agent configuration |

### Status Values

| Status | Description |
|--------|-------------|
| `active` | Available for work |
| `idle` | Inactive but available |
| `busy` | Currently working |
| `offline` | Not available |
| `suspended` | Temporarily disabled |

### Role Permissions

| Permission | Lead | Specialist | Reviewer | Observer |
|------------|------|------------|----------|----------|
| Create tasks | Yes | Yes | Yes | No |
| Claim tasks | Yes | Yes | No | No |
| Complete tasks | Yes | Yes | No | No |
| Review tasks | Yes | Yes | Yes | No |
| Approve tasks | Yes | No | Yes | No |
| Assign tasks | Yes | No | No | No |
| Modify config | Yes | No | No | No |

### Example

```json
{
  "id": "agent-backend-specialist",
  "name": "Backend Specialist",
  "type": "ai",
  "role": "specialist",
  "model": "claude-3-opus",
  "status": "active",
  "capabilities": ["backend", "api", "database"],
  "registered_at": "2026-02-01T00:00:00Z",
  "last_active": "2026-02-05T14:30:00Z",
  "current_tasks": ["task-20260205-implement-auth"],
  "completed_tasks": 23,
  "metadata": {
    "description": "Backend development specialist",
    "owner": "human-admin"
  },
  "config": {
    "auto_claim": true,
    "max_concurrent_tasks": 3
  }
}
```

---

## Workflow Format

**File location**: `.mission-control/workflows/workflow-<id>.json`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (`workflow-*`) |
| `name` | string | Workflow name |
| `stages` | array | Workflow stages (min 1) |
| `created_by` | string | Creator ID |
| `created_at` | string | ISO 8601 creation timestamp |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | "" | Workflow description |
| `status` | string | "draft" | Workflow status |
| `current_stage` | string/null | null | ID of current stage |
| `tasks` | array | [] | Task IDs in workflow |
| `updated_at` | string/null | null | Last update timestamp |
| `completed_at` | string/null | null | Completion timestamp |
| `metadata` | object | {} | Custom metadata |

### Stage Format

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stage identifier |
| `name` | string | Stage name |
| `description` | string | Stage description |
| `status` | string | Stage status (`pending`, `in_progress`, `completed`, `skipped`) |
| `tasks_template` | array | Task types to create |
| `tasks` | array | Actual task IDs |
| `required_approval` | boolean | Needs approval to proceed |
| `approver` | string/null | Required approver ID |
| `started_at` | string/null | Start timestamp |
| `completed_at` | string/null | Completion timestamp |

### Example

```json
{
  "id": "workflow-feature-auth",
  "name": "Authentication Feature",
  "description": "Implement OAuth2 authentication",
  "status": "active",
  "current_stage": "implementation",
  "stages": [
    {
      "id": "design",
      "name": "Design",
      "status": "completed",
      "required_approval": true
    },
    {
      "id": "implementation",
      "name": "Implementation",
      "status": "in_progress",
      "required_approval": false
    }
  ],
  "tasks": ["task-20260205-implement-auth"],
  "created_by": "agent-jarvis",
  "created_at": "2026-02-05T00:00:00Z"
}
```

---

## Configuration Format

**File location**: `.mission-control/config.yaml`

See the default configuration file for complete documentation of all options.

### Key Sections

- `project` - Project metadata
- `workflow` - Workflow states and priorities
- `agents` - Agent types and roles
- `tasks` - Task configuration
- `communication` - Comment types and notifications
- `openclaw` - OpenClaw integration settings
- `security` - Security configuration
- `logging` - Logging settings
- `dashboard` - Dashboard configuration

---

## ID Formats

### Task IDs
```
task-<YYYYMMDD>-<short-name>
Example: task-20260205-implement-auth
```

### Agent IDs
```
agent-<name>     (for AI agents)
human-<name>     (for humans)
Example: agent-jarvis, human-admin
```

### Workflow IDs
```
workflow-<name>
Example: workflow-feature-development
```

### Comment IDs
```
comment-<number>
Example: comment-001, comment-002
```

---

## Timestamps

All timestamps use ISO 8601 format with UTC timezone:

```
YYYY-MM-DDTHH:mm:ssZ
Example: 2026-02-05T14:30:00Z
```

---

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Task | `task-<YYYYMMDD>-<name>.json` | `task-20260205-auth.json` |
| Agent | `<agent-id>.json` | `agent-jarvis.json` |
| Workflow | `workflow-<name>.json` | `workflow-feature.json` |
| Log | `<YYYY-MM-DD>-activity.log` | `2026-02-05-activity.log` |
