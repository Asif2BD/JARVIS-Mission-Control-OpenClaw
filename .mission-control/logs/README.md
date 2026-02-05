# Mission Control Activity Logs

This directory contains activity logs for Mission Control operations.

## Files

| File | Purpose |
|------|---------|
| `activity.log` | Main activity log (append-only) |
| `YYYY-MM-DD.log` | Daily activity logs (archived) |

## Log Format

```
TIMESTAMP [ACTOR] ACTION: DESCRIPTION
```

### Timestamp
ISO 8601 format with timezone: `2026-02-05T12:00:00Z`

### Actor Types
- `agent-*` - AI agent actions
- `human-*` - Human operator actions
- `system` - Automated system actions
- `webhook` - External webhook events

### Action Types

| Action | Description |
|--------|-------------|
| CREATED | New task/entity created |
| CLAIMED | Task claimed by agent |
| ASSIGNED | Task assigned to agent |
| STATUS | Task status changed |
| COMMENT | Comment added to task |
| COMPLETED | Task marked complete |
| BLOCKED | Task blocked |
| STARTED | Queue job started |
| QUEUE | Queue job event |
| SYNC | Repository sync event |
| STATE | STATE.md updated |
| LOGIN | Agent session started |
| LOGOUT | Agent session ended |
| ALERT | System alert triggered |
| ERROR | Error occurred |
| MESSAGE | Incoming message from channel |
| NOTIFY | Outgoing notification sent |

## Examples

```
2026-02-05T12:00:00Z [agent-neo] CREATED: task-20260205-example (New Feature)
2026-02-05T12:01:00Z [agent-neo] STATUS: task-20260205-example changed to IN_PROGRESS
2026-02-05T12:30:00Z [agent-neo] COMMENT: task-20260205-example - "Making progress"
2026-02-05T13:00:00Z [agent-neo] COMPLETED: task-20260205-example
2026-02-05T13:00:00Z [system] NOTIFY: Sent completion notification to human-admin via telegram
```

## Log Rotation

Daily logs are created at midnight UTC:
- `activity.log` is the live log
- At midnight, entries are copied to `YYYY-MM-DD.log`
- Old daily logs can be archived or deleted after 30 days

## Querying Logs

```bash
# Find all actions by an agent
grep "\[agent-neo\]" activity.log

# Find all task creations
grep "CREATED:" activity.log

# Find all errors
grep "ERROR:" activity.log

# Find activity in time range
grep "2026-02-05T1[0-2]" activity.log

# Count actions by type
grep -o "^\S* \[\S*\] \w*:" activity.log | sort | uniq -c

# Find blocked tasks
grep "BLOCKED:" activity.log
```

## Writing to Logs

Agents should append to logs using this pattern:

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [agent-YOUR-ID] ACTION: Description" >> .mission-control/logs/activity.log
```

Or in the task JSON comment format, which is auto-logged.
