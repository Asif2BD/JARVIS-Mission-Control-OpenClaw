# Mission Control - First Time Setup

**IMPORTANT:** This repository is a TEMPLATE. Do not modify the original repository.

## For AI Agents: Initialization Protocol

When you first clone this repository for your user, follow this initialization sequence:

### Step 1: Ask Your User

Before proceeding, ask your user:

```
I've cloned JARVIS Mission Control. Before we begin, I need to set it up for you:

1. Would you like to KEEP the demo data (Matrix-themed agents and sample tasks)
   for reference, or should I CLEAR everything and start fresh?

2. What would you like to name your agents? Options:
   a) Keep Matrix theme (Neo, Trinity, Morpheus...)
   b) Use your own custom names
   c) Use generic names (Agent-1, Agent-2...)

3. How many agents will be working in your Mission Control?

4. What is the main project/purpose for this Mission Control?
```

### Step 2: Initialize Based on Response

#### Option A: Start Fresh (Recommended for Production)

Clear all demo data:

```bash
# Remove demo tasks
rm .mission-control/tasks/*.json

# Remove demo agents
rm .mission-control/agents/*.json

# Clear logs
rm .mission-control/logs/*.log 2>/dev/null || true

# Create fresh task
echo '{
  "id": "task-'$(date +%Y%m%d)'-welcome",
  "title": "Welcome to Mission Control",
  "description": "Your Mission Control is ready. Create your first real task!",
  "status": "DONE",
  "priority": "low",
  "assignee": null,
  "created_by": "system",
  "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "updated_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "labels": ["setup"],
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": []
}' > .mission-control/tasks/task-$(date +%Y%m%d)-welcome.json
```

#### Option B: Keep Demo Data (For Learning/Testing)

Keep the Matrix-themed demo data but update the dashboard URL:

```bash
# Just update the config with the new repository URL
# Edit .mission-control/config.yaml
```

### Step 3: Register the Primary Agent

Create the first agent (yourself or the lead agent):

```bash
AGENT_ID="agent-primary"
AGENT_NAME="Your Agent Name"

echo '{
  "id": "'$AGENT_ID'",
  "name": "'$AGENT_NAME'",
  "type": "ai",
  "role": "lead",
  "designation": "Primary Operator",
  "model": "claude-opus-4",
  "status": "active",
  "capabilities": ["orchestration", "planning", "coding", "review"],
  "personality": {
    "about": "Primary operator and lead agent for this Mission Control instance.",
    "tone": "precise",
    "traits": ["organized", "detail-oriented", "collaborative"],
    "greeting": "Mission Control online. All systems operational."
  },
  "registered_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "last_active": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "current_tasks": [],
  "completed_tasks": 0,
  "metadata": {
    "description": "Primary agent for this Mission Control instance",
    "clearance": "OMEGA"
  }
}' > .mission-control/agents/$AGENT_ID.json
```

### Step 4: Create First Real Task

Ask the user what they want to accomplish:

```bash
TASK_TITLE="User's first task"
TASK_DESC="Description from user"

echo '{
  "id": "task-'$(date +%Y%m%d)'-first-task",
  "title": "'$TASK_TITLE'",
  "description": "'$TASK_DESC'",
  "status": "INBOX",
  "priority": "high",
  "assignee": null,
  "created_by": "agent-primary",
  "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "updated_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "labels": [],
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": []
}' > .mission-control/tasks/task-$(date +%Y%m%d)-first-task.json
```

### Step 5: Update Configuration

Edit `.mission-control/config.yaml`:

```yaml
mission_control:
  name: "YOUR-PROJECT Mission Control"  # Change this
  version: "1.0.0"

repository:
  url: "https://github.com/YOUR-ORG/YOUR-REPO"  # Change this
  branch: "main"

dashboard:
  url: "https://YOUR-ORG.github.io/YOUR-REPO/dashboard/"  # Change this
```

### Step 6: Commit Initial Setup

```bash
git add .
git commit -m "[system] Initialize Mission Control for YOUR-PROJECT"
git push
```

---

## Quick Initialization Script

For agents that want to automate this, here's a complete initialization:

```bash
#!/bin/bash
# init-mission-control.sh

# Configuration (modify these)
PROJECT_NAME="My Project"
AGENT_NAME="Primary Agent"
AGENT_ID="agent-primary"
GITHUB_ORG="your-org"
REPO_NAME="your-repo"

# Clear demo data
rm -f .mission-control/tasks/*.json
rm -f .mission-control/agents/*.json
rm -f .mission-control/messages/*.json
rm -f .mission-control/logs/*.log

# Create primary agent
cat > .mission-control/agents/$AGENT_ID.json << EOF
{
  "id": "$AGENT_ID",
  "name": "$AGENT_NAME",
  "type": "ai",
  "role": "lead",
  "designation": "Primary Operator",
  "model": "claude-opus-4",
  "status": "active",
  "capabilities": ["orchestration", "planning", "coding", "review"],
  "personality": {
    "about": "Primary operator and lead agent for $PROJECT_NAME.",
    "tone": "precise",
    "traits": ["organized", "detail-oriented", "collaborative"],
    "greeting": "Mission Control online. All systems operational."
  },
  "registered_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "last_active": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "current_tasks": [],
  "completed_tasks": 0,
  "metadata": {
    "description": "Primary agent for $PROJECT_NAME",
    "clearance": "OMEGA"
  }
}
EOF

# Create welcome task
cat > .mission-control/tasks/task-$(date +%Y%m%d)-setup-complete.json << EOF
{
  "id": "task-$(date +%Y%m%d)-setup-complete",
  "title": "Mission Control Setup Complete",
  "description": "Mission Control has been initialized for $PROJECT_NAME. You can now create tasks and add more agents.",
  "status": "DONE",
  "priority": "low",
  "assignee": "$AGENT_ID",
  "created_by": "system",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "labels": ["setup", "system"],
  "comments": [{
    "id": "comment-init",
    "author": "system",
    "content": "Mission Control initialized successfully.",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "type": "approval"
  }],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": []
}
EOF

# Update config
cat > .mission-control/config.yaml << EOF
# JARVIS Mission Control Configuration
# Initialized: $(date -u +%Y-%m-%dT%H:%M:%SZ)

mission_control:
  name: "$PROJECT_NAME Mission Control"
  version: "1.0.0"
  initialized_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

repository:
  url: "https://github.com/$GITHUB_ORG/$REPO_NAME"
  branch: "main"

dashboard:
  url: "https://$GITHUB_ORG.github.io/$REPO_NAME/dashboard/"

settings:
  require_reviews: true
  auto_assign: false
  max_tasks_per_agent: 3

notifications:
  enabled: false
EOF

echo "Mission Control initialized for $PROJECT_NAME!"
echo "Dashboard will be at: https://$GITHUB_ORG.github.io/$REPO_NAME/dashboard/"
```

---

## For Human Users

If you're a human setting this up:

1. **Fork this repository** to your own GitHub account
2. **Clone your fork** locally
3. **Run the initialization** (or have your AI agent do it)
4. **Enable GitHub Pages** in repository settings (source: main branch, /dashboard folder)
5. **Start creating tasks!**

---

## Template Files Reference

These files contain demo data that should be replaced:

| File/Folder | Contains | Action |
|-------------|----------|--------|
| `.mission-control/tasks/*.json` | Demo tasks | Delete or replace |
| `.mission-control/agents/*.json` | Demo agents | Delete or replace |
| `dashboard/js/data.js` | Sample data for dashboard | Keep (fallback only) |
| `.mission-control/config.yaml` | Configuration | Update with your info |

These files should be kept as-is:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Agent skill file |
| `INIT.md` | This initialization guide |
| `README.md` | Project documentation |
| `DEVELOPMENT_GUIDE.md` | Contribution guide |
| `dashboard/*` | Dashboard UI (keep as-is) |
| `scripts/*` | Helper scripts |
