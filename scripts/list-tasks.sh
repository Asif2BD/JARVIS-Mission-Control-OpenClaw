#!/bin/bash
#
# JARVIS Mission Control - List Tasks Script
# Lists all tasks with optional filtering
#
# Usage: ./scripts/list-tasks.sh [options]
#
# Options:
#   --status <status>     Filter by status
#   --assignee <id>       Filter by assignee
#   --priority <level>    Filter by priority
#   --label <label>       Filter by label
#   --format <format>     Output format (table, json, simple)
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TASKS_DIR="$PROJECT_ROOT/.mission-control/tasks"

# Defaults
STATUS_FILTER=""
ASSIGNEE_FILTER=""
PRIORITY_FILTER=""
LABEL_FILTER=""
FORMAT="table"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Usage
usage() {
    cat << EOF
Usage: $(basename "$0") [options]

Options:
  --status <status>     Filter by status (INBOX, ASSIGNED, IN_PROGRESS, REVIEW, DONE, BLOCKED)
  --assignee <id>       Filter by assignee
  --priority <level>    Filter by priority (critical, high, medium, low)
  --label <label>       Filter by label
  --format <format>     Output format: table (default), json, simple
  -h, --help            Show this help message

Examples:
  $(basename "$0")
  $(basename "$0") --status IN_PROGRESS
  $(basename "$0") --assignee agent-jarvis --format json
EOF
}

# Status color
status_color() {
    case "$1" in
        INBOX) echo -e "${CYAN}$1${NC}" ;;
        ASSIGNED) echo -e "${BLUE}$1${NC}" ;;
        IN_PROGRESS) echo -e "${YELLOW}$1${NC}" ;;
        REVIEW) echo -e "${PURPLE}$1${NC}" ;;
        DONE) echo -e "${GREEN}$1${NC}" ;;
        BLOCKED) echo -e "${RED}$1${NC}" ;;
        *) echo "$1" ;;
    esac
}

# Priority color
priority_color() {
    case "$1" in
        critical) echo -e "${RED}$1${NC}" ;;
        high) echo -e "${YELLOW}$1${NC}" ;;
        medium) echo -e "${CYAN}$1${NC}" ;;
        low) echo -e "${GREEN}$1${NC}" ;;
        *) echo "$1" ;;
    esac
}

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        --status)
            shift
            STATUS_FILTER="$1"
            ;;
        --assignee)
            shift
            ASSIGNEE_FILTER="$1"
            ;;
        --priority)
            shift
            PRIORITY_FILTER="$1"
            ;;
        --label)
            shift
            LABEL_FILTER="$1"
            ;;
        --format)
            shift
            FORMAT="$1"
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
    shift
done

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed"
    echo "Install with: apt-get install jq (Linux) or brew install jq (macOS)"
    exit 1
fi

# Check tasks directory
if [ ! -d "$TASKS_DIR" ]; then
    echo "No tasks found (directory does not exist)"
    exit 0
fi

# Collect tasks
TASKS=()
for file in "$TASKS_DIR"/*.json 2>/dev/null; do
    [ -e "$file" ] || continue

    # Read task data
    id=$(jq -r '.id' "$file")
    title=$(jq -r '.title' "$file")
    status=$(jq -r '.status' "$file")
    priority=$(jq -r '.priority' "$file")
    assignee=$(jq -r '.assignee // "unassigned"' "$file")
    labels=$(jq -r '.labels | join(",")' "$file")

    # Apply filters
    if [ -n "$STATUS_FILTER" ] && [ "$status" != "$STATUS_FILTER" ]; then
        continue
    fi

    if [ -n "$ASSIGNEE_FILTER" ] && [ "$assignee" != "$ASSIGNEE_FILTER" ]; then
        continue
    fi

    if [ -n "$PRIORITY_FILTER" ] && [ "$priority" != "$PRIORITY_FILTER" ]; then
        continue
    fi

    if [ -n "$LABEL_FILTER" ] && [[ ! "$labels" == *"$LABEL_FILTER"* ]]; then
        continue
    fi

    TASKS+=("$id|$title|$status|$priority|$assignee|$labels|$file")
done

# No tasks found
if [ ${#TASKS[@]} -eq 0 ]; then
    echo "No tasks found"
    exit 0
fi

# Output based on format
case "$FORMAT" in
    json)
        echo "["
        first=true
        for task in "${TASKS[@]}"; do
            IFS='|' read -r id title status priority assignee labels file <<< "$task"
            if [ "$first" = true ]; then
                first=false
            else
                echo ","
            fi
            cat "$file"
        done
        echo ""
        echo "]"
        ;;

    simple)
        for task in "${TASKS[@]}"; do
            IFS='|' read -r id title status priority assignee labels file <<< "$task"
            echo "$id: $title [$status]"
        done
        ;;

    table|*)
        # Print header
        printf "%-35s %-40s %-12s %-10s %-25s\n" "ID" "TITLE" "STATUS" "PRIORITY" "ASSIGNEE"
        printf "%s\n" "$(printf '=%.0s' {1..130})"

        # Print tasks
        for task in "${TASKS[@]}"; do
            IFS='|' read -r id title status priority assignee labels file <<< "$task"

            # Truncate title if too long
            if [ ${#title} -gt 38 ]; then
                title="${title:0:35}..."
            fi

            # Truncate assignee if too long
            if [ ${#assignee} -gt 23 ]; then
                assignee="${assignee:0:20}..."
            fi

            # Print with colors
            printf "%-35s %-40s " "$id" "$title"
            printf "%-12b " "$(status_color "$status")"
            printf "%-10b " "$(priority_color "$priority")"
            printf "%-25s\n" "$assignee"
        done

        echo ""
        echo "Total: ${#TASKS[@]} task(s)"
        ;;
esac
