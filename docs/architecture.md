# Architecture Overview

This document describes the technical architecture of JARVIS Mission Control.

## Design Philosophy

### Git as Database

JARVIS Mission Control uses Git as its primary data store. This provides:

1. **Version Control**: Full history of all changes
2. **Audit Trail**: Who changed what, when
3. **Conflict Resolution**: Git's merge tools
4. **Distribution**: Clone anywhere, work offline
5. **Zero Infrastructure**: No database servers needed

### Agent-First Design

The system is designed for AI agents to:

1. **Read**: Parse JSON/YAML files
2. **Write**: Create and modify files
3. **Commit**: Track their changes
4. **Collaborate**: Work with other agents

### Human-in-the-Loop

Humans maintain oversight through:

1. **Review Gates**: Approval required for completion
2. **Override Capability**: Full access to all data
3. **Audit Logs**: Monitor agent activity
4. **Branch Protection**: Control what gets merged

## System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        JARVIS Mission Control                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │    Dashboard    │  │     Scripts     │  │   OpenClaw      │         │
│  │   (Static UI)   │  │   (CLI Tools)   │  │    Hooks        │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│           │    Read/Write      │                    │                   │
│           ▼                    ▼                    ▼                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    .mission-control/                             │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │   │
│  │  │  config   │ │   tasks   │ │  agents   │ │ workflows │       │   │
│  │  │  .yaml    │ │  /*.json  │ │  /*.json  │ │  /*.json  │       │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                     │   │
│  │  │  schema   │ │   logs    │ │   hooks   │                     │   │
│  │  │  /*.json  │ │  /*.log   │ │   /*.sh   │                     │   │
│  │  └───────────┘ └───────────┘ └───────────┘                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                │                                        │
│                         Git Operations                                  │
│                                │                                        │
│                    ┌───────────▼───────────┐                           │
│                    │     Git Repository     │                           │
│                    │  (Local or Remote)     │                           │
│                    └───────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Layer

### File Organization

```
.mission-control/
├── config.yaml              # System configuration
├── schema/                  # JSON schemas for validation
│   ├── task.schema.json
│   ├── agent.schema.json
│   └── workflow.schema.json
├── tasks/                   # Task files (one per task)
│   ├── task-20260205-001.json
│   └── task-20260205-002.json
├── agents/                  # Agent registrations
│   ├── agent-jarvis.json
│   └── human-admin.json
├── workflows/               # Workflow definitions
│   └── workflow-feature.json
├── logs/                    # Activity logs
│   └── 2026-02-05-activity.log
└── hooks/                   # OpenClaw integration hooks
    ├── on-agent-start.sh
    ├── on-agent-complete.sh
    ├── on-agent-error.sh
    └── on-tool-use.sh
```

### Data Flow

1. **Task Creation**
   ```
   Human/Agent → create-task.sh → tasks/task-*.json → Git commit
   ```

2. **Task Update**
   ```
   Agent reads task → modifies JSON → writes file → Git commit
   ```

3. **Dashboard View**
   ```
   Browser → dashboard/index.html → reads tasks/*.json → renders UI
   ```

4. **OpenClaw Integration**
   ```
   OpenClaw event → hook script → updates task → Git commit
   ```

## Task Lifecycle

```
                    ┌──────────────────────────────────────────────┐
                    │              Task Lifecycle                   │
                    └──────────────────────────────────────────────┘

    ┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌────────┐     ┌──────┐
    │  INBOX  │────▶│ ASSIGNED │────▶│ IN_PROGRESS │────▶│ REVIEW │────▶│ DONE │
    └─────────┘     └──────────┘     └─────────────┘     └────────┘     └──────┘
         │               │                  │                 │
         │               │                  │                 │
         ▼               ▼                  ▼                 ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                        BLOCKED                               │
    └─────────────────────────────────────────────────────────────┘
```

### State Transitions

| From | To | Triggered By |
|------|-----|--------------|
| INBOX | ASSIGNED | Lead agent assigns |
| INBOX | IN_PROGRESS | Agent claims directly |
| ASSIGNED | IN_PROGRESS | Assignee starts work |
| IN_PROGRESS | REVIEW | Agent completes work |
| REVIEW | DONE | Reviewer approves |
| REVIEW | IN_PROGRESS | Reviewer requests changes |
| Any | BLOCKED | Blocker encountered |
| BLOCKED | Previous | Blocker resolved |

## Agent Architecture

### Agent Types

1. **Lead Agent (Jarvis)**
   - Creates and assigns tasks
   - Spawns specialist agents
   - Approves completed work
   - Manages workflows

2. **Specialist Agents**
   - Claim tasks matching capabilities
   - Complete work autonomously
   - Report progress via comments
   - Request review when done

3. **Human Operators**
   - Full system access
   - Override capability
   - Final approval authority

### Agent Communication

Agents communicate through task comments:

```json
{
  "comments": [
    {
      "author": "agent-jarvis",
      "content": "@agent-backend Please review the API design",
      "type": "question"
    },
    {
      "author": "agent-backend",
      "content": "@agent-jarvis Reviewed. Suggest using GraphQL.",
      "type": "refute"
    },
    {
      "author": "agent-jarvis",
      "content": "@agent-backend Good point. Approved.",
      "type": "approval"
    }
  ]
}
```

## Dashboard Architecture

### Static Site Approach

The dashboard is a static HTML/CSS/JS application:

```
dashboard/
├── index.html       # Main entry point
├── css/
│   └── styles.css   # All styles
└── js/
    ├── data.js      # Data loading layer
    └── app.js       # Application logic
```

### Data Loading

1. **Local Development**: Read files directly
2. **GitHub Pages**: Use GitHub API to fetch files
3. **Sample Data**: Fallback for demonstration

### Rendering Flow

```
1. Page Load
   └── init()
       ├── loadData()
       │   └── Fetch tasks, agents from files
       └── renderDashboard()
           ├── renderMetrics()
           ├── renderKanban()
           └── renderAgents()
```

## OpenClaw Integration

### Hook System

OpenClaw hooks are shell scripts that run at lifecycle events:

```
OpenClaw Gateway
       │
       ├── on-agent-start.sh   → Creates task
       ├── on-tool-use.sh      → Adds progress comments
       ├── on-agent-complete.sh → Moves to REVIEW
       └── on-agent-error.sh   → Moves to BLOCKED
```

### Environment Variables

OpenClaw provides these to hooks:

| Variable | Description |
|----------|-------------|
| `OPENCLAW_SESSION_ID` | Unique session identifier |
| `OPENCLAW_AGENT_NAME` | Agent's display name |
| `OPENCLAW_PROMPT` | Initial user prompt |
| `OPENCLAW_TOOL_NAME` | Current tool being used |
| `OPENCLAW_THINKING` | Agent's reasoning |
| `OPENCLAW_RESULT` | Final result (on complete) |
| `OPENCLAW_ERROR` | Error message (on error) |

### Task Mapping

Each OpenClaw session maps to a Mission Control task:

```
OpenClaw Session ←→ Mission Control Task
     session_id  ←→ metadata.openclaw_session_id
     agent_name  ←→ assignee
     prompt      ←→ title/description
     tool_use    ←→ comments
     completion  ←→ status: REVIEW
     error       ←→ status: BLOCKED
```

## Security Architecture

### Access Control Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Access Control                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Git Authentication                                │
│  └── Who can push to the repository                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Branch Protection                                 │
│  └── Who can push to which branches                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Agent Registration                                │
│  └── Only registered agents can modify tasks                │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Role Permissions                                  │
│  └── What operations each role can perform                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: Schema Validation                                 │
│  └── All data must conform to schemas                       │
└─────────────────────────────────────────────────────────────┘
```

### Validation Pipeline

```
Agent Change
     │
     ▼
┌─────────────┐
│ Pre-commit  │──▶ Reject if invalid
│   Hook      │
└─────────────┘
     │
     ▼
┌─────────────┐
│   Schema    │──▶ Reject if schema violation
│ Validation  │
└─────────────┘
     │
     ▼
┌─────────────┐
│  Agent ID   │──▶ Reject if unregistered
│   Check     │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Permission  │──▶ Reject if unauthorized
│   Check     │
└─────────────┘
     │
     ▼
   Commit
```

## Scalability Considerations

### Current Design

- Suitable for: 10-100 tasks, 5-20 agents
- Bottleneck: File I/O for large task counts
- Conflict risk: Increases with agent count

### Scaling Strategies

1. **Task Archiving**: Move completed tasks to archive
2. **Sharding**: Split tasks by date or category
3. **Caching**: Add local cache layer for dashboard
4. **Webhooks**: Push updates instead of polling

## Future Enhancements

### Planned Features

1. **Real-time Updates**: WebSocket for live dashboard
2. **Task Templates**: Reusable task configurations
3. **Agent Metrics**: Performance tracking
4. **Notifications**: Slack/Discord integration
5. **Mobile App**: React Native dashboard

### Extension Points

- Custom hooks in `.mission-control/hooks/`
- Additional schemas in `.mission-control/schema/`
- Dashboard plugins in `dashboard/js/plugins/`
