# CHANGELOG

All notable changes to JARVIS Mission Control are documented here.
Format: [version] — date | what changed | PR

---

## [1.15.0] — 2026-03-04 | Dashboard Aggregate Widgets

**PR #63** — `feature/jarvis-v1.14.0-dashboard-widgets`

### Added
- 4 live aggregate widgets in the dashboard header metrics strip:
  - 🖥 **Claude** — active Claude Code session count
  - ⚡ **CLI** — connected CLI tool count
  - 🐙 **GitHub** — synced issue count
  - 🔔 **Hooks** — open circuit breaker count
- All widgets clickable (open relevant panel), color-coded, poll every 60s
- `dashboard/js/dashboard-widgets.js` — standalone widget module
- Fixes discoverability gap: features were buried in sidebar, now visible at a glance

---

## [1.14.0] — 2026-03-04 | SQLite-Backed Webhook Delivery

**PR #62** — `feature/jarvis-v1.13.0-webhook-retry-db`

### Added
- `server/webhook-delivery.js` — full SQLite-backed delivery engine
  - `webhook_deliveries` table with WAL mode
  - Exponential backoff: 1s → 2s → 4s → 8s → 16s (max 5 attempts)
  - Circuit breaker: ≥3 failures from last 5 deliveries = open circuit
  - Background worker polls pending retries every 60s — survives restarts
- `better-sqlite3` dependency
- `GET /api/webhooks/:id/deliveries` — delivery history with stats
- `POST /api/webhooks/:id/retry` — manual retry by deliveryId
- `POST /api/webhooks/:id/reset-circuit` — reset circuit breaker
- Dashboard: delivery slide-out panel with ↻ Retry + Reset Circuit buttons

---

## [1.13.0] — 2026-03-04 | Persistent Webhook Delivery Log

**PR #61** — `feature/webhook-delivery-persistence`

### Added
- JSON file-based persistence for webhook delivery log (survives restarts)
- `GET /api/webhooks/:id/deliveries` + `POST /api/webhooks/:id/retry` endpoints
- Dashboard delivery history panel with manual retry + reset circuit buttons

---

## [1.12.0] — 2026-03-04 | Test Suite (51 Tests)

**PR #60** — `feature/jarvis-v1.12.0-tests`

### Added
- Jest test framework (`npm test`)
- 51 tests across 5 files in `__tests__/`:
  - `csrf.test.js`, `rate-limiter.test.js`, `webhook-retry.test.js`
  - `claude-sessions.test.js`, `github-issues.test.js`

---

## [1.11.0] — 2026-03-04 | Update Available Banner

**PR #58** — `feature/update-banner`

### Added
- `GET /api/update/check` — checks npm registry for latest version
- Dismissable banner in dashboard header when update available
- Polls on page load + every 6 hours; dismiss stored in localStorage per version

---

## [1.10.0] — 2026-03-04 | Webhook Retry + Circuit Breaker (initial)

**PR #57** — `feature/jarvis-v1.10.0-webhook-retry`

### Added
- Exponential backoff retry on webhook delivery failure (upgraded to SQLite in v1.14.0)
- Circuit breaker: 5 consecutive failures → open for 5 min
- `GET /api/webhooks/status` — per-URL delivery stats

---

## [1.9.0] — 2026-03-04 | Pino Structured Logging

**PR #56** — `feature/jarvis-v1.9.0-pino-logging-final`

### Added
- `server/logger.js` — pino logger (pretty-print in dev, JSON in prod)
- All `console.log/warn/error` replaced with structured pino logger

---

## [1.8.0] — 2026-03-04 | Agent SOUL Panel UI Fix

**PR #54** — `feature/jarvis-v1.8.0-soul-panel-fix`

### Fixed
- Agent SOUL Files panel was missing sidebar entry and panel div in HTML
- Added full `#soul-panel` with agent selector, file picker, textarea editor, Save/Discard buttons

---

## [1.7.0] — 2026-03-04 | Rate Limiting

**PR #52** — `feature/rate-limiting`

### Added
- General limiter: 100 req/min on all `/api/*` routes
- Strict limiter: 10 req/min on `/api/credentials` + `/api/github/config`
- RFC-standard `RateLimit` headers + `Retry-After` on 429 responses

---

## [1.6.0] — 2026-03-04 | CSRF Protection

**PR #51** — `feature/csrf-protection`

### Added
- `GET /api/csrf-token` — generates token, sets `mc-csrf-secret` HttpOnly cookie
- `csrfProtection` middleware on all POST/PUT/DELETE/PATCH routes
- Smart bypass for API/CLI clients (no cookie = no forging risk)
- Dashboard auto-fetches token, includes `X-CSRF-Token` on all mutations

---

## [1.5.0] — 2026-03-04 | Agent SOUL Workspace Sync

**PR #50** — `feature/jarvis-v1.5.0-soul-sync`

### Added
- Read/write agent SOUL.md, MEMORY.md, IDENTITY.md from dashboard
- Path traversal protection, file whitelist, 500KB size limit
- Auto-backup on save

---

## [1.4.0] — 2026-03-04 | GitHub Issues Sync

**PR #49** — `feature/jarvis-v1.4.0-github-sync`

### Added
- Fetch open GitHub issues, auto-create JARVIS task cards (idempotent by issue number)
- `GET/POST /api/github/config` for token + repo config

---

## [1.3.0] — 2026-03-04 | Direct CLI Integration

**PR #48** — `feature/jarvis-v1.3.0-cli-integration`

### Added
- `POST /api/cli/run` — whitelisted OpenClaw command execution from dashboard
- CLI Console panel with command buttons + terminal-style output

---

## [1.2.0] — 2026-03-04 | Claude Code Session Tracking

**PR #47** — `feature/claude-session-tracking`

### Added
- Auto-discovers `~/.claude/projects/` JSONL sessions every 60s
- Shows tokens, cost, model, git branch, active status per session
- Dashboard sessions panel in sidebar

---

## [1.1.0] — 2026-03-04 | Security Hardening

**Final posture: 0 CRITICAL | 0 HIGH | 4 MEDIUM**

| Version | Issue | Fix |
|---------|-------|-----|
| v1.0.9  | 47 XSS + 17 injection | DOMPurify + sanitizeInput() |
| v1.0.10 | SSRF via webhook URLs | validateWebhookUrl() |
| v1.0.11 | 33 HIGH: path traversal + XSS | sanitizeId() + DOMPurify |
| v1.1.0  | resource-manager path gap | _isPathSafe() + audit |

---

## [1.0.11] — 2026-03-03 | HIGH Severity Security Fixes (PR #46)
## [1.0.10] — 2026-03-02 | SSRF Fix (PR #45)
## [1.0.9]  — 2026-03-02 | XSS + Injection Fixes
