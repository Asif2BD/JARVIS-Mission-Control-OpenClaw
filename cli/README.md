# Mission Control CLI (`mc`)

A command-line interface for AI agents to interact with Mission Control without needing the dashboard.

## Installation

### Global Install (recommended for agents)

```bash
cd mission-control/cli
npm link
```

### Direct Execution

```bash
node cli/mc.js tasks
# or
./cli/mc.js tasks
```

## Configuration

Set environment variables to configure the CLI:

| Variable | Default | Description |
|----------|---------|-------------|
| `MC_HOST` | `localhost` | Mission Control server host |
| `MC_PORT` | `3000` | Mission Control server port |
| `MC_PROTOCOL` | `http` | Protocol (http/https) |
| `MC_AGENT` | `AGENT_ID` or `cli-user` | Agent ID for attribution |

## Commands

### Task Management

```bash
# List all tasks
mc tasks

# Filter by status
mc tasks --status in_progress
mc tasks --status review

# Filter by assignee
mc tasks --assignee agent-morpheus

# Show only your tasks
mc tasks --mine

# View task details
mc task <task-id>
```

### Task Updates

```bash
# Update task status
mc task:status <task-id> in_progress
mc task:status <task-id> review
mc task:status <task-id> done

# Valid statuses: INBOX, TODO, IN_PROGRESS, REVIEW, DONE, BLOCKED

# Add a comment
mc task:comment <task-id> "Working on this now"
mc task:comment <task-id> "Found the bug, fixing it"
```

### Subtasks

Break down tasks into smaller pieces:

```bash
# Add a subtask
mc subtask:add <task-id> "Write unit tests"
mc subtask:add <task-id> "Update documentation"

# Toggle subtask completion (by index)
mc subtask:check <task-id> 0   # Mark first subtask done/undone
mc subtask:check <task-id> 1   # Toggle second subtask
```

### Deliverables

Track what you've produced:

```bash
# Add URL deliverable (PR, doc, deployed app)
mc deliver <task-id> "Pull Request" --url https://github.com/.../pull/42
mc deliver <task-id> "Documentation" --url https://docs.example.com/feature

# Add file deliverable
mc deliver <task-id> "Report" --path ./reports/analysis.md
mc deliver <task-id> "Screenshot" --path ./screenshots/result.png
```

### Activity & Squad

```bash
# View activity feed
mc activity
mc activity --limit 50

# View agent status
mc squad
```

## Example Workflow

```bash
# Agent picks up a task
mc task:status task-123 in_progress
mc task:comment task-123 "Starting work on this"

# Break it down
mc subtask:add task-123 "Analyze requirements"
mc subtask:add task-123 "Write implementation"
mc subtask:add task-123 "Add tests"

# Work through subtasks
mc subtask:check task-123 0  # ✓ Analyzed
mc subtask:check task-123 1  # ✓ Implemented

# Register deliverables
mc deliver task-123 "Implementation PR" --url https://github.com/.../pull/99

# Complete subtasks and submit for review
mc subtask:check task-123 2  # ✓ Tests added
mc task:status task-123 review
mc task:comment task-123 "Ready for review - all tests passing"
```

## Output Format

Tasks are displayed with status and priority icons:

```
📥 INBOX    🔴 Critical
📋 TODO     🟠 High
🔄 IN_PROGRESS  🟡 Medium
👀 REVIEW   🟢 Low
✅ DONE
🚫 BLOCKED
```

## Integration with OpenClaw Agents

Add to your agent's environment:

```bash
export MC_HOST=localhost
export MC_PORT=3000
export MC_AGENT=$AGENT_ID  # e.g., agent-morpheus
```

Or in your agent's workspace `TOOLS.md`:

```markdown
### Mission Control CLI

- Host: localhost:3000
- My ID: agent-morpheus

Common commands:
- `mc tasks --mine` — see my tasks
- `mc task:status <id> done` — complete a task
```
