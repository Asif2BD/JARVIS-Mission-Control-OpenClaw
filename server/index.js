/**
 * JARVIS Mission Control - Backend Server
 *
 * Local file-based data server with:
 * - REST API for CRUD operations
 * - WebSocket for real-time dashboard updates
 * - Webhooks for agent notifications
 * - File watcher for external changes
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 3000;
const MISSION_CONTROL_DIR = path.join(__dirname, '..', '.mission-control');
const DASHBOARD_DIR = path.join(__dirname, '..', 'dashboard');

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

// Webhook subscriptions
const webhooks = new Map();

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Read all JSON files from a directory
 */
async function readJsonDirectory(dirPath) {
    try {
        const fullPath = path.join(MISSION_CONTROL_DIR, dirPath);
        const files = await fs.readdir(fullPath);
        const items = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.readFile(path.join(fullPath, file), 'utf-8');
                    items.push(JSON.parse(content));
                } catch (e) {
                    console.error(`Error reading ${file}:`, e.message);
                }
            }
        }

        return items;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/**
 * Read a single JSON file
 */
async function readJsonFile(filePath) {
    const fullPath = path.join(MISSION_CONTROL_DIR, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
}

/**
 * Write a JSON file
 */
async function writeJsonFile(filePath, data) {
    const fullPath = path.join(MISSION_CONTROL_DIR, filePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
    return data;
}

/**
 * Delete a JSON file
 */
async function deleteJsonFile(filePath) {
    const fullPath = path.join(MISSION_CONTROL_DIR, filePath);
    await fs.unlink(fullPath);
}

/**
 * Append to activity log
 */
async function logActivity(actor, action, description) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${actor}] ${action}: ${description}\n`;
    const logPath = path.join(MISSION_CONTROL_DIR, 'logs', 'activity.log');

    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, logEntry);

    // Broadcast log event
    broadcast('log', { timestamp, actor, action, description });
}

// ============================================
// WEBSOCKET - Real-time Updates
// ============================================

const wsClients = new Set();

wss.on('connection', (ws) => {
    wsClients.add(ws);
    console.log('WebSocket client connected. Total:', wsClients.size);

    ws.on('close', () => {
        wsClients.delete(ws);
        console.log('WebSocket client disconnected. Total:', wsClients.size);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        wsClients.delete(ws);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
});

/**
 * Broadcast message to all WebSocket clients
 */
function broadcast(type, data) {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    wsClients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
}

// ============================================
// WEBHOOKS - Agent Notifications
// ============================================

/**
 * Register a webhook
 */
function registerWebhook(id, url, events) {
    webhooks.set(id, { url, events, registered_at: new Date().toISOString() });
    console.log(`Webhook registered: ${id} -> ${url} for events: ${events.join(', ')}`);
}

/**
 * Trigger webhooks for an event
 */
async function triggerWebhooks(event, data) {
    for (const [id, webhook] of webhooks) {
        if (webhook.events.includes(event) || webhook.events.includes('*')) {
            try {
                const response = await fetch(webhook.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event, data, timestamp: new Date().toISOString() })
                });
                console.log(`Webhook ${id} triggered for ${event}: ${response.status}`);
            } catch (error) {
                console.error(`Webhook ${id} failed:`, error.message);
            }
        }
    }
}

// ============================================
// FILE WATCHER - Detect External Changes
// ============================================

const watcher = chokidar.watch(MISSION_CONTROL_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
});

watcher
    .on('add', (filePath) => {
        console.log(`File added: ${filePath}`);
        handleFileChange('created', filePath);
    })
    .on('change', (filePath) => {
        console.log(`File changed: ${filePath}`);
        handleFileChange('updated', filePath);
    })
    .on('unlink', (filePath) => {
        console.log(`File deleted: ${filePath}`);
        handleFileChange('deleted', filePath);
    });

async function handleFileChange(action, filePath) {
    const relativePath = path.relative(MISSION_CONTROL_DIR, filePath);
    const parts = relativePath.split(path.sep);

    if (parts.length < 2 || !filePath.endsWith('.json')) return;

    const entityType = parts[0]; // tasks, agents, humans, queue
    const fileName = parts[parts.length - 1];

    let data = null;
    if (action !== 'deleted') {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            data = JSON.parse(content);
        } catch (e) {
            // File might be partially written
        }
    }

    // Broadcast to WebSocket clients
    broadcast(`${entityType}.${action}`, { file: fileName, data });

    // Trigger webhooks
    triggerWebhooks(`${entityType}.${action}`, { file: fileName, data });
}

// ============================================
// REST API ROUTES
// ============================================

// Serve dashboard static files
app.use(express.static(DASHBOARD_DIR));

// --- TASKS ---

app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await readJsonDirectory('tasks');
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tasks/:id', async (req, res) => {
    try {
        const task = await readJsonFile(`tasks/${req.params.id}.json`);
        res.json(task);
    } catch (error) {
        res.status(404).json({ error: 'Task not found' });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const task = req.body;

        // Generate ID if not provided
        if (!task.id) {
            const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
            task.id = `task-${date}-${Date.now()}`;
        }

        // Set timestamps
        task.created_at = task.created_at || new Date().toISOString();
        task.updated_at = new Date().toISOString();
        task.status = task.status || 'INBOX';

        await writeJsonFile(`tasks/${task.id}.json`, task);
        await logActivity(task.created_by || 'system', 'CREATED', `Task: ${task.title} (${task.id})`);

        broadcast('task.created', task);
        triggerWebhooks('task.created', task);

        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    try {
        const task = req.body;
        task.id = req.params.id;
        task.updated_at = new Date().toISOString();

        await writeJsonFile(`tasks/${task.id}.json`, task);
        await logActivity('system', 'UPDATED', `Task: ${task.title} (${task.id})`);

        broadcast('task.updated', task);
        triggerWebhooks('task.updated', task);

        res.json(task);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await deleteJsonFile(`tasks/${req.params.id}.json`);
        await logActivity('system', 'DELETED', `Task: ${req.params.id}`);

        broadcast('task.deleted', { id: req.params.id });
        triggerWebhooks('task.deleted', { id: req.params.id });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AGENTS ---

app.get('/api/agents', async (req, res) => {
    try {
        const agents = await readJsonDirectory('agents');
        res.json(agents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/agents/:id', async (req, res) => {
    try {
        const agent = await readJsonFile(`agents/${req.params.id}.json`);
        res.json(agent);
    } catch (error) {
        res.status(404).json({ error: 'Agent not found' });
    }
});

app.put('/api/agents/:id', async (req, res) => {
    try {
        const agent = req.body;
        agent.id = req.params.id;
        agent.last_active = new Date().toISOString();

        await writeJsonFile(`agents/${agent.id}.json`, agent);

        broadcast('agent.updated', agent);
        triggerWebhooks('agent.updated', agent);

        res.json(agent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- HUMANS ---

app.get('/api/humans', async (req, res) => {
    try {
        const humans = await readJsonDirectory('humans');
        res.json(humans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- QUEUE ---

app.get('/api/queue', async (req, res) => {
    try {
        const queue = await readJsonDirectory('queue');
        res.json(queue);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- LOGS ---

app.get('/api/logs/activity', async (req, res) => {
    try {
        const logPath = path.join(MISSION_CONTROL_DIR, 'logs', 'activity.log');
        const content = await fs.readFile(logPath, 'utf-8');
        const lines = content.trim().split('\n').slice(-100); // Last 100 lines
        res.json({ lines });
    } catch (error) {
        res.json({ lines: [] });
    }
});

app.post('/api/logs/activity', async (req, res) => {
    try {
        const { actor, action, description } = req.body;
        await logActivity(actor, action, description);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- STATE ---

app.get('/api/state', async (req, res) => {
    try {
        const statePath = path.join(MISSION_CONTROL_DIR, 'STATE.md');
        const content = await fs.readFile(statePath, 'utf-8');
        res.json({ content });
    } catch (error) {
        res.json({ content: '' });
    }
});

app.put('/api/state', async (req, res) => {
    try {
        const statePath = path.join(MISSION_CONTROL_DIR, 'STATE.md');
        await fs.writeFile(statePath, req.body.content);

        broadcast('state.updated', { content: req.body.content });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- WEBHOOKS ---

app.get('/api/webhooks', (req, res) => {
    const list = Array.from(webhooks.entries()).map(([id, data]) => ({ id, ...data }));
    res.json(list);
});

app.post('/api/webhooks', (req, res) => {
    const { id, url, events } = req.body;

    if (!id || !url || !events) {
        return res.status(400).json({ error: 'Missing required fields: id, url, events' });
    }

    registerWebhook(id, url, events);
    res.json({ success: true, id });
});

app.delete('/api/webhooks/:id', (req, res) => {
    webhooks.delete(req.params.id);
    res.json({ success: true });
});

// --- METRICS ---

app.get('/api/metrics', async (req, res) => {
    try {
        const tasks = await readJsonDirectory('tasks');
        const agents = await readJsonDirectory('agents');
        const humans = await readJsonDirectory('humans');
        const queue = await readJsonDirectory('queue');

        const tasksByStatus = {};
        ['INBOX', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'].forEach(status => {
            tasksByStatus[status] = tasks.filter(t => t.status === status).length;
        });

        res.json({
            totalTasks: tasks.length,
            tasksByStatus,
            activeAgents: agents.filter(a => a.status === 'active' || a.status === 'busy').length,
            totalAgents: agents.length,
            activeHumans: humans.filter(h => h.status === 'online' || h.status === 'away').length,
            totalHumans: humans.length,
            runningJobs: queue.filter(q => q.status === 'running').length,
            totalJobs: queue.length,
            webhooksRegistered: webhooks.size,
            wsClientsConnected: wsClients.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fallback to dashboard for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(DASHBOARD_DIR, 'index.html'));
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           JARVIS MISSION CONTROL - SERVER                     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   Dashboard:    http://localhost:${PORT}                        ║
║   API:          http://localhost:${PORT}/api                    ║
║   WebSocket:    ws://localhost:${PORT}/ws                       ║
║                                                               ║
║   Data Dir:     ${MISSION_CONTROL_DIR}
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});
