# Mission Control Deployment Rules

> **For AI Agents (especially Tank) — READ BEFORE ANY UPDATE OPERATION**

## ⚠️ CRITICAL RULES

### Rule 1: NEVER Use Raw Git Commands on Production

```bash
# ❌ WRONG - DANGEROUS - DO NOT DO THIS
git pull
git checkout .
git reset --hard

# ✅ CORRECT - Always use safe-deploy.sh
./scripts/safe-deploy.sh --pull
```

### Rule 2: User Data is Sacred

These directories contain **PRODUCTION DATA** that must NEVER be overwritten:

```
.mission-control/
├── agents/      ← Real agent registrations (Tank, Oracle, etc.)
├── tasks/       ← Real tasks from The Architect
├── humans/      ← Real human operator profiles
├── messages/    ← Real inter-agent communications
└── config.yaml  ← Production configuration
```

**These are NOT in git.** They live only on the production server.

### Rule 3: Demo Data is for Demos Only

```
examples/demo-data/  ← Demo data (Matrix-themed examples)
```

This data is ONLY for:
- New users testing Mission Control
- Development/testing
- Screenshots and documentation

**NEVER copy demo data to production** unless explicitly instructed with "load demo data".

---

## How to Update Mission Control

### Option A: Safe Pull (Recommended)

```bash
# This backs up data FIRST, then pulls code changes
./scripts/safe-deploy.sh --pull
```

### Option B: Update Script

```bash
# Downloads updates from MissionDeck API (if connected)
# Also preserves local data
./scripts/update-mission-control.sh
```

### Option C: Manual (Advanced)

If you MUST do manual operations:

```bash
# 1. ALWAYS backup first
./scripts/safe-deploy.sh --backup

# 2. Note the backup name (you'll need it if things go wrong)
# 3. Do your operation
# 4. Verify data is intact:
ls -la .mission-control/agents/*.json
ls -la .mission-control/tasks/*.json

# 5. If data is missing, restore:
./scripts/safe-deploy.sh --restore BACKUP_NAME
```

---

## Recovery Procedures

### Data Was Overwritten

```bash
# List available backups
./scripts/safe-deploy.sh --list

# Restore most recent backup
./scripts/safe-deploy.sh --restore pre-pull-backup-YYYYMMDD
```

### No Backup Available

Check the `.backups/` directory for any tar.gz files:

```bash
ls -la .backups/
```

If backups exist but data is still wrong, you may need to manually inspect and merge.

---

## GitHub Actions Behavior

The GitHub Actions workflow (`deploy.yml`) deploys **static dashboard assets only**.

- It does NOT have access to user data (gitignored)
- It creates placeholder files indicating "connect to your server for data"
- Production data must be served from your actual Mission Control server

---

## Checklist Before Any Update

- [ ] Created backup with `./scripts/safe-deploy.sh --backup`
- [ ] Noted backup filename
- [ ] Verified current data count (agents, tasks, humans)
- [ ] Using safe scripts, NOT raw git commands
- [ ] Have recovery plan if something goes wrong

---

## When Architect Says "Update Mission Control"

1. **Ask clarifying question**: "Should I update the code only, or reset with demo data?"
2. **Default assumption**: Code update only, preserve all data
3. **Run**: `./scripts/safe-deploy.sh --pull`
4. **Verify**: Check that agents/tasks still exist after update
5. **Report**: Confirm what was updated and that data is intact

---

## Contact

If data is lost and you cannot recover:
1. Check all `.backups/*.tar.gz` files
2. Ask The Architect for guidance
3. Request @MorpheusMatrixZ_Bot to review what happened

---

*Last updated: 2026-02-16*
*Author: Morpheus (Code Review)*
