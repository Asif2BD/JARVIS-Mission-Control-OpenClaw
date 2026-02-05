#!/bin/bash
#
# JARVIS Mission Control - OpenClaw Hook: Agent Complete
# Called when an OpenClaw agent session completes successfully
#
# Environment variables (set by OpenClaw):
#   OPENCLAW_SESSION_ID     - Current session ID
#   OPENCLAW_AGENT_NAME     - Agent name
#   OPENCLAW_RESULT         - Final result/output
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
RESULT="${OPENCLAW_RESULT:-Session completed}"
TASK_ID="${MISSION_CONTROL_TASK_ID:-}"

# Timestamp
ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# If we have a task ID, update the task
if [ -n "$TASK_ID" ] && [ -f "$TASKS_DIR/$TASK_ID.json" ]; then
    # Check if jq is available
    if command -v jq &> /dev/null; then
        TASK_FILE="$TASKS_DIR/$TASK_ID.json"

        # Update task: change status to REVIEW and add completion comment
        UPDATED_TASK=$(jq --arg timestamp "$ISO_TIMESTAMP" --arg result "$RESULT" '
            .status = "REVIEW" |
            .updated_at = $timestamp |
            .comments += [{
                "id": ("comment-" + ((.comments | length) + 1 | tostring | "00" + . | .[-3:])),
                "author": "system",
                "content": ("Session completed successfully.\n\nResult:\n" + $result),
                "timestamp": $timestamp,
                "type": "progress"
            }]
        ' "$TASK_FILE")

        echo "$UPDATED_TASK" > "$TASK_FILE"

        echo "Task $TASK_ID updated to REVIEW status"
    else
        echo "Warning: jq not installed, cannot update task"
    fi
fi

# Log the event
LOG_FILE="$LOGS_DIR/$(date +%Y-%m-%d)-activity.log"
mkdir -p "$LOGS_DIR"
echo "[$ISO_TIMESTAMP] AGENT_COMPLETE session=$SESSION_ID agent=$AGENT_NAME task=$TASK_ID" >> "$LOG_FILE"

# Auto-commit if git is available
if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    cd "$PROJECT_ROOT"
    git add "$TASKS_DIR/" "$LOG_FILE" 2>/dev/null || true
    git commit -m "[system] OpenClaw agent completed: $AGENT_NAME" 2>/dev/null || true
fi

exit 0
