# Skill: DeepSeek-Harness Bridge

> Connect a DeepSeek-Harness (`dsh`) agent to the Mission Control board.
> Load this skill when: setting up dsh, debugging the dsh plugin, or deciding between dsh and OpenClaw as an agent runtime.

**Status: Experimental** — dsh is a v0.1 developer preview; expect upstream breaking changes.

## What This Gives You

[DeepSeek-Harness](https://github.com/deepseek-ai/deepseek-harness) is an open-source agent harness with an "everything is a plugin" architecture (Cordis kernel, append-only session event log). The bridge in this repo mounts a plugin *inside* dsh that mirrors its sessions onto Mission Control:

- Each dsh session → a task (`task-YYYYMMDD-dsh-<id>`), auto-created as `IN_PROGRESS`
- Turns, messages, and tool calls → activity log entries
- Turn completion → task moved to `REVIEW` (humans/reviewers approve to `DONE`)
- The harness agent appears on the dashboard like any other registered agent

## Setup (5 Minutes)

```bash
# 1. Mission Control server running as usual
cd server && npm install && npm start          # http://localhost:3000

# 2. Install the plugin into your dsh environment
npm install ./integrations/deepseek-harness/dsh-plugin-mission-control

# 3. Mount it in your dsh profile config (cordis.patch.yml or equivalent):
#    - name: dsh-plugin-mission-control
#      config:
#        missionControlUrl: http://localhost:3000
#        agentId: agent-dsh

# 4. Run dsh
npx @deepseek-ai/dsh web                       # http://127.0.0.1:3080
```

Tasks appear on the board as soon as a dsh session starts its first turn.

## Key Files

| File | Purpose |
|------|---------|
| `integrations/deepseek-harness/README.md` | Quickstart + config reference |
| `integrations/deepseek-harness/dsh-plugin-mission-control/` | The installable dsh plugin (ESM, zero deps) |
| `docs/deepseek-harness-integration.md` | Full analysis: architecture comparison, plugin-vs-fork decision, concept mapping |

## Rules for Agents Using This Bridge

1. The plugin never moves tasks to `DONE` — the permission model reserves that for humans/reviewers. Don't "fix" this.
2. Message/tool content is excerpted (280 chars default) before logging. Don't raise the cap to dump full transcripts into the activity log.
3. If dsh renames events after a preview update, fix it in the plugin's `events` config block, not by patching event names in code.
4. The bridge queues and drops on Mission Control outages by design — never make it block the dsh agent loop.
