#!/bin/bash
# mc-task.sh - Create/update Mission Control tasks from CLI
# Usage: ./mc-task.sh create "Task title" "Description" [assignee]
# Usage: ./mc-task.sh update <task-id> <status> [result]

MC_URL="${MC_SERVER_URL:-http://localhost:3000}"
MC_DIR="${MISSION_CONTROL_DIR:-/root/.openclaw/workspace/agents/tank/mission-control/.mission-control}"

create_task() {
    local title="$1"
    local description="$2"
    local assignee="${3:-unassigned}"
    local task_id="task-$(date +%Y%m%d)-$(date +%s)"
    
    cat > "$MC_DIR/tasks/$task_id.json" << EOF
{
  "id": "$task_id",
  "title": "$title",
  "description": "$description",
  "status": "pending",
  "priority": "normal",
  "assignee": "$assignee",
  "createdAt": "$(date -Iseconds)",
  "createdBy": "agent",
  "mentions": ["$assignee"],
  "progress": 0
}
EOF
    echo "Created: $task_id"
}

update_task() {
    local task_id="$1"
    local status="$2"
    local result="${3:-}"
    local task_file="$MC_DIR/tasks/$task_id.json"
    
    if [ ! -f "$task_file" ]; then
        echo "Task not found: $task_id"
        exit 1
    fi
    
    # Update status using jq if available, else sed
    if command -v jq &> /dev/null; then
        jq ".status = \"$status\" | .updatedAt = \"$(date -Iseconds)\"" "$task_file" > "$task_file.tmp" && mv "$task_file.tmp" "$task_file"
    else
        sed -i "s/\"status\": \"[^\"]*\"/\"status\": \"$status\"/" "$task_file"
    fi
    echo "Updated: $task_id -> $status"
}

case "$1" in
    create) create_task "$2" "$3" "$4" ;;
    update) update_task "$2" "$3" "$4" ;;
    *) echo "Usage: $0 {create|update} ..." ;;
esac
