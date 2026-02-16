#!/bin/bash
#
# safe-deploy.sh - Deploy Mission Control with data protection
#
# Usage:
#   ./scripts/safe-deploy.sh                    # Deploy current state (preserves data)
#   ./scripts/safe-deploy.sh --backup           # Create backup only
#   ./scripts/safe-deploy.sh --restore BACKUP   # Restore from backup
#   ./scripts/safe-deploy.sh --demo             # Deploy with demo data (WARNING: destructive)
#   ./scripts/safe-deploy.sh --pull             # Safe git pull (backs up first)
#
# RULE: User data is NEVER overwritten without explicit --demo flag
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
MC_DIR="$REPO_ROOT/.mission-control"
BACKUP_DIR="$REPO_ROOT/.backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║         Mission Control - Safe Deployment Tool                ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Create backup of all user data
create_backup() {
    local backup_name="${1:-data-backup-$TIMESTAMP}"
    local backup_path="$BACKUP_DIR/$backup_name.tar.gz"
    
    echo -e "${CYAN}📦 Creating backup: $backup_name${NC}"
    
    # Count what we're backing up
    local agent_count=$(find "$MC_DIR/agents" -name "*.json" 2>/dev/null | wc -l)
    local task_count=$(find "$MC_DIR/tasks" -name "*.json" 2>/dev/null | wc -l)
    local human_count=$(find "$MC_DIR/humans" -name "*.json" 2>/dev/null | wc -l)
    local msg_count=$(find "$MC_DIR/messages" -name "*.json" 2>/dev/null | wc -l)
    
    echo "   Agents: $agent_count | Tasks: $task_count | Humans: $human_count | Messages: $msg_count"
    
    # Create tarball of user data directories
    tar -czf "$backup_path" \
        -C "$REPO_ROOT" \
        .mission-control/agents \
        .mission-control/tasks \
        .mission-control/humans \
        .mission-control/messages \
        .mission-control/config.yaml \
        .mission-control/config \
        2>/dev/null || true
    
    echo -e "${GREEN}✅ Backup created: $backup_path${NC}"
    echo "$backup_path"
}

# Restore from backup
restore_backup() {
    local backup_path="$1"
    
    if [ ! -f "$backup_path" ]; then
        # Try finding in backup dir
        if [ -f "$BACKUP_DIR/$backup_path" ]; then
            backup_path="$BACKUP_DIR/$backup_path"
        elif [ -f "$BACKUP_DIR/$backup_path.tar.gz" ]; then
            backup_path="$BACKUP_DIR/$backup_path.tar.gz"
        else
            echo -e "${RED}❌ Backup not found: $backup_path${NC}"
            echo "Available backups:"
            ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "  (none)"
            exit 1
        fi
    fi
    
    echo -e "${YELLOW}⚠️  Restoring from: $backup_path${NC}"
    echo -e "${YELLOW}   This will REPLACE current data with backup contents.${NC}"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
    
    # Backup current state first
    echo -e "${CYAN}Creating pre-restore backup...${NC}"
    create_backup "pre-restore-backup-$TIMESTAMP"
    
    # Extract backup
    echo -e "${CYAN}Restoring data...${NC}"
    tar -xzf "$backup_path" -C "$REPO_ROOT"
    
    echo -e "${GREEN}✅ Data restored from backup${NC}"
}

# Safe git pull (backs up data first)
safe_pull() {
    echo -e "${CYAN}🔄 Safe Git Pull${NC}"
    
    # Check for uncommitted changes
    if ! git -C "$REPO_ROOT" diff --quiet; then
        echo -e "${YELLOW}⚠️  You have uncommitted changes:${NC}"
        git -C "$REPO_ROOT" status --short
        echo ""
        read -p "Stash changes and continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
        git -C "$REPO_ROOT" stash
    fi
    
    # Create backup
    local backup_path=$(create_backup "pre-pull-backup-$TIMESTAMP")
    
    # Pull
    echo -e "${CYAN}Pulling latest changes...${NC}"
    git -C "$REPO_ROOT" pull
    
    echo ""
    echo -e "${GREEN}✅ Pull complete. Your data is preserved.${NC}"
    echo -e "   Backup: $backup_path"
    echo ""
    echo -e "${YELLOW}NOTE: If anything looks wrong, restore with:${NC}"
    echo "   ./scripts/safe-deploy.sh --restore pre-pull-backup-$TIMESTAMP"
}

# Deploy with demo data (DESTRUCTIVE)
deploy_demo() {
    echo -e "${RED}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║  ⚠️  WARNING: DESTRUCTIVE OPERATION                            ║"
    echo "║                                                               ║"
    echo "║  This will REPLACE all your data with demo data!             ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Count existing data
    local agent_count=$(find "$MC_DIR/agents" -name "*.json" 2>/dev/null | wc -l)
    local task_count=$(find "$MC_DIR/tasks" -name "*.json" 2>/dev/null | wc -l)
    
    if [ "$agent_count" -gt 0 ] || [ "$task_count" -gt 0 ]; then
        echo -e "${YELLOW}You have existing data:${NC}"
        echo "   Agents: $agent_count"
        echo "   Tasks: $task_count"
        echo ""
        echo "Type 'DEMO' to confirm replacement: "
        read -r confirm
        
        if [ "$confirm" != "DEMO" ]; then
            echo "Cancelled."
            exit 0
        fi
        
        # Backup first
        create_backup "pre-demo-backup-$TIMESTAMP"
    fi
    
    # Clear existing data
    echo -e "${CYAN}Clearing existing data...${NC}"
    rm -f "$MC_DIR/agents/"*.json 2>/dev/null || true
    rm -f "$MC_DIR/tasks/"*.json 2>/dev/null || true
    rm -f "$MC_DIR/humans/"*.json 2>/dev/null || true
    rm -f "$MC_DIR/messages/"*.json 2>/dev/null || true
    
    # Copy demo data
    echo -e "${CYAN}Loading demo data...${NC}"
    cp "$REPO_ROOT/examples/demo-data/agents/"*.json "$MC_DIR/agents/" 2>/dev/null || true
    cp "$REPO_ROOT/examples/demo-data/tasks/"*.json "$MC_DIR/tasks/" 2>/dev/null || true
    cp "$REPO_ROOT/examples/demo-data/humans/"*.json "$MC_DIR/humans/" 2>/dev/null || true
    cp "$REPO_ROOT/examples/demo-data/messages/"*.json "$MC_DIR/messages/" 2>/dev/null || true
    
    # Mark as demo
    touch "$MC_DIR/.demo-loaded"
    
    echo -e "${GREEN}✅ Demo data loaded${NC}"
}

# Show usage
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --backup           Create backup of current data"
    echo "  --restore BACKUP   Restore from a backup file"
    echo "  --pull             Safe git pull (backs up first)"
    echo "  --demo             Load demo data (DESTRUCTIVE - requires confirmation)"
    echo "  --list             List available backups"
    echo "  --help             Show this help"
    echo ""
    echo "Default behavior: Creates a backup (safe operation)"
    echo ""
    echo "Examples:"
    echo "  $0 --pull                              # Update code safely"
    echo "  $0 --restore data-backup-20260210      # Restore specific backup"
    echo "  $0 --list                              # See all backups"
}

# List backups
list_backups() {
    echo -e "${CYAN}Available backups:${NC}"
    echo ""
    if ls "$BACKUP_DIR"/*.tar.gz 1>/dev/null 2>&1; then
        for f in "$BACKUP_DIR"/*.tar.gz; do
            local size=$(du -h "$f" | cut -f1)
            local name=$(basename "$f")
            echo "  $name ($size)"
        done
    else
        echo "  (no backups found)"
    fi
}

# Main
print_banner

case "${1:-}" in
    --backup)
        create_backup
        ;;
    --restore)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}❌ Please specify a backup to restore${NC}"
            list_backups
            exit 1
        fi
        restore_backup "$2"
        ;;
    --pull)
        safe_pull
        ;;
    --demo)
        deploy_demo
        ;;
    --list)
        list_backups
        ;;
    --help|-h)
        show_help
        ;;
    "")
        # Default: just create a backup
        create_backup
        echo ""
        echo "Run with --help for more options"
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        show_help
        exit 1
        ;;
esac
