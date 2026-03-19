# Mission Control v2 — Day 1 Sprint

**Goal:** Ship the highest-impact features in one day using parallel Claude Code agents.

---

## Scope (Realistic for 1 Day)

### ✅ In Scope
1. **Enhanced Agent Cards** — status badges, model, last active, cost/mo
2. **Live Event Feed** — real-time activity log (WebSocket)
3. **Top Metrics Bar** — today's cost, active agents, tasks count
4. **Basic Cost Tracking** — pull from OpenClaw, display per-agent

### ⏸️ Deferred
- Approval workflow (needs OpenClaw hooks — bigger lift)
- Schedule view (nice-to-have)
- Budget alerts & settings
- Historical data storage

---

## Task Breakdown (Parallel Execution)

### Agent 1: Backend — Event System
**Branch:** `feat/event-feed`
- [ ] Create event logging infrastructure (SQLite table)
- [ ] WebSocket server for real-time events
- [ ] Event types: chat, tool, cron, error
- [ ] API endpoint: `GET /api/events` (with filters)
- [ ] Hook into existing agent status polling to generate events

### Agent 2: Backend — Cost Tracking
**Branch:** `feat/cost-tracking`
- [ ] OpenClaw usage API integration
- [ ] Per-agent cost aggregation
- [ ] Today/monthly cost endpoints
- [ ] Cache layer to avoid hammering API

### Agent 3: Frontend — Agent Cards v2
**Branch:** `feat/agent-cards-v2`
- [ ] Enhanced card component with status badges
- [ ] Model display
- [ ] Last active timestamp
- [ ] Cost/mo display
- [ ] Loading states

### Agent 4: Frontend — Event Feed + Metrics
**Branch:** `feat/event-feed-ui`
- [ ] Top metrics bar component
- [ ] Live event feed component
- [ ] WebSocket client connection
- [ ] Event type icons and filtering
- [ ] Auto-scroll with pause on hover

---

## Execution Order

```
┌─────────────────────────────────────────────────────┐
│  PARALLEL PHASE 1 (Backend)                         │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Agent 1:        │  │ Agent 2:        │          │
│  │ Event System    │  │ Cost Tracking   │          │
│  └────────┬────────┘  └────────┬────────┘          │
│           │                    │                    │
│           └──────────┬─────────┘                    │
│                      ▼                              │
│  PARALLEL PHASE 2 (Frontend)                        │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Agent 3:        │  │ Agent 4:        │          │
│  │ Agent Cards v2  │  │ Event Feed UI   │          │
│  └────────┬────────┘  └────────┬────────┘          │
│           │                    │                    │
│           └──────────┬─────────┘                    │
│                      ▼                              │
│  INTEGRATION & TEST                                 │
│  Tank: Merge branches, fix conflicts, deploy        │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack Reference

- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **Frontend:** React, TailwindCSS, shadcn/ui
- **Real-time:** ws (WebSocket library)
- **Build:** Vite

---

## Sub-Agent Prompts

### Agent 1 Prompt
```
You're working on JARVIS Mission Control. Your task: Build the event logging backend.

Directory: /root/.openclaw/workspace/agents/tank/mission-control
Branch: feat/event-feed

Tasks:
1. Create SQLite table for events (id, timestamp, agent, type, summary, cost, metadata)
2. Add WebSocket server on /ws/events for real-time streaming
3. Create event logger utility that other parts of the app can call
4. API endpoint GET /api/events with ?agent=&type=&limit= filters
5. Generate sample events when agents are polled for status

Event types: chat, tool, search, email, cron, error, approval

Read existing code first to match patterns. Use better-sqlite3. Test with curl.
```

### Agent 2 Prompt
```
You're working on JARVIS Mission Control. Your task: Build cost tracking integration.

Directory: /root/.openclaw/workspace/agents/tank/mission-control
Branch: feat/cost-tracking

Tasks:
1. Create service to call OpenClaw gateway API for usage stats
2. Aggregate costs per-agent (today, this month)
3. API endpoints: GET /api/costs, GET /api/costs/:agent
4. Cache results (5 min TTL) to reduce API calls
5. Calculate projected monthly spend based on daily average

OpenClaw API base: http://localhost:3000 (or from env)
Read existing code to match patterns.
```

### Agent 3 Prompt
```
You're working on JARVIS Mission Control. Your task: Enhance the agent status cards.

Directory: /root/.openclaw/workspace/agents/tank/mission-control
Branch: feat/agent-cards-v2

Tasks:
1. Update AgentCard component with new design
2. Add status badge (Running/Idle/Monitoring/Awaiting/Offline)
3. Show model name
4. Show last active time (relative: "2 min ago")
5. Show cost/mo (placeholder until backend ready)
6. Add "View Logs" and "Send Message" buttons (can be stubs)

Use existing shadcn components. Match current styling.
```

### Agent 4 Prompt
```
You're working on JARVIS Mission Control. Your task: Build the event feed UI and metrics bar.

Directory: /root/.openclaw/workspace/agents/tank/mission-control
Branch: feat/event-feed-ui

Tasks:
1. Create TopMetricsBar component (today's cost, active agents, tasks count)
2. Create LiveEventFeed component
3. WebSocket client to connect to /ws/events
4. Event icons by type (💬🔧🔍📧⏰⚠️)
5. Filter dropdown (by agent, by type)
6. Auto-scroll with pause on hover

Use shadcn components. Mobile responsive.
```

---

## Success Criteria

By end of day:
- [ ] Dashboard shows enhanced agent cards with real status
- [ ] Top bar shows today's cost and active agent count
- [ ] Live event feed shows activity in real-time
- [ ] Events persist in SQLite
- [ ] Deployed and accessible at zion.asif.dev

---

*Let's ship it.*
