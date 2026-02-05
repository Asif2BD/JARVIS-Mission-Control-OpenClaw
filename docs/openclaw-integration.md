# OpenClaw Integration Guide

This guide explains how to integrate JARVIS Mission Control with OpenClaw for automatic task tracking.

## Overview

When integrated with OpenClaw, Mission Control automatically:

1. **Creates tasks** when agent sessions start
2. **Logs progress** when agents use tools
3. **Updates status** when sessions complete or fail
4. **Commits changes** to the Git repository

## Prerequisites

- OpenClaw installed and configured
- JARVIS Mission Control repository cloned
- Git configured with push access

## Installation

### Step 1: Install Hooks

Copy the Mission Control hooks to your OpenClaw hooks directory:

```bash
# Create hooks directory if it doesn't exist
mkdir -p ~/.openclaw/hooks/mission-control

# Copy hooks from the repository
cp .mission-control/hooks/*.sh ~/.openclaw/hooks/mission-control/

# Make hooks executable
chmod +x ~/.openclaw/hooks/mission-control/*.sh
```

### Step 2: Configure OpenClaw

Add Mission Control configuration to `~/.openclaw/config.jsonc`:

```jsonc
{
  "hooks": {
    "mission-control": {
      "enabled": true,
      // Path to this Mission Control repository
      "repo_path": "/path/to/JARVIS-Mission-Control-OpenClaw",
      // Which events to track
      "events": {
        "on_start": true,
        "on_complete": true,
        "on_error": true,
        "on_tool_use": true
      }
    }
  }
}
```

### Step 3: Set Environment Variables

The hooks need to know where your Mission Control repo is:

```bash
# Add to ~/.bashrc or ~/.zshrc
export MISSION_CONTROL_PATH="/path/to/JARVIS-Mission-Control-OpenClaw"
```

### Step 4: Restart OpenClaw

```bash
openclaw gateway restart
```

## How It Works

### Session Start

When you start an OpenClaw session:

1. OpenClaw triggers `on-agent-start.sh`
2. Hook creates a new task with:
   - Title: Your prompt (truncated)
   - Description: Full prompt + session info
   - Status: `IN_PROGRESS`
   - Assignee: The agent
   - Labels: `openclaw`, `auto-generated`
3. Task is committed to the repository
4. Task ID is stored for the session

### Tool Usage

When the agent uses a tool:

1. OpenClaw triggers `on-tool-use.sh`
2. Hook adds a progress comment (for significant tools)
3. Logs the event to activity log

Significant tools that trigger comments:
- Write, Edit
- Bash
- Task
- WebFetch, WebSearch

### Session Complete

When a session completes successfully:

1. OpenClaw triggers `on-agent-complete.sh`
2. Hook updates task:
   - Status: `REVIEW`
   - Adds completion comment with result
3. Changes committed to repository

### Session Error

When a session encounters an error:

1. OpenClaw triggers `on-agent-error.sh`
2. Hook updates task:
   - Status: `BLOCKED`
   - Adds error comment with details
3. Changes committed to repository

## Task Example

Here's what an auto-generated task looks like:

```json
{
  "id": "task-20260205-session-1707123456",
  "title": "Implement user authentication with OAuth2...",
  "description": "OpenClaw agent session task.\n\nSession ID: abc123\nAgent: Claude\n\nOriginal prompt:\nImplement user authentication with OAuth2 support for Google and GitHub",
  "status": "IN_PROGRESS",
  "priority": "medium",
  "assignee": "agent-claude",
  "labels": ["openclaw", "auto-generated"],
  "metadata": {
    "openclaw_session_id": "abc123",
    "openclaw_agent_name": "Claude",
    "source": "openclaw_hook"
  }
}
```

## Configuration Options

### Hook Settings

You can customize hook behavior by editing the hook scripts:

**on-agent-start.sh**
```bash
# Default priority for auto-created tasks
PRIORITY="medium"

# Default labels
LABELS="openclaw,auto-generated"

# Auto-commit (set to false for manual commit)
AUTO_COMMIT=true
```

**on-tool-use.sh**
```bash
# Tools that trigger progress comments
SIGNIFICANT_TOOLS=("Write" "Edit" "Bash" "Task" "WebFetch" "WebSearch")

# Maximum thinking length in comments
MAX_THINKING_LENGTH=500
```

### Disabling Auto-Commit

If you prefer to review changes before committing:

1. Edit each hook script
2. Comment out the auto-commit section at the end
3. Manually commit when ready

### Filtering Events

To disable specific hooks:

```jsonc
// In ~/.openclaw/config.jsonc
{
  "hooks": {
    "mission-control": {
      "events": {
        "on_start": true,
        "on_complete": true,
        "on_error": true,
        "on_tool_use": false  // Disable tool tracking
      }
    }
  }
}
```

## Viewing Tasks

### Dashboard

Open `dashboard/index.html` to see tasks in the Kanban board.

### Command Line

```bash
# List all OpenClaw tasks
./scripts/list-tasks.sh --label openclaw

# List in-progress sessions
./scripts/list-tasks.sh --status IN_PROGRESS --label openclaw
```

### Activity Log

```bash
# View today's activity
cat .mission-control/logs/$(date +%Y-%m-%d)-activity.log

# Watch for real-time updates
tail -f .mission-control/logs/$(date +%Y-%m-%d)-activity.log
```

## Multi-Agent Setup

When running multiple agents, each gets its own task:

```
┌─────────────────────────────────────────────────┐
│                OpenClaw Gateway                  │
├─────────────────────────────────────────────────┤
│  Agent: Jarvis    → Task: task-session-001      │
│  Agent: Backend   → Task: task-session-002      │
│  Agent: Frontend  → Task: task-session-003      │
└─────────────────────────────────────────────────┘
```

### Lead Agent Pattern

Set up Jarvis as the lead agent that spawns others:

1. Jarvis receives high-level task
2. Jarvis creates sub-tasks in Mission Control
3. Jarvis spawns sub-agents assigned to sub-tasks
4. Sub-agents complete their tasks
5. Jarvis reviews and approves

## Troubleshooting

### Hooks Not Running

1. Check hooks are executable:
   ```bash
   ls -la ~/.openclaw/hooks/mission-control/
   ```

2. Check OpenClaw config:
   ```bash
   cat ~/.openclaw/config.jsonc | grep -A 10 mission-control
   ```

3. Check OpenClaw logs:
   ```bash
   openclaw logs | grep mission-control
   ```

### Tasks Not Being Created

1. Verify repo path:
   ```bash
   echo $MISSION_CONTROL_PATH
   ls $MISSION_CONTROL_PATH/.mission-control/tasks/
   ```

2. Check hook output:
   ```bash
   # Run hook manually
   OPENCLAW_SESSION_ID=test OPENCLAW_AGENT_NAME=Test OPENCLAW_PROMPT="Test prompt" \
     ~/.openclaw/hooks/mission-control/on-agent-start.sh
   ```

3. Check file permissions:
   ```bash
   ls -la $MISSION_CONTROL_PATH/.mission-control/tasks/
   ```

### Git Commit Failures

1. Check git status:
   ```bash
   cd $MISSION_CONTROL_PATH
   git status
   ```

2. Check git config:
   ```bash
   git config user.name
   git config user.email
   ```

3. Check for conflicts:
   ```bash
   git diff
   ```

### JSON Parsing Errors

1. Install jq:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install jq

   # macOS
   brew install jq
   ```

2. Validate task file:
   ```bash
   jq . .mission-control/tasks/task-*.json
   ```

## Best Practices

### 1. Regular Syncs

Pull changes before starting sessions:

```bash
cd $MISSION_CONTROL_PATH
git pull origin main
```

### 2. Review Auto-Tasks

Periodically review auto-generated tasks:

- Verify status is accurate
- Add missing details
- Link related tasks

### 3. Archive Completed Tasks

Move old completed tasks to archive:

```bash
# Create archive directory
mkdir -p .mission-control/archive/2026-02

# Move completed tasks older than 7 days
find .mission-control/tasks -name "*.json" -mtime +7 \
  -exec sh -c 'jq -r .status "$1" | grep -q DONE && mv "$1" .mission-control/archive/2026-02/' _ {} \;
```

### 4. Monitor Activity

Set up log monitoring:

```bash
# Add to crontab for daily summary
0 9 * * * cd $MISSION_CONTROL_PATH && ./scripts/daily-summary.sh | mail -s "MC Daily Summary" you@email.com
```

## API Reference

### Hook Environment Variables

| Variable | Hook | Description |
|----------|------|-------------|
| `OPENCLAW_SESSION_ID` | All | Unique session identifier |
| `OPENCLAW_AGENT_NAME` | All | Agent display name |
| `OPENCLAW_PROMPT` | start | Initial user prompt |
| `OPENCLAW_TOOL_NAME` | tool_use | Name of tool used |
| `OPENCLAW_TOOL_INPUT` | tool_use | Tool input parameters |
| `OPENCLAW_THINKING` | tool_use | Agent's reasoning |
| `OPENCLAW_RESULT` | complete | Session result |
| `OPENCLAW_ERROR` | error | Error message |
| `MISSION_CONTROL_TASK_ID` | All (after start) | Created task ID |

### Hook Return Values

- Exit 0: Success
- Exit 1: Error (OpenClaw will log)
- stdout: Key=Value pairs passed to subsequent hooks
