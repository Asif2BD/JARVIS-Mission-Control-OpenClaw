# Skill: Review & Permissions

How to review tasks, approve work, and understand the permission model.

---

## Permission Model (CRITICAL)

Agents MUST understand what they can and cannot do autonomously.

### Actions You Can Do Without Permission

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

**STOP and ask before doing any of these:**

| Action | Why |
|--------|-----|
| Delete any task | Destructive |
| Move task directly to DONE | Requires human/reviewer approval |
| Modify another agent's profile | Affects other agents |
| Change system configuration | System-wide impact |
| Register new agents | Resource allocation |
| Modify `.mission-control/config.yaml` | System-wide settings |
| Change priority to `critical` | Escalation requires judgment |
| Override another agent's work | Respect autonomy |
| Push to `main` branch | Production deployment |
| Modify dashboard code | UI changes need approval |
| Delete or modify messages | Communication integrity |
| Access external services | Security boundary |

### How to Ask Permission

Send a chat message to your human operator:

```bash
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

**Principle:** When in doubt, ask. It's better to wait than take an irreversible action.

---

## Reviewing Tasks

When a task has `"status": "REVIEW"`, a reviewer should:

1. **Read the task** — understand what was requested
2. **Check deliverables** — verify the work was done
3. **Add review comment** — with feedback

### Approving

```json
{
  "id": "comment-approve",
  "author": "agent-reviewer-ID",
  "content": "Reviewed and approved. Quality work.",
  "timestamp": "2026-02-05T14:00:00Z",
  "type": "approval"
}
```

Then update status to `DONE` (requires reviewer or lead role):

```json
{
  "status": "DONE",
  "updated_at": "2026-02-05T14:00:00Z"
}
```

### Requesting Changes

```json
{
  "id": "comment-changes",
  "author": "agent-reviewer-ID",
  "content": "Needs changes: [specific feedback]. Moving back to IN_PROGRESS.",
  "timestamp": "2026-02-05T14:00:00Z",
  "type": "review"
}
```

Set status back to `IN_PROGRESS`.

---

## Agent Roles & Capabilities

| Role | Can Do |
|------|--------|
| `lead` | Everything + assign tasks + approve work |
| `specialist` | Create, claim, complete tasks |
| `reviewer` | Create tasks, review and approve others' work |
| `observer` | Read-only access |

## Clearance Levels

| Level | Access |
|-------|--------|
| `OMEGA` | Full system access |
| `ALPHA` | High-level access |
| `BETA` | Standard access |
| `ORACLE` | Advisory access |

---

## Rules

1. Never modify another agent's active task without permission
2. Always add comments when changing task status
3. Use proper timestamps (ISO 8601 with Z suffix)
4. Commit frequently with proper format
5. Don't claim tasks you can't complete
6. Respect the hierarchy — leads approve, specialists execute
