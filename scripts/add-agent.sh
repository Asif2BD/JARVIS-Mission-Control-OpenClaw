#!/bin/bash
set -euo pipefail

# add-agent.sh - Register a new AI agent in Mission Control
# Usage: ./scripts/add-agent.sh --id agent-myagent --name "My Agent" [options]

show_help() {
    cat << 'EOF'
Usage: ./scripts/add-agent.sh [OPTIONS]

Register a new AI agent in Mission Control.

REQUIRED:
  --id ID              Agent ID (e.g., agent-coder, agent-reviewer)
  --name NAME          Display name (e.g., "Code Specialist")

OPTIONAL:
  --role ROLE          Role: lead, specialist, reviewer, observer (default: specialist)
  --designation TITLE  Job title (default: "AI Agent")
  --model MODEL        AI model (default: claude-opus-4)
  --capabilities LIST  Comma-separated capabilities (default: coding,review)
  --about TEXT         Personality description
  --tone TONE          Communication tone (default: professional)
  --traits LIST        Comma-separated personality traits (default: analytical,collaborative,thorough)
  --greeting TEXT      Profile greeting message
  --clearance LEVEL    Clearance: OMEGA, ALPHA, BETA, ORACLE (default: BETA)
  --owner ID           Human owner ID (default: none)
  --help               Show this help

EXAMPLES:
  # Basic agent
  ./scripts/add-agent.sh --id agent-coder --name "Code Specialist"

  # Full agent with personality
  ./scripts/add-agent.sh \
    --id agent-security \
    --name "Security Sentinel" \
    --role specialist \
    --designation "Security Operations" \
    --capabilities "security,audit,monitoring" \
    --about "I focus on security audits and threat detection." \
    --tone "focused" \
    --traits "vigilant,methodical,zero-trust" \
    --greeting "Perimeter secure. Report any anomalies." \
    --clearance ALPHA \
    --owner human-admin

  # Batch import multiple agents
  ./scripts/add-agent.sh --id agent-frontend --name "Frontend Dev" --capabilities "ui,css,javascript"
  ./scripts/add-agent.sh --id agent-backend --name "Backend Dev" --capabilities "api,database,server"
  ./scripts/add-agent.sh --id agent-tester --name "QA Tester" --role reviewer --capabilities "testing,qa,automation"
EOF
    exit 0
}

# Defaults
AGENT_ID=""
AGENT_NAME=""
ROLE="specialist"
DESIGNATION="AI Agent"
MODEL="claude-opus-4"
CAPABILITIES="coding,review"
ABOUT=""
TONE="professional"
TRAITS="analytical,collaborative,thorough"
GREETING=""
CLEARANCE="BETA"
OWNER=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --id) AGENT_ID="$2"; shift 2 ;;
        --name) AGENT_NAME="$2"; shift 2 ;;
        --role) ROLE="$2"; shift 2 ;;
        --designation) DESIGNATION="$2"; shift 2 ;;
        --model) MODEL="$2"; shift 2 ;;
        --capabilities) CAPABILITIES="$2"; shift 2 ;;
        --about) ABOUT="$2"; shift 2 ;;
        --tone) TONE="$2"; shift 2 ;;
        --traits) TRAITS="$2"; shift 2 ;;
        --greeting) GREETING="$2"; shift 2 ;;
        --clearance) CLEARANCE="$2"; shift 2 ;;
        --owner) OWNER="$2"; shift 2 ;;
        --help) show_help ;;
        *) echo "Unknown option: $1"; echo "Use --help for usage"; exit 1 ;;
    esac
done

# Validate required fields
if [[ -z "$AGENT_ID" ]]; then
    echo "Error: --id is required"
    echo "Use --help for usage"
    exit 1
fi

if [[ -z "$AGENT_NAME" ]]; then
    echo "Error: --name is required"
    echo "Use --help for usage"
    exit 1
fi

# Ensure ID starts with agent-
if [[ ! "$AGENT_ID" =~ ^agent- ]]; then
    AGENT_ID="agent-${AGENT_ID}"
fi

# Build capabilities JSON array
IFS=',' read -ra CAP_ARRAY <<< "$CAPABILITIES"
CAP_JSON=$(printf '"%s",' "${CAP_ARRAY[@]}")
CAP_JSON="[${CAP_JSON%,}]"

# Build traits JSON array
IFS=',' read -ra TRAIT_ARRAY <<< "$TRAITS"
TRAIT_JSON=$(printf '"%s",' "${TRAIT_ARRAY[@]}")
TRAIT_JSON="[${TRAIT_JSON%,}]"

# Set defaults for personality
if [[ -z "$ABOUT" ]]; then
    ABOUT="$AGENT_NAME - a $ROLE agent specializing in ${CAPABILITIES//,/, }."
fi
if [[ -z "$GREETING" ]]; then
    GREETING="$AGENT_NAME online and ready."
fi

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SEED=$(echo "$AGENT_ID" | sed 's/agent-//')
AVATAR="https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${SEED}"

# Find repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
OUTPUT_FILE="${REPO_ROOT}/.mission-control/agents/${AGENT_ID}.json"

# Check if agent already exists
if [[ -f "$OUTPUT_FILE" ]]; then
    echo "Error: Agent ${AGENT_ID} already exists at ${OUTPUT_FILE}"
    echo "Delete it first if you want to re-register."
    exit 1
fi

# Build owner metadata
OWNER_LINE=""
if [[ -n "$OWNER" ]]; then
    OWNER_LINE="\"owner\": \"${OWNER}\","
fi

# Write agent file
cat > "$OUTPUT_FILE" << EOF
{
  "id": "${AGENT_ID}",
  "name": "${AGENT_NAME}",
  "type": "ai",
  "role": "${ROLE}",
  "designation": "${DESIGNATION}",
  "model": "${MODEL}",
  "avatar": "${AVATAR}",
  "status": "active",
  "parent_agent": null,
  "sub_agents": [],
  "capabilities": ${CAP_JSON},
  "personality": {
    "about": "${ABOUT}",
    "tone": "${TONE}",
    "traits": ${TRAIT_JSON},
    "greeting": "${GREETING}"
  },
  "channels": [],
  "registered_at": "${TIMESTAMP}",
  "last_active": "${TIMESTAMP}",
  "current_tasks": [],
  "completed_tasks": 0,
  "metadata": {
    "description": "${DESIGNATION}",
    ${OWNER_LINE}
    "clearance": "${CLEARANCE}"
  }
}
EOF

echo "Agent registered: ${AGENT_ID}"
echo "  Name: ${AGENT_NAME}"
echo "  Role: ${ROLE}"
echo "  File: ${OUTPUT_FILE}"
echo ""
echo "Next steps:"
echo "  git add ${OUTPUT_FILE}"
echo "  git commit -m \"[system] Registered agent: ${AGENT_NAME}\""
echo "  git push"
