#!/bin/bash
#
# JARVIS Mission Control - OpenClaw Hook: Agent Error
# Called when an OpenClaw agent session encounters an error
#
# Environment variables (set by OpenClaw):
#   OPENCLAW_SESSION_ID     - Current session ID
#   OPENCLAW_AGENT_NAME     - Agent name
#   OPENCLAW_ERROR          - Error message
#   MISSION_CONTROL_TASK_ID - Task ID (from start hook)
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MC_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$MC_DIR")"
TASKS_DIR="$MC_DIR/tasks"
LOGS_DIR="$MC_DIR/logs"

# Get values from environment
SESSION_ID="${OPENCLAW_SESSION_ID:-unknown-session}"
AGENT_NAME="${OPENCLAW_AGENT_NAME:-unknown-agent}"
ERROR="${OPENCLAW_ERROR:-Unknown error occurred}"
TASK_ID="${MISSION_CONTROL_TASK_ID:-}"

# Timestamp
ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# If we have a task ID, update the task
if [ -n "$TASK_ID" ] && [ -f "$TASKS_DIR/$TASK_ID.json" ]; then
    if command -v jq &> /dev/null; then
        TASK_FILE="$TASKS_DIR/$TASK_ID.json"

        # Update task: change status to BLOCKED and add error comment
        UPDATED_TASK=$(jq --arg timestamp "$ISO_TIMESTAMP" --arg error "$ERROR" '
            .status = "BLOCKED" |
            .updated_at = $timestamp |
            .comments += [{
                "id": ("comment-" + ((.comments | length) + 1 | tostring | "00" + . | .[-3:])),
                "author": "system",
                "content": ("Session encountered an error.\n\nError:\n" + $error),
                "timestamp": $timestamp,
                "type": "blocked"
            }]
        ' "$TASK_FILE")

        echo "$UPDATED_TASK" > "$TASK_FILE"

        echo "Task $TASK_ID updated to BLOCKED status"
    fi
fi

# Log the event
LOG_FILE="$LOGS_DIR/$(date +%Y-%m-%d)-activity.log"
mkdir -p "$LOGS_DIR"
echo "[$ISO_TIMESTAMP] AGENT_ERROR session=$SESSION_ID agent=$AGENT_NAME task=$TASK_ID error=\"$ERROR\"" >> "$LOG_FILE"

# Auto-commit if git is available
if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    cd "$PROJECT_ROOT"
    git add "$TASKS_DIR/" "$LOG_FILE" 2>/dev/null || true
    git commit -m "[system] OpenClaw agent error: $AGENT_NAME" 2>/dev/null || true
fi

exit 0
