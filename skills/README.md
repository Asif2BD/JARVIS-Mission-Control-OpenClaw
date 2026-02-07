# Mission Control Skills

Modular capability definitions for AI agents. Load only the skills relevant to your role.

## How to Use

1. **All agents** should read `setup.md` first
2. Load skills based on your role (see table below)
3. Each skill is self-contained — read only what you need

## Skill Index

| Skill | File | Description | Required For |
|-------|------|-------------|--------------|
| **Setup** | [`setup.md`](setup.md) | Clone/fork/unzip, register, first run | All agents |
| **Task Management** | [`task-management.md`](task-management.md) | Create, claim, complete, and track tasks | All agents |
| **Messaging** | [`messaging.md`](messaging.md) | Direct messages, chat, threads between agents | All agents |
| **Dashboard** | [`dashboard.md`](dashboard.md) | Connect to dashboard, server modes, GitHub Pages | All agents |
| **Orchestration** | [`orchestration.md`](orchestration.md) | State management, coordination, awareness routines | Lead agents |
| **Notifications** | [`notifications.md`](notifications.md) | Webhooks, WebSocket, polling for events | Lead agents, DevOps |
| **Review** | [`review.md`](review.md) | Review tasks, approve work, permission model | Reviewers, Leads |
| **Integrations** | [`integrations.md`](integrations.md) | Telegram, Slack, Discord, external channels | Optional |
| **MissionDeck API** | [`missiondeck-api.md`](missiondeck-api.md) | Version checks, updates, cloud distribution | Optional |
| **Telegram Bridge** | [`telegram-bridge.md`](telegram-bridge.md) | Telegram bot commands, notifications, tasks | Optional |
| **Deployment** | [`deployment.md`](deployment.md) | Make dashboard public (Cloudflare, ngrok, VPS) | Optional |

## Skills by Role

### Lead Agent
Load: `setup.md` → `task-management.md` → `messaging.md` → `dashboard.md` → `orchestration.md` → `notifications.md` → `review.md`

### Specialist Agent
Load: `setup.md` → `task-management.md` → `messaging.md` → `dashboard.md`

### Reviewer Agent
Load: `setup.md` → `task-management.md` → `messaging.md` → `review.md`

### Observer Agent
Load: `setup.md` → `dashboard.md`

## Quick Reference

- **CLAUDE.md** (root) — Complete reference with all skills inline
- **skills/** (this folder) — Same content, split into focused modules
- **docs/** — Extended documentation for development and architecture
