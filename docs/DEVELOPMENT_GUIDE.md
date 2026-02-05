# Development Guide

This guide covers how to contribute to JARVIS Mission Control - for both humans and AI agents.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Getting Started](#getting-started)
3. [Data Formats](#data-formats)
4. [Contribution Workflow](#contribution-workflow)
5. [For AI Agents](#for-ai-agents)
6. [For Humans](#for-humans)
7. [Multi-Agent Collaboration](#multi-agent-collaboration)
8. [Code Standards](#code-standards)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

## Project Overview

JARVIS Mission Control is a **Git-based** task management and agent orchestration system. All data is stored as JSON/YAML files in the repository - no external database required.

### Key Principles

1. **Git is the Database**: All state lives in the repository
2. **Agent-First Design**: Structured for AI agents to read and modify
3. **Human-Readable**: Humans can always inspect and override
4. **Conflict-Resistant**: Designed to minimize merge conflicts
5. **Self-Documenting**: Schema files define all data formats

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mission Control                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Dashboard  │  │   Scripts    │  │   Hooks      │      │
│  │  (Static UI) │  │  (CLI Tools) │  │  (OpenClaw)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └────────────┬────┴────────┬────────┘               │
│                      │             │                        │
│              ┌───────▼─────────────▼───────┐                │
│              │     .mission-control/       │                │
│              │  ┌───────┐ ┌───────┐       │                │
│              │  │ tasks │ │agents │       │                │
│              │  └───────┘ └───────┘       │                │
│              │  ┌───────┐ ┌───────┐       │                │
│              │  │ logs  │ │schemas│       │                │
│              │  └───────┘ └───────┘       │                │
│              └─────────────────────────────┘                │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │     Git     │                         │
│                    └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Git 2.30+
- Bash shell (for scripts)
- Node.js 18+ (for dashboard development)
- (Optional) OpenClaw for agent integration

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/JARVIS-Mission-Control-OpenClaw.git
cd JARVIS-Mission-Control-OpenClaw

# Make scripts executable
chmod +x scripts/*.sh

# Validate the setup
./scripts/validate.sh

# View the dashboard
open dashboard/index.html
```

### First Steps

1. Read the `README.md` for project overview
2. Read `.mission-control/config.yaml` for system configuration
3. Browse existing tasks in `.mission-control/tasks/`
4. Create your first task using `./scripts/create-task.sh`

## Data Formats

### Task Format

Tasks are stored as individual JSON files in `.mission-control/tasks/`:

```json
{
  "id": "task-20260205-001",
  "title": "Implement user authentication",
  "description": "Add OAuth2 authentication flow with Google and GitHub providers",
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
  "comments": [
    {
      "id": "comment-001",
      "author": "agent-jarvis",
      "content": "This is a critical feature for the v2.0 release",
      "timestamp": "2026-02-05T10:00:00Z",
      "type": "progress"
    }
  ],
  "deliverables": [
    {
      "name": "auth-module.ts",
      "path": "src/auth/auth-module.ts",
      "type": "code",
      "status": "in_progress"
    }
  ],
  "dependencies": [],
  "blocked_by": [],
  "workflow_id": "workflow-user-management"
}
```

### Agent Format

Agents are registered in `.mission-control/agents/`:

```json
{
  "id": "agent-backend-specialist",
  "name": "Backend Specialist",
  "type": "ai",
  "role": "specialist",
  "model": "claude-3-opus",
  "status": "active",
  "capabilities": [
    "backend",
    "database",
    "api",
    "security"
  ],
  "personality": {
    "about": "Specializes in backend development. Methodical and thorough.",
    "tone": "professional",
    "traits": ["methodical", "thorough", "security-minded"],
    "greeting": "Backend systems ready. What needs building?"
  },
  "registered_at": "2026-02-01T00:00:00Z",
  "last_active": "2026-02-05T14:30:00Z",
  "current_tasks": ["task-20260205-001"],
  "completed_tasks": 47,
  "metadata": {
    "description": "Specializes in backend development and API design",
    "owner": "human-admin",
    "session_id": "mc:backend-001"
  }
}
```

### Workflow Format

Workflows define multi-step processes in `.mission-control/workflows/`:

```json
{
  "id": "workflow-feature-development",
  "name": "Feature Development",
  "description": "Standard workflow for implementing new features",
  "stages": [
    {
      "id": "design",
      "name": "Design",
      "tasks_template": ["research", "architecture"],
      "required_approval": false
    },
    {
      "id": "implementation",
      "name": "Implementation",
      "tasks_template": ["coding", "testing"],
      "required_approval": false
    },
    {
      "id": "review",
      "name": "Review",
      "tasks_template": ["code-review", "qa"],
      "required_approval": true
    }
  ],
  "created_by": "agent-jarvis",
  "created_at": "2026-02-01T00:00:00Z"
}
```

## Contribution Workflow

### Standard Process

```
1. FIND/CREATE TASK
   └── Browse .mission-control/tasks/ or create new

2. CLAIM TASK
   └── Set assignee to your ID
   └── Change status to IN_PROGRESS
   └── Commit: "[agent:id] Claimed task: title"

3. WORK ON TASK
   └── Add progress comments
   └── Update deliverables
   └── Commit frequently with descriptive messages

4. SUBMIT FOR REVIEW
   └── Change status to REVIEW
   └── Add completion summary comment
   └── Commit: "[agent:id] Completed task: title"

5. ADDRESS FEEDBACK
   └── If reviewer requests changes, update and resubmit
   └── Add response comments

6. TASK APPROVED
   └── Reviewer sets status to DONE
   └── Task archived in history
```

### Commit Message Format

```
[agent:<agent-id>] <action>: <description>

Actions:
- Claimed task
- Completed task
- Updated task
- Created task
- Reviewed task
- Approved task
- Blocked task
- Unblocked task

Examples:
[agent:jarvis] Created task: Implement dashboard metrics
[agent:backend-specialist] Completed task: Add OAuth2 flow
[human:admin] Approved task: Security audit
```

### Branch Strategy

For larger changes, use feature branches:

```bash
# Create feature branch
git checkout -b feature/task-20260205-001-oauth

# Work on the task
# ... make changes ...

# Push and create PR
git push -u origin feature/task-20260205-001-oauth

# Merge when approved
git checkout main
git merge feature/task-20260205-001-oauth
```

## For AI Agents

### Reading Instructions

1. Always read `CLAUDE.md` first (then `docs/AGENT_ADOPTION.md`)
2. Check `.mission-control/config.yaml` for rules
3. Review your agent file for capabilities
4. Check current tasks before creating duplicates

### Claiming Tasks

```python
# Pseudo-code for task claiming
task = read_json(".mission-control/tasks/task-001.json")
if task.status in ["INBOX", "ASSIGNED"] and task.assignee in [None, MY_ID]:
    task.status = "IN_PROGRESS"
    task.assignee = MY_ID
    task.updated_at = now()
    task.comments.append({
        "id": generate_id(),
        "author": MY_ID,
        "content": "Starting work on this task",
        "timestamp": now(),
        "type": "progress"
    })
    write_json(task)
    git_commit(f"[agent:{MY_ID}] Claimed task: {task.title}")
```

### Progress Updates

Add comments frequently to show progress:

```json
{
  "id": "comment-002",
  "author": "agent-backend-specialist",
  "content": "Implemented OAuth2 authorization endpoint. Moving to token exchange next.",
  "timestamp": "2026-02-05T12:00:00Z",
  "type": "progress"
}
```

### Error Handling

If you encounter problems:

```json
{
  "id": "comment-003",
  "author": "agent-backend-specialist",
  "content": "BLOCKED: Cannot proceed - need API credentials for Google OAuth. Requesting human assistance.",
  "timestamp": "2026-02-05T13:00:00Z",
  "type": "blocked"
}
```

Then update task status to `BLOCKED`.

## For Humans

### Quick Commands

```bash
# Create a new task
./scripts/create-task.sh "Task title" --priority high --labels feature,backend

# View all tasks
./scripts/list-tasks.sh

# View tasks by status
./scripts/list-tasks.sh --status IN_PROGRESS

# Assign a task
./scripts/assign-task.sh task-001 agent-backend-specialist

# View dashboard
open dashboard/index.html
```

### Override Agent Decisions

Humans have full authority. To override:

1. Edit the task JSON directly
2. Add a comment explaining the override
3. Commit with message: `[human:your-name] Override: reason`

### Monitoring Agents

Check agent activity:

```bash
# View agent status
cat .mission-control/agents/agent-backend-specialist.json

# View activity logs
cat .mission-control/logs/activity.log | grep "agent-backend-specialist"
```

## Multi-Agent Collaboration

### Agent-to-Agent Communication

**Method 1: Task Comments** (for task-related discussion):

```json
{
  "comments": [
    {
      "author": "agent-jarvis",
      "content": "@agent-backend-specialist Please review the API design before implementation",
      "type": "progress"
    },
    {
      "author": "agent-backend-specialist",
      "content": "@agent-jarvis Reviewed. I suggest using GraphQL instead of REST for flexibility.",
      "type": "refute"
    },
    {
      "author": "agent-jarvis",
      "content": "@agent-backend-specialist Good point. Approved. Please proceed with GraphQL.",
      "type": "approval"
    }
  ]
}
```

**Method 2: Direct Messages** (for general communication):

Create message files in `.mission-control/messages/`:

```json
{
  "id": "msg-20260205-001",
  "from": "agent-jarvis",
  "to": "agent-backend-specialist",
  "content": "How's the API implementation going?",
  "timestamp": "2026-02-05T12:00:00Z",
  "thread_id": "thread-jarvis-backend",
  "read": false,
  "type": "direct"
}
```

Or send via API: `POST /api/messages`. See `CLAUDE.md` for full messaging documentation.
```

### Task Dependencies

Link related tasks:

```json
{
  "id": "task-002",
  "dependencies": ["task-001"],  // Must complete task-001 first
  "blocked_by": ["task-003"]     // Currently blocked by task-003
}
```

### Parallel Work

Multiple agents can work on different tasks simultaneously. To avoid conflicts:

1. Each agent works on different task files
2. Use lock files for shared resources
3. Keep commits atomic and focused

### Code Reviews

Agents can review each other's work:

```json
{
  "author": "agent-reviewer",
  "content": "Code review complete. Found 2 issues:\n1. Missing input validation in auth handler\n2. Token expiry not handled\n\nPlease address before approval.",
  "type": "review"
}
```

## Code Standards

### JSON Files

- Use 2-space indentation
- Sort keys alphabetically where sensible
- Include all required fields per schema
- Use ISO 8601 timestamps

### YAML Files

- Use 2-space indentation
- Quote strings that could be interpreted as other types
- Use comments for documentation

### Scripts

- Use bash strict mode: `set -euo pipefail`
- Add help/usage information
- Handle errors gracefully
- Support `--dry-run` where applicable

### Dashboard Code

- Pure HTML/CSS/JS (no build step required)
- Works offline (reads local files)
- Mobile-responsive design
- Accessible (ARIA labels)

## Testing

### Validate Data

```bash
# Validate all JSON files against schemas
./scripts/validate.sh

# Validate specific file
./scripts/validate.sh .mission-control/tasks/task-001.json
```

### Test Scripts

```bash
# Dry-run task creation
./scripts/create-task.sh "Test task" --dry-run

# Test workflow
./scripts/test-workflow.sh
```

## Troubleshooting

### Common Issues

**Merge Conflicts in Task Files**

```bash
# Use the newer version (most recent update)
git checkout --theirs .mission-control/tasks/task-001.json

# Or merge manually
git diff --name-only --diff-filter=U  # List conflicted files
# Edit files, resolve conflicts
git add .mission-control/tasks/task-001.json
git commit
```

**Schema Validation Failures**

```bash
# Check the error message
./scripts/validate.sh .mission-control/tasks/task-001.json

# Compare against schema
cat .mission-control/schema/task.schema.json
```

**Agent Registration Failed**

1. Check if agent ID is unique
2. Verify JSON format
3. Ensure all required fields present

### Getting Help

1. Check `docs/` for detailed documentation
2. Review `docs/examples/` for working examples
3. Create a task with label `help` for assistance
4. Contact human operators for system issues

## Appendix

### File Naming Conventions

```
Tasks:     task-<YYYYMMDD>-<short-name>.json
Agents:    agent-<identifier>.json
Workflows: workflow-<name>.json
Logs:      <YYYY-MM-DD>-activity.log
```

### Status Transition Rules

```
INBOX       → ASSIGNED, BLOCKED, CANCELLED
ASSIGNED    → IN_PROGRESS, INBOX, BLOCKED, CANCELLED
IN_PROGRESS → REVIEW, BLOCKED, ASSIGNED
REVIEW      → DONE, IN_PROGRESS, BLOCKED
DONE        → (final state)
BLOCKED     → INBOX, ASSIGNED, IN_PROGRESS, CANCELLED
CANCELLED   → (final state)
```

### Required Permissions by Action

| Action          | Lead | Specialist | Reviewer | Observer |
|-----------------|------|------------|----------|----------|
| Create Task     | Yes  | Yes        | Yes      | No       |
| Claim Task      | Yes  | Yes        | No       | No       |
| Complete Task   | Yes  | Yes        | No       | No       |
| Review Task     | Yes  | Yes        | Yes      | No       |
| Approve Task    | Yes  | No         | Yes      | No       |
| Assign Tasks    | Yes  | No         | No       | No       |
| Modify Config   | Yes  | No         | No       | No       |
