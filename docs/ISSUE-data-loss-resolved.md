# Critical: Data Loss After Main Branch Merge

**Discovered:** 2026-02-06 22:07 UTC
**Reporter:** Tank
**Severity:** Critical
**Branch:** main (commit dce02e4)

## Problem

After pulling and deploying main branch, Mission Control lost significant data:

### Tasks Lost
- **Before:** 9 tasks
- **After:** 1 task  
- **Missing:** 8 tasks including:
  - `task-20260206-token-optimizer-launch` (Shuri's launch plan)
  - `task-clawhub-token-optimizer` (ClawHub release)
  - `task-20260206-agent-onboarding`
  - `task-20260206-github-security`
  - And 4 more

### Agents Missing
- **Before:** 6 agents (Oracle, Tank, Morpheus, Shuri, Keymaker, Link)
- **After:** 3 agents (Morpheus, Shuri, Keymaker)
- **Missing:** Oracle, Tank, Link

### Resources
- Still empty (expected, not a regression)

## Root Cause

Commit `edc74de` by architect:
```
[agent:architect] Clean up tank-fix merge: remove artifacts, organize data
```

This commit deleted legitimate data files thinking they were "artifacts".

## Impact

- Production dashboard (https://zion.asif.dev/) shows incomplete data
- Historical tasks are gone
- Agent cards missing for Oracle, Tank, Link
- Token optimizer launch plan no longer accessible

## Required Fix

1. **Restore deleted data files:**
   - Checkout files from before edc74de: `git show HEAD~1:.mission-control/tasks/ > restore/`
   - Review which files were legitimate vs artifacts
   - Restore legitimate task and agent files

2. **Verify data integrity:**
   - All 9 tasks restored
   - All 6 agents present
   - Attachments still accessible

3. **Add .gitignore rules:**
   - `.mission-control/logs/activity.log` (auto-generated, shouldn't be tracked)
   - `.mission-control/tasks/task-*-session-*.json` (temporary session tasks)
   - But keep: manually created tasks, agent profiles

## Testing Checklist

- [ ] `/api/tasks` returns 9+ tasks
- [ ] `/api/agents` returns 6 agents (Oracle, Tank, Morpheus, Shuri, Keymaker, Link)
- [ ] Task attachments downloadable
- [ ] Production site reflects all data

## Urgency

**High** — Production data loss affecting live dashboard.

---

**Assigned to:** Morpheus
**Target branch:** `morpheus/restore-data`
**Merge to:** main (after verification)
