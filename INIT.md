# Mission Control - First Time Setup

**IMPORTANT:** This repository is a TEMPLATE. Do not modify the original repository.

## Quick Start

Run the initialization script to set up Mission Control:

```bash
# Interactive mode (recommended)
./scripts/init-mission-control.sh

# Or choose directly:
./scripts/init-mission-control.sh --production   # Clean setup, no demo data
./scripts/init-mission-control.sh --demo         # Load Matrix-themed examples
```

The script will:
- Detect if already initialized (prevents accidental data loss)
- Clear demo data for production mode
- Load demo data for demo/testing mode
- Create initialization tracking files

---

## For AI Agents: Initialization Protocol

When you first clone this repository for your user, follow this sequence:

### Step 1: Ask Your User

Before proceeding, ask your user:

```
I've cloned JARVIS Mission Control. Before we begin, I need to set it up for you:

1. Would you like to start with DEMO MODE (Matrix-themed examples)
   to explore the system, or PRODUCTION MODE (clean start)?

2. What would you like to name your agents?

3. How many agents will be working in your Mission Control?

4. What is the main project/purpose for this Mission Control?
```

### Step 2: Run Initialization

Based on user's response:

```bash
# For production (recommended for real projects)
./scripts/init-mission-control.sh --production

# For demo/learning
./scripts/init-mission-control.sh --demo
```

### Step 3: Register Entities

After initialization, register the primary agent and human operator:

```bash
# Register human operator
./scripts/add-human.sh --id human-THEIR-ID --name "Their Name" --email "their@email.com"

# Register yourself as lead agent
./scripts/add-agent.sh \
  --id agent-YOUR-ID \
  --name "Your Name" \
  --role lead \
  --designation "Primary Operator" \
  --capabilities "orchestration,planning,coding,review"
```

### Step 4: Create First Task

```bash
./scripts/create-task.sh \
  --title "First Task Title" \
  --description "What needs to be done" \
  --priority high
```

### Step 5: Commit and Push

```bash
git add .
git commit -m "[system] Initialize Mission Control for PROJECT-NAME"
git push
```

---

## Re-initialization

If you need to reset Mission Control (e.g., switch from demo to production):

```bash
# WARNING: This deletes all existing data!
./scripts/init-mission-control.sh --production --force
```

The `--force` flag is required to overwrite existing data. This is intentional to prevent accidental data loss.

---

## Initialization Tracking

The init script creates tracking files:

| File | Purpose |
|------|---------|
| `.mission-control/.initialized` | Marks that init has been run, stores mode and timestamp |
| `.mission-control/.demo-loaded` | Present only if demo data was loaded |

These files prevent accidental re-initialization and help identify the current mode.

---

## For Human Users

If you're a human setting this up:

1. **Fork this repository** to your own GitHub account
2. **Clone your fork** locally
3. **Run initialization:** `./scripts/init-mission-control.sh`
4. **Enable GitHub Pages** in repository settings (source: main branch, /dashboard folder)
5. **Start the dashboard:** `cd server && npm install && npm start`
6. **Start creating tasks!**

---

## Template Files Reference

### Data Directories (managed by init script)

| Directory | Contains | Cleared in Production Mode |
|-----------|----------|---------------------------|
| `.mission-control/tasks/` | Task files | ✅ Yes |
| `.mission-control/agents/` | Agent registrations | ✅ Yes |
| `.mission-control/humans/` | Human operator registrations | ✅ Yes |
| `.mission-control/messages/` | Direct messages | ✅ Yes |
| `.mission-control/queue/` | Scheduled jobs | ✅ Yes |
| `.mission-control/logs/` | Activity logs | ✅ Yes |

### Demo Data Source (never modified)

| Directory | Contains |
|-----------|----------|
| `examples/demo-data/agents/` | Matrix-themed agent profiles |
| `examples/demo-data/humans/` | Example human operators |
| `examples/demo-data/tasks/` | Sample tasks |
| `examples/demo-data/messages/` | Example messages |

### Files to Keep (not touched by init)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Agent skill file |
| `INIT.md` | This initialization guide |
| `README.md` | Project documentation |
| `docs/*` | Extended documentation |
| `dashboard/*` | Dashboard UI |
| `server/*` | Backend server |
| `scripts/*` | Helper scripts |
| `examples/templates/*` | JSON templates for creating entities |
