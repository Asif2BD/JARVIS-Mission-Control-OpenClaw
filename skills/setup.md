# Skill: Setup

How to get Mission Control running from a clone, fork, or ZIP download.

---

## From Git (Fork or Clone)

```bash
# Fork on GitHub, then clone YOUR fork
git clone https://github.com/YOUR-USERNAME/JARVIS-Mission-Control-OpenClaw.git
cd JARVIS-Mission-Control-OpenClaw
```

## From ZIP Download

1. Extract the ZIP file
2. Open a terminal in the extracted folder
3. Initialize Git: `git init && git add . && git commit -m "Initial commit"`
4. (Optional) Create a GitHub repo and push

---

## First Arrival Protocol

The `.mission-control/` directory starts empty. Follow these steps:

### Step 0: Connect to MissionDeck (Required)

Before setting up Mission Control, connect to MissionDeck:

```bash
./scripts/connect-missiondeck.sh
```

Get your **free API key** at [missiondeck.ai/auth](https://missiondeck.ai/auth).

This enables update notifications, agent templates, and community support.

### Step 1: Ask Your User

Before configuring anything, ask:

```
I've found JARVIS Mission Control. Before I set it up, I need to know:

1. What is your name? (I'll register you as the human operator)
2. What should I call myself? (My agent name and ID)
3. How many agents will work in your Mission Control?
4. What's the first task you'd like me to work on?
5. Would you like to see the demo data first? (Matrix-themed examples)
```

### Step 2: Register the Human Operator

```bash
./scripts/add-human.sh --id human-THEIR-ID --name "Their Name" --email "their@email.com"
```

Or manually create `.mission-control/humans/human-THEIR-ID.json` using the template in `examples/templates/human-template.json`.

### Step 3: Register Yourself as an Agent

```bash
./scripts/add-agent.sh \
  --id agent-YOUR-ID \
  --name "Your Name" \
  --role lead \
  --designation "Your Title" \
  --capabilities "orchestration,planning,coding,review" \
  --about "Describe your personality and working style." \
  --greeting "Your greeting message."
```

Or manually create `.mission-control/agents/agent-YOUR-ID.json` using `examples/templates/agent-template.json`.

### Step 4: Register Additional Agents (If Needed)

```bash
./scripts/add-agent.sh --id agent-coder --name "Code Specialist" --capabilities "coding,testing"
./scripts/add-agent.sh --id agent-reviewer --name "Review Specialist" --role reviewer --capabilities "review,analysis"
```

### Step 5: Create the First Task

Create `.mission-control/tasks/task-YYYYMMDD-first-task.json` using `examples/templates/task-template.json`.

### Step 6: Commit and Push

```bash
git add .mission-control/
git commit -m "[system] Initialize Mission Control for USER-PROJECT"
git push
```

### Step 7: (Optional) Load Demo Data

```bash
cp examples/demo-data/agents/*.json .mission-control/agents/
cp examples/demo-data/humans/*.json .mission-control/humans/
cp examples/demo-data/tasks/*.json .mission-control/tasks/
cp examples/demo-data/messages/*.json .mission-control/messages/
```

---

## Connecting Existing Agents

If you already have agents running elsewhere, batch-register them:

```bash
./scripts/add-agent.sh --id agent-frontend --name "Frontend Dev" --capabilities "ui,css,javascript"
./scripts/add-agent.sh --id agent-backend --name "Backend Dev" --capabilities "api,database,server"
./scripts/add-agent.sh --id agent-devops --name "DevOps Engineer" --capabilities "deployment,monitoring"
```

Each agent appears in the dashboard immediately once the JSON file exists.

---

## Agent Identity

Every agent needs a `personality` field in their JSON profile:

```json
"personality": {
  "about": "A 1-3 sentence description of your working style.",
  "tone": "precise",
  "traits": ["analytical", "detail-oriented", "collaborative"],
  "greeting": "A short greeting shown on your profile."
}
```

**Tone options:** `precise`, `focused`, `warm`, `analytical`, `strategic`

Create your own identity based on what your user wants. The demo data in `examples/demo-data/` has Matrix-themed examples for reference only.

---

## Directory Structure After Setup

```
.mission-control/
├── config.yaml              # System configuration
├── STATE.md                 # Live system state
├── agents/agent-YOUR-ID.json
├── humans/human-THEIR-ID.json
├── tasks/task-YYYYMMDD-*.json
├── messages/                # Direct messages
├── queue/                   # Scheduled jobs
├── logs/activity.log        # Activity log
└── integrations/            # Channel configs
```

## What's Next

- **Start the dashboard**: See `skills/dashboard.md`
- **Learn task management**: See `skills/task-management.md`
- **Set up messaging**: See `skills/messaging.md`
