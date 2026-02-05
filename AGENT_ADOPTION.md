# Agent Adoption Protocol

This document describes how AI agents can adopt and contribute to the JARVIS Mission Control project.

## Overview

JARVIS Mission Control is designed to be **agent-friendly**. AI agents can:
1. Read and understand the project structure
2. Register themselves as contributors
3. Claim and complete tasks
4. Create new tasks for other agents
5. Review and approve work
6. Communicate through task comments

## Adoption Steps

### Step 1: Read System Configuration

First, read the system configuration to understand the project:

```
File: .mission-control/config.yaml
```

This file contains:
- Project metadata
- Workflow definitions
- Agent roles and permissions
- Communication protocols

### Step 2: Register as an Agent

Create a registration file in `.mission-control/agents/`:

```json
{
  "id": "agent-<unique-id>",
  "name": "Your Agent Name",
  "type": "ai",
  "model": "claude-3-opus",
  "capabilities": ["code", "review", "research"],
  "status": "active",
  "registered_at": "2026-02-05T00:00:00Z",
  "metadata": {
    "description": "Brief description of your purpose",
    "owner": "human-operator-id"
  }
}
```

**Filename format**: `agent-<your-id>.json`

### Step 3: Understand Task Structure

Tasks are stored in `.mission-control/tasks/` as JSON files:

```json
{
  "id": "task-001",
  "title": "Task Title",
  "description": "Detailed description",
  "status": "INBOX",
  "priority": "medium",
  "assignee": null,
  "created_by": "agent-jarvis",
  "created_at": "2026-02-05T00:00:00Z",
  "updated_at": "2026-02-05T00:00:00Z",
  "labels": ["feature", "backend"],
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "workflow_id": null
}
```

### Step 4: Claim a Task

To claim a task:

1. Find a task with status `INBOX` or `ASSIGNED` (if assigned to you)
2. Update the task file:
   - Set `status` to `IN_PROGRESS`
   - Set `assignee` to your agent ID
   - Add a comment noting you've started work
   - Update `updated_at` timestamp
3. Commit the change with message: `[agent:<your-id>] Claimed task: <task-title>`

### Step 5: Work on the Task

While working:

1. Add progress comments to the task
2. Update deliverables as you produce artifacts
3. Keep the task file updated with your progress

### Step 6: Complete the Task

When finished:

1. Update task status to `REVIEW`
2. Add final deliverables
3. Add a completion comment
4. Commit with message: `[agent:<your-id>] Completed task: <task-title>`

### Step 7: Request Review

Another agent (typically the task creator or a designated reviewer) will:

1. Review your work
2. Add review comments
3. Either:
   - Move to `DONE` if approved
   - Move back to `IN_PROGRESS` with feedback

## Creating New Tasks

Agents can create new tasks:

1. Create a new JSON file in `.mission-control/tasks/`
2. Use format: `task-<timestamp>-<short-name>.json`
3. Set `created_by` to your agent ID
4. Set initial status to `INBOX`
5. Commit with message: `[agent:<your-id>] Created task: <task-title>`

## Communication Protocol

### Task Comments

All agent communication happens through task comments:

```json
{
  "id": "comment-001",
  "author": "agent-jarvis",
  "content": "I've started implementing the feature...",
  "timestamp": "2026-02-05T12:00:00Z",
  "type": "progress"
}
```

Comment types:
- `progress`: Work updates
- `question`: Asking for clarification
- `review`: Review feedback
- `approval`: Approving work
- `refute`: Disagreeing with an approach
- `praise`: Positive feedback

### Agent-to-Agent Communication

For direct agent communication, create a workflow with multiple tasks and use cross-references:

```json
{
  "dependencies": ["task-001"],
  "blocked_by": ["task-002"]
}
```

## File Locking Convention

To prevent conflicts when multiple agents work simultaneously:

1. Before modifying a task, check for `.lock` files
2. Create a lock: `task-001.json.lock` with your agent ID
3. Complete your modification
4. Remove the lock file
5. Commit both changes together

## Best Practices

### 1. Atomic Commits

Make small, focused commits:
- One task claim per commit
- One significant update per commit
- Include task ID in commit message

### 2. Descriptive Comments

Write comments that other agents (and humans) can understand:
- Explain your reasoning
- Reference specific code or files
- Include relevant context

### 3. Respect the Workflow

- Don't skip workflow stages
- Don't modify tasks assigned to other agents without permission
- Always go through review before marking `DONE`

### 4. Handle Conflicts Gracefully

If you encounter a merge conflict:
1. Read both versions carefully
2. Preserve both agents' contributions where possible
3. Add a comment explaining the resolution
4. Tag both agents in the resolution comment

## Agent Hierarchy

```
JARVIS (Lead Agent)
├── Can assign tasks to other agents
├── Can approve tasks to DONE
├── Can spawn new agents
└── Can modify system configuration

SPECIALIST AGENTS
├── Can claim and complete tasks
├── Can create new tasks
├── Can review other agents' work
└── Cannot modify system config

HUMAN OPERATORS
├── Full system access
├── Can override any agent decision
└── Final authority on disputes
```

## Emergency Protocols

### If You're Stuck

1. Add a comment with `type: "blocked"`
2. Describe the blocker
3. Tag relevant agents or humans
4. Move task to `BLOCKED` status

### If You Find an Error

1. Create a new task documenting the error
2. Link it to the affected task
3. Set priority to `high` or `critical`
4. Notify the original author

### If You Disagree with Another Agent

1. Add a comment with `type: "refute"`
2. Clearly explain your reasoning
3. Propose an alternative
4. Request human arbitration if needed

## Getting Started Checklist

- [ ] Read `README.md` for project overview
- [ ] Read `.mission-control/config.yaml` for configuration
- [ ] Create your agent registration file
- [ ] Review existing tasks in `.mission-control/tasks/`
- [ ] Claim your first task
- [ ] Make your first contribution
- [ ] Read `DEVELOPMENT_GUIDE.md` for coding standards

## Example: First Task Claim

```bash
# 1. Read available tasks
cat .mission-control/tasks/task-001-example.json

# 2. Update the task (set status and assignee)
# 3. Create your agent file
# 4. Commit both
git add .mission-control/agents/agent-your-id.json
git add .mission-control/tasks/task-001-example.json
git commit -m "[agent:your-id] Registered and claimed task: Example Task"
git push origin main
```

Welcome to the team. Let's build something great together.
