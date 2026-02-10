#!/bin/bash
#
# init-mission-control.sh - Initialize Mission Control for production or demo mode
#
# Usage:
#   ./scripts/init-mission-control.sh              # Interactive mode
#   ./scripts/init-mission-control.sh --production # Skip demo, clean setup
#   ./scripts/init-mission-control.sh --demo       # Load demo data
#   ./scripts/init-mission-control.sh --help       # Show help
#
# This script properly separates demo data from production deployments.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
MC_DIR="$REPO_ROOT/.mission-control"
DEMO_DATA_DIR="$REPO_ROOT/examples/demo-data"
DEMO_FLAG="$MC_DIR/.demo-loaded"
INIT_FLAG="$MC_DIR/.initialized"

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║           JARVIS Mission Control - Initialization             ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Print help
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --production    Initialize for production (no demo data)"
    echo "  --demo          Initialize with demo data (Matrix-themed examples)"
    echo "  --force         Force re-initialization (overwrite existing)"
    echo "  --help          Show this help message"
    echo ""
    echo "Without options, runs in interactive mode."
    echo ""
    echo "Examples:"
    echo "  $0                  # Interactive mode"
    echo "  $0 --production     # Clean production setup"
    echo "  $0 --demo           # Load demo data for testing"
    echo "  $0 --production --force  # Re-initialize (destructive)"
}

# Check if already initialized
check_existing() {
    if [[ -f "$INIT_FLAG" ]]; then
        echo -e "${YELLOW}⚠️  Mission Control is already initialized.${NC}"
        
        if [[ -f "$DEMO_FLAG" ]]; then
            echo -e "   Mode: ${CYAN}Demo${NC} (Matrix-themed examples loaded)"
        else
            echo -e "   Mode: ${GREEN}Production${NC}"
        fi
        
        echo ""
        
        if [[ "$FORCE" != "true" ]]; then
            echo -e "${YELLOW}To re-initialize, run with --force flag.${NC}"
            echo -e "${RED}WARNING: --force will DELETE all existing tasks, agents, and messages!${NC}"
            exit 0
        else
            echo -e "${RED}--force flag detected. Proceeding with re-initialization...${NC}"
            echo ""
        fi
    fi
}

# Count existing data
count_existing_data() {
    local tasks=$(find "$MC_DIR/tasks" -name "*.json" 2>/dev/null | wc -l)
    local agents=$(find "$MC_DIR/agents" -name "*.json" 2>/dev/null | wc -l)
    local messages=$(find "$MC_DIR/messages" -name "*.json" 2>/dev/null | wc -l)
    local humans=$(find "$MC_DIR/humans" -name "*.json" 2>/dev/null | wc -l)
    
    echo "$tasks tasks, $agents agents, $humans humans, $messages messages"
}

# Clear all data directories (for production or re-init)
clear_data() {
    echo -e "${YELLOW}Clearing existing data...${NC}"
    
    # Remove JSON files from data directories
    rm -f "$MC_DIR/tasks/"*.json 2>/dev/null || true
    rm -f "$MC_DIR/agents/"*.json 2>/dev/null || true
    rm -f "$MC_DIR/messages/"*.json 2>/dev/null || true
    rm -f "$MC_DIR/humans/"*.json 2>/dev/null || true
    rm -f "$MC_DIR/queue/"*.json 2>/dev/null || true
    rm -f "$MC_DIR/workflows/"*.json 2>/dev/null || true
    
    # Clear logs
    rm -f "$MC_DIR/logs/"*.log 2>/dev/null || true
    
    # Remove flags
    rm -f "$DEMO_FLAG" 2>/dev/null || true
    rm -f "$INIT_FLAG" 2>/dev/null || true
    
    echo -e "${GREEN}✓ Data cleared${NC}"
}

# Load demo data
load_demo_data() {
    echo -e "${CYAN}Loading demo data (Matrix-themed examples)...${NC}"
    
    # Copy demo data to .mission-control
    if [[ -d "$DEMO_DATA_DIR/agents" ]]; then
        cp "$DEMO_DATA_DIR/agents/"*.json "$MC_DIR/agents/" 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} Agents loaded"
    fi
    
    if [[ -d "$DEMO_DATA_DIR/humans" ]]; then
        cp "$DEMO_DATA_DIR/humans/"*.json "$MC_DIR/humans/" 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} Humans loaded"
    fi
    
    if [[ -d "$DEMO_DATA_DIR/tasks" ]]; then
        cp "$DEMO_DATA_DIR/tasks/"*.json "$MC_DIR/tasks/" 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} Tasks loaded"
    fi
    
    if [[ -d "$DEMO_DATA_DIR/messages" ]]; then
        cp "$DEMO_DATA_DIR/messages/"*.json "$MC_DIR/messages/" 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} Messages loaded"
    fi
    
    # Create demo flag
    echo "Loaded: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DEMO_FLAG"
    
    echo -e "${GREEN}✓ Demo data loaded successfully${NC}"
}

# Initialize for production (clean state)
init_production() {
    echo -e "${GREEN}Initializing for production (clean state)...${NC}"
    
    # Create welcome task
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local date_prefix=$(date +%Y%m%d)
    
    cat > "$MC_DIR/tasks/task-${date_prefix}-welcome.json" << EOF
{
  "id": "task-${date_prefix}-welcome",
  "title": "Welcome to Mission Control",
  "description": "Your Mission Control is ready for production use!\\n\\nNext steps:\\n1. Register your human operator: ./scripts/add-human.sh\\n2. Register your agent: ./scripts/add-agent.sh\\n3. Create your first task: ./scripts/create-task.sh\\n\\nSee CLAUDE.md for complete documentation.",
  "status": "INBOX",
  "priority": "high",
  "assignee": null,
  "created_by": "system",
  "created_at": "${timestamp}",
  "updated_at": "${timestamp}",
  "labels": ["setup", "getting-started"],
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": []
}
EOF
    
    echo -e "  ${GREEN}✓${NC} Welcome task created"
    echo -e "${GREEN}✓ Production initialization complete${NC}"
}

# Create initialization flag
mark_initialized() {
    local mode=$1
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    cat > "$INIT_FLAG" << EOF
# Mission Control Initialized
mode: ${mode}
initialized_at: ${timestamp}
initialized_by: init-mission-control.sh
EOF
    
    echo -e "${GREEN}✓ Initialization complete (${mode} mode)${NC}"
}

# Print summary
print_summary() {
    local mode=$1
    
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    Initialization Complete                     ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [[ "$mode" == "demo" ]]; then
        echo -e "Mode: ${CYAN}Demo${NC}"
        echo -e "Data: Matrix-themed agents, tasks, and messages loaded"
        echo ""
        echo -e "${YELLOW}Note: This is demo data. For production, re-run with --production --force${NC}"
    else
        echo -e "Mode: ${GREEN}Production${NC}"
        echo -e "Data: Clean state with welcome task"
        echo ""
        echo -e "Next steps:"
        echo -e "  1. Register yourself: ${CYAN}./scripts/add-agent.sh --id agent-primary --name 'Your Name' --role lead${NC}"
        echo -e "  2. Register human:    ${CYAN}./scripts/add-human.sh --id human-admin --name 'Admin Name'${NC}"
        echo -e "  3. Start dashboard:   ${CYAN}cd server && npm install && npm start${NC}"
    fi
    
    echo ""
    echo -e "Current data: $(count_existing_data)"
    echo ""
}

# Interactive mode
interactive_mode() {
    echo ""
    echo -e "${BOLD}How would you like to initialize Mission Control?${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} ${BOLD}Production${NC} - Clean setup, no demo data"
    echo -e "     Best for: Real projects, deployments, your own agents"
    echo ""
    echo -e "  ${CYAN}2)${NC} ${BOLD}Demo${NC} - Load Matrix-themed examples"
    echo -e "     Best for: Learning, testing, exploring features"
    echo ""
    
    read -p "Enter choice (1 or 2): " choice
    
    case $choice in
        1)
            MODE="production"
            ;;
        2)
            MODE="demo"
            ;;
        *)
            echo -e "${RED}Invalid choice. Exiting.${NC}"
            exit 1
            ;;
    esac
}

# Parse arguments
MODE=""
FORCE="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --production)
            MODE="production"
            shift
            ;;
        --demo)
            MODE="demo"
            shift
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        --help|-h)
            print_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            print_help
            exit 1
            ;;
    esac
done

# Main execution
print_banner

# Check if already initialized
check_existing

# If no mode specified, run interactive
if [[ -z "$MODE" ]]; then
    interactive_mode
fi

# Clear existing data
clear_data

# Initialize based on mode
if [[ "$MODE" == "demo" ]]; then
    load_demo_data
    mark_initialized "demo"
else
    init_production
    mark_initialized "production"
fi

# Print summary
print_summary "$MODE"
