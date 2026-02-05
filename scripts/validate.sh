#!/bin/bash
#
# JARVIS Mission Control - Validation Script
# Validates all data files against their JSON schemas
#
# Usage: ./scripts/validate.sh [file]
#
# If no file is specified, validates all files in .mission-control/
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MC_DIR="$PROJECT_ROOT/.mission-control"
SCHEMA_DIR="$MC_DIR/schema"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
PASSED=0
FAILED=0
WARNINGS=0

# Functions
info() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if jq is available for JSON validation
check_jq() {
    if ! command -v jq &> /dev/null; then
        warn "jq not installed - using basic JSON syntax validation only"
        return 1
    fi
    return 0
}

# Basic JSON syntax validation
validate_json_syntax() {
    local file="$1"

    if command -v jq &> /dev/null; then
        if jq empty "$file" 2>/dev/null; then
            return 0
        else
            return 1
        fi
    elif command -v python3 &> /dev/null; then
        if python3 -c "import json; json.load(open('$file'))" 2>/dev/null; then
            return 0
        else
            return 1
        fi
    else
        # Try node.js
        if command -v node &> /dev/null; then
            if node -e "JSON.parse(require('fs').readFileSync('$file'))" 2>/dev/null; then
                return 0
            else
                return 1
            fi
        fi
    fi

    warn "No JSON validator available (install jq, python3, or node)"
    return 0
}

# Validate YAML syntax
validate_yaml_syntax() {
    local file="$1"

    if command -v python3 &> /dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
            return 0
        else
            return 1
        fi
    fi

    warn "Cannot validate YAML (install python3 with pyyaml)"
    return 0
}

# Validate a task file
validate_task() {
    local file="$1"
    local basename=$(basename "$file")

    # Check JSON syntax
    if ! validate_json_syntax "$file"; then
        error "$basename: Invalid JSON syntax"
        return 1
    fi

    # Check required fields (using jq if available)
    if command -v jq &> /dev/null; then
        local missing=""

        # Check id
        if [ "$(jq -r '.id // empty' "$file")" = "" ]; then
            missing+="id, "
        fi

        # Check title
        if [ "$(jq -r '.title // empty' "$file")" = "" ]; then
            missing+="title, "
        fi

        # Check status
        local status=$(jq -r '.status // empty' "$file")
        if [ "$status" = "" ]; then
            missing+="status, "
        elif [[ ! "$status" =~ ^(INBOX|ASSIGNED|IN_PROGRESS|REVIEW|DONE|BLOCKED|CANCELLED)$ ]]; then
            error "$basename: Invalid status '$status'"
            return 1
        fi

        # Check priority
        local priority=$(jq -r '.priority // empty' "$file")
        if [ "$priority" = "" ]; then
            missing+="priority, "
        elif [[ ! "$priority" =~ ^(critical|high|medium|low)$ ]]; then
            error "$basename: Invalid priority '$priority'"
            return 1
        fi

        if [ -n "$missing" ]; then
            error "$basename: Missing required fields: ${missing%, }"
            return 1
        fi
    fi

    info "$basename: Valid task"
    return 0
}

# Validate an agent file
validate_agent() {
    local file="$1"
    local basename=$(basename "$file")

    # Check JSON syntax
    if ! validate_json_syntax "$file"; then
        error "$basename: Invalid JSON syntax"
        return 1
    fi

    # Check required fields
    if command -v jq &> /dev/null; then
        local missing=""

        if [ "$(jq -r '.id // empty' "$file")" = "" ]; then
            missing+="id, "
        fi

        if [ "$(jq -r '.name // empty' "$file")" = "" ]; then
            missing+="name, "
        fi

        local agent_type=$(jq -r '.type // empty' "$file")
        if [ "$agent_type" = "" ]; then
            missing+="type, "
        elif [[ ! "$agent_type" =~ ^(ai|human|hybrid)$ ]]; then
            error "$basename: Invalid type '$agent_type'"
            return 1
        fi

        local role=$(jq -r '.role // empty' "$file")
        if [ "$role" = "" ]; then
            missing+="role, "
        elif [[ ! "$role" =~ ^(lead|specialist|reviewer|observer)$ ]]; then
            error "$basename: Invalid role '$role'"
            return 1
        fi

        if [ -n "$missing" ]; then
            error "$basename: Missing required fields: ${missing%, }"
            return 1
        fi
    fi

    info "$basename: Valid agent"
    return 0
}

# Validate a workflow file
validate_workflow() {
    local file="$1"
    local basename=$(basename "$file")

    # Check JSON syntax
    if ! validate_json_syntax "$file"; then
        error "$basename: Invalid JSON syntax"
        return 1
    fi

    # Check required fields
    if command -v jq &> /dev/null; then
        if [ "$(jq -r '.id // empty' "$file")" = "" ]; then
            error "$basename: Missing required field: id"
            return 1
        fi

        if [ "$(jq -r '.stages | length' "$file")" = "0" ]; then
            error "$basename: Workflow must have at least one stage"
            return 1
        fi
    fi

    info "$basename: Valid workflow"
    return 0
}

# Validate config file
validate_config() {
    local file="$1"
    local basename=$(basename "$file")

    if ! validate_yaml_syntax "$file"; then
        error "$basename: Invalid YAML syntax"
        return 1
    fi

    info "$basename: Valid config"
    return 0
}

# Validate a single file
validate_file() {
    local file="$1"
    TOTAL=$((TOTAL + 1))

    if [[ "$file" == *"/tasks/"* && "$file" == *.json ]]; then
        if validate_task "$file"; then
            PASSED=$((PASSED + 1))
        else
            FAILED=$((FAILED + 1))
        fi
    elif [[ "$file" == *"/agents/"* && "$file" == *.json ]]; then
        if validate_agent "$file"; then
            PASSED=$((PASSED + 1))
        else
            FAILED=$((FAILED + 1))
        fi
    elif [[ "$file" == *"/workflows/"* && "$file" == *.json ]]; then
        if validate_workflow "$file"; then
            PASSED=$((PASSED + 1))
        else
            FAILED=$((FAILED + 1))
        fi
    elif [[ "$file" == */config.yaml ]]; then
        if validate_config "$file"; then
            PASSED=$((PASSED + 1))
        else
            FAILED=$((FAILED + 1))
        fi
    elif [[ "$file" == *.json ]]; then
        if validate_json_syntax "$file"; then
            info "$(basename "$file"): Valid JSON"
            PASSED=$((PASSED + 1))
        else
            error "$(basename "$file"): Invalid JSON syntax"
            FAILED=$((FAILED + 1))
        fi
    else
        warn "$(basename "$file"): Skipped (unknown type)"
        WARNINGS=$((WARNINGS + 1))
        TOTAL=$((TOTAL - 1))
    fi
}

# Main
echo "JARVIS Mission Control - Data Validation"
echo "========================================"
echo ""

# Check if a specific file was provided
if [ $# -gt 0 ]; then
    for file in "$@"; do
        if [ -f "$file" ]; then
            validate_file "$file"
        else
            error "File not found: $file"
            FAILED=$((FAILED + 1))
        fi
    done
else
    # Validate all files
    echo "Validating all files in $MC_DIR..."
    echo ""

    # Config
    if [ -f "$MC_DIR/config.yaml" ]; then
        validate_file "$MC_DIR/config.yaml"
    fi

    # Tasks
    if [ -d "$MC_DIR/tasks" ]; then
        for file in "$MC_DIR/tasks"/*.json 2>/dev/null; do
            [ -e "$file" ] || continue
            validate_file "$file"
        done
    fi

    # Agents
    if [ -d "$MC_DIR/agents" ]; then
        for file in "$MC_DIR/agents"/*.json 2>/dev/null; do
            [ -e "$file" ] || continue
            validate_file "$file"
        done
    fi

    # Workflows
    if [ -d "$MC_DIR/workflows" ]; then
        for file in "$MC_DIR/workflows"/*.json 2>/dev/null; do
            [ -e "$file" ] || continue
            validate_file "$file"
        done
    fi

    # Schemas
    if [ -d "$SCHEMA_DIR" ]; then
        for file in "$SCHEMA_DIR"/*.json 2>/dev/null; do
            [ -e "$file" ] || continue
            TOTAL=$((TOTAL + 1))
            if validate_json_syntax "$file"; then
                info "$(basename "$file"): Valid schema"
                PASSED=$((PASSED + 1))
            else
                error "$(basename "$file"): Invalid JSON syntax"
                FAILED=$((FAILED + 1))
            fi
        done
    fi
fi

# Summary
echo ""
echo "========================================"
echo "Validation Summary"
echo "========================================"
echo "Total:    $TOTAL"
echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
if [ $WARNINGS -gt 0 ]; then
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
fi
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Validation FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Validation PASSED${NC}"
    exit 0
fi
