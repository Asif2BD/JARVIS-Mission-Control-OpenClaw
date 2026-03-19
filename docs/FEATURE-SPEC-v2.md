# JARVIS Mission Control v2 — Feature Spec

*Inspired by SEO automation dashboards, built for generalized multi-agent orchestration.*

---

## Overview

Transform Mission Control from a status dashboard into a full **Agent Operations Center** with cost tracking, approval workflows, and real-time observability.

---

## 1. Top Metrics Bar

**Current:** Basic agent count and status  
**New:** Key operational metrics at a glance

| Metric | Source | Notes |
|--------|--------|-------|
| Today's Cost | OpenClaw usage API | Sum of all agent costs today |
| Monthly Spend | OpenClaw usage API | With budget limit indicator |
| Tasks Completed | Event log count | Messages processed, tools run |
| Pending Approvals | New approval queue | Human-in-the-loop items |
| Active Agents | Session status | Currently running agents |

---

## 2. Agent Status Cards (Enhanced)

**Current:** Name + online/offline indicator  
**New:** Rich cards with operational data

```
┌─────────────────────────────────┐
│ 🤖 Oracle                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Status: ● Running               │
│ Model: claude-sonnet-4          │
│ Cost/mo: $12.40                 │
│ Last active: 2 min ago          │
│ Tasks today: 47                 │
│ [View Logs] [Send Message]      │
└─────────────────────────────────┘
```

**Status types:**
- 🟢 Running — actively processing
- 🟡 Idle — connected, waiting
- 🔵 Monitoring — heartbeat mode
- 🟠 Awaiting Approval — blocked on human
- 🔴 Offline — not connected

---

## 3. Live Event Feed

Real-time activity stream across all agents.

```
21:53:42  Oracle    📧 Checked inbox (3 new)           $0.02
21:53:38  Tank      🔧 Edited mission-control/api.ts   $0.01
21:53:30  Morpheus  🔍 Web search: "market trends"     $0.03
21:53:15  Keymaker  ⏰ Cron: daily-backup completed    $0.00
21:52:58  Oracle    💬 Replied in Matrix Zion          $0.04
```

**Event types:** 💬 Chat | 🔧 Tool | 🔍 Search | 📧 Email | ⏰ Cron | ⚠️ Error | ✅ Approval

**Features:**
- Filter by agent
- Filter by event type
- Search within events
- Click to expand full context
- WebSocket for real-time updates

---

## 4. Approval Workflow System 🔥

**The killer feature.** Human-in-the-loop for sensitive operations.

### Approval Types
- 📧 Outbound emails
- 🐦 Social posts (Twitter, etc.)
- 💸 Purchases / API calls with cost
- 🔧 System changes (config edits)
- 📁 File deletions
- 🌐 External API calls

### UI Component
```
┌─────────────────────────────────────────────────────┐
│ ⏳ PENDING APPROVALS (2)                            │
├─────────────────────────────────────────────────────┤
│ Oracle wants to send email                          │
│ To: client@example.com                              │
│ Subject: Project Update - March 2026               │
│ ┌─────────────────────────────────────────────┐    │
│ │ Hi John,                                     │    │
│ │                                              │    │
│ │ Here's the weekly update on Project Alpha... │    │
│ └─────────────────────────────────────────────┘    │
│ [✅ Approve] [✏️ Edit] [❌ Reject] [👁️ Full View]   │
├─────────────────────────────────────────────────────┤
│ Tank wants to delete files                          │
│ Path: /workspace/old-backups/* (23 files, 1.2GB)   │
│ [✅ Approve] [❌ Reject] [📋 List Files]            │
└─────────────────────────────────────────────────────┘
```

### Backend Flow
1. Agent calls sensitive action → intercepted
2. Action queued in `pending_approvals` table
3. WebSocket notification to dashboard
4. Human approves/rejects/edits
5. Result sent back to agent session
6. Agent continues or handles rejection

### API Endpoints
```
GET  /api/approvals              # List pending
POST /api/approvals/:id/approve  # Approve (with optional edits)
POST /api/approvals/:id/reject   # Reject with reason
GET  /api/approvals/:id/preview  # Full preview
```

---

## 5. Budget & Cost Tracking

### Monthly Budget View
```
March 2026 Budget: $100.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 47% used

Oracle      ████████░░░░░░░░░░  $18.40
Tank        ██████░░░░░░░░░░░░  $12.20
Morpheus    ████░░░░░░░░░░░░░░  $8.50
Keymaker    ██░░░░░░░░░░░░░░░░  $4.30
Shuri       █░░░░░░░░░░░░░░░░░  $2.80
Link        █░░░░░░░░░░░░░░░░░  $0.80
                         Total: $47.00
```

### Features
- Set monthly budget limit
- Per-agent budget allocation (optional)
- Alert thresholds (50%, 80%, 95%)
- Cost projection based on trend
- Daily/weekly cost charts

### Data Source
OpenClaw exposes usage via gateway API — we aggregate and store historical data.

---

## 6. Schedule View (Cron Visualization)

**Current:** Raw cron list via API  
**New:** Visual timeline

```
Today's Schedule
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

06:00  ✅ Oracle    Morning briefing         Done
08:00  ✅ Morpheus  Market scan              Done  
12:00  ✅ Tank      Backup workspace         Done
14:00  🔄 Oracle    Inbox check              Running
18:00  ⏳ Keymaker  Security audit           Scheduled
22:00  ⏳ Oracle    Daily summary            Scheduled

Tomorrow: 6 tasks scheduled
```

### Features
- Timeline view (today/week)
- Run history per job
- Manual trigger button
- Edit schedule inline
- Disable/enable toggle

---

## 7. Recent Runs Table

Operational view of recent agent activity.

| Agent | Task | Status | Duration | Cost | Time |
|-------|------|--------|----------|------|------|
| Oracle | Inbox check | ✅ Done | 12s | $0.04 | 2m ago |
| Tank | Git commit | ✅ Done | 3s | $0.01 | 5m ago |
| Morpheus | Web research | 🔄 Running | 45s | $0.08 | now |
| Oracle | Email draft | ⏳ Awaiting | — | — | 8m ago |

**Features:**
- Sort by any column
- Filter by status
- Click to view full context
- Retry failed tasks

---

## 8. Agent Performance Metrics

Replace SEO-specific metrics with generalized agent performance.

### Per-Agent Stats
- Messages processed (today/week/month)
- Average response time
- Tool usage breakdown
- Error rate
- Most used tools
- Peak activity hours

### System-Wide
- Total messages across all agents
- Total tool invocations
- Cost per message (average)
- Uptime percentage

---

## 9. Notification System

### In-App
- Toast notifications for approvals
- Alert badge on pending items
- Sound option for urgent items

### External
- Telegram notification for pending approvals
- Daily cost summary
- Budget threshold alerts
- Error alerts

---

## 10. Settings & Configuration

### Dashboard Settings
- Theme (dark/light/system)
- Refresh interval
- Default time range
- Notification preferences

### Agent Settings (per agent)
- Monthly budget limit
- Approval requirements (what needs approval)
- Alert thresholds
- Model override

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Event logging infrastructure
- [ ] Cost tracking integration
- [ ] Enhanced agent cards
- [ ] Live event feed (basic)

### Phase 2: Approvals (Week 3-4)
- [ ] Approval queue backend
- [ ] Approval UI component
- [ ] WebSocket notifications
- [ ] Agent-side integration

### Phase 3: Budget & Schedule (Week 5-6)
- [ ] Budget tracking & visualization
- [ ] Schedule view
- [ ] Historical data storage
- [ ] Charts & trends

### Phase 4: Polish (Week 7-8)
- [ ] Performance metrics
- [ ] Notification system
- [ ] Settings page
- [ ] Mobile responsiveness

---

## Technical Considerations

### Data Storage
- SQLite for event logs and approvals
- JSON files for config (existing pattern)
- Consider PostgreSQL for scale

### Real-time Updates
- WebSocket for live feed
- Server-Sent Events as fallback
- Polling as last resort

### OpenClaw Integration
- Usage API for cost data
- Session API for agent status
- Cron API for schedules
- Need: approval hook system

---

## Open Questions

1. **Approval hooks** — Does OpenClaw support intercepting actions? May need upstream feature request.

2. **Cost granularity** — Can we get per-message costs or only session totals?

3. **Multi-user** — Should dashboard support multiple human operators with different permissions?

4. **Mobile app** — PWA sufficient or native app needed?

---

*Draft v1 — Tank, 2026-03-19*
