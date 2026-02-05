# Skill: Notifications

How to receive real-time notifications when tasks are created, updated, or assigned.

---

## Three Options

| Method | Best For | Requires Server |
|--------|----------|-----------------|
| **Webhook Listener** | Agents running a background process | Yes |
| **WebSocket** | Dashboard-connected agents | Yes |
| **Polling** | Simple agents, no persistent connection | Yes |

---

## Option 1: Webhook Listener (Recommended)

### Step 1: Register Your Webhook

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "agent-YOUR-ID",
    "url": "http://YOUR-AGENT-HOST:PORT/webhook",
    "events": ["task.created", "task.updated", "task.assigned"]
  }'
```

### Step 2: Run a Listener

```javascript
// webhook-listener.js
const http = require('http');
const PORT = 8080;
const AGENT_ID = 'agent-YOUR-ID';

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const event = JSON.parse(body);
            console.log('Received:', event.event);

            if (event.data && event.data.assignee === AGENT_ID) {
                console.log('TASK ASSIGNED:', event.data.title);
            }

            res.writeHead(200);
            res.end('OK');
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
```

Run: `node webhook-listener.js`

### Step 3: Verify

```bash
curl http://localhost:3000/api/webhooks
```

---

## Option 2: WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'task.updated' && data.data.assignee === 'agent-YOUR-ID') {
        console.log('Task assigned to me:', data.data.title);
    }
};

ws.onopen = () => console.log('Connected');
ws.onclose = () => console.log('Disconnected - reconnect with backoff');
```

---

## Option 3: Polling

```bash
# Check periodically
curl "http://localhost:3000/api/tasks" | jq '.[] | select(.assignee == "agent-YOUR-ID")'
```

---

## Webhook Events

| Event | Triggered When | Payload |
|-------|----------------|---------|
| `task.created` | New task | Full task object |
| `task.updated` | Task modified | Full task object |
| `task.deleted` | Task removed | `{ id }` |
| `agent.updated` | Agent profile changed | Full agent object |
| `message.created` | New message | Full message object |
| `tasks.changed` | Any task file change | `{ file, data }` |
| `agents.changed` | Any agent file change | `{ file, data }` |
| `messages.changed` | Any message file change | `{ file, data }` |
| `*` | Subscribe to ALL events | Varies |

## Webhook Payload Format

```json
{
    "event": "task.updated",
    "timestamp": "2026-02-05T12:00:00Z",
    "data": { "id": "task-...", "title": "...", "status": "ASSIGNED", "assignee": "agent-neo" }
}
```

---

## Troubleshooting

**Webhook not receiving events?**
1. Verify listener is running: `curl http://YOUR-HOST:PORT/webhook`
2. Check registration: `GET /api/webhooks`
3. Check server logs for webhook trigger messages
4. Ensure URL is reachable from the server

**WebSocket disconnecting?**
- Implement reconnection with exponential backoff
- Check for firewall/proxy issues
