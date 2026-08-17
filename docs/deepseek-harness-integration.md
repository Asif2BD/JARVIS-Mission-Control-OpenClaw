# DeepSeek-Harness Integration — Analysis & Guide

> Status: **Experimental** (DeepSeek-Harness is a v0.1 developer preview; its plugin API may change)
> Companion code: [`integrations/deepseek-harness/`](../integrations/deepseek-harness/)

This document answers three questions:

1. Could we fork JARVIS Mission Control to work with [DeepSeek-Harness](https://github.com/deepseek-ai/deepseek-harness) the way it works with OpenClaw?
2. What is the *right* way to connect the two? (Spoiler: a **dsh plugin**, not a fork.)
3. If you still want a fork, how should you structure it?

---

## 1. What DeepSeek-Harness Is

DeepSeek-Harness (`dsh`, released August 2026, MIT license) is an open-source **agent harness**: it wraps LLMs into working agents with file access, command execution, and long-running task management.

Its defining trait is the **"everything is a plugin"** architecture, built on **Cordis** (the TypeScript plugin framework from the Koishi ecosystem):

- Models, tools, skills, sessions, sandboxes, storage, the agent loop, scheduling, and the UI are **all swappable plugins** mounted through configuration.
- Plugins contribute **services, typed events, and reversible effects** to a shared context (`ctx`). Unloading a plugin unwinds its registrations — no rebuild, no fork.
- Every run produces an **append-only session event stream** (`session/event`) that supports resume, fork, search, and replay. "Model-visible means logged."

Key services on the shared context:

| Service | Key | Responsibility |
|---------|-----|----------------|
| Sessions | `ctx.sessions` | Append-only event log + in-memory store |
| Tools | `ctx.tools` | Scoped registry, guarded execution |
| Agents | `ctx.agents` | Agent interface + live registry |
| Agent loop | `ctx.agentLoop` | Default think–act driver |
| LLM | `ctx.llm` | Message vocabulary + provider adapters |

Durable session events include `turn/start`, `turn/end`, `step/start`, `step/end`, `user/message`, `assistant/*`, and `tool/*`. Live agent events include `agent/pre-step`, `agent/request`, and `agent/turn-stopping`.

## 2. Architecture Comparison

| | JARVIS Mission Control | DeepSeek-Harness |
|---|---|---|
| Purpose | Task board + orchestration layer *above* agents | Runtime harness *around* one model/agent |
| State | JSON files in `.mission-control/` (Git-versioned) | Append-only session event log |
| Real-time | WebSocket broadcast + webhooks | Typed Cordis event bus |
| Extensibility | REST API, webhooks, bridge processes | First-class plugin kernel |
| Agents | Many agents, humans, reviews, permissions | One harnessed agent per session (composable) |
| UI | Kanban dashboard (`dashboard/`) | Local Web UI (`127.0.0.1:3080`) |

**These are complementary, not competing.** dsh answers "how does one agent think, act, and log?" Mission Control answers "how do many agents and humans coordinate work?" That's exactly the relationship Mission Control already has with OpenClaw — where `server/agent-bridge.js` tails OpenClaw session JSONL files and turns them into tasks, statuses, and activity log entries.

With dsh the equivalent bridge is *cleaner*, because instead of scraping session files we can subscribe to a typed event stream from inside the harness itself.

## 3. Recommendation: Plugin, Not Fork

**Do not fork deepseek-harness.** Reasons:

1. **The architecture explicitly discourages it.** dsh's own docs: *"There is no privileged core to patch: you extend dsh by mounting a plugin beside the others."* A fork would fight the design and rot against a fast-moving v0.1 preview (breaking changes are announced).
2. **Everything we need is exposed as events.** The `session/event` stream carries every task-relevant moment (turn start/end, messages, tool calls). A plugin that forwards those to Mission Control's existing REST API gives us the full OpenClaw-bridge feature set with far less code.
3. **Mission Control's API is already the integration surface.** `POST /api/tasks`, `PATCH /api/tasks/:id`, `POST /api/logs/activity`, `POST /api/messages`, and `PUT /api/agents/:id` are everything a bridge needs. No server changes required.
4. **Discoverability.** dsh plugins are published with the `dsh-plugin` GitHub topic; the ecosystem hit ~1,200 plugin repos within days of launch. A `dsh-plugin-mission-control` package rides that wave; a fork does not.

### Concept mapping

| DeepSeek-Harness | Mission Control | Bridge behavior |
|---|---|---|
| Session (first `turn/start`) | Task (`task-YYYYMMDD-dsh-<id>`) | Auto-create as `IN_PROGRESS`, assigned to the harness agent |
| `turn/start` | Task status / comment | Ensure `IN_PROGRESS`, add progress comment |
| `user/message` | Activity log | Trimmed excerpt logged |
| `assistant/message` | Activity log | Trimmed excerpt logged |
| `tool/call`, `tool/result` | Activity log | `TOOL:` entries |
| `turn/end` | Task → `REVIEW` | Never `DONE` — the permission model reserves that for humans/reviewers |
| Harness agent identity | Agent (`.mission-control/agents/`) | Registered/updated via `PUT /api/agents/:id` |

The `REVIEW`-not-`DONE` rule matters: Mission Control's permission model says agents may never move work directly to `DONE`. The plugin honors that.

## 4. What Ships in This Repo

```
integrations/deepseek-harness/
├── README.md                          # Quickstart
└── dsh-plugin-mission-control/        # Installable dsh plugin (ESM, zero deps)
    ├── package.json
    └── src/
        ├── index.js                   # Cordis plugin: subscribes to session/event
        └── mc-client.js               # Tiny Mission Control REST client (queue + retry)
```

The plugin is deliberately defensive about the preview-stage API:

- Event names are **configurable** (`events` map in config) so renames in future dsh versions are a config fix, not a code fix.
- Payloads are read loosely — missing fields degrade to log-only behavior instead of crashing the harness.
- All Mission Control calls go through a serialized queue with retry/backoff; a dead dashboard never blocks the agent loop.
- Cordis disposers are respected: everything the plugin registers unwinds when it unloads.

### Installing into dsh

```bash
# From a dsh checkout or any dsh profile:
npm install /path/to/JARVIS-Mission-Control-OpenClaw/integrations/deepseek-harness/dsh-plugin-mission-control
```

Then mount it in your dsh profile/bundle config (YAML patch shown; adjust to your profile layout):

```yaml
# cordis.patch.yml
- name: dsh-plugin-mission-control
  config:
    missionControlUrl: http://localhost:3000
    agentId: agent-dsh
    agentName: DeepSeek Harness
```

Verify composition with `dsh --profile web --dump-config`, then run a session and watch tasks appear on the Mission Control board at `http://localhost:3000`.

## 5. If You Still Want a Fork

If the goal is a *product* fork ("JARVIS Mission Control for DeepSeek-Harness" as its own repo), do it like this:

1. **Fork this repo, not deepseek-harness.** Name it e.g. `JARVIS-Mission-Control-DSH`. Mission Control is the product; dsh is a runtime you attach to.
2. Keep `.mission-control/`, `server/`, and `dashboard/` intact — they are runtime-agnostic.
3. Replace the OpenClaw-specific pieces:
   - `server/agent-bridge.js` / `server/openclaw-sessions.js` → a `server/dsh-sessions.js` that talks to a dsh instance (or simply rely on the plugin in this directory pushing events in — that is the recommended data path).
   - `skills/telegram-bridge.md` and OpenClaw wording in docs.
4. Vendor `integrations/deepseek-harness/dsh-plugin-mission-control/` as the connection layer.
5. Publish the plugin to npm with the `dsh-plugin` keyword/topic so the dsh ecosystem can find it independently of your fork.

But start with the plugin from section 4 — it gets you a working dsh-powered Mission Control today, inside this repo, with no fork maintenance burden.

## 6. Known Unknowns (v0.1 preview)

- Exact `session/event` payload shapes are not yet formally documented; the plugin normalizes defensively and logs unknown events at debug level.
- Plugin manifest conventions (`dsh` field in `package.json`, bundle declaration via `dsh.bundle`) are evolving; the shipped `package.json` follows what the repo documents today.
- The dsh Python SDK and JSON-RPC agent (`examples/jsonrpc-agent`) offer an alternative *external* integration path if in-process plugins prove too unstable during the preview — the Mission Control REST surface used here would be identical.

## References

- Repo: https://github.com/deepseek-ai/deepseek-harness (`docs/architecture.md`, `docs/development.md`)
- Overview: https://xcloud.host/what-is-deepseek-harness-features-architecture-use-cases/
- Comparison: https://xcloud.host/deepseek-harness-vs-openclaw-vs-hermes-agent/
- Hosting: https://xcloud.host/deepseek-harness/ and https://xcloud.host/best-deepseek-harness-hosting-providers/
