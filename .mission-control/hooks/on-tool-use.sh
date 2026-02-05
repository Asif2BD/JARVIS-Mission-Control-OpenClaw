#!/bin/bash
#
# JARVIS Mission Control - OpenClaw Hook: Tool Use
# Called when an OpenClaw agent uses a tool
#
# Environment variables (set by OpenClaw):
#   OPENCLAW_SESSION_ID     - Current session ID
#   OPENCLAW_AGENT_NAME     - Agent name
#   OPENCLAW_TOOL_NAME      - Name of the tool used
#   OPENCLAW_TOOL_INPUT     - Tool input (may be large)
#   OPENCLAW_THINKING       - Agent's thinking/reasoning
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
TOOL_NAME="${OPENCLAW_TOOL_NAME:-unknown-tool}"
THINKING="${OPENCLAW_THINKING:-}"
TASK_ID="${MISSION_CONTROL_TASK_ID:-}"

# Timestamp
ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Only add comments for significant tools (to avoid noise)
SIGNIFICANT_TOOLS=("Write" "Edit" "Bash" "Task" "WebFetch" "WebSearch")
IS_SIGNIFICANT=false
for tool in "${SIGNIFICANT_TOOLS[@]}"; do
    if [ "$TOOL_NAME" = "$tool" ]; then
        IS_SIGNIFICANT=true
        break
    fi
done

# If we have a task ID and this is a significant tool, add a progress comment
if [ -n "$TASK_ID" ] && [ -f "$TASKS_DIR/$TASK_ID.json" ] && [ "$IS_SIGNIFICANT" = true ]; then
    if command -v jq &> /dev/null; then
        TASK_FILE="$TASKS_DIR/$TASK_ID.json"

        # Create comment content
        COMMENT_CONTENT="Used tool: $TOOL_NAME"
        if [ -n "$THINKING" ]; then
            # Truncate thinking if too long
            TRUNCATED_THINKING="${THINKING:0:500}"
            if [ ${#THINKING} -gt 500 ]; then
                TRUNCATED_THINKING="${TRUNCATED_THINKING}..."
            fi
            COMMENT_CONTENT="$COMMENT_CONTENT\n\nReasoning: $TRUNCATED_THINKING"
        fi

        # Update task: add progress comment
        UPDATED_TASK=$(jq --arg timestamp "$ISO_TIMESTAMP" --arg content "$COMMENT_CONTENT" '
            .updated_at = $timestamp |
            .comments += [{
                "id": ("comment-" + ((.comments | length) + 1 | tostring | "00" + . | .[-3:])),
                "author": "system",
                "content": $content,
                "timestamp": $timestamp,
                "type": "progress"
            }]
        ' "$TASK_FILE")

        echo "$UPDATED_TASK" > "$TASK_FILE"
    fi
fi

# Log the event (all tools)
LOG_FILE="$LOGS_DIR/$(date +%Y-%m-%d)-activity.log"
mkdir -p "$LOGS_DIR"
echo "[$ISO_TIMESTAMP] TOOL_USE session=$SESSION_ID agent=$AGENT_NAME tool=$TOOL_NAME task=$TASK_ID" >> "$LOG_FILE"

exit 0
