# CHANGELOG

All notable changes to JARVIS Mission Control are documented here.
Format: [version] — date | what changed | PR

---

## v2.0.4 — Housekeeping & Security Polish

### Fixed
- VERSION file now correctly reflects `2.0.4` (was stuck at `1.5.0`)
- License mismatch resolved: `package.json` now correctly declares `Apache-2.0` (was `MIT`), matching the `LICENSE` file
- Duplicate basic-auth removed from Node.js app — nginx handles auth at the edge (PR #80)

### Security
- zion.asif.dev deployment: password-protected + `X-Robots-Tag: noindex` + `robots.txt: Disallow: /` (PR #79)
- Private deployment URL removed from all public documentation (PR #78)

### Docs
- README fully updated through v2.0.3 feature set (Smart Panels, Matrix Theme, Security hardening)
- CHANGELOG backfilled with complete v1.2.0–v2.0.3 history

---

## [2.0.3] — 2026-03-04 | Smart Panels — Chat, Reports, Schedules

**PR #73 + PR #74**

### Added
- 💬 **Mission Control Chat** — slide-out panel, real-time WebSocket, agent emojis, unread badge, @mention support
- 📋 **Reports panel** — slide-out from header button, Reports/Logs/Archive tabs, fixed double `/api/` URL bug
- ⏰ **Schedules panel** — slide-out from header button, shows all 14 live OpenClaw cron jobs (fixed wrong endpoint)
- Right sidebar removed — Kanban gets full width; all panels via header buttons

### Fixed
- Smart panels not opening (mobile + desktop) — JS never added `.open` CSS class; fixed with `offsetHeight` reflow + `classList.add('open')`

---

## [2.0.2] — 2026-03-04 | Right Panel Fixes

**PR #71**

### Fixed
- Reports "Failed to load files" — double `/api/api/` prefix bug in `api.js`
- Resources hidden from sidebar (accessible via Settings modal)
- Chat overflow off-screen resolved

---

## [2.0.1] — 2026-03-04 | Dark Mode + Getting Started Fix

**PR #70**

### Fixed
- Dashboard defaulting to white/light mode — hardcoded `data-theme="dark"` on `<html>`
- "Getting Started" modal no longer blocks Kanban when server is connected

---

## [2.0.0] — 2026-03-04 | Major UI Overhaul

**PRs #65–#69**

### Added
- **Widget Cards** (v1.16.0) — 4 large clickable stat cards: Claude Sessions, CLI Connections, GitHub Sync, Webhook Health
- **Enhanced Task Cards** (v1.17.0) — priority color bars, agent avatar circles, label badges, review indicator
- **Sidebar Groups** (v1.18.0) — TEAM / INTELLIGENCE / SYSTEM collapsible sections with localStorage persistence
- **Panel Redesign** (v1.19.0) — gradient headers, icon boxes, Orbitron titles, stat badges on all 6 panels
- **Matrix Theme Polish** (v2.0.0) — CRT scanlines, pulse-glow on agents, Matrix rain header accent, typewriter version cursor

---


## [2.0.3] — 2026-03-04 | Smart Slide-out Panels

**PR #73** — `feature/smart-panels-v2.0.3`
**PR #74** — `fix/smart-panels-open-class`

### Added
- `dashboard/js/smart-panels.js` — new module powering three on-demand panels
- **💬 Chat panel** — full-height slide-out from CHAT header button
  - Real-time via WebSocket (`message.created` events)
  - Message bubbles with per-agent emoji avatars (🔧 Tank, 🔮 Oracle, 🧠 Morpheus…)
  - Unread badge on header button when panel is closed
  - Send via `POST /api/messages`, receive via WS broadcast
- **📋 Reports & Files panel** — slide-out from REPORTS header button
  - Tabs: Reports / Logs / Archive
  - File list with ext badge, size, date, download link
  - Clean empty state
- **⏰ Schedules panel** — slide-out from SCHEDULES header button
  - Calls `/api/schedules` (was previously calling wrong endpoint `/api/queue`)
  - Shows all OpenClaw cron jobs across all agents with agent emoji, schedule type, last run
  - Filter: All / Active / Disabled
- Three header action buttons replace the removed right sidebar: CHAT · REPORTS · SCHEDULES

### Fixed
- Smart panels not opening on click (PR #74): panels use `transform: translateX(100%)` by default; `.open` CSS class slides them in — `_openPanel()` was setting `display: flex` but never adding `.open`
- `/api/schedules` now correctly returns OpenClaw cron jobs (14 real jobs); old code called `/api/queue` which only reads local queue (always empty)
- Floating chat widget replaced by slide-out (no more viewport overflow)

### Changed
- Right sidebar (`sidebar-right`) permanently hidden (`display: none !important`) — Kanban board gets full available width
- Old floating chat HTML replaced with stub divs to prevent JS errors from old references

---

## [2.0.2] — 2026-03-04 | Right Panel Bug Fixes

**PR #70** — `fix/dark-mode-default-and-modal`
**PR #71** — `fix/right-panel-and-chat`

### Fixed
- **Dark mode not defaulting**: `initTheme()` was following `prefers-color-scheme: light` system setting; now always defaults to `'dark'` regardless of OS preference
- **Getting Started modal blocking board**: modal now only shows after 2s delay AND only when `!api.isConnected()` — server is always running so modal never fires
- **"Failed to load files" error**: `getFiles()` in `api.js` was passing `/api/files?dir=reports` to `request()` which prepends `/api`, producing URL `/api/api/files` → 404 → catch block → "Failed to load files". Fixed to `/files?dir=...`
- **Resources section removed from sidebar**: was displaying 0/0/0 with no inline actions — hidden from permanent view (Resources modal still accessible via Settings)

---

## [2.0.0] — 2026-03-04 | Matrix Theme Polish

**PR #69** — `feature/matrix-theme-v2`

### Added
- Full Matrix-themed visual overhaul: neon green (#00ff41) primary accent, cyan (#00d4ff) secondary
- Glowing card borders, terminal-style typography, animated status indicators
- Enhanced agent avatar system with colored letter badges
- Improved task card layout with priority indicators and label chips
- Footer bar with live clock, activity count, version badge
- CSS custom property system for consistent theming across all components
- Light/dark theme toggle preserved

---

## [1.19.0] — 2026-03-04 | Panel Header Redesign

**PR #68** — `feature/panel-header-redesign`

### Added
- Gradient panel headers across all slide-out panels (agent profile, Claude sessions, GitHub, webhooks, CLI, SOUL)
- Large icon area, title + subtitle, stat pill badges in header
- Unified `panel-header-gradient` design system applied to all panels
- Close button repositioned to top-right corner

---

## [1.18.0] — 2026-03-04 | Sidebar Organization

**PR #67** — `feature/sidebar-organization`

### Added
- Left sidebar reorganized into collapsible sections: TEAM, SYSTEM, INTEGRATIONS
- Sticky section headers with chevron toggle
- Each section independently collapsible with state stored in localStorage
- SYSTEM section: Claude Sessions, CLI Console, GitHub Sync, Agent SOUL, Webhooks
- INTEGRATIONS section: Telegram Bridge, Update Banner

---

## [1.17.0] — 2026-03-04 | Enhanced Task Cards

**PR #66** — `feature/enhanced-task-cards`

### Added
- Redesigned Kanban task cards with left-border color coding by priority/status
- Agent avatar chip in card footer showing assignee initials + color
- Label chips with overflow count (`+2 more`)
- Hover elevation effect and subtle glow
- Card footer with due date, comment count, attachment indicator

---

## [1.16.0] — 2026-03-04 | Dashboard Widget Cards

**PR #65** — `feature/dashboard-widget-cards`

### Added
- 4 feature widget cards below the header metrics strip:
  - 🖥 Claude Sessions — active count, last scan time
  - ⚡ CLI Connections — connected count
  - 🐙 GitHub Sync — synced issue count, last sync time
  - 🔔 Webhooks — active/circuit-open counts
- Each card clickable to open its detail panel
- Color-coded status dots (green = active, red = issue, grey = idle)

---

## [1.15.0] — 2026-03-04 | Dashboard Aggregate Widgets

**PR #63** — `feature/jarvis-v1.14.0-dashboard-widgets`

### Added
- 4 live aggregate widget chips in the header metrics bar
- `dashboard/js/dashboard-widgets.js` — standalone widget module, polls every 60s

---

## [1.14.0] — 2026-03-04 | SQLite-Backed Webhook Delivery

**PR #62** — `feature/jarvis-v1.13.0-webhook-retry-db`

### Added
- `server/webhook-delivery.js` — full SQLite-backed delivery engine
  - `webhook_deliveries` table with WAL mode
  - Exponential backoff: 0s → 1s → 2s → 4s → 8s (max 5 attempts)
  - Circuit breaker: ≥3 failures from last 5 deliveries = open circuit; 60s TTL
  - Background worker polls pending retries every 60s — survives restarts
- `better-sqlite3` dependency
- `GET /api/webhooks/:id/deliveries` — delivery history with stats
- `POST /api/webhooks/:id/retry` — manual retry by deliveryId
- `POST /api/webhooks/:id/reset-circuit` — reset circuit breaker
- Dashboard: delivery slide-out panel with ↻ Retry + Reset Circuit buttons
- SQLite DB stored at `.mission-control/webhook-deliveries.db` (gitignored)

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
- `GET /api/releases/check` — checks npm registry for latest version
- Dismissable banner in dashboard header when update available
- Polls on page load + every 6 hours; dismiss stored in localStorage per version

---

## [1.10.0] — 2026-03-04 | Webhook Retry + Circuit Breaker (initial)

**PR #57** — `feature/jarvis-v1.10.0-webhook-retry`

### Added
- Exponential backoff retry on webhook delivery failure (upgraded to SQLite in v1.14.0)
- Circuit breaker: 5 consecutive failures → open for 5 min

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
