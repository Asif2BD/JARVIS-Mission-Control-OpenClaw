# Feature Request: Auto-Sync OpenClaw Data to Mission Control

## Problem

Mission Control dashboard shows empty sections because it doesn't automatically sync with OpenClaw's actual state. Users expect to see their real agents, schedules, and resources — not manually created entries.

## Missing Integrations

### 1. **Agents Sync** ⚠️ Partial
- **Current:** Manual agent JSON files in `.mission-control/agents/`
- **Expected:** Auto-discover from OpenClaw config (`openclaw.json` agents list)
- **Data source:** `gateway config.get` → `agents.list[]`

### 2. **Schedules Sync** ❌ Missing
- **Current:** Directory doesn't exist, no schedules shown
- **Expected:** Sync with OpenClaw cron jobs
- **Data source:** `cron list` → display all scheduled jobs
- **Fields needed:** job name, schedule (cron expr), next run, last run, status

### 3. **Resources Sync** ❌ Missing  
- **Current:** Empty directory
- **Expected:** Show configured resources:
  - Models (Opus, Sonnet, Haiku, Deepseek)
  - API keys (masked)
  - Providers (Anthropic, Brave, etc.)
  - Skills loaded
- **Data source:** `gateway config.get` → models, tools, skills

### 4. **Tasks from Chat** ❌ Missing
- **Current:** Only auto-generated session tasks exist
- **Expected:** When Oracle/architect assigns work in chat, create a tracked task
- **Trigger:** Message patterns like "@TankMatrixZ_Bot do X" or "Tank, handle Y"
- **Integration:** Webhook or message hook to capture assignments

### 5. **Session Activity** ⚠️ Partial
- **Current:** Logs exist but not surfaced in dashboard
- **Expected:** Show active sessions, token usage, recent activity
- **Data source:** `sessions_list` → display in dashboard

## Proposed Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  OpenClaw API   │────▶│  Sync Service    │────▶│ Mission Control │
│  (gateway/cron) │     │  (new component) │     │   (.mission-    │
└─────────────────┘     └──────────────────┘     │    control/)    │
                                                  └─────────────────┘
```

### Sync Service Requirements:
1. **Startup sync:** Pull all data on Mission Control server start
2. **Periodic sync:** Refresh every 5 minutes
3. **Event-driven:** Webhook for real-time updates (optional)

## Implementation Priority

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| Schedules sync (cron) | P0 | Medium | High |
| Resources sync (models/keys) | P0 | Low | High |
| Agents sync (full) | P1 | Low | Medium |
| Tasks from chat | P2 | High | High |
| Session activity | P2 | Medium | Medium |

## Acceptance Criteria

- [ ] Dashboard shows all OpenClaw cron jobs in Schedules tab
- [ ] Dashboard shows configured models in Resources tab
- [ ] Dashboard shows loaded skills in Resources tab
- [ ] Agent cards show real status from `sessions_list`
- [ ] Data refreshes automatically (no manual intervention)

## Notes

This was identified during live testing on 2026-02-06. The Architect expected Mission Control to reflect the actual system state, not require manual data entry.

---
*Created by Tank | 2026-02-06*
