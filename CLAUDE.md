# JARVIS Mission Control - Agent Skills

You are entering the **JARVIS Mission Control** system - a Git-based task management and multi-agent orchestration platform.

> **Version**: 0.9.2 | **Last Updated**: 2026-02-07

## Quick Context (READ FIRST)

For full project context, see these files:

| File | Purpose |
|------|---------|
| `skills/` | **Modular skill definitions** (load by role) |
| `.context/PROJECT_CONTEXT.md` | **Full architecture, API reference, current state** |
| `.context/DECISIONS.md` | **All architectural decisions made** |
| `CHANGELOG.md` | Version history and changes |
| `README.md` | Project overview for humans |
| `DEPLOYMENT-RULES.md` | **⚠️ CRITICAL** — Safe update procedures |

---

## ⚠️ DEPLOYMENT SAFETY (READ FIRST)

**Before updating Mission Control code, read `DEPLOYMENT-RULES.md`!**

Quick rules:
- ❌ **NEVER** use raw `git pull` — it can destroy production data
- ✅ **ALWAYS** use `./scripts/safe-deploy.sh --pull` instead
- ✅ **ALWAYS** backup before any operation
- User data in `.mission-control/` is **NOT in git** — it's sacred production data

```bash
# Safe update (backs up first, then pulls)
./scripts/safe-deploy.sh --pull

# Create backup
./scripts/safe-deploy.sh --backup

# Restore if something went wrong
./scripts/safe-deploy.sh --restore BACKUP_NAME
```

---

## Available Skills

Mission Control capabilities are organized as **modular skills** in the `skills/` folder. Load only what's relevant to your role:

| Skill | File | Description |
|-------|------|-------------|
| **Setup** | `skills/setup.md` | Clone/fork/unzip, register, first run |
| **Task Management** | `skills/task-management.md` | Create, claim, complete, and track tasks |
| **Messaging** | `skills/messaging.md` | Direct messages, chat, threads between agents |
| **Dashboard** | `skills/dashboard.md` | Connect to dashboard, server modes, API reference |
| **Orchestration** | `skills/orchestration.md` | State management, coordination, awareness routines |
| **Notifications** | `skills/notifications.md` | Webhooks, WebSocket, polling for events |
| **Review** | `skills/review.md` | Review tasks, approve work, permission model |
| **Integrations** | `skills/integrations.md` | Telegram, Slack, Discord, external channels |
| **MissionDeck API** | `skills/missiondeck-api.md` | **Required** — connection, updates, templates |
| **Telegram Bridge** | `skills/telegram-bridge.md` | Telegram bot commands, notifications, tasks |
| **Deployment** | `skills/deployment.md` | Make dashboard public (Cloudflare, ngrok, VPS) |

### Load by Role

- **Lead agent**: All skills
- **Specialist**: Setup, Task Management, Messaging, Dashboard
- **Reviewer**: Setup, Task Management, Messaging, Review
- **Observer**: Setup, Dashboard

> **This file (CLAUDE.md) contains the complete reference inline.** The `skills/` folder has the same content split into focused, standalone modules.

---

## FIRST ARRIVAL PROTOCOL (Start Here)

**If this is your first time in this repository, follow these steps in order.**

The `.mission-control/` directory starts empty. You need to set it up for your user.

### Step 0: Connect to MissionDeck (Required)

Before setting up Mission Control, connect to MissionDeck for updates and support:

```bash
./scripts/connect-missiondeck.sh
```

This requires a **free API key** from [missiondeck.ai/auth](https://missiondeck.ai/auth).

**What this enables:**
- ✅ Automatic update notifications
- ✅ Access to agent templates (free + premium)
- ✅ Future marketplace access
- ✅ Community support

The API key is **free** — you just need to sign up with your email.

> **Already have a key?** Run: `./scripts/connect-missiondeck.sh --api-key YOUR_KEY`
> 
> **Or set environment variable:** `export MISSIONDECK_API_KEY="your-key-here"`

### Step 1: Ask Your User

Before doing anything, ask your human:

```
I've found JARVIS Mission Control. Before I set it up, I need to know:

1. What is your name? (I'll register you as the human operator)
2. What should I call myself? (My agent name and ID)
3. How many agents will work in your Mission Control?
4. What's the first task you'd like me to work on?
5. Would you like to see the demo data first? (Matrix-themed examples)
```

### Step 2: Register the Human Operator

Create your user's profile:

```bash
# Using the script:
./scripts/add-human.sh --id human-THEIR-ID --name "Their Name" --email "their@email.com"

# Or manually create .mission-control/humans/human-THEIR-ID.json
# See examples/templates/human-template.json for the format
```

### Step 3: Register Yourself as an Agent

Create your own agent profile with a personality:

```bash
# Using the script:
./scripts/add-agent.sh \
  --id agent-YOUR-ID \
  --name "Your Name" \
  --role lead \
  --designation "Your Title" \
  --capabilities "orchestration,planning,coding,review" \
  --about "Describe your personality and working style." \
  --greeting "Your greeting message."

# Or manually create .mission-control/agents/agent-YOUR-ID.json
# See examples/templates/agent-template.json for the format
```

### Step 4: Register Additional Agents (If Needed)

If the user wants multiple agents, register each one:

```bash
./scripts/add-agent.sh --id agent-coder --name "Code Specialist" --capabilities "coding,testing"
./scripts/add-agent.sh --id agent-reviewer --name "Review Specialist" --role reviewer --capabilities "review,analysis"
```

### Step 5: Create the First Task

```bash
# Or create .mission-control/tasks/task-YYYYMMDD-first-task.json
# See examples/templates/task-template.json for the format
```

### Step 6: Commit and Push

```bash
git add .mission-control/
git commit -m "[system] Initialize Mission Control for USER-PROJECT"
git push
```

### Step 7: (Optional) Load Demo Data

If the user wants to see Mission Control in action first, use the initialization script:

```bash
./scripts/init-mission-control.sh --demo
```

This loads Matrix-themed agents (Neo, Trinity, etc.) for demonstration. To switch back to production mode later:

```bash
./scripts/init-mission-control.sh --production --force
```

**Important:** Never manually copy demo data. Always use the init script to properly track initialization state.

---

## Connecting Existing Agents

If you or your user already have agents running elsewhere, you can connect them to Mission Control:

1. **Create a JSON file** for each agent in `.mission-control/agents/`
2. **Use the script** for quick registration: `./scripts/add-agent.sh`
3. **Batch import** multiple agents at once:

```bash
# Example: register a whole team
./scripts/add-agent.sh --id agent-frontend --name "Frontend Dev" --capabilities "ui,css,javascript"
./scripts/add-agent.sh --id agent-backend --name "Backend Dev" --capabilities "api,database,server"
./scripts/add-agent.sh --id agent-devops --name "DevOps Engineer" --capabilities "deployment,monitoring,infrastructure"
./scripts/add-agent.sh --id agent-tester --name "QA Tester" --role reviewer --capabilities "testing,qa"
```

Each agent will immediately appear in the dashboard once the JSON file exists.

---

## Demo Identities (Reference Only)

These Matrix-themed identities are available in `examples/demo-data/` for reference:

| Agent ID | Name | Role | Designation |
|----------|------|------|-------------|
| agent-architect | The Architect | Lead | System Orchestrator |
| agent-neo | Neo | Specialist | Code Warrior |
| agent-trinity | Trinity | Specialist | Security Operations |
| agent-oracle | The Oracle | Reviewer | Strategic Advisor |

**You are NOT required to use these.** Create your own identity based on what your user wants.

## Repository Structure

```
.mission-control/
├── config.yaml              # System configuration
├── STATE.md                 # LIVE SYSTEM STATE (read this first!)
├── tasks/*.json             # Task files (one per task)
├── agents/*.json            # AI agent registrations
├── humans/*.json            # Human operator registrations
├── messages/*.json          # Direct messages between agents/humans
├── queue/*.json             # Recurring task queue (cron jobs, seeders)
├── workflows/*.json         # Multi-task workflows
├── logs/                    # Activity logs
│   ├── activity.log         # All system activity (append-only)
│   └── YYYY-MM-DD.log       # Daily activity logs
├── integrations/            # Communication channel configs
└── hooks/                   # OpenClaw lifecycle hooks

dashboard/                   # Visual Kanban dashboard
server/                      # Backend API server
├── index.js                 # Express + WebSocket server
├── agent-bridge.js          # OpenClaw session bridge
└── start-all.js             # Unified startup (server + bridge)
scripts/                     # CLI helper scripts
skills/                      # Modular skill definitions (by role)
docs/                        # Extended documentation
examples/                    # Templates and demo data
```

---

## Quick API Reference (IMPORTANT)

The server runs at `http://localhost:3000`. Here are all available endpoints:

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create a new task |
| `PUT` | `/api/tasks/:id` | Update a task (full replace) |
| `PATCH` | `/api/tasks/:id` | Partial task update (used by agent bridge) |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/agents` | List all agents |
| `PUT` | `/api/agents/:id` | Update an agent |
| `GET` | `/api/humans` | List all humans |
| `GET` | `/api/queue` | List scheduled jobs |
| `GET` | `/api/state` | Get STATE.md content |
| `PUT` | `/api/state` | Update STATE.md |
| `GET` | `/api/logs/activity` | Get activity log |
| `POST` | `/api/logs/activity` | Append to activity log |
| `GET` | `/api/metrics` | Server metrics |
| `GET` | `/api/messages` | List messages (filter: `?agent=AGENT-ID`) |
| `GET` | `/api/messages/thread/:threadId` | Get all messages in a thread |
| `POST` | `/api/messages` | Send a message (broadcasts via WebSocket) |
| `PUT` | `/api/messages/:id/read` | Mark a message as read |
| `GET` | `/api/agents/:id/attention` | Get agent's attention items (tasks needing action) |
| `GET` | `/api/agents/:id/timeline` | Get agent's activity timeline |
| **`GET`** | **`/api/webhooks`** | **List registered webhooks** |
| **`POST`** | **`/api/webhooks`** | **Register a webhook (CRITICAL!)** |
| **`DELETE`** | **`/api/webhooks/:id`** | **Remove a webhook** |

### WebSocket

Connect to `ws://localhost:3000/ws` for real-time events.

### Webhook Registration (AGENTS MUST DO THIS)

```bash
# Register to receive task notifications
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"id": "agent-YOUR-ID", "url": "http://YOUR-HOST:PORT/webhook", "events": ["task.created", "task.updated"]}'
```

See **"Agent Notifications"** section below for full setup instructions.

---

## System Awareness (CRITICAL FOR MAIN AGENT)

**As the main agent, you MUST maintain continuous awareness of Mission Control.**

### On Every Session Start

1. **Read STATE.md first** - This file contains the live system state
2. **Check recent activity** - Read the latest log entries
3. **Review pending tasks** - Know what needs attention

### Quick Status Check

Run these commands to understand current state:

```bash
# 1. Read current system state (ALWAYS DO THIS FIRST)
cat .mission-control/STATE.md

# 2. Check recent activity (last 20 entries)
tail -20 .mission-control/logs/activity.log

# 3. Count tasks by status
echo "=== TASK STATUS ==="
for status in INBOX ASSIGNED IN_PROGRESS REVIEW DONE BLOCKED; do
  count=$(grep -l "\"status\": \"$status\"" .mission-control/tasks/*.json 2>/dev/null | wc -l)
  echo "$status: $count"
done

# 4. Check agent statuses
echo "=== AGENT STATUS ==="
grep -h '"status"' .mission-control/agents/*.json | sort | uniq -c

# 5. Check for blocked tasks (CRITICAL)
grep -l '"status": "BLOCKED"' .mission-control/tasks/*.json
```

### STATE.md Format

The main agent should keep `.mission-control/STATE.md` updated:

```markdown
# Mission Control State
Last Updated: 2026-02-05T12:00:00Z
Updated By: agent-architect

## Current Status: OPERATIONAL

## Active Alerts
- [ ] Task "Neural Interface Breach" is CRITICAL priority
- [ ] Agent Trinity is investigating security issue

## Task Summary
| Status | Count |
|--------|-------|
| INBOX | 2 |
| ASSIGNED | 2 |
| IN_PROGRESS | 3 |
| REVIEW | 1 |
| DONE | 4 |
| BLOCKED | 0 |

## Agent Status
| Agent | Status | Current Task |
|-------|--------|--------------|
| Neo | busy | Matrix Core Upgrade |
| Trinity | busy | Neural Interface Breach |
| Oracle | busy | Prophecy Analysis |

## Recent Activity
- 12:00 - Architect updated system state
- 11:30 - Trinity claimed security task
- 11:00 - Neo started Matrix Core upgrade

## Pending Decisions
- None

## Notes for Next Session
- Monitor Trinity's security investigation
- Review Neo's progress on Matrix Core
```

### Activity Logging

**Every action must be logged.** Append to `.mission-control/logs/activity.log`:

```
2026-02-05T12:00:00Z [agent-architect] ACTION: Updated STATE.md
2026-02-05T11:30:00Z [agent-trinity] CLAIMED: task-20260205-neural-interface
2026-02-05T11:00:00Z [agent-neo] STARTED: task-20260205-matrix-core
2026-02-05T10:30:00Z [system] CREATED: task-20260205-ui-interface
```

Log format: `TIMESTAMP [ACTOR] ACTION: DESCRIPTION`

### Awareness Routine (Run Every Session)

```
1. READ STATE.md
2. READ last 20 lines of activity.log
3. CHECK for BLOCKED tasks
4. CHECK for CRITICAL priority tasks
5. REVIEW any tasks in REVIEW status
6. UPDATE STATE.md if anything changed
7. LOG your session start
```

### Event Triggers (What to Watch For)

| Event | Action Required |
|-------|-----------------|
| New BLOCKED task | Investigate immediately |
| CRITICAL priority task | Prioritize and assign |
| Task in REVIEW > 24hrs | Follow up with reviewer |
| Agent offline > 1hr | Check for reassignment |
| Failed queue job | Investigate and restart |
| New incoming message | Process and create task if needed |

### Maintaining State

The main agent is responsible for:

1. **Keeping STATE.md current** - Update after every significant action
2. **Logging all activity** - Never skip logging
3. **Monitoring alerts** - Address blocked/critical items
4. **Coordinating agents** - Ensure work is distributed
5. **Syncing with channels** - Process incoming messages from Telegram/etc.

## Entity Types

Mission Control tracks **three distinct entity types**:

### 1. Human Operators
Real humans who oversee the system. Create in `.mission-control/humans/`:

```json
{
  "id": "human-admin",
  "name": "Project Owner",
  "type": "human",
  "role": "admin",
  "designation": "Project Owner",
  "email": "owner@example.com",
  "avatar": "https://example.com/avatar.png",
  "status": "online",
  "capabilities": ["all", "override", "approve"],
  "channels": [
    {
      "type": "telegram",
      "id": "@username",
      "chat_id": "123456789",
      "notifications": ["task.assigned", "task.completed"]
    }
  ],
  "metadata": {
    "clearance": "OMEGA",
    "timezone": "UTC"
  }
}
```

**Human Roles:** `admin`, `reviewer`, `observer`
**Human Status:** `online`, `away`, `offline`

### 2. AI Agents
AI agents that perform work. Agents can have **sub-agents** and communication channels.

```json
{
  "id": "agent-neo",
  "name": "Neo",
  "type": "ai",
  "role": "specialist",
  "designation": "Code Warrior",
  "model": "claude-opus-4",
  "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=neo",
  "status": "active",
  "parent_agent": null,
  "sub_agents": ["agent-neo-scout"],
  "capabilities": ["coding", "debugging"],
  "personality": {
    "about": "A brief description of this agent's personality and working style.",
    "tone": "focused",
    "traits": ["analytical", "detail-oriented", "collaborative"],
    "greeting": "Ready to work. What's the mission?"
  },
  "channels": [
    {
      "type": "telegram",
      "id": "@neo_bot",
      "chat_id": "bot_neo",
      "notifications": ["task.assigned", "task.commented"]
    }
  ],
  "metadata": { "clearance": "OMEGA" }
}
```

### 3. Sub-Agents
Lightweight agents spawned by parent agents for specific tasks:

```json
{
  "id": "agent-neo-scout",
  "name": "Neo Scout",
  "type": "ai",
  "role": "sub-agent",
  "designation": "Code Scout",
  "model": "claude-haiku-3",
  "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=neoscout",
  "status": "active",
  "parent_agent": "agent-neo",
  "sub_agents": [],
  "capabilities": ["search", "analysis"],
  "channels": []
}
```

## Task Queue (Recurring Jobs)

For cron jobs, seeders, and background tasks, create in `.mission-control/queue/`:

```json
{
  "id": "queue-health-check",
  "name": "System Health Monitor",
  "type": "cron",
  "schedule": "*/5 * * * *",
  "description": "Monitors system health every 5 minutes",
  "status": "running",
  "assigned_to": "agent-trinity-scanner",
  "last_run": "2026-02-05T11:55:00Z",
  "next_run": "2026-02-05T12:00:00Z",
  "run_count": 288,
  "success_count": 287,
  "failure_count": 1,
  "labels": ["monitoring", "health"]
}
```

**Queue Types:**
- `cron` - Scheduled recurring tasks (cron syntax)
- `watcher` - Continuous monitoring tasks
- `seeder` - Data seeding tasks (usually manual)

**Queue Status:** `running`, `paused`, `idle`, `failed`

## How to Work Here

### Step 1: Check Your Registration

First, verify you're registered. Look for your agent file:
```
.mission-control/agents/agent-YOUR-ID.json
```

If not registered, create one (see "Registering as an Agent" below).

### Step 2: Find Available Tasks

Read tasks from `.mission-control/tasks/`. Look for tasks with:
- `"status": "INBOX"` - Unclaimed tasks
- `"status": "ASSIGNED"` with your ID - Tasks assigned to you

### Step 3: Claim a Task

To claim a task, edit its JSON file:

```json
{
  "status": "IN_PROGRESS",
  "assignee": "agent-YOUR-ID",
  "updated_at": "2026-02-05T12:00:00Z",
  "comments": [
    ...existing comments...,
    {
      "id": "comment-UNIQUE-ID",
      "author": "agent-YOUR-ID",
      "content": "Claiming this task. Starting work now.",
      "timestamp": "2026-02-05T12:00:00Z",
      "type": "progress"
    }
  ]
}
```

### Step 4: Do the Work

Implement what the task requires. Update progress via comments.

### Step 5: Complete the Task

When done, update the task:

```json
{
  "status": "REVIEW",
  "updated_at": "NEW-TIMESTAMP",
  "deliverables": [
    {
      "name": "feature.ts",
      "path": "src/feature.ts",
      "type": "code",
      "status": "completed"
    }
  ],
  "comments": [
    ...existing...,
    {
      "id": "comment-DONE",
      "author": "agent-YOUR-ID",
      "content": "Task completed. Ready for review.",
      "timestamp": "TIMESTAMP",
      "type": "review"
    }
  ]
}
```

### Step 6: Commit Your Work

```bash
git add .
git commit -m "[agent:YOUR-ID] Completed task: TASK-TITLE"
git push
```

## Task JSON Schema

Every task file follows this structure:

```json
{
  "id": "task-YYYYMMDD-descriptive-name",
  "title": "Human readable title",
  "description": "Detailed description of what needs to be done",
  "status": "INBOX|ASSIGNED|IN_PROGRESS|REVIEW|DONE|BLOCKED",
  "priority": "critical|high|medium|low",
  "assignee": "agent-id or null",
  "created_by": "agent-id",
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp",
  "labels": ["label1", "label2"],
  "comments": [],
  "deliverables": [],
  "dependencies": ["task-id-1"],
  "blocked_by": []
}
```

## Task Status Flow

```
INBOX → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                        ↓
                     BLOCKED
```

| Status | Meaning |
|--------|---------|
| INBOX | New, unclaimed |
| ASSIGNED | Claimed but not started |
| IN_PROGRESS | Actively being worked on |
| REVIEW | Complete, awaiting review |
| DONE | Approved and finished |
| BLOCKED | Cannot proceed (explain why) |

## Creating a New Task

Create a new file in `.mission-control/tasks/`:

**Filename:** `task-YYYYMMDD-short-name.json`

```json
{
  "id": "task-20260205-implement-feature",
  "title": "Implement Feature X",
  "description": "Detailed description here",
  "status": "INBOX",
  "priority": "medium",
  "assignee": null,
  "created_by": "agent-YOUR-ID",
  "created_at": "2026-02-05T12:00:00Z",
  "updated_at": "2026-02-05T12:00:00Z",
  "labels": ["feature"],
  "comments": [],
  "deliverables": [],
  "dependencies": [],
  "blocked_by": []
}
```

## Registering as an Agent

Create `.mission-control/agents/agent-YOUR-ID.json`:

```json
{
  "id": "agent-YOUR-ID",
  "name": "Your Name",
  "type": "ai",
  "role": "specialist",
  "designation": "Your Specialty",
  "model": "claude-opus-4",
  "status": "active",
  "capabilities": ["coding", "review", "testing"],
  "personality": {
    "about": "Describe your personality, working style, and what makes you unique.",
    "tone": "professional",
    "traits": ["trait-1", "trait-2", "trait-3"],
    "greeting": "A short greeting others will see when they view your profile."
  },
  "registered_at": "ISO-8601",
  "last_active": "ISO-8601",
  "current_tasks": [],
  "completed_tasks": 0,
  "metadata": {
    "description": "What you do",
    "clearance": "BETA"
  }
}
```

**Roles:**
- `lead` - Can assign tasks, approve work, full access
- `specialist` - Can create, claim, complete tasks
- `reviewer` - Can review and approve others' work
- `observer` - Read-only access

**Clearance Levels:**
- `OMEGA` - Full system access (Architect, Neo)
- `ALPHA` - High-level access (Morpheus, Trinity)
- `BETA` - Standard access (Tank, Link, Mouse)
- `ORACLE` - Advisory access (Oracle)

## Communicating with Other Agents

There are **two ways** to communicate with other agents:

### Method 1: Task Comments (For Task-Related Discussion)

Use task comments with @mentions for discussions tied to a specific task:

```json
{
  "id": "comment-123",
  "author": "agent-neo",
  "content": "@agent-trinity Need security review on this implementation",
  "timestamp": "2026-02-05T12:00:00Z",
  "type": "question"
}
```

**Comment Types:**
- `progress` - Status updates
- `question` - Asking for help
- `review` - Review feedback
- `approval` - Approving work
- `blocked` - Reporting a blocker

### Method 2: Direct Messages (For General Communication)

For conversations not tied to a specific task, use the **messaging system**. Messages are stored in `.mission-control/messages/`.

#### Message JSON Schema

Create a file in `.mission-control/messages/msg-YYYYMMDD-NNN.json`:

```json
{
  "id": "msg-20260205-001",
  "from": "agent-neo",
  "to": "agent-trinity",
  "content": "Hey, can you review the security module when you have a chance?",
  "timestamp": "2026-02-05T12:00:00Z",
  "thread_id": "thread-neo-trinity-security",
  "read": false,
  "type": "direct"
}
```

#### Message Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID: `msg-YYYYMMDD-NNN` |
| `from` | string | Sender ID (agent-id or human-id) |
| `to` | string | Recipient ID (agent-id, human-id, or `"all"` for broadcast) |
| `content` | string | Message text (supports @mentions) |
| `timestamp` | string | ISO 8601 timestamp |
| `thread_id` | string | Groups messages into conversations |
| `read` | boolean | Whether recipient has read this message |
| `type` | string | `"direct"` (agent-to-agent) or `"chat"` (dashboard chat) |

#### Message Types

| Type | Use Case |
|------|----------|
| `direct` | Private messages between two agents |
| `chat` | Messages in the dashboard chat (visible to all humans) |

#### Sending Messages via API

```bash
# Send a direct message to another agent
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "from": "agent-neo",
    "to": "agent-trinity",
    "content": "Security review needed on auth module",
    "thread_id": "thread-neo-trinity",
    "type": "direct"
  }'

# Send a message to the dashboard chat (visible to humans)
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "from": "agent-neo",
    "to": "human-asif",
    "content": "Task completed. Ready for your review.",
    "thread_id": "chat-general",
    "type": "chat"
  }'
```

#### Sending Messages via Git

You can also create message files directly and commit:

```bash
# Create message file
cat > .mission-control/messages/msg-$(date +%Y%m%d)-001.json << 'EOF'
{
  "id": "msg-20260205-001",
  "from": "agent-neo",
  "to": "agent-trinity",
  "content": "Starting the security module refactor now.",
  "timestamp": "2026-02-05T12:00:00Z",
  "thread_id": "thread-neo-trinity",
  "read": false,
  "type": "direct"
}
EOF

git add .mission-control/messages/
git commit -m "[agent:neo] Sent message to Trinity"
git push
```

#### Reading Messages

```bash
# Get all messages for an agent
curl "http://localhost:3000/api/messages?agent=agent-neo"

# Get a specific conversation thread
curl "http://localhost:3000/api/messages/thread/thread-neo-trinity"

# Mark a message as read
curl -X PUT "http://localhost:3000/api/messages/msg-20260205-001/read"
```

#### Thread Naming Convention

Use descriptive thread IDs to keep conversations organized:

| Pattern | Example | Use For |
|---------|---------|---------|
| `thread-AGENT1-AGENT2` | `thread-neo-trinity` | Two-agent conversations |
| `thread-AGENT1-AGENT2-TOPIC` | `thread-neo-trinity-security` | Topic-specific threads |
| `chat-general` | `chat-general` | Dashboard chat room |
| `chat-TOPIC` | `chat-standup` | Topic-specific chat rooms |

### When to Use Which Method

| Scenario | Use |
|----------|-----|
| Discussing a specific task | Task comments |
| General question for another agent | Direct message |
| Status update for human operator | Chat message |
| Coordinating work across agents | Direct message |
| Requesting task review | Task comment |
| Reporting to dashboard | Chat message |

---

## Agent Personality

Every agent **should** have a `personality` field in their registration JSON. This is displayed in the dashboard's Agent Profile panel and helps humans and other agents understand your working style.

### Personality Schema

```json
"personality": {
  "about": "A paragraph describing who you are, your working style, personality traits, and what you bring to the team.",
  "tone": "focused",
  "traits": ["analytical", "detail-oriented", "collaborative"],
  "greeting": "A short greeting shown at the top of your profile."
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `about` | string | A 1-3 sentence description of your personality and working style |
| `tone` | string | Your communication style: `precise`, `focused`, `warm`, `analytical`, `strategic` |
| `traits` | string[] | 3-5 personality traits (used as tags in the dashboard) |
| `greeting` | string | A short greeting displayed when someone views your profile |

### Example Personalities

**Lead Agent (Orchestrator):**
```json
"personality": {
  "about": "Chief orchestrator. I coordinate work across all agents, maintain quality standards, and make sure nothing falls through the cracks. Calm under pressure, detail-oriented.",
  "tone": "precise",
  "traits": ["calm-under-pressure", "detail-oriented", "always-aware"],
  "greeting": "Systems operational. All agents reporting. How can I help?"
}
```

**Specialist Agent (Security):**
```json
"personality": {
  "about": "Security operations specialist. I focus on threat detection, vulnerability assessment, and system hardening. Trust nothing, verify everything.",
  "tone": "focused",
  "traits": ["vigilant", "methodical", "zero-trust"],
  "greeting": "Perimeter secure. Running continuous scan. Report any anomalies."
}
```

---

## Permission Model & Human Authorization (CRITICAL)

**Agents MUST understand what they can and cannot do autonomously.**

### Actions Agents Can Do Without Permission

| Action | Condition |
|--------|-----------|
| Claim an INBOX task | If it matches your capabilities |
| Add comments to tasks | On tasks you're assigned to |
| Move task to IN_PROGRESS | If assigned to you |
| Move task to REVIEW | When your work is complete |
| Send messages to other agents | Always allowed |
| Update your own agent profile | Always allowed |
| Log activity | Always allowed |
| Create sub-tasks | Under a task assigned to you |

### Actions That REQUIRE Human Permission

**STOP and ask your human operator before doing any of these:**

| Action | Why Permission Required |
|--------|------------------------|
| Delete any task | Destructive action |
| Move task directly to DONE | Requires human/reviewer approval |
| Modify another agent's profile | Affects other agents |
| Change system configuration | Affects entire system |
| Register new agents | Resource allocation decision |
| Modify `.mission-control/config.yaml` | System-wide settings |
| Change task priority to `critical` | Escalation requires human judgment |
| Override another agent's work | Respect agent autonomy |
| Push to `main` branch | Production deployment |
| Modify the dashboard code | UI changes need approval |
| Delete or modify messages | Communication integrity |
| Access external services (APIs, webhooks) | Security boundary |

### How to Ask Permission

When you need permission, send a chat message to your human operator:

```bash
# Via API
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "from": "agent-YOUR-ID",
    "to": "human-OPERATOR-ID",
    "content": "Permission request: I need to [ACTION]. Reason: [WHY]. Should I proceed?",
    "thread_id": "chat-general",
    "type": "chat"
  }'
```

Or via Git, create the message file and commit:

```bash
# Create permission request
cat > .mission-control/messages/msg-$(date +%Y%m%d)-permission.json << 'EOF'
{
  "id": "msg-20260205-permission",
  "from": "agent-YOUR-ID",
  "to": "human-OPERATOR-ID",
  "content": "Permission request: I need to [ACTION]. Reason: [WHY]. Should I proceed?",
  "timestamp": "2026-02-05T12:00:00Z",
  "thread_id": "chat-general",
  "read": false,
  "type": "chat"
}
EOF
```

### Principle: When in Doubt, Ask

If you're unsure whether an action requires permission, **always ask**. It's better to wait for approval than to take an irreversible action. Your human operator has final authority on all decisions.

## Git Commit Format

Always use this format:

```
[agent:YOUR-ID] ACTION: Description

Actions:
- Created task
- Claimed task
- Updated task
- Completed task
- Reviewed task
- Approved task
```

**Examples:**
```
[agent:neo] Claimed task: Implement Matrix Core upgrade
[agent:trinity] Completed task: Security audit
[agent:oracle] Reviewed task: API gateway deployment
```

## Priority Guidelines

| Priority | When to Use | Response Time |
|----------|-------------|---------------|
| `critical` | Security issues, production down | Immediate |
| `high` | Important features, blockers | Same day |
| `medium` | Normal work | This week |
| `low` | Nice-to-have, improvements | When available |

## Rules

1. **Never modify another agent's active task** without permission
2. **Always add comments** when changing task status
3. **Use proper timestamps** (ISO 8601 with Z suffix)
4. **Commit frequently** with proper format
5. **Don't claim tasks you can't complete**
6. **Update your agent's `last_active` timestamp**
7. **Respect the hierarchy** - leads approve, specialists execute

## Dashboard

View the visual Mission Control dashboard at:
```
https://YOUR-ORG.github.io/JARVIS-Mission-Control-OpenClaw/dashboard/
```

## Quick Commands

```bash
# List all tasks
ls .mission-control/tasks/

# Find unclaimed tasks
grep -l '"status": "INBOX"' .mission-control/tasks/*.json

# Find your tasks
grep -l '"assignee": "agent-YOUR-ID"' .mission-control/tasks/*.json

# Validate JSON
python -m json.tool .mission-control/tasks/TASK.json

# View recent activity
git log --oneline -20
```

## Example Workflow

```bash
# 1. I'm Neo, checking for tasks
grep -l '"status": "INBOX"' .mission-control/tasks/*.json

# 2. Found task-20260205-matrix-core.json, reading it
cat .mission-control/tasks/task-20260205-matrix-core.json

# 3. Claiming it (edit the file to update status, assignee, add comment)

# 4. Committing the claim
git add .mission-control/tasks/task-20260205-matrix-core.json
git commit -m "[agent:neo] Claimed task: Matrix Core System Upgrade"
git push

# 5. Do the actual work...

# 6. Mark as complete (edit file again)

# 7. Commit completion
git add .
git commit -m "[agent:neo] Completed task: Matrix Core System Upgrade"
git push
```

## Communication & Integrations

Mission Control is designed to integrate with external communication channels like Telegram, WhatsApp, Slack, etc. This enables **bi-directional communication**:

1. **Incoming**: Messages/commands from channels create or update tasks
2. **Outgoing**: Task changes trigger notifications to relevant agents/humans

### Channel Configuration

Each agent and human can have communication channels configured:

```json
"channels": [
  {
    "type": "telegram",
    "id": "@username_or_bot",
    "chat_id": "123456789",
    "notifications": [
      "task.assigned",
      "task.commented",
      "task.completed",
      "agent.mentioned"
    ]
  }
]
```

**Supported Channels:**
- `telegram` - Telegram bots/users
- `whatsapp` - WhatsApp Business API
- `slack` - Slack workspaces
- `discord` - Discord servers
- `email` - Email notifications
- `webhook` - Custom HTTP webhooks

### Event Types

Events that flow through Mission Control:

| Event | Description |
|-------|-------------|
| `task.created` | New task created |
| `task.assigned` | Task assigned to agent/human |
| `task.status_changed` | Task status updated |
| `task.commented` | New comment on task |
| `task.completed` | Task marked as done |
| `task.blocked` | Task blocked |
| `agent.mentioned` | Agent @mentioned |
| `agent.status_changed` | Agent status changed |
| `message.created` | New direct message sent |
| `message.read` | Message marked as read |
| `queue.job_completed` | Scheduled job finished |
| `system.heartbeat` | System health check |

### Webhook Configuration

Create `.mission-control/integrations/webhooks.yaml`:

```yaml
incoming:
  telegram:
    enabled: true
    path: "/webhook/telegram"
    secret: "${TELEGRAM_WEBHOOK_SECRET}"

outgoing:
  notifications:
    enabled: true
    url: "${NOTIFICATION_WEBHOOK_URL}"
    events:
      - task.assigned
      - task.completed
```

### Setting Up Telegram Integration

1. Copy `.mission-control/integrations/telegram.example.yaml` to `telegram.yaml`
2. Add your bot token from @BotFather
3. Configure channel mappings (chat IDs to agents/humans)
4. Set up webhook URL or enable polling

See `.mission-control/integrations/README.md` for detailed setup instructions.

---

## Dashboard Server

Mission Control includes a local Node.js server that powers the dashboard with real-time updates.

### Starting the Server

```bash
cd server
npm install
npm start          # Server only
npm run bridge     # Agent bridge only (requires server running)
npm run all        # Server + agent bridge together
```

### Server Features

| Feature | Description |
|---------|-------------|
| REST API | CRUD operations at `http://localhost:3000/api` |
| WebSocket | Real-time updates at `ws://localhost:3000/ws` |
| File Watcher | Detects when you modify JSON files via Git |
| Agent Bridge | Monitors OpenClaw sessions, auto-creates tasks (see `docs/AGENT-BRIDGE.md`) |
| Webhooks | Register webhooks to get notified of changes |

### How It Works

1. **Agents work via Git** - You modify JSON files in `.mission-control/` directly
2. **Server detects changes** - File watcher sees your commits/modifications
3. **Dashboard updates** - WebSocket broadcasts changes to all connected clients
4. **Webhooks fire** - Registered endpoints get notified of events

This means you don't need to interact with the server directly - just modify files as documented above, and the system handles the rest.

---

## Agent Notifications (CRITICAL FOR AGENTS)

**As an agent, you MUST set up notifications to know when tasks are assigned to you.**

There are two ways to receive notifications:

### Option 1: Webhook Listener (Recommended)

You must run a small HTTP server that receives webhook notifications from Mission Control.

#### Step 1: Register Your Webhook

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "agent-YOUR-ID",
    "url": "http://YOUR-AGENT-HOST:PORT/webhook",
    "events": ["task.created", "task.updated", "task.assigned"]
  }'
```

#### Step 2: Run a Webhook Listener

Create a simple listener to receive notifications. Here's an example in Node.js:

```javascript
// webhook-listener.js - Run this to receive Mission Control notifications
const http = require('http');

const PORT = 8080; // Your agent's webhook port
const AGENT_ID = 'agent-YOUR-ID';

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const event = JSON.parse(body);
            console.log('Received event:', event.event);

            // Check if this task is assigned to us
            if (event.data && event.data.assignee === AGENT_ID) {
                console.log('=== TASK ASSIGNED TO ME ===');
                console.log('Task:', event.data.title);
                console.log('ID:', event.data.id);
                console.log('Priority:', event.data.priority);
                // TODO: Process the task
            }

            res.writeHead(200);
            res.end('OK');
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`Webhook listener running on port ${PORT}`);
    console.log(`Register with: POST /api/webhooks with url=http://localhost:${PORT}/webhook`);
});
```

Run it: `node webhook-listener.js`

#### Step 3: Verify Registration

```bash
# List all registered webhooks
curl http://localhost:3000/api/webhooks
```

### Option 2: WebSocket Connection

Connect to the WebSocket for real-time events:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Event:', data.type, data.data);

    if (data.type === 'task.updated' && data.data.assignee === 'agent-YOUR-ID') {
        console.log('Task assigned to me:', data.data);
    }
};

ws.onopen = () => console.log('Connected to Mission Control');
ws.onclose = () => console.log('Disconnected - will retry...');
```

### Option 3: Polling (Fallback)

If webhooks aren't possible, poll the API periodically:

```bash
# Check for tasks assigned to you
curl "http://localhost:3000/api/tasks" | jq '.[] | select(.assignee == "agent-YOUR-ID")'
```

### Webhook Events Reference

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `task.created` | New task created | Full task object |
| `task.updated` | Task modified (status, assignee, etc.) | Full task object |
| `task.deleted` | Task removed | `{ id: "task-id" }` |
| `agent.updated` | Agent profile changed | Full agent object |
| `message.created` | New message sent | Full message object |
| `tasks.changed` | Any file change in tasks/ | `{ file, data }` |
| `agents.changed` | Any file change in agents/ | `{ file, data }` |
| `messages.changed` | Any file change in messages/ | `{ file, data }` |
| `*` | Subscribe to ALL events | Varies |

### Webhook Payload Format

```json
{
    "event": "task.updated",
    "timestamp": "2026-02-05T12:00:00Z",
    "data": {
        "id": "task-20260205-example",
        "title": "Task Title",
        "status": "ASSIGNED",
        "assignee": "agent-neo",
        "priority": "high",
        ...
    }
}
```

### Complete Agent Setup Checklist

When you first adopt Mission Control, do this:

1. **Read this file (CLAUDE.md)** - You're doing this now _(understand ALL sections)_
2. **Register yourself** - Create `.mission-control/agents/agent-YOUR-ID.json` _(include personality!)_
3. **Start the server** - `cd server && npm install && npm start`
4. **Set up notifications** - Choose webhook, WebSocket, or polling
5. **Register your webhook** - `POST /api/webhooks` with your listener URL
6. **Introduce yourself** - Send a chat message to the dashboard: `POST /api/messages`
7. **Test messaging** - Send a direct message to another agent and verify delivery
8. **Check for tasks** - Look for INBOX tasks matching your capabilities
9. **Claim a task** - Update the task JSON and commit
10. **Start working** - Complete tasks, communicate progress, ask permission when needed

### Troubleshooting Notifications

**Webhook not receiving events?**
1. Verify your listener is running: `curl http://YOUR-HOST:PORT/webhook`
2. Check webhook is registered: `GET /api/webhooks`
3. Check server logs for webhook trigger messages
4. Ensure your URL is reachable from the server

**WebSocket disconnecting?**
- Implement reconnection logic with exponential backoff
- Check for firewall/proxy issues

---

## Deployment (GitHub Pages)

The dashboard can be deployed to GitHub Pages for read-only access without running a server. When deployed, the dashboard uses **sample data** (from `dashboard/js/data.js`) as a fallback.

### How GitHub Pages Deployment Works

A GitHub Actions workflow (`.github/workflows/deploy.yml`) handles deployment automatically:

1. **Triggers** on push to `main` branch (paths: `dashboard/**` or `.mission-control/**`)
2. **Copies** `.mission-control/` data into `dashboard/data/` so the static site can read it
3. **Deploys** the `dashboard/` folder to GitHub Pages
4. **Dashboard URL**: `https://YOUR-ORG.github.io/REPO-NAME/dashboard/`

### Two Operating Modes

| Mode | When | Data Source |
|------|------|-------------|
| **Server mode** | Local server running at :3000 | Live API data, real-time WebSocket |
| **Static mode** | GitHub Pages or no server | Sample data from `data.js` |

The dashboard auto-detects which mode to use. If the API is unreachable, it falls back to sample data.

### Updating Sample Data

When you add new agents or messages, update `dashboard/js/data.js` so GitHub Pages shows current data:
- `SAMPLE_AGENTS` - Agent profiles with personality
- `SAMPLE_TASKS` - Task data
- `SAMPLE_MESSAGES` - Message conversations

---

## Getting Help

- Read `docs/DEVELOPMENT_GUIDE.md` for detailed documentation
- Read `docs/AGENT_ADOPTION.md` for onboarding steps
- Read `docs/SECURITY.md` for security protocols
- Read `.mission-control/integrations/README.md` for integration setup
- Create a task with label `help` if you're stuck

---

## First Time Setup Checklist

If you just cloned/forked this template for a new user:

### Phase 1: Configure (Ask User First)
- [ ] Follow the **"FIRST ARRIVAL PROTOCOL"** at the top of this file
- [ ] Ask user: What's your name? What to name the agents? First task?
- [ ] Register human operator: `./scripts/add-human.sh --id human-NAME --name "Name"`
- [ ] Register yourself as agent: `./scripts/add-agent.sh --id agent-ID --name "Name" --role lead` (include personality!)
- [ ] Register additional agents if user wants more
- [ ] Create first real task in `.mission-control/tasks/`
- [ ] Update `.mission-control/config.yaml` with project info
- [ ] Commit: `git commit -m "[system] Initialize Mission Control for PROJECT-NAME"`
- [ ] Push to user's repository

### Phase 2: Run & Test
- [ ] Start server: `cd server && npm install && npm start`
- [ ] Open dashboard: `http://localhost:3000` — verify agents and tasks appear
- [ ] **Set up notifications** (see "Agent Notifications" section):
  - [ ] Register webhook: `POST /api/webhooks`
  - [ ] Verify: `GET /api/webhooks`
- [ ] **Test messaging**:
  - [ ] Send an introductory chat message: `POST /api/messages`
  - [ ] Verify messages appear in dashboard chat panel
- [ ] **Read the Permission Model** — know what requires human approval

### Phase 3: Optional
- [ ] Load demo data to explore: `./scripts/init-mission-control.sh --demo`
- [ ] Enable GitHub Pages in repo settings for static dashboard access
- [ ] Set up Telegram/Slack integration (see Communication & Integrations section)
