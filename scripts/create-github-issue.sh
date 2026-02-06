#!/bin/bash
# Create GitHub Issue for Auto-Task Spam Bug
# Usage: GITHUB_TOKEN=ghp_xxx ./scripts/create-github-issue.sh

set -e

REPO="Asif2BD/JARVIS-Mission-Control-OpenClaw"
TITLE="[BUG] Agent Bridge auto-creates junk tasks for every spawn"
LABELS="bug,agent-bridge,cleanup"
ASSIGNEES="morpheus"

BODY=$(cat <<'EOF'
## Problem Description

The Agent Bridge is configured to automatically create a Mission Control task for **every agent spawn** via `sessions_spawn`, resulting in dashboard clutter with meaningless tasks like:

- "Agent session started" (24+ duplicate instances)
- Generic session tasks with no context
- Real work buried under auto-generated noise

## Root Cause

**File:** `server/agent-bridge.js`  
**Function:** `processNewSession()`

The bridge creates a task whenever it detects a spawned subagent session.

**Config:** `.mission-control/config.yaml`
```yaml
openclaw:
  hooks:
    on_agent_start:
      - action: create_task
        template: "agent_session"
```

This creates noise for casual agent conversations, quick questions, and internal coordination.

## Current Workaround

**Environment variable override:**
```bash
AUTO_CREATE_TASKS=false node start-all.js
```

**Changes applied:**
- Added `AUTO_CREATE_TASKS` check in `agent-bridge.js`
- Archived 24 junk tasks to `archived-tasks/`
- Updated `config.yaml` with policy documentation

## Proposed Solution

**Option 1: Make Auto-Create Configurable (Recommended)**

Add to `config.yaml`:
```yaml
openclaw:
  auto_create_tasks:
    enabled: false  # Default off
    rules:
      - spawn_label_contains: "task:"
      - prompt_starts_with: "Task ID:"
```

**Option 2: Require Explicit Task Linking**

- Spawns with `Task ID: task-xyz` → link to existing task
- Spawns without reference → no task created
- Forces deliberate task management

## Expected Behavior

**For meaningful work:**
1. Create task JSON explicitly
2. Spawn with reference: `sessions_spawn("tank", "Task ID: task-xyz...")`
3. Bridge links session → updates task status
4. No duplicate created

**For casual work:**
1. Spawn without reference
2. Bridge logs session only (no task)
3. Dashboard stays clean

## Impact

- UX: Dashboard cluttered
- Maintenance: Manual cleanup needed
- Trust: Users lose confidence in tracking

## Acceptance Criteria

- [ ] `config.yaml` controls auto-task behavior
- [ ] Default: `auto_create_tasks: false`
- [ ] Bridge respects config
- [ ] Docs updated (`AGENT-BRIDGE.md`, `CLAUDE.md`)
- [ ] Tests for both modes
- [ ] Migration guide

**Related:**
- `docs/AGENT-BRIDGE-CLEANUP-LOG.md` (previous cleanup 2026-02-05)
- `MISSION_CONTROL_PROTOCOL.md` (workflow documentation)

**Discovered:** 2026-02-06 by Tank (user report)  
**Affected versions:** v0.8.0+

**Assignee recommendation:** Morpheus (code review specialist)
EOF
)

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable not set"
    echo ""
    echo "To create the issue, run:"
    echo "  export GITHUB_TOKEN=ghp_your_token_here"
    echo "  ./scripts/create-github-issue.sh"
    echo ""
    echo "Or create manually at:"
    echo "  https://github.com/$REPO/issues/new"
    echo ""
    echo "Title: $TITLE"
    echo "Labels: $LABELS"
    echo "Body: (see below)"
    echo ""
    echo "$BODY"
    exit 1
fi

echo "Creating GitHub issue..."

RESPONSE=$(curl -s -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$REPO/issues" \
    -d @- <<JSON_PAYLOAD
{
  "title": "$TITLE",
  "body": $(echo "$BODY" | jq -Rs .),
  "labels": ["bug", "agent-bridge", "cleanup"],
  "assignees": []
}
JSON_PAYLOAD
)

ISSUE_URL=$(echo "$RESPONSE" | grep -o '"html_url": "[^"]*' | cut -d'"' -f4)

if [ -n "$ISSUE_URL" ]; then
    echo "✅ Issue created: $ISSUE_URL"
else
    echo "❌ Failed to create issue"
    echo "$RESPONSE"
    exit 1
fi
