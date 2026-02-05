#!/bin/bash
set -euo pipefail

# add-human.sh - Register a human operator in Mission Control
# Usage: ./scripts/add-human.sh --id human-name --name "Full Name" [options]

show_help() {
    cat << 'EOF'
Usage: ./scripts/add-human.sh [OPTIONS]

Register a human operator in Mission Control.

REQUIRED:
  --id ID              Human ID (e.g., human-john, human-admin)
  --name NAME          Display name (e.g., "John Doe")

OPTIONAL:
  --role ROLE          Role: admin, reviewer, observer (default: admin)
  --designation TITLE  Title (default: "Project Owner")
  --email EMAIL        Email address
  --clearance LEVEL    Clearance: OMEGA, ALPHA, BETA (default: OMEGA)
  --help               Show this help

EXAMPLES:
  ./scripts/add-human.sh --id human-john --name "John Doe" --email "john@example.com"
  ./scripts/add-human.sh --id human-reviewer --name "Jane Smith" --role reviewer
EOF
    exit 0
}

# Defaults
HUMAN_ID=""
HUMAN_NAME=""
ROLE="admin"
DESIGNATION="Project Owner"
EMAIL=""
CLEARANCE="OMEGA"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --id) HUMAN_ID="$2"; shift 2 ;;
        --name) HUMAN_NAME="$2"; shift 2 ;;
        --role) ROLE="$2"; shift 2 ;;
        --designation) DESIGNATION="$2"; shift 2 ;;
        --email) EMAIL="$2"; shift 2 ;;
        --clearance) CLEARANCE="$2"; shift 2 ;;
        --help) show_help ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ -z "$HUMAN_ID" || -z "$HUMAN_NAME" ]]; then
    echo "Error: --id and --name are required"
    echo "Use --help for usage"
    exit 1
fi

# Ensure ID starts with human-
if [[ ! "$HUMAN_ID" =~ ^human- ]]; then
    HUMAN_ID="human-${HUMAN_ID}"
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
OUTPUT_FILE="${REPO_ROOT}/.mission-control/humans/${HUMAN_ID}.json"

if [[ -f "$OUTPUT_FILE" ]]; then
    echo "Error: Human ${HUMAN_ID} already exists at ${OUTPUT_FILE}"
    exit 1
fi

SEED=$(echo "$HUMAN_ID" | sed 's/human-//')
AVATAR="https://api.dicebear.com/7.x/avataaars/svg?seed=${SEED}"

EMAIL_LINE=""
if [[ -n "$EMAIL" ]]; then
    EMAIL_LINE="\"email\": \"${EMAIL}\","
fi

cat > "$OUTPUT_FILE" << EOF
{
  "id": "${HUMAN_ID}",
  "name": "${HUMAN_NAME}",
  "type": "human",
  "role": "${ROLE}",
  "designation": "${DESIGNATION}",
  ${EMAIL_LINE}
  "avatar": "${AVATAR}",
  "status": "online",
  "capabilities": ["all", "override", "approve"],
  "channels": [],
  "metadata": {
    "clearance": "${CLEARANCE}",
    "timezone": "UTC"
  }
}
EOF

echo "Human registered: ${HUMAN_ID}"
echo "  Name: ${HUMAN_NAME}"
echo "  Role: ${ROLE}"
echo "  File: ${OUTPUT_FILE}"
echo ""
echo "Next steps:"
echo "  git add ${OUTPUT_FILE}"
echo "  git commit -m \"[system] Registered human: ${HUMAN_NAME}\""
echo "  git push"
