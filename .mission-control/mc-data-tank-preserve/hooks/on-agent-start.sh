#!/bin/bash
#
# JARVIS Mission Control - OpenClaw Hook: Agent Start
# Called when an OpenClaw agent session starts
#
# Environment variables (set by OpenClaw):
#   OPENCLAW_SESSION_ID - Current session ID
#   OPENCLAW_AGENT_NAME - Agent name
#   OPENCLAW_PROMPT     - Initial user prompt
#
# This hook creates a new task for tracking the agent's work
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MC_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$MC_DIR")"
TASKS_DIR="$MC_DIR/tasks"
LOGS_DIR="$MC_DIR/logs"

# Get values from environment or use defaults
SESSION_ID="${OPENCLAW_SESSION_ID:-unknown-session}"
AGENT_NAME="${OPENCLAW_AGENT_NAME:-unknown-agent}"
PROMPT="${OPENCLAW_PROMPT:-Agent session started}"

# Generate task ID
DATE_PART=$(date +%Y%m%d)
TIMESTAMP=$(date +%s)
TASK_ID="task-${DATE_PART}-session-${TIMESTAMP}"

# Determine agent ID from name
AGENT_ID="agent-$(echo "$AGENT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

# Create timestamp
ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Truncate prompt if too long for title (use first 100 chars)
TITLE="${PROMPT:0:100}"
if [ ${#PROMPT} -gt 100 ]; then
    TITLE="${TITLE}..."
fi

# Create task JSON
TASK_JSON=$(cat << EOF
{
  "id": "$TASK_ID",
  "title": "$TITLE",
  "description": "OpenClaw agent session task.\n\nSession ID: $SESSION_ID\nAgent: $AGENT_NAME\n\nOriginal prompt:\n$PROMPT",
  "status": "IN_PROGRESS",
  "priority": "medium",
  "assignee": "$AGENT_ID",
  "created_by": "system",
  "created_at": "$ISO_TIMESTAMP",
  "updated_at": "$ISO_TIMESTAMP",
  "due_date": null,
  "labels": ["openclaw", "auto-generated"],
  "estimated_hours": null,
  "actual_hours": null,
  "comments": [
    {
      "id": "comment-001",
      "author": "system",
      "content": "Task automatically created from OpenClaw session $SESSION_ID",
      "timestamp": "$ISO_TIMESTAMP",
      "type": "system"
    }
  ],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": [],
  "workflow_id": null,
  "metadata": {
    "openclaw_session_id": "$SESSION_ID",
    "openclaw_agent_name": "$AGENT_NAME",
    "source": "openclaw_hook"
  }
}
EOF
)

# Ensure directories exist
mkdir -p "$TASKS_DIR"
mkdir -p "$LOGS_DIR"

# Write task file
echo "$TASK_JSON" > "$TASKS_DIR/$TASK_ID.json"

# Log the event
LOG_FILE="$LOGS_DIR/$(date +%Y-%m-%d)-activity.log"
echo "[$ISO_TIMESTAMP] AGENT_START session=$SESSION_ID agent=$AGENT_NAME task=$TASK_ID" >> "$LOG_FILE"

# Output task ID for OpenClaw to use
echo "MISSION_CONTROL_TASK_ID=$TASK_ID"

# Auto-commit if git is available and we're in a repo
if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    cd "$PROJECT_ROOT"
    git add "$TASKS_DIR/$TASK_ID.json" "$LOG_FILE" 2>/dev/null || true
    git commit -m "[system] OpenClaw agent started: $AGENT_NAME - $TITLE" 2>/dev/null || true
fi

exit 0
