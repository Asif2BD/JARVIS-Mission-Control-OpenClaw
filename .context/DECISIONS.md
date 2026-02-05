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

## ADR-009: Inter-Agent Messaging System

**Date**: 2026-02-05
**Status**: Accepted

### Context
Agents needed a way to communicate beyond task comments - for general coordination, status updates, and human interaction.

### Decision
Create a messaging system using JSON files in `.mission-control/messages/`. Messages have `from`, `to`, `thread_id`, and `type` (direct or chat). API endpoints for sending/reading messages. WebSocket broadcasts `message.created` events.

### Consequences
- **Positive**: Agents can communicate without task context
- **Positive**: Humans can chat with agents from the dashboard
- **Positive**: Message threads keep conversations organized
- **Negative**: More JSON files to manage

---

## ADR-010: Agent Personality & Profile System

**Date**: 2026-02-05
**Status**: Accepted

### Context
Humans and other agents needed to understand each agent's working style, capabilities, and current focus at a glance.

### Decision
Add `personality` field to agent JSON (about, tone, traits, greeting). Create a slide-out Agent Profile panel in the dashboard with tabs: About, Skills/Attention, Timeline, Messages.

### Consequences
- **Positive**: Rich agent profiles visible in dashboard
- **Positive**: Personality data helps agents interact appropriately
- **Negative**: Additional required field in agent registration

---

## ADR-011: Dashboard Chat Panel

**Date**: 2026-02-05
**Status**: Accepted

### Context
Humans using the dashboard needed a way to communicate with agents without leaving the interface.

### Decision
Add a floating chat panel to the dashboard. Messages with `type: "chat"` and `thread_id: "chat-general"` appear in this panel. Supports @mentions.

### Consequences
- **Positive**: Human-agent communication in the dashboard
- **Positive**: Real-time via WebSocket
- **Negative**: Adds UI complexity

---

## ADR-012: GitHub Actions Deployment

**Date**: 2026-02-05
**Status**: Accepted

### Context
The dashboard needed to be accessible without running a local server.

### Decision
GitHub Actions workflow copies `.mission-control/` data into `dashboard/data/` and deploys to GitHub Pages. Dashboard has fallback mode that loads sample data from `data.js` when API is unavailable.

### Consequences
- **Positive**: Dashboard accessible via GitHub Pages URL
- **Positive**: Works in read-only mode without server
- **Negative**: Static mode shows sample data, not live data

---

## ADR-013: Permission Model for Agents

**Date**: 2026-02-05
**Status**: Accepted

### Context
Need clear boundaries for what agents can do autonomously vs. what requires human approval.

### Decision
Document explicit permission model in CLAUDE.md. Agents can autonomously: claim tasks, send messages, update their own profiles, log activity. Agents MUST ask human permission for: deletions, moving tasks to DONE, modifying other agents, changing config, escalating to critical priority, pushing to main.

### Consequences
- **Positive**: Clear boundaries prevent accidental damage
- **Positive**: Agents know when to ask
- **Negative**: May slow down some operations

---

## Future Decisions Needed

- [ ] How to handle Telegram/WhatsApp integration
- [ ] Whether to add user authentication
- [ ] How to handle multi-user conflicts
- [ ] Message retention/archival policy
