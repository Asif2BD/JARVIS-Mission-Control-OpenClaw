# Skill: Messaging

How to send direct messages, use dashboard chat, and organize conversations.

---

## Two Communication Methods

| Method | Use For |
|--------|---------|
| **Task Comments** | Discussions tied to a specific task |
| **Direct Messages** | General communication between agents/humans |

---

## Task Comments

Add to a task's `comments` array with @mentions:

```json
{
  "id": "comment-123",
  "author": "agent-YOUR-ID",
  "content": "@agent-reviewer Please review my implementation",
  "timestamp": "2026-02-05T12:00:00Z",
  "type": "question"
}
```

**Comment types:** `progress`, `question`, `review`, `approval`, `blocked`

---

## Direct Messages

Messages stored in `.mission-control/messages/`. One file per message.

**Naming:** `msg-YYYYMMDD-NNN.json`

### Message Schema

```json
{
  "id": "msg-20260205-001",
  "from": "agent-YOUR-ID",
  "to": "agent-OTHER-ID",
  "content": "Hey, can you review the security module?",
  "timestamp": "2026-02-05T12:00:00Z",
  "thread_id": "thread-you-other-security",
  "read": false,
  "type": "direct"
}
```

### Message Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique: `msg-YYYYMMDD-NNN` |
| `from` | string | Sender ID |
| `to` | string | Recipient ID, or `"all"` for broadcast |
| `content` | string | Message text (supports @mentions) |
| `timestamp` | string | ISO 8601 |
| `thread_id` | string | Groups messages into conversations |
| `read` | boolean | Whether recipient has read it |
| `type` | string | `"direct"` or `"chat"` |

### Message Types

| Type | Use Case |
|------|----------|
| `direct` | Private messages between two agents |
| `chat` | Dashboard chat (visible to all humans) |

---

## Sending Messages

### Via API (server must be running)

```bash
# Direct message to another agent
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "from": "agent-YOUR-ID",
    "to": "agent-OTHER-ID",
    "content": "Security review needed on auth module",
    "thread_id": "thread-you-other",
    "type": "direct"
  }'

# Chat message to dashboard (visible to humans)
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "from": "agent-YOUR-ID",
    "to": "human-OPERATOR-ID",
    "content": "Task completed. Ready for your review.",
    "thread_id": "chat-general",
    "type": "chat"
  }'
```

### Via Git (no server needed)

Create the message file and commit:

```bash
# Create message JSON in .mission-control/messages/
git add .mission-control/messages/
git commit -m "[agent:YOUR-ID] Sent message to OTHER-ID"
git push
```

---

## Reading Messages

```bash
# All messages for an agent
curl "http://localhost:3000/api/messages?agent=agent-YOUR-ID"

# Specific conversation thread
curl "http://localhost:3000/api/messages/thread/thread-you-other"

# Mark as read
curl -X PUT "http://localhost:3000/api/messages/msg-20260205-001/read"
```

---

## Thread Naming Convention

| Pattern | Example | Use For |
|---------|---------|---------|
| `thread-AGENT1-AGENT2` | `thread-neo-trinity` | Two-agent conversations |
| `thread-AGENT1-AGENT2-TOPIC` | `thread-neo-trinity-security` | Topic-specific threads |
| `chat-general` | `chat-general` | Dashboard chat room |
| `chat-TOPIC` | `chat-standup` | Topic-specific chat rooms |

---

## When to Use Which

| Scenario | Use |
|----------|-----|
| Discussing a specific task | Task comments |
| General question for another agent | Direct message |
| Status update for human operator | Chat message (`type: "chat"`) |
| Coordinating work across agents | Direct message |
| Requesting task review | Task comment |
| Asking for permission | Chat message to human |
