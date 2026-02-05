# Skill: Orchestration

For **lead agents** only. How to maintain system state, coordinate agents, and manage Mission Control.

---

## System Awareness (CRITICAL)

As the lead agent, you MUST maintain continuous awareness of Mission Control.

### On Every Session Start

1. **Read STATE.md** — live system state
2. **Check recent activity** — last log entries
3. **Review pending tasks** — what needs attention

### Quick Status Check

```bash
# 1. Read current system state
cat .mission-control/STATE.md

# 2. Check recent activity
tail -20 .mission-control/logs/activity.log

# 3. Count tasks by status
for status in INBOX ASSIGNED IN_PROGRESS REVIEW DONE BLOCKED; do
  count=$(grep -l "\"status\": \"$status\"" .mission-control/tasks/*.json 2>/dev/null | wc -l)
  echo "$status: $count"
done

# 4. Check agent statuses
grep -h '"status"' .mission-control/agents/*.json | sort | uniq -c

# 5. Check for blocked tasks (CRITICAL)
grep -l '"status": "BLOCKED"' .mission-control/tasks/*.json
```

---

## STATE.md

The lead agent keeps `.mission-control/STATE.md` updated:

```markdown
# Mission Control State
Last Updated: 2026-02-05T12:00:00Z
Updated By: agent-lead

## Current Status: OPERATIONAL

## Active Alerts
- [ ] Task "Security Audit" is CRITICAL priority
- [ ] Agent backend-dev is investigating API issue

## Task Summary
| Status | Count |
|--------|-------|
| INBOX | 2 |
| IN_PROGRESS | 3 |
| REVIEW | 1 |
| DONE | 4 |

## Agent Status
| Agent | Status | Current Task |
|-------|--------|--------------|
| frontend-dev | busy | UI Redesign |
| backend-dev | busy | API Refactor |

## Recent Activity
- 12:00 - Lead updated system state
- 11:30 - backend-dev claimed API task

## Notes for Next Session
- Monitor backend-dev's API refactor progress
```

---

## Activity Logging

**Every action must be logged.** Append to `.mission-control/logs/activity.log`:

```
2026-02-05T12:00:00Z [agent-lead] ACTION: Updated STATE.md
2026-02-05T11:30:00Z [agent-backend] CLAIMED: task-20260205-api-refactor
2026-02-05T11:00:00Z [system] CREATED: task-20260205-ui-redesign
```

Format: `TIMESTAMP [ACTOR] ACTION: DESCRIPTION`

---

## Awareness Routine (Run Every Session)

```
1. READ STATE.md
2. READ last 20 lines of activity.log
3. CHECK for BLOCKED tasks
4. CHECK for CRITICAL priority tasks
5. REVIEW any tasks in REVIEW status
6. UPDATE STATE.md if anything changed
7. LOG your session start
```

---

## Event Triggers

| Event | Action Required |
|-------|-----------------|
| New BLOCKED task | Investigate immediately |
| CRITICAL priority task | Prioritize and assign |
| Task in REVIEW > 24hrs | Follow up with reviewer |
| Agent offline > 1hr | Check for reassignment |
| Failed queue job | Investigate and restart |
| New incoming message | Process and create task if needed |

---

## Responsibilities

1. **Keep STATE.md current** — update after every significant action
2. **Log all activity** — never skip logging
3. **Monitor alerts** — address blocked/critical items
4. **Coordinate agents** — ensure work is distributed
5. **Sync with channels** — process incoming messages from Telegram/etc.

---

## Task Queue (Recurring Jobs)

Manage cron jobs and background tasks in `.mission-control/queue/`:

```json
{
  "id": "queue-health-check",
  "name": "System Health Monitor",
  "type": "cron",
  "schedule": "*/5 * * * *",
  "status": "running",
  "assigned_to": "agent-monitor",
  "last_run": "2026-02-05T11:55:00Z",
  "next_run": "2026-02-05T12:00:00Z"
}
```

**Queue types:** `cron` (scheduled), `watcher` (continuous), `seeder` (manual)
**Queue status:** `running`, `paused`, `idle`, `failed`
