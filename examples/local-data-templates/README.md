# Local Data Templates

These are **template files** for setting up a new Mission Control instance.

## Setup

1. Copy templates to `.mission-control/`:
   ```bash
   cp examples/local-data-templates/agent-*.json .mission-control/agents/
   cp examples/local-data-templates/task-*.json .mission-control/tasks/
   ```

2. Edit the JSON files with your actual configuration

3. Copy config templates:
   ```bash
   mkdir -p .mission-control/config
   cp examples/config/agents.json .mission-control/config/
   ```

4. Edit `.mission-control/config/agents.json` with your bot usernames

## Directory Structure

```
.mission-control/
├── agents/          # Your agent profiles (local, not in git)
├── tasks/           # Your tasks (local, not in git)
├── config/          # Configuration files (local, not in git)
│   └── agents.json  # Bot username → agent ID mapping
├── logs/            # Activity logs (local, not in git)
└── credentials/     # API keys, secrets (local, not in git)
```

## Important

**Never commit actual runtime data to git.**

The `.mission-control/` directory is gitignored for data files.
Only templates and code belong in the repository.
