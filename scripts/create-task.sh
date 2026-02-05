#!/bin/bash
#
# JARVIS Mission Control - Create Task Script
# Creates a new task file in .mission-control/tasks/
#
# Usage: ./scripts/create-task.sh "Task Title" [options]
#
# Options:
#   --priority <level>    Set priority (critical, high, medium, low)
#   --labels <labels>     Comma-separated labels
#   --assignee <id>       Assign to agent/human
#   --description <text>  Task description (or read from stdin)
#   --dry-run            Show task JSON without creating file
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TASKS_DIR="$PROJECT_ROOT/.mission-control/tasks"

# Defaults
PRIORITY="medium"
LABELS=""
ASSIGNEE=""
DESCRIPTION=""
DRY_RUN=false
CREATED_BY="${MC_AGENT_ID:-human-user}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
usage() {
    cat << EOF
Usage: $(basename "$0") "Task Title" [options]

Options:
  --priority <level>     Set priority (critical, high, medium, low)
  --labels <labels>      Comma-separated labels
  --assignee <id>        Assign to agent/human (e.g., agent-jarvis)
  --description <text>   Task description
  --dry-run              Show task JSON without creating file
  -h, --help             Show this help message

Examples:
  $(basename "$0") "Implement login feature" --priority high --labels feature,backend
  $(basename "$0") "Fix bug #123" --assignee agent-backend-specialist
  echo "Detailed description" | $(basename "$0") "Task Title" --description -
EOF
}

error() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

info() {
    echo -e "${GREEN}$1${NC}"
}

warn() {
    echo -e "${YELLOW}$1${NC}"
}

# Generate task ID
generate_id() {
    local date_part=$(date +%Y%m%d)
    local title_slug=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-' | head -c 30)
    echo "task-${date_part}-${title_slug}"
}

# Parse labels into JSON array
parse_labels() {
    local labels="$1"
    if [ -z "$labels" ]; then
        echo "[]"
        return
    fi

    local json="["
    local first=true
    IFS=',' read -ra LABEL_ARRAY <<< "$labels"
    for label in "${LABEL_ARRAY[@]}"; do
        label=$(echo "$label" | xargs)  # trim whitespace
        if [ "$first" = true ]; then
            first=false
        else
            json+=","
        fi
        json+="\"$label\""
    done
    json+="]"
    echo "$json"
}

# Generate task JSON
generate_task_json() {
    local id="$1"
    local title="$2"
    local description="$3"
    local priority="$4"
    local labels_json="$5"
    local assignee="$6"
    local created_by="$7"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local assignee_json="null"
    if [ -n "$assignee" ]; then
        assignee_json="\"$assignee\""
    fi

    local status="INBOX"
    if [ -n "$assignee" ]; then
        status="ASSIGNED"
    fi

    cat << EOF
{
  "id": "$id",
  "title": "$title",
  "description": "$description",
  "status": "$status",
  "priority": "$priority",
  "assignee": $assignee_json,
  "created_by": "$created_by",
  "created_at": "$timestamp",
  "updated_at": "$timestamp",
  "due_date": null,
  "labels": $labels_json,
  "estimated_hours": null,
  "actual_hours": null,
  "comments": [
    {
      "id": "comment-001",
      "author": "$created_by",
      "content": "Task created via create-task.sh",
      "timestamp": "$timestamp",
      "type": "system"
    }
  ],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": [],
  "workflow_id": null,
  "metadata": {}
}
EOF
}

# Parse arguments
if [ $# -lt 1 ]; then
    usage
    exit 1
fi

TITLE=""

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        --priority)
            shift
            PRIORITY="$1"
            if [[ ! "$PRIORITY" =~ ^(critical|high|medium|low)$ ]]; then
                error "Invalid priority: $PRIORITY (must be critical, high, medium, or low)"
            fi
            ;;
        --labels)
            shift
            LABELS="$1"
            ;;
        --assignee)
            shift
            ASSIGNEE="$1"
            ;;
        --description)
            shift
            if [ "$1" = "-" ]; then
                DESCRIPTION=$(cat)
            else
                DESCRIPTION="$1"
            fi
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        -*)
            error "Unknown option: $1"
            ;;
        *)
            if [ -z "$TITLE" ]; then
                TITLE="$1"
            else
                error "Unexpected argument: $1"
            fi
            ;;
    esac
    shift
done

# Validate
if [ -z "$TITLE" ]; then
    error "Task title is required"
fi

# Use title as description if not provided
if [ -z "$DESCRIPTION" ]; then
    DESCRIPTION="$TITLE"
fi

# Generate task
TASK_ID=$(generate_id "$TITLE")
LABELS_JSON=$(parse_labels "$LABELS")
TASK_JSON=$(generate_task_json "$TASK_ID" "$TITLE" "$DESCRIPTION" "$PRIORITY" "$LABELS_JSON" "$ASSIGNEE" "$CREATED_BY")

# Output
if [ "$DRY_RUN" = true ]; then
    warn "Dry run - task not created"
    echo ""
    echo "Task ID: $TASK_ID"
    echo "File: $TASKS_DIR/$TASK_ID.json"
    echo ""
    echo "$TASK_JSON"
    exit 0
fi

# Ensure tasks directory exists
mkdir -p "$TASKS_DIR"

# Write task file
TASK_FILE="$TASKS_DIR/$TASK_ID.json"
echo "$TASK_JSON" > "$TASK_FILE"

info "Task created successfully!"
echo ""
echo "ID:   $TASK_ID"
echo "File: $TASK_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the task: cat $TASK_FILE"
echo "  2. Commit: git add $TASK_FILE && git commit -m '[$CREATED_BY] Created task: $TITLE'"
echo "  3. Push: git push"
