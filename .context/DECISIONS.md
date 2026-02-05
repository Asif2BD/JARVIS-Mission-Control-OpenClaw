# Architectural Decision Records (ADR)

This file tracks important architectural and design decisions made during development.

---

## ADR-001: Local File-Based Storage Over GitHub API

**Date**: 2026-02-05
**Status**: Accepted
**Deciders**: User, Claude

### Context
Initially, the dashboard used GitHub API to persist tasks directly to the repository. This required GitHub tokens and added complexity.

### Decision
Use local JSON files as the database. A Node.js server handles file I/O and provides a REST API.

### Consequences
- **Positive**: Simpler architecture, no external dependencies, works offline
- **Positive**: Anyone can clone and run immediately
- **Negative**: Need to run a local server
- **Negative**: No built-in cloud sync (relies on Git)

---

## ADR-002: WebSocket for Real-time Dashboard Updates

**Date**: 2026-02-05
**Status**: Accepted

### Context
Dashboard needed to reflect changes made by agents (who edit files via Git) in real-time.

### Decision
Use WebSocket (`ws` library) to push updates to all connected dashboard clients.

### Consequences
- **Positive**: Instant updates without polling
- **Positive**: Lower server load than polling
- **Negative**: Requires persistent connection

---

## ADR-003: Webhook System for Agent Notifications

**Date**: 2026-02-05
**Status**: Accepted

### Context
When a task is assigned to an agent via the dashboard, the agent needs to be notified.

### Decision
Implement a webhook registration system. Agents POST to `/api/webhooks` with their listener URL. Server triggers webhooks on task events.

### Consequences
- **Positive**: Agents get notified of relevant events
- **Positive**: Decoupled - agents choose what events to listen to
- **Negative**: Agents must run an HTTP listener

---

## ADR-004: Matrix-Themed Dark UI as Default

**Date**: 2026-02-05
**Status**: Accepted

### Context
User wanted a futuristic "command center" aesthetic.

### Decision
Dark theme with:
- Fonts: Orbitron (headers), Rajdhani (body), Share Tech Mono (code)
- Colors: Neon cyan, green, orange accents on dark background
- Default: `data-theme="dark"` on HTML element

### Consequences
- **Positive**: Distinctive, memorable UI
- **Positive**: Easy on eyes for extended use
- **Negative**: Light theme needs separate testing

---

## ADR-005: Semantic Versioning

**Date**: 2026-02-05
**Status**: Accepted

### Context
Need to track releases and communicate changes clearly.

### Decision
Use Semantic Versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

Version tracked in:
- `CHANGELOG.md`
- `README.md` (badge)
- `server/package.json`
- `dashboard/index.html`

### Consequences
- **Positive**: Clear version communication
- **Positive**: Users know impact of upgrades
- **Negative**: Must update multiple files on release

---

## ADR-006: URL Routing with Hash for Tasks

**Date**: 2026-02-05
**Status**: Accepted

### Context
Users wanted to share links to specific tasks.

### Decision
Use URL hash (`#task-id`) for task deep linking:
- Opening task updates URL to `#task-20260205-example`
- Loading URL with hash opens that task automatically
- Browser back/forward works correctly

### Consequences
- **Positive**: Shareable task links
- **Positive**: Bookmarkable tasks
- **Positive**: No server-side routing needed
- **Negative**: Hash-based (not clean URLs)

---

## ADR-007: Horizontal Layout for Human Operators

**Date**: 2026-02-05
**Status**: Accepted

### Context
Vertical list of humans required scrolling and took too much space.

### Decision
Display human operators as horizontal compact "pills" using flexbox wrap.

### Consequences
- **Positive**: No scrolling needed
- **Positive**: More visible at a glance
- **Negative**: Less detail per human

---

## ADR-008: Context Storage for AI Agents

**Date**: 2026-02-05
**Status**: Accepted

### Context
AI agents starting work on the project need to understand full context quickly.

### Decision
Create `.context/` directory with:
- `PROJECT_CONTEXT.md` - Full project overview
- `DECISIONS.md` - This file (ADRs)

Referenced from `CLAUDE.md` as the primary agent instruction file.

### Consequences
- **Positive**: New agents can understand project quickly
- **Positive**: Decisions are documented and searchable
- **Positive**: Reduces repeated explanations

---

## Future Decisions Needed

- [ ] How to handle Telegram/WhatsApp integration
- [ ] Whether to add user authentication
- [ ] How to handle multi-user conflicts
- [ ] Database migration strategy if needed
