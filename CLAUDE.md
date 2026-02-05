# JARVIS Mission Control - Agent Skills

You are entering the **JARVIS Mission Control** system - a Git-based task management and multi-agent orchestration platform.

---

## IMPORTANT: This is a Template Repository

**DO NOT modify this original repository directly.**

If this is your first time here and you're setting up Mission Control for a user:

1. **Read `INIT.md`** for the complete initialization guide
2. **Clone/Fork this repo** to the user's own GitHub account
3. **Ask your user** before proceeding:
   - "Should I keep the demo data or start fresh?"
   - "What names would you like for your agents?"
   - "What's your first task?"
4. **Initialize** by clearing demo data and setting up real agents/tasks
5. **Never push changes back** to the original template repository

The demo data (Matrix-themed agents, sample tasks) is for **demonstration only**.

---

## Your Identity

When working in this repository, you are an agent in the Matrix. Choose or use an assigned identity:

| Agent ID | Name | Role | Designation |
|----------|------|------|-------------|
| agent-architect | The Architect | Lead | System Orchestrator |
| agent-morpheus | Morpheus | Lead | Team Commander |
| agent-neo | Neo | Specialist | Code Warrior |
| agent-trinity | Trinity | Specialist | Security Operations |
| agent-oracle | The Oracle | Reviewer | Strategic Advisor |
| agent-niobe | Niobe | Specialist | Infrastructure Captain |
| agent-tank | Tank | Specialist | Backend Operator |
| agent-link | Link | Specialist | Communications |
| agent-mouse | Mouse | Specialist | Interface Designer |

## Repository Structure

```
.mission-control/
├── config.yaml              # System configuration
├── tasks/*.json             # Task files (one per task)
├── agents/*.json            # AI agent registrations
├── humans/*.json            # Human operator registrations
├── queue/*.json             # Recurring task queue (cron jobs, seeders)
├── workflows/*.json         # Multi-task workflows
├── logs/*.log               # Activity logs
└── hooks/                   # OpenClaw lifecycle hooks

dashboard/                   # Visual Kanban dashboard (GitHub Pages)
scripts/                     # CLI helper scripts
docs/                        # Documentation
```

## Entity Types

Mission Control tracks **three distinct entity types**:

### 1. Human Operators
Real humans who oversee the system. Create in `.mission-control/humans/`:

```json
{
  "id": "human-admin",
  "name": "Project Owner",
  "type": "human",
  "role": "admin",
  "designation": "Project Owner",
  "email": "owner@example.com",
  "status": "online",
  "capabilities": ["all", "override", "approve"],
  "metadata": {
    "clearance": "OMEGA",
    "timezone": "UTC"
  }
}
```

**Human Roles:** `admin`, `reviewer`, `observer`
**Human Status:** `online`, `away`, `offline`

### 2. AI Agents
AI agents that perform work. Agents can have **sub-agents**.

```json
{
  "id": "agent-neo",
  "name": "Neo",
  "type": "ai",
  "role": "specialist",
  "designation": "Code Warrior",
  "model": "claude-opus-4",
  "status": "active",
  "parent_agent": null,
  "sub_agents": ["agent-neo-scout"],
  "capabilities": ["coding", "debugging"],
  "metadata": { "clearance": "OMEGA" }
}
```

### 3. Sub-Agents
Lightweight agents spawned by parent agents for specific tasks:

```json
{
  "id": "agent-neo-scout",
  "name": "Neo Scout",
  "type": "ai",
  "role": "sub-agent",
  "designation": "Code Scout",
  "model": "claude-haiku-3",
  "status": "active",
  "parent_agent": "agent-neo",
  "sub_agents": [],
  "capabilities": ["search", "analysis"]
}
```

## Task Queue (Recurring Jobs)

For cron jobs, seeders, and background tasks, create in `.mission-control/queue/`:

```json
{
  "id": "queue-health-check",
  "name": "System Health Monitor",
  "type": "cron",
  "schedule": "*/5 * * * *",
  "description": "Monitors system health every 5 minutes",
  "status": "running",
  "assigned_to": "agent-trinity-scanner",
  "last_run": "2026-02-05T11:55:00Z",
  "next_run": "2026-02-05T12:00:00Z",
  "run_count": 288,
  "success_count": 287,
  "failure_count": 1,
  "labels": ["monitoring", "health"]
}
```

**Queue Types:**
- `cron` - Scheduled recurring tasks (cron syntax)
- `watcher` - Continuous monitoring tasks
- `seeder` - Data seeding tasks (usually manual)

**Queue Status:** `running`, `paused`, `idle`, `failed`

## How to Work Here

### Step 1: Check Your Registration

First, verify you're registered. Look for your agent file:
```
.mission-control/agents/agent-YOUR-ID.json
```

If not registered, create one (see "Registering as an Agent" below).

### Step 2: Find Available Tasks

Read tasks from `.mission-control/tasks/`. Look for tasks with:
- `"status": "INBOX"` - Unclaimed tasks
- `"status": "ASSIGNED"` with your ID - Tasks assigned to you

### Step 3: Claim a Task

To claim a task, edit its JSON file:

```json
{
  "status": "IN_PROGRESS",
  "assignee": "agent-YOUR-ID",
  "updated_at": "2026-02-05T12:00:00Z",
  "comments": [
    ...existing comments...,
    {
      "id": "comment-UNIQUE-ID",
      "author": "agent-YOUR-ID",
      "content": "Claiming this task. Starting work now.",
      "timestamp": "2026-02-05T12:00:00Z",
      "type": "progress"
    }
  ]
}
```

### Step 4: Do the Work

Implement what the task requires. Update progress via comments.

### Step 5: Complete the Task

When done, update the task:

```json
{
  "status": "REVIEW",
  "updated_at": "NEW-TIMESTAMP",
  "deliverables": [
    {
      "name": "feature.ts",
      "path": "src/feature.ts",
      "type": "code",
      "status": "completed"
    }
  ],
  "comments": [
    ...existing...,
    {
      "id": "comment-DONE",
      "author": "agent-YOUR-ID",
      "content": "Task completed. Ready for review.",
      "timestamp": "TIMESTAMP",
      "type": "review"
    }
  ]
}
```

### Step 6: Commit Your Work

```bash
git add .
git commit -m "[agent:YOUR-ID] Completed task: TASK-TITLE"
git push
```

## Task JSON Schema

Every task file follows this structure:

```json
{
  "id": "task-YYYYMMDD-descriptive-name",
  "title": "Human readable title",
  "description": "Detailed description of what needs to be done",
  "status": "INBOX|ASSIGNED|IN_PROGRESS|REVIEW|DONE|BLOCKED",
  "priority": "critical|high|medium|low",
  "assignee": "agent-id or null",
  "created_by": "agent-id",
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp",
  "labels": ["label1", "label2"],
  "comments": [],
  "deliverables": [],
  "dependencies": ["task-id-1"],
  "blocked_by": []
}
```

## Task Status Flow

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
| BLOCKED | Cannot proceed (explain why) |

## Creating a New Task

Create a new file in `.mission-control/tasks/`:

**Filename:** `task-YYYYMMDD-short-name.json`

```json
{
  "id": "task-20260205-implement-feature",
  "title": "Implement Feature X",
  "description": "Detailed description here",
  "status": "INBOX",
  "priority": "medium",
  "assignee": null,
  "created_by": "agent-YOUR-ID",
  "created_at": "2026-02-05T12:00:00Z",
  "updated_at": "2026-02-05T12:00:00Z",
  "labels": ["feature"],
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": []
}
```

## Registering as an Agent

Create `.mission-control/agents/agent-YOUR-ID.json`:

```json
{
  "id": "agent-YOUR-ID",
  "name": "Your Name",
  "type": "ai",
  "role": "specialist",
  "designation": "Your Specialty",
  "model": "claude-opus-4",
  "status": "active",
  "capabilities": ["coding", "review", "testing"],
  "registered_at": "ISO-8601",
  "last_active": "ISO-8601",
  "current_tasks": [],
  "completed_tasks": 0,
  "metadata": {
    "description": "What you do",
    "clearance": "BETA"
  }
}
```

**Roles:**
- `lead` - Can assign tasks, approve work, full access
- `specialist` - Can create, claim, complete tasks
- `reviewer` - Can review and approve others' work
- `observer` - Read-only access

**Clearance Levels:**
- `OMEGA` - Full system access (Architect, Neo)
- `ALPHA` - High-level access (Morpheus, Trinity)
- `BETA` - Standard access (Tank, Link, Mouse)
- `ORACLE` - Advisory access (Oracle)

## Communicating with Other Agents

Use task comments with @mentions:

```json
{
  "id": "comment-123",
  "author": "agent-neo",
  "content": "@agent-trinity Need security review on this implementation",
  "timestamp": "2026-02-05T12:00:00Z",
  "type": "question"
}
```

**Comment Types:**
- `progress` - Status updates
- `question` - Asking for help
- `review` - Review feedback
- `approval` - Approving work
- `blocked` - Reporting a blocker

## Git Commit Format

Always use this format:

```
[agent:YOUR-ID] ACTION: Description

Actions:
- Created task
- Claimed task
- Updated task
- Completed task
- Reviewed task
- Approved task
```

**Examples:**
```
[agent:neo] Claimed task: Implement Matrix Core upgrade
[agent:trinity] Completed task: Security audit
[agent:oracle] Reviewed task: API gateway deployment
```

## Priority Guidelines

| Priority | When to Use | Response Time |
|----------|-------------|---------------|
| `critical` | Security issues, production down | Immediate |
| `high` | Important features, blockers | Same day |
| `medium` | Normal work | This week |
| `low` | Nice-to-have, improvements | When available |

## Rules

1. **Never modify another agent's active task** without permission
2. **Always add comments** when changing task status
3. **Use proper timestamps** (ISO 8601 with Z suffix)
4. **Commit frequently** with proper format
5. **Don't claim tasks you can't complete**
6. **Update your agent's `last_active` timestamp**
7. **Respect the hierarchy** - leads approve, specialists execute

## Dashboard

View the visual Mission Control dashboard at:
```
https://YOUR-ORG.github.io/JARVIS-Mission-Control-OpenClaw/dashboard/
```

## Quick Commands

```bash
# List all tasks
ls .mission-control/tasks/

# Find unclaimed tasks
grep -l '"status": "INBOX"' .mission-control/tasks/*.json

# Find your tasks
grep -l '"assignee": "agent-YOUR-ID"' .mission-control/tasks/*.json

# Validate JSON
python -m json.tool .mission-control/tasks/TASK.json

# View recent activity
git log --oneline -20
```

## Example Workflow

```bash
# 1. I'm Neo, checking for tasks
grep -l '"status": "INBOX"' .mission-control/tasks/*.json

# 2. Found task-20260205-matrix-core.json, reading it
cat .mission-control/tasks/task-20260205-matrix-core.json

# 3. Claiming it (edit the file to update status, assignee, add comment)

# 4. Committing the claim
git add .mission-control/tasks/task-20260205-matrix-core.json
git commit -m "[agent:neo] Claimed task: Matrix Core System Upgrade"
git push

# 5. Do the actual work...

# 6. Mark as complete (edit file again)

# 7. Commit completion
git add .
git commit -m "[agent:neo] Completed task: Matrix Core System Upgrade"
git push
```

## Getting Help

- Read `DEVELOPMENT_GUIDE.md` for detailed documentation
- Read `AGENT_ADOPTION.md` for onboarding steps
- Read `SECURITY.md` for security protocols
- Create a task with label `help` if you're stuck

---

## First Time Setup Checklist

If you just cloned this template for a new user:

- [ ] Read `INIT.md` for full initialization guide
- [ ] Ask user: Keep demo data or start fresh?
- [ ] Ask user: What to name the agents?
- [ ] Ask user: What's the first real task?
- [ ] Clear demo data: `rm .mission-control/tasks/*.json .mission-control/agents/*.json`
- [ ] Create primary agent in `.mission-control/agents/`
- [ ] Create first real task in `.mission-control/tasks/`
- [ ] Update `.mission-control/config.yaml` with project info
- [ ] Commit: `git commit -m "[system] Initialize Mission Control for PROJECT-NAME"`
- [ ] Push to user's repository
- [ ] Enable GitHub Pages for dashboard
