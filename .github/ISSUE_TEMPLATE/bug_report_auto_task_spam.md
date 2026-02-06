---
name: Bug - Agent Bridge Auto-Creates Task Spam
about: Agent Bridge creates unwanted tasks for every agent spawn
title: '[BUG] Agent Bridge auto-creates junk tasks for every spawn'
labels: bug, agent-bridge, cleanup
assignees: ''
---

## Problem Description

The Agent Bridge is configured to automatically create a Mission Control task for **every agent spawn** via `sessions_spawn`, resulting in dashboard clutter with meaningless tasks like:

- "Agent session started" (24+ duplicate instances)
- Generic session tasks with no context
- Real work buried under auto-generated noise

**Example junk tasks:**
```
task-20260206-session-1770411811398.json: "Agent session started"
task-20260206-session-1770389489420.json: "Agent session started"
task-20260206-session-1770360244949.json: "Agent session started"
... (22 more like this)
```

## Root Cause

**File:** `server/agent-bridge.js`  
**Function:** `processNewSession()`

The bridge creates a task whenever it detects a spawned subagent session:

```javascript
// If spawned by Oracle/main agent, auto-create a task
if (isSubagent || spawnedBy) {
    // ... creates task automatically
    await createTask({
        id: taskId,
        title: taskInfo.title,
        description: `**OpenClaw Session Task**\n\n...`,
        // ...
        labels: ['openclaw', 'auto-generated', agentName],
    });
}
```

**Config:** `.mission-control/config.yaml`
```yaml
openclaw:
  hooks:
    on_agent_start:
      - action: create_task
        template: "agent_session"
```

This creates noise for:
- Casual agent conversations
- Quick questions/research
- Internal coordination
- Any spawn that doesn't represent a tracked deliverable

## Current Workaround (Temporary Fix)

**Environment variable override:**
```bash
AUTO_CREATE_TASKS=false node start-all.js
```

**Modified:** `server/agent-bridge.js` (lines 27, 313-343)
- Added `AUTO_CREATE_TASKS` environment variable check
- Task creation now conditional: `if (AUTO_CREATE_TASKS) { ... }`

**Cleaned up:**
- Archived 24 junk session tasks to `archived-tasks/`
- Updated `config.yaml` to document the policy change

## Proposed Permanent Solution

### Option 1: Make Auto-Create Configurable (Recommended)

**Add to `.mission-control/config.yaml`:**
```yaml
openclaw:
  enabled: true
  
  # Auto-task creation policy
  auto_create_tasks:
    enabled: false  # Default: off to reduce noise
    
    # Only create tasks for spawns matching these rules:
    rules:
      - spawn_label_contains: "task:"
      - prompt_starts_with: "Task ID:"
      - priority_keywords: ["CRITICAL", "URGENT"]
```

**Benefits:**
- Configurable without code changes
- Clear documentation of behavior
- Room for smart rules (e.g., only create for labeled/priority spawns)

### Option 2: Require Explicit Task Linking

**Policy:** Always require `"Task ID: task-xyz"` in spawn prompts for task tracking.

**Bridge behavior:**
```javascript
// If prompt contains "Task ID: task-xyz" → link to existing task
// If no task reference → log session but DON'T create a task
```

**Benefits:**
- Forces deliberate task management
- No junk tasks ever
- Clear separation: tasks = tracked work, spawns = execution

### Option 3: Task Creation UI/API Workflow

Add a "Create Task & Spawn Agent" workflow:
- User/Oracle creates task via API first
- Task creation returns a `task_id`
- Spawn includes that `task_id` in metadata
- Bridge links automatically

## Expected Behavior

**Before spawning an agent:**
1. **Meaningful work** → Create explicit task JSON with proper title/description
2. **Spawn with reference:** `sessions_spawn("tank", "Task ID: task-xyz. Do the work...")`
3. **Bridge links session** → Updates existing task status (IN_PROGRESS → REVIEW)
4. **No duplicate task created**

**For casual/quick work:**
1. Spawn without task reference: `sessions_spawn("tank", "Quick question about API design")`
2. **Bridge logs session** but does NOT create a task
3. Dashboard stays clean

## Steps to Reproduce

1. Start Mission Control with default config
2. Spawn any agent: `sessions_spawn("shuri", "Write a summary")`
3. Check `.mission-control/tasks/` → New `task-YYYYMMDD-session-TIMESTAMP.json` created
4. Repeat 20 times → Dashboard filled with "Agent session started" tasks

## Impact

- **User Experience:** Dashboard cluttered, hard to find real work
- **Maintenance:** Need to manually archive junk tasks regularly
- **Trust:** Users lose confidence in Mission Control tracking

## Additional Context

- **Date discovered:** 2026-02-06
- **Discovered by:** Tank (via user report)
- **Affected versions:** v0.8.0+
- **Related docs:** `docs/AGENT-BRIDGE.md`, `docs/AGENT-BRIDGE-CLEANUP-LOG.md`
- **Workaround doc:** `/MISSION_CONTROL_PROTOCOL.md` (in workspace)

## Acceptance Criteria

- [ ] `config.yaml` controls auto-task creation behavior
- [ ] Default: `auto_create_tasks: false`
- [ ] Bridge respects config setting
- [ ] Documentation updated (`AGENT-BRIDGE.md`, `CLAUDE.md`)
- [ ] Tests added for both modes (auto-create on/off)
- [ ] Migration guide for existing deployments

---

**Assignee recommendation:** Morpheus (code review/quality guardian)
