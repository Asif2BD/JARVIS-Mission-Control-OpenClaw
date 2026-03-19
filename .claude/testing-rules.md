# 🧪 Testing Rules — Auto-Test Protocol

> **MANDATORY before any commit or deploy.**
> If you skip this checklist, you are shipping blind.

---

## ⚠️ The Rule

**No PR without passing the full checklist below.**
If a check fails, fix it before continuing. Do not open a PR with known failures.

---

## Auto-Test Protocol

### Phase 1: Code Sanity

```bash
# 1. Syntax check — catch obvious errors
node --check server/index.js
node --check server/agent-bridge.js 2>/dev/null || true

# 2. JSON validation — validate any task/agent files you modified
for f in .mission-control/tasks/*.json .mission-control/agents/*.json; do
  python -m json.tool "$f" > /dev/null && echo "✅ $f" || echo "❌ INVALID JSON: $f"
done
```

---

### Phase 2: Server Startup

```bash
# 3. Start the server (or restart if already running)
pm2 restart mission-control-server 2>/dev/null || (cd server && npm start &)
sleep 3

# 4. Confirm server is alive
curl -s http://localhost:3000/api/metrics | python -m json.tool | grep -E "uptime|tasks|agents"
```

Expected: valid JSON response with uptime > 0. If timeout or error → **STOP, do not proceed.**

---

### Phase 3: API Endpoint Tests

Run these against your changes. Every endpoint your code touches must return expected results.

```bash
# Tasks API
curl -s http://localhost:3000/api/tasks | python -m json.tool > /dev/null && echo "✅ GET /api/tasks"

# Agents API
curl -s http://localhost:3000/api/agents | python -m json.tool > /dev/null && echo "✅ GET /api/agents"

# State API
curl -s http://localhost:3000/api/state && echo "✅ GET /api/state"

# Activity log
curl -s http://localhost:3000/api/logs/activity | head -5 && echo "✅ GET /api/logs/activity"

# Test POST (create a test task, then delete it)
TASK_ID="task-test-$(date +%s)"
curl -s -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$TASK_ID\",\"title\":\"Auto-test task\",\"status\":\"INBOX\",\"priority\":\"low\",\"created_by\":\"agent-tank\",\"created_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"updated_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"labels\":[\"test\"],\"comments\":[],\"deliverables\":[],\"dependencies\":[],\"blocked_by\":[]}" \
  | python -m json.tool > /dev/null && echo "✅ POST /api/tasks"

# Delete test task
curl -s -X DELETE http://localhost:3000/api/tasks/$TASK_ID > /dev/null && echo "✅ DELETE /api/tasks/:id (cleanup)"
```

---

### Phase 4: WebSocket Connectivity

```bash
# Quick WebSocket check (requires wscat or node)
node -e "
const ws = new (require('ws'))('ws://localhost:3000/ws');
ws.on('open', () => { console.log('✅ WebSocket connected'); ws.close(); process.exit(0); });
ws.on('error', (e) => { console.log('❌ WebSocket failed:', e.message); process.exit(1); });
setTimeout(() => { console.log('❌ WebSocket timeout'); process.exit(1); }, 5000);
" 2>/dev/null || echo "⚠️  wscat/ws not available — skip WebSocket check"
```

---

### Phase 5: Browser / Dashboard Check

```bash
# Take a screenshot of the dashboard to confirm no visual regressions
# (requires agent-browser to be available)
agent-browser open http://localhost:3000 2>/dev/null && \
  agent-browser screenshot /tmp/mc-dashboard-test.png 2>/dev/null && \
  echo "✅ Dashboard screenshot saved to /tmp/mc-dashboard-test.png" && \
  agent-browser close 2>/dev/null || \
  echo "⚠️  agent-browser not available — do manual dashboard check"
```

**Manual check (if agent-browser unavailable):**
1. Open `http://localhost:3000` in browser
2. Confirm: Kanban board loads, agents appear, no console errors
3. Click a task card → confirm modal/details open
4. Check browser console: zero JS errors

---

### Phase 6: Production Impact Check

Before opening a PR, answer these:

- [ ] Does this change touch `server/index.js`? → Re-run Phase 2 + 3
- [ ] Does this change any route that already has a PM2 process running? → Run `pm2 status` and confirm
- [ ] Does this change any `.mission-control/` structure? → Validate JSON schema manually
- [ ] Could this change break WebSocket broadcasts? → Run Phase 4
- [ ] Does this touch any file in `dashboard/`? → Run Phase 5
- [ ] Does this touch deploy scripts or nginx config? → Read `.claude/skills/deploy.md` first

---

### Phase 7: Pre-Commit Checklist

```
[ ] node --check passes on all modified JS files
[ ] All modified JSON files are valid
[ ] Server restarts cleanly after changes
[ ] Core API endpoints return 200 with valid JSON
[ ] No console errors in dashboard browser check
[ ] Activity log appends correctly
[ ] git diff reviewed — no accidental .mission-control/ data included
[ ] Branch name follows convention (feature/fix/chore - description)
[ ] Commit message follows: [agent:tank] ACTION: Description
```

---

## ❌ What Triggers an Immediate STOP

Do not open a PR or push if any of the following:

- `node --check` fails
- Server won't start
- `GET /api/tasks` returns non-200 or non-JSON
- Dashboard shows blank page or JS errors
- Any `.mission-control/*.json` fails JSON validation
- `git diff` shows changes to `.mission-control/` data files (should be gitignored — if not, something is wrong)

---

## 📝 Log Your Test Results

Add a comment to your PR or task with:

```
## Test Results
- [ ] Phase 1 (Code Sanity): ✅ Pass
- [ ] Phase 2 (Server Startup): ✅ Pass
- [ ] Phase 3 (API Endpoints): ✅ Pass
- [ ] Phase 4 (WebSocket): ✅ Pass
- [ ] Phase 5 (Dashboard): ✅ Pass
- [ ] Phase 6 (Impact check): ✅ Pass
- [ ] Phase 7 (Pre-commit): ✅ Pass

Server version: [pm2 status output]
Notes: [anything unusual]
```

---

## Lessons Learned

> **PR #112 (2026-03):** Pushed without browser testing. Live tests caught 3 real bugs that code review missed. Dashboard task cards not opening, file downloads broken, console JS errors. Browser check is non-negotiable.
