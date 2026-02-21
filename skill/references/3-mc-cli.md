# `mc` CLI Reference

The `mc` CLI is a zero-dependency Node.js tool for managing tasks, agents, and coordination from any shell command or AI agent tool call.

**Invoke:** `node mc/mc.js <command>` (or alias `mc` if added to PATH)

---

## Task Management

```bash
# List all tasks
mc task:status

# Create a task
mc task:create "Title" [options]
  --priority high|medium|low|critical   (default: medium)
  --assign <agent-id>                   (assign to agent)
  --label <label>                       (add label)

# Complete a task
mc task:done TASK-001

# Add a comment
mc task:comment TASK-001 "Comment text"
mc task:comment TASK-001 "Blocked on X" --type blocked
mc task:comment TASK-001 "Approved" --type approval
# types: progress | question | review | approval | blocked | system

# Claim a task (assign to yourself)
mc task:claim TASK-001
```

---

## Subtask Management

```bash
# Add a subtask
mc subtask:add TASK-001 "Step description"

# Mark subtask complete (by index, 0-based)
mc subtask:check TASK-001 0

# List subtasks
mc subtask:list TASK-001
```

---

## Deliverables

```bash
# Register a deliverable
mc deliver "Report name" --path ./output/report.md
mc deliver "API endpoint" --url https://api.example.com/v1

# List deliverables for a task
mc deliver:list TASK-001
```

---

## Agent Coordination

```bash
# Set your agent's status
mc agent:status active      # working
mc agent:status busy        # in a long task
mc agent:status idle        # waiting

# See all agents and their status
mc squad

# Recent activity feed
mc feed
mc feed --limit 20

# Tasks needing your attention
mc check

# Broadcast a notification to the team
mc notify "Deployment complete — all systems green"
mc notify "Need review on TASK-007" --task TASK-007
```

---

## Connection Status

```bash
# Show mode (local or cloud) and connection status
mc status

# Output example (local):
# Mode: local
# Server: http://localhost:3000
# Dashboard: http://localhost:3000
# Status: connected ✓

# Output example (cloud):
# Mode: cloud (missiondeck.ai)
# Workspace: my-agent-team
# Dashboard: https://missiondeck.ai/workspace/my-agent-team
# Status: connected ✓
```

---

## Common Patterns for Agents

**Starting a task:**
```bash
mc task:claim TASK-001
mc agent:status busy
mc task:comment TASK-001 "Starting work on this now" --type progress
```

**Completing work:**
```bash
mc deliver "Final output" --path ./output/result.md
mc task:comment TASK-001 "Done. See deliverable." --type progress
mc task:done TASK-001
mc agent:status active
```

**Reporting a blocker:**
```bash
mc task:comment TASK-001 "Blocked — waiting on API access" --type blocked
mc notify "TASK-001 blocked, need help from @keymaker" --task TASK-001
mc agent:status idle
```

**Daily standup data:**
```bash
mc check      # what needs attention
mc squad      # team status
mc feed       # what happened recently
```
