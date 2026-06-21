# JARVIS Mission Control v0.8.0 - Feature Proposal

> **Date**: 2026-02-05
> **Author**: agent-architect
> **Status**: AWAITING APPROVAL
> **Base Version**: 0.7.0

---

## Context

Currently JARVIS Mission Control is a Kanban-centric dashboard. You see task columns, agent names in a sidebar, and scheduled jobs. But you can't **click into an agent** and see who they are, what they're working on, what needs their attention, or how they've been communicating with other agents.

The screenshot from the reference video shows what the next level looks like: an **Agent Profile Page** where each agent has a personality, skills, an attention feed, a timeline of their activity, and a messages view showing inter-agent conversations. The user can also chat directly from the dashboard.

This proposal breaks that vision into **10 independent features** you can pick from. Each one builds on the current v0.7.0 architecture (file-based JSON, Node.js server, vanilla HTML/CSS/JS dashboard, WebSocket).

---

## What We Have Today (v0.7.0)

| Layer | Current State |
|-------|--------------|
| **Dashboard** | Kanban board, sidebar with agent/human lists, task modals, drag-and-drop |
| **Server** | Express REST API, WebSocket broadcast, file watcher, webhook registry |
| **Data** | JSON files in `.mission-control/` (tasks, agents, humans, queue) |
| **Agent Schema** | id, name, role, status, capabilities, channels, metadata |
| **Communication** | Task comments only. No direct messaging. No chat. |
| **Agent View** | One-line sidebar row (name + status dot + completed count) |

### What's Missing

- No way to click an agent and see their full profile
- No personality/about description for agents
- No attention/notification center per agent
- No activity timeline per agent
- No direct messaging between agents
- No in-dashboard chat
- No way to see inter-agent conversations
- No skill/capability tags displayed visually

---

## Proposed Features (Pick the ones you want)

### Feature 1: Agent Profile Panel

**What**: Clicking an agent name in the sidebar opens a detailed profile panel (slide-out or full page) showing their identity, role, status, avatar, and metadata.

**UI Reference** (from screenshot):
```
┌─────────────────────────────────┐
│  [Avatar]  JARVIS               │
│  Squad Lead                     │
│  ┌──────┐                       │
│  │ Lead │                       │
│  └──────┘                       │
│                                 │
│  ● WORKING                      │
│                                 │
│  ABOUT                          │
│  Chief orchestrator of the      │
│  marketing squad. I coordinate  │
│  work across all agents...      │
│                                 │
│  SKILLS                         │
│  [coordination] [quality-ctrl]  │
│  [communication] [automation]   │
│                                 │
│  ┌──────────┬──────────┬──────┐ │
│  │Attention │ Timeline │ Msgs │ │
│  └──────────┴──────────┴──────┘ │
│                                 │
│  (Tab content area)             │
│                                 │
└─────────────────────────────────┘
```

**Implementation**:
- New HTML modal/panel in `dashboard/index.html`
- CSS for the profile layout matching the screenshot style
- JS handler: `openAgentProfile(agentId)` in `app.js`
- Reads agent JSON via existing `/api/agents/:id` endpoint
- URL routing: `#agent-neo` opens Neo's profile

**Changes**: `dashboard/index.html`, `dashboard/js/app.js`, `dashboard/css/styles.css`

**Depends on**: Nothing (standalone)

---

### Feature 2: Agent Personality & About System

**What**: Add a `personality` object to the agent JSON schema with structured fields for about text, tone, traits, and behavioral description. This gives each agent a distinct identity visible on their profile.

**Schema Addition**:
```json
{
  "personality": {
    "about": "Chief orchestrator of the marketing squad. I coordinate work across all agents, maintain quality standards, and make sure nothing falls through the cracks. Direct line to Bhanu. Calm under pressure, detail-oriented, occasionally dry humor.",
    "tone": "precise",
    "traits": ["calm-under-pressure", "detail-oriented", "dry-humor"],
    "greeting": "Systems nominal. What needs my attention?"
  }
}
```

**Implementation**:
- Update agent JSON schema in `.mission-control/schema/`
- Add `personality` field to all existing agent JSON files
- Profile panel (Feature 1) renders the `about` text and traits
- Write personality descriptions for: Architect, Neo, Trinity, JARVIS

**Changes**: `.mission-control/agents/*.json`, `.mission-control/schema/agent.schema.json`

**Depends on**: Feature 1 (to display it), but can be done independently (data-first)

---

### Feature 3: Skills & Capabilities Tags

**What**: Display agent capabilities as styled tags/badges on the profile panel and optionally in the sidebar. Currently `capabilities` exists in the JSON but is never shown in the UI.

**UI**:
```
SKILLS
┌──────────────┐ ┌───────────────┐ ┌───────────────┐
│ coordination │ │ quality-ctrl  │ │ communication │
└──────────────┘ └───────────────┘ └───────────────┘
┌────────────┐
│ automation │
└────────────┘
```

**Implementation**:
- CSS for skill tags (rounded pills, themed colors)
- Render `agent.capabilities` array as tags in profile panel
- Optional: show top 2-3 skills in sidebar agent row on hover

**Changes**: `dashboard/css/styles.css`, `dashboard/js/app.js`

**Depends on**: Feature 1 (for the profile panel context)

---

### Feature 4: Attention Center (Per-Agent Notification Feed)

**What**: A tab on the agent profile that shows everything needing that agent's attention:
- Tasks assigned to them
- @mentions from other agents in task comments
- Tasks they created that are now BLOCKED
- CRITICAL priority items in their queue
- Unresolved questions directed at them

**UI**:
```
⚠ Attention                                          ▼ Filter
─────────────────────────────────────────────────────
🔴 CRITICAL  "Neural Interface Breach" assigned to you
   2 hours ago

💬 MENTION   @jarvis review needed on Matrix Core
   by agent-neo · 4 hours ago

📋 ASSIGNED  "Implement Real-time Sync" waiting
   since yesterday

⚠ BLOCKED   "API Gateway" - you created this
   blocked by: task-20260205-security-audit
```

**Implementation**:
- New API endpoint: `GET /api/agents/:id/attention`
- Server-side logic to scan tasks for: assignee match, @mentions in comments, blocked tasks created by agent, critical items
- Frontend tab content renderer
- Badge count on the Attention tab header

**Changes**: `server/index.js` (new endpoint), `dashboard/js/app.js`, `dashboard/css/styles.css`

**Depends on**: Feature 1 (for the tab container)

---

### Feature 5: Agent Activity Timeline

**What**: A chronological feed of everything an agent has done, pulled from the activity log and task comment history. Shows claims, status changes, comments, completions.

**UI**:
```
📋 Timeline
─────────────────────────────────────────────────────
● 12:00  Updated system state
          STATE.md refreshed

● 11:30  Completed task: Security Audit Review
          Approved Trinity's work

● 11:00  Commented on "Matrix Core Upgrade"
          "@neo Looks good. Ship it."

● 10:30  Claimed task: API Documentation
          "Starting work on this now."

● 09:00  Session started
          Agent came online
```

**Implementation**:
- New API endpoint: `GET /api/agents/:id/timeline`
- Server parses `activity.log` filtered by agent ID
- Also scans task comments authored by the agent
- Merges and sorts by timestamp (newest first)
- Frontend renders as a vertical timeline with icons per action type
- Pagination or "load more" for long histories

**Changes**: `server/index.js` (new endpoint), `dashboard/js/app.js`, `dashboard/css/styles.css`

**Depends on**: Feature 1 (for the tab container)

---

### Feature 6: Inter-Agent Messaging System

**What**: A direct messaging system between agents that lives outside of task comments. Agents can send messages to each other, creating conversation threads. Stored as JSON files.

**Data Structure** (new directory: `.mission-control/messages/`):
```json
{
  "id": "msg-20260205-001",
  "from": "agent-neo",
  "to": "agent-trinity",
  "content": "Trinity, I found a vulnerability in the auth module. Can you take a look?",
  "timestamp": "2026-02-05T12:00:00Z",
  "thread_id": "thread-neo-trinity-20260205",
  "read": false,
  "type": "direct"
}
```

**Thread grouping**: Messages between the same two agents are grouped into threads by `thread_id`.

**API Endpoints**:
```
GET    /api/messages?agent=agent-neo          # All messages for an agent
GET    /api/messages/thread/:threadId         # Single thread
POST   /api/messages                          # Send a message
PUT    /api/messages/:id/read                 # Mark as read
```

**Implementation**:
- New `messages/` directory in `.mission-control/`
- Server CRUD for messages
- WebSocket broadcast on new message: `message.created`
- Webhook event: `message.created`
- File watcher detects message files created by agents via Git

**Changes**: `server/index.js` (new endpoints), new directory `.mission-control/messages/`

**Depends on**: Nothing (backend-only, can be consumed by Features 7 or 8)

---

### Feature 7: Messages Tab (Agent-to-Agent Conversations)

**What**: The Messages tab on the agent profile shows all conversations that agent is part of. Click a conversation to see the full thread. This is how you "see how one agent is actually talking with each other."

**UI**:
```
💬 Messages
─────────────────────────────────────────────────────
┌─────────────────────────────────────────────┐
│ 🤖 Neo                              2h ago │
│ "Found a vulnerability in auth..."    ● 2   │
├─────────────────────────────────────────────┤
│ 🤖 Architect                         5h ago │
│ "Approved your task. Good work."            │
├─────────────────────────────────────────────┤
│ 🤖 Oracle                            1d ago │
│ "I foresee complications with..."           │
└─────────────────────────────────────────────┘

─── Conversation with Neo ────────────────────
Neo (12:00): Found a vulnerability in auth...
Trinity (12:05): On it. Which module?
Neo (12:07): src/auth/token-validator.ts line 47
Trinity (12:15): Confirmed. Patching now.
```

**Implementation**:
- Frontend message list renderer (conversations grouped by thread)
- Click to expand into full conversation view
- Unread badge count per conversation
- Real-time updates via WebSocket `message.created` events
- Auto-scroll to latest message

**Changes**: `dashboard/js/app.js`, `dashboard/css/styles.css`

**Depends on**: Feature 1 (profile panel) + Feature 6 (messaging backend)

---

### Feature 8: Dashboard Chat Panel

**What**: A persistent chat panel at the bottom or right side of the dashboard where the human operator can send messages into Mission Control. Messages go to specific agents or to a general channel. Agents can respond via the API.

**UI**:
```
┌─── Mission Control Chat ──────────────────────┐
│                                                │
│  Asif (10:00): @jarvis what's the status?     │
│  JARVIS (10:01): All systems operational.      │
│    3 tasks in progress, 0 blocked.             │
│  Asif (10:02): @neo how's the core upgrade?   │
│  Neo (10:03): 80% complete. ETA: 2 hours.     │
│                                                │
│ ┌──────────────────────────────────┐ [Send]   │
│ │ Type a message... @mention agent │           │
│ └──────────────────────────────────┘           │
└────────────────────────────────────────────────┘
```

**Implementation**:
- New chat panel HTML element (collapsible, bottom-right or right sidebar)
- Uses the messaging API from Feature 6 with `type: "chat"`
- @mention autocomplete for agent names
- WebSocket for real-time message display
- Chat history persisted in `.mission-control/messages/` with `thread_id: "chat-general"`
- Toggle button in header to show/hide chat

**Changes**: `dashboard/index.html`, `dashboard/js/app.js`, `dashboard/css/styles.css`

**Depends on**: Feature 6 (messaging backend)

---

### Feature 9: Agent Status Enhancement

**What**: Upgrade the agent status system beyond simple active/busy/idle. Show what each agent is currently working on, their workload, and a human-readable status line.

**Schema Addition**:
```json
{
  "status": "working",
  "status_detail": {
    "current_task": "task-20260205-matrix-core",
    "current_task_title": "Matrix Core System Upgrade",
    "activity": "Implementing real-time sync module",
    "progress": 80,
    "started_at": "2026-02-05T10:00:00Z"
  }
}
```

**UI in sidebar**:
```
● Neo  ━━━━━━━━░░ 80%
  Matrix Core Upgrade
```

**UI in profile panel**:
```
● WORKING
  Currently: Matrix Core System Upgrade (80%)
  "Implementing real-time sync module"
  Started: 2 hours ago
```

**Implementation**:
- Extend agent JSON schema with `status_detail` object
- Update sidebar rendering to show mini progress bar + task name
- Profile panel shows full status detail
- API: agents update their own status via `PUT /api/agents/:id`
- WebSocket broadcasts status changes in real-time

**Changes**: `.mission-control/agents/*.json`, `server/index.js`, `dashboard/js/app.js`, `dashboard/css/styles.css`

**Depends on**: Nothing (standalone enhancement)

---

### Feature 10: Conversation Replay / Agent Collaboration View

**What**: A dedicated view (accessible from header or as a new page) that shows ALL inter-agent conversations across the system. Think of it as a "Slack-like" overview where you can see every conversation thread, filter by agent pair, and watch agents collaborate in real-time.

**UI**:
```
┌─── Agent Conversations ───────────────────────────┐
│                                                    │
│ Filter: [All Agents ▼]  [All Time ▼]  [Search...] │
│                                                    │
│ ┌── Neo ↔ Trinity ─────────── 12:15 ────────────┐ │
│ │ Neo: Found vulnerability in auth module        │ │
│ │ Trinity: On it. Which module?                  │ │
│ │ Neo: src/auth/token-validator.ts line 47       │ │
│ │ Trinity: Confirmed. Patching now.              │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌── Architect ↔ Neo ──────── 11:30 ─────────────┐ │
│ │ Architect: Neo, Matrix Core is priority today  │ │
│ │ Neo: Already on it. 60% done.                  │ │
│ │ Architect: Good. Keep Trinity posted on deps.  │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌── Oracle → All ──────────── 10:00 ────────────┐ │
│ │ Oracle: I foresee a blocker on the API task.   │ │
│ │   The auth refactor must land first.           │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**Implementation**:
- New page/view: `#conversations` route
- Fetches all messages from `/api/messages`
- Groups by thread, sorted by most recent activity
- Filter controls: by agent, by date range, search text
- Live updates via WebSocket
- Linkable: click a conversation to open the relevant agent profile messages tab

**Changes**: `dashboard/index.html` (new view), `dashboard/js/app.js`, `dashboard/css/styles.css`

**Depends on**: Feature 6 (messaging backend) + Feature 7 (message rendering)

---

## Dependency Map

```
Feature 1: Agent Profile Panel ──────────────── FOUNDATION
    │
    ├── Feature 2: Personality System (data)
    ├── Feature 3: Skills Tags (UI)
    ├── Feature 4: Attention Center (tab)
    ├── Feature 5: Activity Timeline (tab)
    │
Feature 6: Messaging Backend ───────────────── FOUNDATION
    │
    ├── Feature 7: Messages Tab (profile tab)
    ├── Feature 8: Dashboard Chat Panel
    └── Feature 10: Conversation Replay View

Feature 9: Status Enhancement ──────────────── STANDALONE
```

**Minimum viable set for the screenshot experience**: Features 1, 2, 3, 4, 5

**Minimum viable set for inter-agent chat**: Features 6, 7

**Full vision (everything in the screenshot + chat)**: Features 1-8

---

## Recommended Build Order

If you pick multiple features, here's the optimal sequence:

| Phase | Features | What You Get |
|-------|----------|-------------|
| **Phase A** | 1, 2, 3 | Agent profile panel with personality and skills |
| **Phase B** | 4, 5 | Attention + Timeline tabs (profile is now complete) |
| **Phase C** | 6 | Messaging backend (enables all chat features) |
| **Phase D** | 7, 8 | Messages tab + Dashboard chat |
| **Phase E** | 9 | Enhanced status with progress bars |
| **Phase F** | 10 | Full conversation replay view |

---

## Technical Notes

### Architecture Consistency
All features follow the existing patterns:
- **Data**: JSON files in `.mission-control/` (Git-friendly)
- **Server**: Express endpoints + WebSocket broadcast
- **Dashboard**: Vanilla HTML/CSS/JS (no framework)
- **Real-time**: WebSocket events + webhook triggers
- **File Watcher**: Detects agent-created files automatically

### No New Dependencies Required
Everything can be built with the existing stack:
- Express 4.x, ws 8.x, chokidar 3.x, cors
- Vanilla JavaScript (no React/Vue needed)
- CSS with existing Matrix theme variables

### Backward Compatible
All features are additive. No existing functionality changes. Agent JSON files get new optional fields. New API endpoints don't affect existing ones.

---

## How to Respond

Pick the features you want by number. For example:

> "Yes, build 1, 2, 3, 4, 5, 6, and 7"

or

> "Start with 1, 2, 3 only for now"

or

> "Build everything except 10"

I'll then implement them in the optimal order and ship v0.8.0.
