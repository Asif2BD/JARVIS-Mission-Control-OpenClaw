# Changelog

All notable changes to JARVIS Mission Control will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-02-07

### Added
- **Telegram Integration** - Auto-create tasks from @mentions in Telegram group messages
  - New `server/telegram-bridge.js` for parsing mentions and creating tasks
  - Agent bridge extended to detect @mentions in session transcripts
  - Deduplication prevents duplicate tasks within 5 minute window
  - Configurable agent bot mapping via env var or config file
- **CLI Task Management** - New scripts for task operations
  - `scripts/mc-task.sh` - Create and update tasks from command line
  - `scripts/mc-telegram-task.sh` - Create tasks from Telegram messages
- **Git/Local Data Separation** - Clear separation between code and runtime data
  - Templates in `examples/local-data-templates/`
  - Runtime data in `.mission-control/` (gitignored)
  - Config example in `examples/config/agents.json`

### Changed
- Agent bot mapping now configurable (no hardcoded bot names)
- Demo data cleaned for public release (no private info)
- Documentation updated with setup instructions

### Fixed
- Restored data accidentally deleted in previous cleanup

---

## [Unreleased]

### Added
- **Agent Auto-Sync** - Mission Control now automatically discovers and syncs agents from OpenClaw
  - New `server/agent-sync.js` module handles agent discovery
  - Reads `openclaw.json` to find configured agents
  - Creates Mission Control agent files automatically on startup
  - Periodic sync (configurable, default 30s) keeps agents in sync
  - Works without hardcoded paths - auto-detects OpenClaw installation
- **Dynamic Agent Discovery** - Agent bridge no longer has hardcoded agent names
  - Discovers agents from OpenClaw config or by scanning agents directory
  - File watcher paths built dynamically from discovered agents
- **New Environment Variables** for customization:
  - `OPENCLAW_CONFIG_PATH` - Override OpenClaw config location
  - `AGENT_SYNC_INTERVAL` - Control sync frequency (default: 30000ms)

### Changed
- Agent bridge now uses dynamic agent discovery instead of hardcoded list
- File watcher setup is now async and builds paths dynamically

## [0.8.0] - 2026-02-05

### Added
- **Agent Profile Panel** - Click any agent to open a detailed slide-out profile with avatar, name, role, status, and personality
- **Agent Personality System** - Each agent now has an "About" section with personality description, tone, and character traits
- **Skills & Capabilities Tags** - Agent capabilities displayed as styled pill badges on the profile panel
- **Attention Center** - Per-agent tab showing tasks assigned, @mentions, blocked items, and critical alerts
- **Agent Activity Timeline** - Chronological feed of agent actions (task claims, comments, completions)
- **Inter-Agent Messaging System** - Direct messaging between agents stored in `.mission-control/messages/`
- **Messages Tab** - View agent-to-agent conversations with threaded message view
- **Dashboard Chat Panel** - Floating chat panel for human-to-agent communication with @mention support
- **Messages API** - New REST endpoints: GET/POST `/api/messages`, GET `/api/messages/thread/:id`, PUT `/api/messages/:id/read`
- **Agent Attention API** - New endpoint: GET `/api/agents/:id/attention`
- **Agent Timeline API** - New endpoint: GET `/api/agents/:id/timeline`
- **GitHub Actions** - Automated deployment to GitHub Pages via `.github/workflows/deploy.yml`
- **URL Routing for Agents** - Each agent has a shareable URL (e.g., `#agent-neo`)
- **Real-time Message Updates** - WebSocket broadcasts for new messages with toast notifications
- **Sample Messages** - Pre-loaded conversation data between agents for demo mode

### Changed
- Agent sidebar rows now open profile panel instead of highlighting tasks
- Version bumped to 0.8.0 across all files
- Data layer updated with message accessor methods

## [0.7.0] - 2026-02-05

### Added
- **URL Routing** - Each task now has a shareable URL (e.g., `#task-20260205-example`)
- **Deep Linking** - Opening a URL with task ID automatically opens that task
- **Browser Navigation** - Back/forward buttons work with task modal
- **Semantic Versioning** - Added CHANGELOG.md with full version history
- **Version Badges** - README shows current version with badge

### Changed
- **Human Operators UI** - Horizontal compact layout instead of vertical list
- **Jobs Section** - Improved styling with status indicators and empty state
- Updated version to 0.7.0 across all files

### Fixed
- Human list no longer requires scrolling
- Jobs section no longer appears "hanging"

## [0.6.0] - 2026-02-05

### Added
- **Local Backend Server** - Node.js server with Express for data persistence
- **REST API** - Full CRUD endpoints for tasks, agents, humans, queue
- **WebSocket Support** - Real-time updates pushed to all connected dashboards
- **Webhook System** - Agents can register webhooks to receive task notifications
- **File Watcher** - Server detects when agents modify JSON files via Git
- **Comprehensive Agent Documentation** - Full webhook setup guide in CLAUDE.md
- **API Reference** - Complete endpoint documentation for agents
- **Server Status Indicator** - Dashboard shows connection status

### Changed
- Removed GitHub API dependency (simpler architecture)
- Dashboard now uses local API instead of external services
- Updated README with server installation instructions
- Updated CLAUDE.md with notification setup guide

### Fixed
- CSS fonts now load correctly (Orbitron, Rajdhani, Share Tech Mono)
- Dark theme set as default on page load
- Relative paths for better deployment compatibility

## [0.5.0] - 2026-02-05

### Added
- **Click-to-Highlight** - Click agent/human to highlight their tasks on board
- **Real Entity Files** - Actual JSON files for agents, humans, tasks, queue
- **Human Operators** - Support for human team members (Asif, Nobin, Jewel, Cipher, Tony)
- **Queue/Jobs System** - Scheduled tasks and cron job support
- **Channel Icons** - Telegram, WhatsApp, Slack indicators on profiles

### Changed
- Updated human names from demo to real operators
- Improved entity row styling with avatars

## [0.4.0] - 2026-02-04

### Added
- **Matrix Command Center Theme** - Dark futuristic UI with neon accents
- **Kanban Board** - Drag-and-drop task management
- **Agent Sidebar** - List of AI agents with status indicators
- **Human Sidebar** - List of human operators
- **Jobs Panel** - Scheduled/recurring task display
- **Theme Toggle** - Dark/Light mode switching
- **Task Modal** - Detailed task view with comments
- **Create Task Modal** - Form to create new tasks

### Changed
- Complete UI redesign with Matrix aesthetic
- Custom fonts: Orbitron (headers), Rajdhani (body), Share Tech Mono (code)

## [0.3.0] - 2026-02-03

### Added
- **Dashboard HTML** - Static Kanban board interface
- **Sample Data** - Demo tasks and agents for testing
- **Priority Colors** - Visual indicators for task priority
- **Status Columns** - INBOX, ASSIGNED, IN_PROGRESS, REVIEW, DONE

## [0.2.0] - 2026-02-02

### Added
- **CLAUDE.md** - Comprehensive agent skill file
- **Task JSON Schema** - Standardized task format
- **Agent JSON Schema** - Standardized agent format
- **Git Commit Format** - Standardized commit messages
- **Activity Logging** - System for tracking all actions

## [0.1.0] - 2026-02-01

### Added
- **Initial Template** - Base repository structure
- **README.md** - Project overview and quick start
- **INIT.md** - First-time initialization guide
- **AGENT_ADOPTION.md** - Protocol for agents to adopt project
- **DEVELOPMENT_GUIDE.md** - Contribution guidelines
- **SECURITY.md** - Security model documentation
- **.mission-control/** - Core data directory structure
- **MIT License** - Open source license

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 0.9.0 | 2026-02-07 | Telegram integration, CLI tools, git/local separation |
| 0.8.0 | 2026-02-05 | Agent profiles, personalities, messaging, chat, GitHub Actions |
| 0.7.0 | 2026-02-05 | URL routing, versioning, UI improvements |
| 0.6.0 | 2026-02-05 | Local server, WebSocket, Webhooks |
| 0.5.0 | 2026-02-05 | Click-to-highlight, real entities |
| 0.4.0 | 2026-02-04 | Matrix theme, Kanban UI |
| 0.3.0 | 2026-02-03 | Dashboard HTML, sample data |
| 0.2.0 | 2026-02-02 | CLAUDE.md, schemas |
| 0.1.0 | 2026-02-01 | Initial template |

---

## Versioning Guide

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes, major rewrites
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, minor improvements

### Pre-1.0.0

While in pre-release (0.x.x):
- Minor version bumps may include breaking changes
- Project is under active development
- APIs may change without notice

### Post-1.0.0 Goals

Version 1.0.0 will be released when:
- [ ] Core features are stable
- [ ] Documentation is complete
- [ ] Webhook system is battle-tested
- [ ] Dashboard is production-ready
- [ ] Security audit completed
