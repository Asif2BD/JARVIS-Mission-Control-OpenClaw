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
const ResourceManager = require('./resource-manager');
const ReviewManager = require('./review-manager');
const telegramBridge = require('./telegram-bridge');

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

// --- FILE LISTING & DOWNLOADS ---

// Directory listing endpoint — GET /api/files?dir=reports
app.get('/api/files', async (req, res) => {
    try {
        const dir = req.query.dir || 'reports';
        const fullPath = path.join(MISSION_CONTROL_DIR, dir);

        const resolvedPath = path.resolve(fullPath);
        const resolvedBase = path.resolve(MISSION_CONTROL_DIR);
        if (!resolvedPath.startsWith(resolvedBase)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const entries = await fs.readdir(fullPath);
        const files = [];
        for (const entry of entries) {
            try {
                const entryPath = path.join(fullPath, entry);
                const stat = await fs.stat(entryPath);
                if (stat.isFile()) {
                    files.push({
                        name: entry,
                        path: `${dir}/${entry}`,
                        size: stat.size,
                        modified: stat.mtime,
                        ext: path.extname(entry).toLowerCase()
                    });
                }
            } catch (e) { /* skip unreadable entries */ }
        }
        res.json({ directory: dir, files });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json({ directory: req.query.dir || 'reports', files: [] });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/files/:path(*)', async (req, res) => {
    try {
        const filePath = req.params.path;
        const fullPath = path.join(MISSION_CONTROL_DIR, filePath);
        
        // Security: Ensure path is within MISSION_CONTROL_DIR
        const resolvedPath = path.resolve(fullPath);
        const resolvedBase = path.resolve(MISSION_CONTROL_DIR);
        
        if (!resolvedPath.startsWith(resolvedBase)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Check if file exists
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Set content type based on extension
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.md': 'text/markdown',
            '.json': 'application/json',
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        
        // Check if download is requested
        const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
        res.setHeader('Content-Disposition', `${disposition}; filename="${path.basename(filePath)}"`);
        
        // Stream the file
        const fileStream = fsSync.createReadStream(fullPath);
        fileStream.pipe(res);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
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

app.patch('/api/tasks/:id', async (req, res) => {
    try {
        // Read existing task
        let task;
        try {
            task = await readJsonFile(`tasks/${req.params.id}.json`);
        } catch (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Apply partial updates (only allowed fields)
        const allowedFields = ['status', 'assignee', 'priority', 'title', 'description'];
        const updates = req.body;
        const changes = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined && updates[field] !== task[field]) {
                changes.push(`${field}: ${task[field]} → ${updates[field]}`);
                task[field] = updates[field];
            }
        }

        // Update timestamp
        task.updated_at = new Date().toISOString();

        // Save updated task
        await writeJsonFile(`tasks/${task.id}.json`, task);

        // Log the change with details
        const actor = updates.updated_by || 'system';
        const changeDescription = changes.length > 0 
            ? `Task ${task.id}: ${changes.join(', ')}`
            : `Task ${task.id}: no changes`;
        await logActivity(actor, 'PATCHED', changeDescription);

        // Broadcast and trigger webhooks
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

// --- MESSAGES ---

app.get('/api/messages', async (req, res) => {
    try {
        const messages = await readJsonDirectory('messages');
        const agentFilter = req.query.agent;

        if (agentFilter) {
            const filtered = messages.filter(m => m.from === agentFilter || m.to === agentFilter);
            return res.json(filtered);
        }

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/messages/thread/:threadId', async (req, res) => {
    try {
        const messages = await readJsonDirectory('messages');
        const threadMessages = messages
            .filter(m => m.thread_id === req.params.threadId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        res.json(threadMessages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const message = req.body;

        // Generate ID if not provided
        if (!message.id) {
            message.id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        }

        // Set defaults
        message.timestamp = message.timestamp || new Date().toISOString();
        message.read = message.read !== undefined ? message.read : false;
        message.type = message.type || 'direct';

        await writeJsonFile(`messages/${message.id}.json`, message);
        await logActivity(message.from || 'system', 'MESSAGE', `To ${message.to}: ${message.content.substring(0, 80)}`);

        broadcast('message.created', message);
        triggerWebhooks('message.created', message);

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/messages/:id/read', async (req, res) => {
    try {
        const message = await readJsonFile(`messages/${req.params.id}.json`);
        message.read = true;

        await writeJsonFile(`messages/${message.id}.json`, message);

        broadcast('message.updated', message);

        res.json(message);
    } catch (error) {
        res.status(404).json({ error: 'Message not found' });
    }
});

// --- AGENT ATTENTION ---

app.get('/api/agents/:id/attention', async (req, res) => {
    try {
        const agentId = req.params.id;
        const tasks = await readJsonDirectory('tasks');
        const items = [];

        for (const task of tasks) {
            // Tasks assigned to this agent
            if (task.assignee === agentId) {
                items.push({
                    type: 'assigned_task',
                    task_id: task.id,
                    title: task.title,
                    status: task.status,
                    priority: task.priority,
                    timestamp: task.updated_at || task.created_at
                });
            }

            // Critical priority tasks assigned to this agent
            if (task.assignee === agentId && task.priority === 'critical') {
                items.push({
                    type: 'critical_task',
                    task_id: task.id,
                    title: task.title,
                    status: task.status,
                    priority: task.priority,
                    timestamp: task.updated_at || task.created_at
                });
            }

            // Blocked tasks created by this agent
            if (task.status === 'BLOCKED' && task.created_by === agentId) {
                items.push({
                    type: 'blocked_task',
                    task_id: task.id,
                    title: task.title,
                    status: task.status,
                    priority: task.priority,
                    timestamp: task.updated_at || task.created_at
                });
            }

            // @mentions in task comments
            if (task.comments && Array.isArray(task.comments)) {
                for (const comment of task.comments) {
                    if (comment.content && comment.content.includes(`@${agentId}`)) {
                        items.push({
                            type: 'mention',
                            task_id: task.id,
                            title: task.title,
                            comment_id: comment.id,
                            author: comment.author,
                            content: comment.content,
                            timestamp: comment.timestamp
                        });
                    }
                }
            }
        }

        // Sort by timestamp, newest first
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AGENT TIMELINE ---

app.get('/api/agents/:id/timeline', async (req, res) => {
    try {
        const agentId = req.params.id;
        const timeline = [];

        // Scan activity.log for entries matching this agent
        try {
            const logPath = path.join(MISSION_CONTROL_DIR, 'logs', 'activity.log');
            const content = await fs.readFile(logPath, 'utf-8');
            const lines = content.trim().split('\n');

            for (const line of lines) {
                if (line.includes(`[${agentId}]`)) {
                    // Parse log format: TIMESTAMP [ACTOR] ACTION: DESCRIPTION
                    const match = line.match(/^(\S+)\s+\[([^\]]+)\]\s+(\w+):\s+(.*)$/);
                    if (match) {
                        timeline.push({
                            type: 'log',
                            timestamp: match[1],
                            actor: match[2],
                            action: match[3],
                            description: match[4]
                        });
                    }
                }
            }
        } catch (e) {
            // Activity log may not exist yet
        }

        // Scan task comments authored by this agent
        try {
            const tasks = await readJsonDirectory('tasks');

            for (const task of tasks) {
                if (task.comments && Array.isArray(task.comments)) {
                    for (const comment of task.comments) {
                        if (comment.author === agentId) {
                            timeline.push({
                                type: 'comment',
                                timestamp: comment.timestamp,
                                task_id: task.id,
                                task_title: task.title,
                                comment_id: comment.id,
                                content: comment.content,
                                comment_type: comment.type
                            });
                        }
                    }
                }
            }
        } catch (e) {
            // Tasks directory may not exist yet
        }

        // Sort by timestamp, newest first
        timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Limit to 50 entries
        res.json(timeline.slice(0, 50));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// RESOURCE MANAGEMENT
// ============================================

// Initialize Resource Manager
const resourceManager = new ResourceManager(MISSION_CONTROL_DIR);

// Initialize Review Manager
const reviewManager = new ReviewManager(MISSION_CONTROL_DIR);

// Register Telegram bridge routes
telegramBridge.registerRoutes(app);

// --- CREDENTIALS VAULT ---

app.get('/api/credentials', async (req, res) => {
    try {
        const credentials = await resourceManager.listCredentials();
        res.json(credentials);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/credentials/:id', async (req, res) => {
    try {
        // Never expose credential values through API - security risk
        const credential = await resourceManager.getCredential(req.params.id, false);
        res.json(credential);
    } catch (error) {
        res.status(404).json({ error: 'Credential not found' });
    }
});

app.post('/api/credentials', async (req, res) => {
    try {
        const credential = await resourceManager.storeCredential(req.body);
        await logActivity(req.body.owner || 'system', 'CREATED', `Credential: ${credential.name} (${credential.id})`);
        broadcast('credential.created', credential);
        res.status(201).json(credential);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/credentials/:id', async (req, res) => {
    try {
        await resourceManager.deleteCredential(req.params.id);
        await logActivity('system', 'DELETED', `Credential: ${req.params.id}`);
        broadcast('credential.deleted', { id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RESOURCES ---

app.get('/api/resources', async (req, res) => {
    try {
        const resources = await resourceManager.listResources();
        res.json(resources);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// IMPORTANT: Specific routes must come BEFORE parameterized routes
app.get('/api/resources/metrics', async (req, res) => {
    try {
        const metrics = await resourceManager.getMetrics();
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/resources/:id', async (req, res) => {
    try {
        const resource = await resourceManager.getResource(req.params.id);
        res.json(resource);
    } catch (error) {
        res.status(404).json({ error: 'Resource not found' });
    }
});

app.post('/api/resources', async (req, res) => {
    try {
        const resource = await resourceManager.createResource(req.body);
        await logActivity(req.body.owner || 'system', 'CREATED', `Resource: ${resource.name} (${resource.id})`);
        broadcast('resource.created', resource);
        res.status(201).json(resource);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- BOOKINGS ---

app.get('/api/bookings', async (req, res) => {
    try {
        const filters = {
            resource_id: req.query.resource_id,
            agent_id: req.query.agent_id,
            status: req.query.status,
            from_date: req.query.from_date,
            to_date: req.query.to_date
        };
        const bookings = await resourceManager.listBookings(filters);
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        const booking = await resourceManager.bookResource(req.body);
        await logActivity(req.body.booked_by || 'system', 'BOOKED', `Resource: ${booking.resource_name} from ${booking.start_time} to ${booking.end_time}`);
        broadcast('booking.created', booking);
        res.status(201).json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const booking = await resourceManager.cancelBooking(req.params.id);
        await logActivity('system', 'CANCELLED', `Booking: ${booking.id}`);
        broadcast('booking.cancelled', booking);
        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- COSTS ---

app.get('/api/costs', async (req, res) => {
    try {
        const filters = {
            agent_id: req.query.agent_id,
            type: req.query.type,
            from_date: req.query.from_date,
            to_date: req.query.to_date
        };
        const summary = await resourceManager.getCostSummary(filters);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/costs', async (req, res) => {
    try {
        const cost = await resourceManager.recordCost(req.body);
        await logActivity(req.body.agent_id || 'system', 'COST_RECORDED', `${cost.type}: $${cost.amount} - ${cost.description}`);
        broadcast('cost.recorded', cost);
        res.status(201).json(cost);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- QUOTAS ---

app.get('/api/quotas', async (req, res) => {
    try {
        const agentId = req.query.agent_id || null;
        const quotas = await resourceManager.getQuotas(agentId);
        res.json(quotas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/quotas', async (req, res) => {
    try {
        const quota = await resourceManager.setQuota(req.body);
        await logActivity('system', 'QUOTA_SET', `${quota.type} quota for ${quota.agent_id || 'global'}: ${quota.limit}`);
        broadcast('quota.updated', quota);
        res.status(201).json(quota);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/quotas/:id/usage', async (req, res) => {
    try {
        const { usage } = req.body;
        const result = await resourceManager.updateQuotaUsage(req.params.id, usage);
        
        if (result.warning) {
            broadcast('quota.warning', result);
        }
        if (result.exceeded) {
            broadcast('quota.exceeded', result);
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/quotas/:id/reset', async (req, res) => {
    try {
        const quota = await resourceManager.resetQuota(req.params.id);
        await logActivity('system', 'QUOTA_RESET', `Reset quota: ${quota.id}`);
        broadcast('quota.reset', quota);
        res.json(quota);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/quotas/check', async (req, res) => {
    try {
        const { agent_id, type, amount } = req.query;
        const result = await resourceManager.checkQuota(agent_id, type, parseFloat(amount) || 1);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// QUALITY CONTROL & REVIEW SYSTEM
// ============================================

// --- REVIEWS ---

app.get('/api/reviews', async (req, res) => {
    try {
        const filters = {
            stage: req.query.stage,
            type: req.query.type,
            submitter: req.query.submitter,
            assignee: req.query.assignee
        };
        const reviews = await reviewManager.listReviews(filters);
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// IMPORTANT: Specific routes must come BEFORE parameterized routes
app.get('/api/reviews/metrics', async (req, res) => {
    try {
        const filters = {
            from_date: req.query.from_date,
            to_date: req.query.to_date,
            submitter: req.query.submitter
        };
        const metrics = await reviewManager.getMetrics(filters);
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reviews/summary', async (req, res) => {
    try {
        const summary = await reviewManager.getSummary();
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reviews/:id', async (req, res) => {
    try {
        const review = await reviewManager.getReview(req.params.id);
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }
        res.json(review);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const review = await reviewManager.createReview(req.body);
        await logActivity(req.body.submitter || 'system', 'REVIEW_CREATED', `${review.title} (${review.id})`);
        broadcast('review.created', review);
        res.status(201).json(review);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reviews/:id/submit', async (req, res) => {
    try {
        const { submitter } = req.body;
        const review = await reviewManager.submitForReview(req.params.id, submitter);
        await logActivity(review.submitter || 'system', 'REVIEW_SUBMITTED', `${review.title} (${review.id})`);
        broadcast('review.submitted', review);
        res.json(review);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/reviews/:id/approve', async (req, res) => {
    try {
        const { approver, comment } = req.body;
        const review = await reviewManager.approveReview(req.params.id, approver, comment);
        await logActivity(approver || 'system', 'REVIEW_APPROVED', `${review.title} (${review.id})`);
        broadcast('review.approved', review);
        res.json(review);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/reviews/:id/reject', async (req, res) => {
    try {
        const { rejector, reason } = req.body;
        const review = await reviewManager.rejectReview(req.params.id, rejector, reason);
        await logActivity(rejector || 'system', 'REVIEW_REJECTED', `${review.title}: ${reason}`);
        broadcast('review.rejected', review);
        res.json(review);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/reviews/:id/request-changes', async (req, res) => {
    try {
        const { reviewer, feedback } = req.body;
        const review = await reviewManager.requestChanges(req.params.id, reviewer, feedback);
        await logActivity(reviewer || 'system', 'CHANGES_REQUESTED', `${review.title}: ${feedback}`);
        broadcast('review.changes_requested', review);
        res.json(review);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/reviews/:id/deploy', async (req, res) => {
    try {
        const { deployer, notes } = req.body;
        const review = await reviewManager.markDeployed(req.params.id, deployer, notes);
        await logActivity(deployer || 'system', 'REVIEW_DEPLOYED', `${review.title} (${review.id})`);
        broadcast('review.deployed', review);
        res.json(review);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/reviews/:id/comments', async (req, res) => {
    try {
        const { author, content, type } = req.body;
        const review = await reviewManager.addComment(req.params.id, author, content, type);
        broadcast('review.comment_added', { review_id: req.params.id, comment: req.body });
        res.json(review);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CHECKLISTS ---

app.get('/api/checklists', async (req, res) => {
    try {
        const checklists = await reviewManager.listChecklists();
        res.json(checklists);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/checklists/:id', async (req, res) => {
    try {
        const checklist = await reviewManager.getChecklist(req.params.id);
        if (!checklist) {
            return res.status(404).json({ error: 'Checklist not found' });
        }
        res.json(checklist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/checklists', async (req, res) => {
    try {
        const checklist = await reviewManager.createChecklist(req.body);
        await logActivity(req.body.created_by || 'system', 'CHECKLIST_CREATED', checklist.name);
        broadcast('checklist.created', checklist);
        res.status(201).json(checklist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reviews/:id/checklist/:itemId/toggle', async (req, res) => {
    try {
        const { checked, checked_by } = req.body;
        const review = await reviewManager.updateChecklistItem(
            req.params.id,
            req.params.itemId,
            checked !== false,
            checked_by
        );
        broadcast('review.checklist_updated', review);
        res.json(review);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- WORKFLOWS ---

app.get('/api/workflows', async (req, res) => {
    try {
        const workflows = await reviewManager.listWorkflows();
        res.json(workflows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/workflows', async (req, res) => {
    try {
        const workflow = await reviewManager.createWorkflow(req.body);
        await logActivity(req.body.created_by || 'system', 'WORKFLOW_CREATED', workflow.name);
        broadcast('workflow.created', workflow);
        res.status(201).json(workflow);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SCHEDULES / OPENCLAW CRON SYNC ---

// Path to OpenClaw cron jobs
const OPENCLAW_CRON_FILE = process.env.OPENCLAW_CRON_FILE || 
    path.join(process.env.HOME || '/root', '.openclaw', 'cron', 'jobs.json');

/**
 * Read OpenClaw cron jobs
 */
async function readOpenClawCronJobs() {
    try {
        const content = await fs.readFile(OPENCLAW_CRON_FILE, 'utf-8');
        const data = JSON.parse(content);
        return data.jobs || [];
    } catch (error) {
        console.log('Could not read OpenClaw cron jobs:', error.message);
        return [];
    }
}

/**
 * Convert OpenClaw cron job format to Mission Control queue format
 */
function convertCronJobToQueueItem(cronJob) {
    return {
        id: `openclaw-cron-${cronJob.id || cronJob.name}`,
        name: cronJob.name || 'Unnamed Job',
        type: 'cron',
        schedule: cronJob.schedule || cronJob.cron,
        status: cronJob.enabled !== false ? 'scheduled' : 'disabled',
        agent: cronJob.agent || 'system',
        description: cronJob.description || `OpenClaw cron job`,
        config: cronJob.config || {},
        run_count: cronJob.runCount || 0,
        success_count: cronJob.successCount || 0,
        last_run: cronJob.lastRun || null,
        next_run: cronJob.nextRun || null,
        source: 'openclaw',
        created_at: cronJob.createdAt || new Date().toISOString(),
        created_by: cronJob.createdBy || 'system'
    };
}

// Get all scheduled jobs (local queue + OpenClaw cron)
app.get('/api/schedules', async (req, res) => {
    try {
        // Get local queue items
        const localQueue = await readJsonDirectory('queue');
        
        // Get OpenClaw cron jobs
        const cronJobs = await readOpenClawCronJobs();
        const convertedJobs = cronJobs.map(convertCronJobToQueueItem);
        
        // Combine and dedupe (local takes precedence)
        const localIds = new Set(localQueue.map(q => q.id));
        const combined = [
            ...localQueue,
            ...convertedJobs.filter(j => !localIds.has(j.id))
        ];
        
        // Sort by status (running first) then by next_run
        combined.sort((a, b) => {
            if (a.status === 'running' && b.status !== 'running') return -1;
            if (b.status === 'running' && a.status !== 'running') return 1;
            const aNext = a.next_run ? new Date(a.next_run) : new Date(0);
            const bNext = b.next_run ? new Date(b.next_run) : new Date(0);
            return aNext - bNext;
        });
        
        res.json(combined);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sync OpenClaw cron jobs to local queue
app.post('/api/schedules/sync', async (req, res) => {
    try {
        const cronJobs = await readOpenClawCronJobs();
        const synced = [];
        
        for (const job of cronJobs) {
            const queueItem = convertCronJobToQueueItem(job);
            const filePath = `queue/${queueItem.id}.json`;
            await writeJsonFile(filePath, queueItem);
            synced.push(queueItem);
        }
        
        await logActivity('system', 'CRON_SYNC', `Synced ${synced.length} jobs from OpenClaw`);
        broadcast('schedules.synced', { count: synced.length });
        
        res.json({ success: true, synced: synced.length, jobs: synced });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new scheduled job
app.post('/api/schedules', async (req, res) => {
    try {
        const job = {
            id: req.body.id || `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            name: req.body.name,
            type: req.body.type || 'cron',
            schedule: req.body.schedule,
            status: req.body.status || 'scheduled',
            agent: req.body.agent || 'system',
            description: req.body.description || '',
            config: req.body.config || {},
            run_count: 0,
            success_count: 0,
            last_run: null,
            next_run: req.body.next_run || null,
            created_at: new Date().toISOString(),
            created_by: req.body.created_by || 'system'
        };
        
        await writeJsonFile(`queue/${job.id}.json`, job);
        await logActivity(job.created_by, 'SCHEDULE_CREATED', `Job: ${job.name}`);
        broadcast('schedule.created', job);
        
        res.status(201).json(job);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a scheduled job
app.put('/api/schedules/:id', async (req, res) => {
    try {
        const job = await readJsonFile(`queue/${req.params.id}.json`);
        
        const allowedFields = ['name', 'schedule', 'status', 'agent', 'description', 'config'];
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                job[field] = req.body[field];
            }
        }
        job.updated_at = new Date().toISOString();
        
        await writeJsonFile(`queue/${job.id}.json`, job);
        await logActivity('system', 'SCHEDULE_UPDATED', `Job: ${job.name}`);
        broadcast('schedule.updated', job);
        
        res.json(job);
    } catch (error) {
        res.status(404).json({ error: 'Schedule not found' });
    }
});

// Delete a scheduled job
app.delete('/api/schedules/:id', async (req, res) => {
    try {
        await deleteJsonFile(`queue/${req.params.id}.json`);
        await logActivity('system', 'SCHEDULE_DELETED', `Job: ${req.params.id}`);
        broadcast('schedule.deleted', { id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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

// ============================================
// Serve dashboard static files (MUST be before catch-all route)
app.use(express.static(DASHBOARD_DIR));

// Fallback to dashboard for SPA routing (MUST be last)
app.get('*', (req, res) => {
    res.sendFile(path.join(DASHBOARD_DIR, 'index.html'));
});

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
