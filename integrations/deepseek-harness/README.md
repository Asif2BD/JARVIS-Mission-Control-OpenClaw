# DeepSeek-Harness × JARVIS Mission Control

Connect a [DeepSeek-Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) agent to the Mission Control board: every dsh session becomes a task, turns and tool calls stream into the activity log, and the agent shows up on the dashboard like any other Mission Control agent.

> **Experimental.** dsh is a v0.1 developer preview and its plugin API may change. Event names are configurable so upstream renames are a config fix. Full analysis and design rationale: [`docs/deepseek-harness-integration.md`](../../docs/deepseek-harness-integration.md).

## How It Works

`dsh-plugin-mission-control/` is a [Cordis](https://cordis.io) plugin that mounts inside dsh, subscribes to the append-only `session/event` stream, and forwards what matters to Mission Control's existing REST API — no Mission Control server changes needed.

```
┌────────────── dsh ──────────────┐        ┌──── Mission Control ────┐
│ agent loop → session event log  │        │ server (localhost:3000) │
│        │                        │  HTTP  │   POST /api/tasks       │
│        └─► mission-control ─────┼───────►│   PATCH /api/tasks/:id  │
│            plugin (this repo)   │        │   POST /api/logs/...    │
└─────────────────────────────────┘        │   → dashboard + WS      │
                                           └─────────────────────────┘
```

| dsh event | Mission Control effect |
|---|---|
| first `turn/start` of a session | Task created (`IN_PROGRESS`, assigned to the harness agent) |
| `user/message` | Activity log entry |
| `assistant/message` | Activity log entry |
| `tool/call` / `tool/result` | Activity log entries |
| `turn/end` | Task moved to `REVIEW` (never `DONE` — humans approve) |

## Quickstart

```bash
# 1. Start Mission Control as usual
cd server && npm install && npm start        # http://localhost:3000

# 2. Install the plugin into your dsh setup
npm install /path/to/JARVIS-Mission-Control-OpenClaw/integrations/deepseek-harness/dsh-plugin-mission-control

# 3. Mount it in your dsh profile (cordis.patch.yml or equivalent)
```

```yaml
- name: dsh-plugin-mission-control
  config:
    missionControlUrl: http://localhost:3000
    agentId: agent-dsh
    agentName: DeepSeek Harness
```

```bash
# 4. Run dsh and watch the board
npx @deepseek-ai/dsh web
```

## Configuration

| Key | Default | Description |
|---|---|---|
| `missionControlUrl` | `http://localhost:3000` | Mission Control server base URL |
| `agentId` | `agent-dsh` | Agent ID registered on the board (must match `^[a-zA-Z0-9-_]+$`) |
| `agentName` | `DeepSeek Harness` | Display name |
| `designation` | `Harnessed Agent` | Dashboard designation |
| `capabilities` | `["coding","automation"]` | Capability tags |
| `maxExcerpt` | `280` | Max characters of message/tool content forwarded to logs |
| `dryRun` | `false` | Log what would be sent instead of calling the API |
| `events` | see `src/index.js` | Override dsh event names if a future preview renames them |

## Troubleshooting

- **Nothing appears on the board** — confirm the server is up (`curl http://localhost:3000/api/metrics`) and check dsh logs for `[mission-control]` lines. Set `dryRun: true` to see the exact payloads.
- **Unknown event warnings** — a dsh update likely renamed events; map the new names via the `events` config block.
- **Board unreachable mid-session** — the plugin queues and retries with backoff, and drops (with a log line) rather than blocking the agent loop.
