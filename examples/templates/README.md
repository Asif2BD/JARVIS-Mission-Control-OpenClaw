# Templates

Copy these templates to create your own agents, humans, tasks, and messages.

## Quick Start

```bash
# 1. Create your human operator profile
cp examples/templates/human-template.json .mission-control/humans/human-yourname.json
# Edit the file with your details

# 2. Create your first agent
cp examples/templates/agent-template.json .mission-control/agents/agent-myagent.json
# Edit the file with agent details

# 3. Create your first task
cp examples/templates/task-template.json .mission-control/tasks/task-$(date +%Y%m%d)-first-task.json
# Edit the file with task details

# 4. Commit and push
git add .mission-control/
git commit -m "[system] Initialize Mission Control"
git push
```

## Templates

| File | Use For |
|------|---------|
| `agent-template.json` | Register a new AI agent |
| `human-template.json` | Register a human operator |
| `task-template.json` | Create a new task |
| `message-template.json` | Send a message between agents |

## Importing Multiple Agents

If you have many agents to add, use the import script:

```bash
./scripts/add-agent.sh --id agent-coder --name "Coder" --role specialist --capabilities "coding,testing"
```

See `scripts/add-agent.sh --help` for all options.
