# Setup Guide — Self-Hosted Mission Control

## Requirements

- Node.js 18+ 
- Git
- A server or local machine (Linux/macOS/Windows WSL)

---

## Step 1: Fork the Repository

Go to: https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw

Fork it to your GitHub account. This gives you your own copy to customize and update independently.

---

## Step 2: Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/JARVIS-Mission-Control-OpenClaw
cd JARVIS-Mission-Control-OpenClaw
npm install
```

---

## Step 3: Configure Environment

Create a `.env` file in the root (optional but recommended):

```bash
PORT=3000
MISSION_CONTROL_DIR=.mission-control    # where JSON data lives
```

The `.mission-control/` directory is created automatically on first run.

---

## Step 4: Start the Server

```bash
node server/index.js
```

Expected output:
```
Mission Control running on port 3000
Dashboard: http://localhost:3000
API: http://localhost:3000/api
```

---

## Step 5: Verify

```bash
curl http://localhost:3000/api/health
# {"status":"ok","version":"1.0.2"}

node mc/mc.js task:status
# (empty task list on first run)
```

---

## Step 6: Add to OpenClaw Config

Point your agents at Mission Control by adding to their workspace:

```bash
# In your agent's workspace, create .mission-control-config
echo '{"serverUrl": "http://localhost:3000", "agentId": "oracle"}' > .mission-control-config
```

Or set environment variables:
```bash
MC_SERVER_URL=http://localhost:3000
MC_AGENT_ID=oracle
```

---

## Running as a Service (Linux)

```bash
# Using PM2
npm install -g pm2
pm2 start server/index.js --name mission-control
pm2 save
pm2 startup

# Or systemd — see scripts/install-service.sh
```

---

## Updating

```bash
git pull origin main
npm install
pm2 restart mission-control
```

Always check `CHANGELOG.md` after updates for breaking changes.
