# Local Data Templates

These are **template files** for setting up a new Mission Control instance.

## How to use

When deploying Mission Control:

1. Copy agent templates to `.mission-control/agents/`:
   ```bash
   cp examples/local-data-templates/*.json .mission-control/agents/
   ```

2. Edit the JSON files with your actual agent configuration

3. The `.mission-control/` directory is gitignored for data files - your local data stays local.

## What's here

- `oracle.json`, `tank.json`, etc. - Agent profile templates
- `task-*.json` - Example task structures

## Important

**Never commit actual runtime data to git.**

- API keys → use `.mission-control/credentials/` (gitignored)
- Agent configs → `.mission-control/agents/` (gitignored)  
- Tasks → `.mission-control/tasks/` (gitignored)
- Logs → `.mission-control/logs/` (gitignored)

Only templates and code belong in the repo.
