## [v1.0.9] - 2026-03-02
### Security
- Fixed 47 XSS vulnerabilities in dashboard/js/app.js — all innerHTML assignments now sanitized via DOMPurify
- Fixed 14 input injection vulnerabilities in server/index.js — sanitizeInput() helper applied to all req.body/req.query fields
- DOMPurify CDN added to dashboard/index.html

## [1.0.8] - 2026-02-27

### Fixed
- Closes #43: `agent-bridge.js` now watches main agent session JSONL files (not just spawned sub-sessions) for Telegram @mentions
- `processMainSessionForTelegramTasks()`: reads new JSONL lines, filters on `[Telegram ...]` prefix (skips heartbeats/cron/system), creates MC tasks for bot @mentions
- `mainSessionOffsets` Map tracks per-file read position for efficient incremental reads

## [1.0.7] - 2026-02-27

### Fixed
- `agent-bridge.js`: AgentSync null-check for `soulData.skills` (was crashing on agents without skills field)

### Added
- Telegram → MC auto-routing: bridge now watches OpenClaw session JSONL files and forwards any user message mentioning a bot to `/api/telegram/task`
- `parseTelegramHeader()`: extracts `chatId`, `sender`, `messageId` from OpenClaw Telegram session format
- `processedTelegramMessages` Set for idempotent message deduplication
- `skill/SKILL.md`: documents Telegram auto-routing and `agents.json` bot mapping config
- `agents.json` bot mapping for Matrix Zion agents (oracle, tank, morpheus, shuri, keymaker)

### Closes
- Issue #42: Telegram → Mission Control task auto-routing


# Changelog

## [1.0.6] - 2026-02-25
### Added
- **Context window meter in agent cards** — each agent card shows live context usage as a bar
  - Green (<60%), Amber (60-80%), Red (>80%) with pulsing border when critical
- `POST /api/agents/:id/context` endpoint — agents self-report context window stats
- `scripts/report-context.sh` — script agents call from heartbeat to push context data
- `public/mc-board/css/context-meter.css` — context bar styles
- `public/mc-board/js/context-patch.js` — patches renderAgents() to inject context meters

### How agents report context
Agents call `report-context.sh` from their OpenClaw heartbeat:
```
exec: ./scripts/report-context.sh <agent_id> <tokens_used> <tokens_total> <model>
```
Data appears on the MC board within 30 seconds (next board refresh).

## [1.0.5] - 2026-02-25
### Added
- Bidirectional cloud sync: cloud-created tasks sync back to local MC
- `startCloudPull()` polls mc-api every 30s for cloud tasks
- Cloud tasks written as local files → chokidar → Telegram notifications

## [1.0.4] - 2026-02-25
### Fixed
- Cloud sync endpoint defaults to direct Supabase URL (fixes 405 errors)

## [1.0.3] - 2026-02-24
### Fixed
- Added /verify endpoint to mc-api
- Fixed nginx CORS headers

## [1.0.2] - 2026-02-21
### Fixed
- Security patch — 10 vulnerabilities fixed

## [1.0.0] - 2026-02-05
### Added
- Initial release
