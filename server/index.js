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
const claudeSessions = require('./claude-sessions');
const cliConnections = require('./cli-connections');

// Input sanitization helper
function sanitizeInput(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/[<>"'`\\$;|&]/g, '');
}

// Configuration
const PORT = process.env.PORT || 3000;
const MISSION_CONTROL_DIR = path.join(__dirname, '..', '.mission-control');
const DASHBOARD_DIR = path.join(__dirname, '..', 'dashboard');

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Security middleware: sanitize named route parameters
// app.param() runs *after* route matching so req.params is populated — unlike app.use() which is a no-op here
['id', 'taskId', 'agentId', 'humanId', 'threadId', 'index', 'itemId', 'type'].forEach(name => {
    app.param(name, (req, res, next, value) => {
        req.params[name] = String(value).replace(/[^a-zA-Z0-9\-_\.@]/g, '').slice(0, 256);
        next();
    });
});
// Note: :path(*) wildcard is NOT sanitized here — it is validated with isPathSafe() + path.resolve() in the route handler

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

// Webhook subscriptions
const webhooks = new Map();

// ============================================
// SECURITY UTILITIES
// ============================================

/**
 * Sanitize an ID parameter to prevent path traversal attacks
 * Only allows alphanumeric, hyphens, underscores, and dots
 */
function sanitizeId(id) {
    if (!id || typeof id !== 'string') return '';
    // Remove any path traversal attempts and dangerous characters
    return id.replace(/[^a-zA-Z0-9\-_\.]/g, '').slice(0, 256);
}

/**
 * Sanitize a string for safe logging (prevent log injection)
 */
function sanitizeForLog(str) {
    if (!str || typeof str !== 'string') return '';
    // Remove newlines and control characters that could inject fake log entries
    return str.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 500);
}

/**
 * Validate that a path stays within the allowed directory
 */
function isPathSafe(filePath, baseDir) {
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(baseDir);
    return resolvedPath.startsWith(resolvedBase + path.sep) || resolvedPath === resolvedBase;
}

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
    if (!isPathSafe(fullPath, MISSION_CONTROL_DIR)) {
        throw new Error('Path traversal attempt blocked');
    }
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
}

/**
 * Write a JSON file
 */
async function writeJsonFile(filePath, data) {
    const fullPath = path.join(MISSION_CONTROL_DIR, filePath);
    if (!isPathSafe(fullPath, MISSION_CONTROL_DIR)) {
        throw new Error('Path traversal attempt blocked');
    }

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
    if (!isPathSafe(fullPath, MISSION_CONTROL_DIR)) {
        throw new Error('Path traversal attempt blocked');
    }
    await fs.unlink(fullPath);
}

/**
 * Append to activity log
 */
async function logActivity(actor, action, description) {
    const timestamp = new Date().toISOString();
    // Sanitize inputs to prevent log injection
    const safeActor = sanitizeForLog(actor);
    const safeAction = sanitizeForLog(action);
    const safeDescription = sanitizeForLog(description);
    
    const logEntry = `${timestamp} [${safeActor}] ${safeAction}: ${safeDescription}\n`;
    const logPath = path.join(MISSION_CONTROL_DIR, 'logs', 'activity.log');

    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, logEntry);

    // Broadcast log event
    broadcast('log', { timestamp, actor: safeActor, action: safeAction, description: safeDescription });
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
        // SAFE: req.params.id sanitized by app.param middleware (line 39-45)
        // SAFE: readJsonFile() validates path with isPathSafe() (line 127-129)
        const id = sanitizeId(req.params.id);
        const task = await readJsonFile(`tasks/${id}.json`);
        res.json(task);
    } catch (error) {
        res.status(404).json({ error: 'Task not found' });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const task = req.body;

        // Sanitize user-supplied ID before using in file path (HIGH-1: path traversal)
        if (task.id) task.id = sanitizeId(task.id);

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
        const dir = sanitizeInput(req.query.dir) || 'reports';
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
            res.json({ directory: sanitizeInput(req.query.dir) || 'reports', files: [] });
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
        const id = sanitizeId(req.params.id);
        let task;
        try {
            // SAFE: req.params.id sanitized by app.param middleware
            // SAFE: readJsonFile() validates path with isPathSafe()
            task = await readJsonFile(`tasks/${id}.json`);
        } catch (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Apply partial updates (only allowed fields)
        const allowedFields = ['status', 'assignee', 'priority', 'title', 'description', 'labels', 'subtasks', 'deliverables'];
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
        // SAFE: req.params.id sanitized by app.param middleware
        // SAFE: deleteJsonFile() validates path with isPathSafe()
        const id = sanitizeId(req.params.id);
        await deleteJsonFile(`tasks/${id}.json`);
        await logActivity('system', 'DELETED', `Task: ${sanitizeForLog(id)}`);

        broadcast('task.deleted', { id });
        triggerWebhooks('task.deleted', { id });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- TASK COMMENTS (CLI support) ---

app.post('/api/tasks/:id/comments', async (req, res) => {
    try {
        const id = sanitizeId(req.params.id);
        let task;
        try {
            // SAFE: req.params.id sanitized by app.param middleware
            // SAFE: readJsonFile() validates path with isPathSafe()
            task = await readJsonFile(`tasks/${id}.json`);
        } catch (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const { content, author, type } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Comment content required' });
        }

        const comment = {
            id: `comment-${Date.now()}`,
            author: author || req.headers['x-agent-id'] || 'system',
            content: content,
            timestamp: new Date().toISOString(),
            type: type || 'comment'
        };

        task.comments = task.comments || [];
        task.comments.push(comment);
        task.updated_at = new Date().toISOString();

        await writeJsonFile(`tasks/${task.id}.json`, task);
        await logActivity(comment.author, 'COMMENT', `Task ${task.id}: ${content.substring(0, 50)}`);

        broadcast('task.updated', task);
        triggerWebhooks('task.comment', { task_id: task.id, comment });

        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- TASK SUBTASKS (CLI support) ---

app.post('/api/tasks/:id/subtasks', async (req, res) => {
    try {
        const id = sanitizeId(req.params.id);
        let task;
        try {
            // SAFE: req.params.id sanitized by app.param middleware
            // SAFE: readJsonFile() validates path with isPathSafe()
            task = await readJsonFile(`tasks/${id}.json`);
        } catch (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Subtask text required' });
        }

        const subtask = {
            text: text,
            done: false,
            added_at: new Date().toISOString(),
            added_by: req.headers['x-agent-id'] || 'system'
        };

        task.subtasks = task.subtasks || [];
        task.subtasks.push(subtask);
        task.updated_at = new Date().toISOString();

        await writeJsonFile(`tasks/${task.id}.json`, task);
        await logActivity(subtask.added_by, 'SUBTASK', `Added to ${task.id}: ${text}`);

        broadcast('task.updated', task);
        triggerWebhooks('task.subtask', { task_id: task.id, subtask, index: task.subtasks.length - 1 });

        res.status(201).json({ subtask, index: task.subtasks.length - 1 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/tasks/:id/subtasks/:index', async (req, res) => {
    try {
        const id = sanitizeId(req.params.id);
        let task;
        try {
            // SAFE: req.params.id sanitized by app.param middleware
            // SAFE: readJsonFile() validates path with isPathSafe()
            task = await readJsonFile(`tasks/${id}.json`);
        } catch (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const index = parseInt(req.params.index, 10);
        if (!task.subtasks || index < 0 || index >= task.subtasks.length) {
            return res.status(404).json({ error: 'Subtask not found' });
        }

        // Toggle done status
        task.subtasks[index].done = !task.subtasks[index].done;
        task.subtasks[index].toggled_at = new Date().toISOString();
        task.subtasks[index].toggled_by = req.headers['x-agent-id'] || 'system';
        task.updated_at = new Date().toISOString();

        await writeJsonFile(`tasks/${task.id}.json`, task);

        const status = task.subtasks[index].done ? 'completed' : 'uncompleted';
        await logActivity(task.subtasks[index].toggled_by, 'SUBTASK', `${status} in ${task.id}: ${task.subtasks[index].text}`);

        broadcast('task.updated', task);

        res.json(task.subtasks[index]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- TASK DELIVERABLES (CLI support) ---

app.post('/api/tasks/:id/deliverables', async (req, res) => {
    try {
        const id = sanitizeId(req.params.id);
        let task;
        try {
            // SAFE: req.params.id sanitized by app.param middleware
            // SAFE: readJsonFile() validates path with isPathSafe()
            task = await readJsonFile(`tasks/${id}.json`);
        } catch (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const { name, url, path: filePath, type } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Deliverable name required' });
        }
        if (!url && !filePath) {
            return res.status(400).json({ error: 'Deliverable must have url or path' });
        }

        const deliverable = {
            id: `del-${Date.now()}`,
            name: name,
            url: url || null,
            path: filePath || null,
            type: type || (url ? 'url' : 'file'),
            added_at: new Date().toISOString(),
            added_by: req.headers['x-agent-id'] || 'system'
        };

        task.deliverables = task.deliverables || [];
        task.deliverables.push(deliverable);
        task.updated_at = new Date().toISOString();

        await writeJsonFile(`tasks/${task.id}.json`, task);
        await logActivity(deliverable.added_by, 'DELIVER', `Added to ${task.id}: ${name}`);

        broadcast('task.updated', task);
        triggerWebhooks('task.deliverable', { task_id: task.id, deliverable });

        res.status(201).json(deliverable);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ACTIVITY FEED (CLI support) ---

app.get('/api/activity', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const logPath = path.join(MISSION_CONTROL_DIR, 'logs', 'activity.log');
        
        let entries = [];
        try {
            const content = await fs.readFile(logPath, 'utf-8');
            const lines = content.trim().split('\n').filter(l => l);
            entries = lines.slice(-limit).reverse(); // Most recent first
        } catch (e) {
            // No log file yet
        }

        // Also get recent task updates for richer activity
        const tasks = await readJsonDirectory('tasks');
        const recentTasks = tasks
            .filter(t => t.updated_at)
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(0, 10);

        res.json({ 
            entries,
            recent_tasks: recentTasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                assignee: t.assignee,
                updated_at: t.updated_at
            }))
        });
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
        // SAFE: req.params.id sanitized by app.param middleware
        // SAFE: readJsonFile() validates path with isPathSafe()
        const id = sanitizeId(req.params.id);
        const agent = await readJsonFile(`agents/${id}.json`);
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


// POST /api/agents/:id/context — agent self-reports context window usage
// Called from agent heartbeat: POST { used, total, model }
app.post('/api/agents/:id/context', async (req, res) => {
    try {
        const { used, total, model } = req.body;
        const agentId = req.params.id;
        const agentFile = `agents/${agentId}.json`;

        // Load existing agent or start fresh
        let agent = {};
        try { agent = await readJsonFile(agentFile); } catch (e) {}

        agent.id = agentId;
        agent.context = {
            used:       used  || 0,
            total:      total || 200000,
            pct:        total ? Math.round((used / total) * 100) : 0,
            model:      model || agent.model || 'unknown',
            updated_at: new Date().toISOString(),
        };
        agent.last_active = new Date().toISOString();

        await writeJsonFile(agentFile, agent);
        broadcast('agent.updated', agent);
        triggerWebhooks('agent.updated', agent);

        res.json({ ok: true, context: agent.context });
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

/**
 * Validates a webhook URL against SSRF attack vectors.
 * Blocks: private IPs, localhost, APIPA, AWS/cloud metadata, non-HTTP(S) schemes.
 * @param {string} urlString
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateWebhookUrl(urlString) {
    let parsed;
    try {
        parsed = new URL(urlString);
    } catch {
        return { valid: false, reason: 'Invalid URL format' };
    }

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: `Protocol '${parsed.protocol}' is not allowed. Use http or https.` };
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Block localhost variants
    const blocked = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '0000:0000:0000:0000:0000:0000:0000:0001'];
    if (blocked.includes(hostname)) {
        return { valid: false, reason: 'Localhost addresses are not allowed' };
    }

    // Block AWS EC2 and GCP metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
        return { valid: false, reason: 'Cloud metadata endpoints are not allowed' };
    }

    // Block private and reserved IPv4 ranges
    const privateRanges = [
        /^127\./, // loopback
        /^10\./, // RFC1918
        /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918
        /^192\.168\./, // RFC1918
        /^169\.254\./, // APIPA / link-local
        /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT RFC6598
        /^192\.0\.2\./, // TEST-NET-1
        /^198\.51\.100\./, // TEST-NET-2
        /^203\.0\.113\./, // TEST-NET-3
    ];
    for (const pattern of privateRanges) {
        if (pattern.test(hostname)) {
            return { valid: false, reason: 'Private or reserved IP ranges are not allowed' };
        }
    }

    // Block private IPv6 ranges
    if (
        hostname === '::1' ||
        hostname.startsWith('fc') ||
        hostname.startsWith('fd') ||
        hostname.startsWith('fe80') ||
        hostname.startsWith('::ffff:')
    ) {
        return { valid: false, reason: 'Private or link-local IPv6 addresses are not allowed' };
    }

    return { valid: true };
}

app.post('/api/webhooks', (req, res) => {
    const { id, url, events } = req.body;

    if (!id || !url || !events) {
        return res.status(400).json({ error: 'Missing required fields: id, url, events' });
    }

    const urlCheck = validateWebhookUrl(url);
    if (!urlCheck.valid) {
        return res.status(400).json({ error: `Invalid webhook URL: ${urlCheck.reason}` });
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
        const agentFilter = sanitizeInput(req.query.agent);

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

        // Sanitize user-supplied ID before using in file path (HIGH-1: path traversal)
        if (message.id) message.id = sanitizeId(message.id);

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
        // SAFE: req.params.id sanitized by app.param middleware
        // SAFE: readJsonFile() validates path with isPathSafe()
        const id = sanitizeId(req.params.id);
        const message = await readJsonFile(`messages/${id}.json`);
        message.read = true;

        // SAFE: message.id comes from trusted file, writeJsonFile() validates path
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
        await logActivity(sanitizeInput(req.body.owner) || 'system', 'CREATED', `Credential: ${credential.name} (${credential.id})`);
        broadcast('credential.created', credential);
        res.status(201).json(credential);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/credentials/:id', async (req, res) => {
    try {
        const id = sanitizeId(req.params.id);
        await resourceManager.deleteCredential(id);
        await logActivity('system', 'DELETED', `Credential: ${sanitizeForLog(id)}`);
        broadcast('credential.deleted', { id });
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
        await logActivity(sanitizeInput(req.body.owner) || 'system', 'CREATED', `Resource: ${resource.name} (${resource.id})`);
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
        await logActivity(sanitizeInput(req.body.booked_by) || 'system', 'BOOKED', `Resource: ${booking.resource_name} from ${booking.start_time} to ${booking.end_time}`);
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
        await logActivity(sanitizeInput(req.body.agent_id) || 'system', 'COST_RECORDED', `${cost.type}: $${cost.amount} - ${cost.description}`);
        broadcast('cost.recorded', cost);
        res.status(201).json(cost);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- QUOTAS ---

app.get('/api/quotas', async (req, res) => {
    try {
        const agentId = sanitizeInput(req.query.agent_id) || null;
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
        await logActivity(sanitizeInput(req.body.submitter) || 'system', 'REVIEW_CREATED', `${review.title} (${review.id})`);
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
        await logActivity(sanitizeInput(req.body.created_by) || 'system', 'CHECKLIST_CREATED', checklist.name);
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
        await logActivity(sanitizeInput(req.body.created_by) || 'system', 'WORKFLOW_CREATED', workflow.name);
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
            id: req.body.id ? sanitizeId(req.body.id) : `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            name: sanitizeInput(req.body.name),
            type: sanitizeInput(req.body.type) || 'cron',
            schedule: req.body.schedule,
            status: req.body.status || 'scheduled',
            agent: sanitizeInput(req.body.agent) || 'system',
            description: sanitizeInput(req.body.description) || '',
            config: req.body.config || {},
            run_count: 0,
            success_count: 0,
            last_run: null,
            next_run: req.body.next_run || null,
            created_at: new Date().toISOString(),
            created_by: sanitizeInput(req.body.created_by) || 'system'
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
        // SAFE: req.params.id sanitized by app.param middleware
        // SAFE: readJsonFile() validates path with isPathSafe()
        const id = sanitizeId(req.params.id);
        const job = await readJsonFile(`queue/${id}.json`);
        
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
        // SAFE: req.params.id sanitized by app.param middleware
        // SAFE: deleteJsonFile() validates path with isPathSafe()
        const id = sanitizeId(req.params.id);
        await deleteJsonFile(`queue/${id}.json`);
        await logActivity('system', 'SCHEDULE_DELETED', `Job: ${sanitizeForLog(id)}`);
        broadcast('schedule.deleted', { id });
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
// Claude Code Session Routes (v1.2.0)
// ============================================

/**
 * GET /api/claude/sessions
 * List all discovered Claude Code sessions.
 * Query params:
 *   ?active=1   — only return active sessions (last message < 30min ago)
 *   ?project=   — filter by project path substring
 *   ?scan=1     — force an immediate rescan before responding
 */
app.get('/api/claude/sessions', async (req, res) => {
    try {
        if (req.query.scan === '1') {
            await claudeSessions.scanSessions();
        }
        const { sessions, lastScan, claudeHome, projectsDir } = claudeSessions.getCachedSessions();

        let filtered = sessions;

        if (req.query.active === '1') {
            filtered = filtered.filter(s => s.active);
        }

        if (req.query.project) {
            const q = req.query.project.toLowerCase();
            filtered = filtered.filter(s => s.project && s.project.toLowerCase().includes(q));
        }

        res.json({
            sessions: filtered,
            total: filtered.length,
            totalAll: sessions.length,
            activeCount: sessions.filter(s => s.active).length,
            lastScan,
            claudeHome,
            projectsDir,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/claude/sessions
 * Trigger a manual rescan of Claude Code sessions.
 */
app.post('/api/claude/sessions', async (req, res) => {
    try {
        const sessions = await claudeSessions.scanSessions();
        res.json({
            ok: true,
            message: 'Scan complete',
            total: sessions.length,
            activeCount: sessions.filter(s => s.active).length,
            lastScan: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// CLI INTEGRATION (v1.3.0)
// ============================================

const { execFile } = require('child_process');

// Whitelist of safe commands that can be triggered from the dashboard
const CLI_COMMAND_WHITELIST = {
    'openclaw:status':         { cmd: 'openclaw', args: ['status'] },
    'openclaw:gateway:status': { cmd: 'openclaw', args: ['gateway', 'status'] },
    'openclaw:gateway:start':  { cmd: 'openclaw', args: ['gateway', 'start'] },
    'openclaw:gateway:stop':   { cmd: 'openclaw', args: ['gateway', 'stop'] },
    'system:uptime':           { cmd: 'uptime',   args: [] },
    'system:df':               { cmd: 'df',       args: ['-h', '--output=source,size,used,avail,pcent,target', '-x', 'tmpfs', '-x', 'devtmpfs'] },
    'system:free':             { cmd: 'free',     args: ['-h'] },
    'node:version':            { cmd: 'node',     args: ['--version'] },
    'jarvis:version':          { cmd: 'node',     args: [path.join(__dirname, '..', 'scripts', 'jarvis.js'), '--version'] },
};

app.get('/api/cli/commands', (req, res) => {
    const commands = Object.keys(CLI_COMMAND_WHITELIST).map(key => ({
        id: key,
        label: key.replace(/:/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    }));
    res.json({ commands });
});

app.post('/api/cli/run', (req, res) => {
    const { command } = req.body || {};
    if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: 'command is required' });
    }
    const entry = CLI_COMMAND_WHITELIST[command];
    if (!entry) {
        return res.status(403).json({ error: `Command not whitelisted: ${command}` });
    }
    const startTime = Date.now();
    execFile(entry.cmd, entry.args, { timeout: 15000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
        const elapsed = Date.now() - startTime;
        res.json({
            command,
            exitCode: err ? (err.code || 1) : 0,
            stdout: stdout || '',
            stderr: stderr || '',
            elapsed,
            timestamp: new Date().toISOString(),
        });
    });
});

// ============================================
// CLI CONNECTIONS API (v1.3.0)
// ============================================

/**
 * POST /api/connect
 * Register a CLI tool and get back a connection ID.
 * Body: { name, version, cwd, token? }
 */
app.post('/api/connect', (req, res) => {
    const { name, version, cwd, token } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const conn = cliConnections.registerConnection({ name, version, cwd, token });
    res.status(201).json({
        ok: true,
        id: conn.id,
        message: `Registered ${conn.name} v${conn.version}`,
        connectedAt: conn.connectedAt,
    });
});

/**
 * GET /api/connect
 * List all CLI connections (active = last heartbeat < 5min).
 */
app.get('/api/connect', (req, res) => {
    const list = cliConnections.listConnections();
    res.json({
        connections: list,
        total: list.length,
        activeCount: cliConnections.getActiveCount(),
    });
});

/**
 * DELETE /api/connect
 * Disconnect/unregister a CLI session.
 * Body: { id }
 */
app.delete('/api/connect', (req, res) => {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const removed = cliConnections.disconnect(String(id).replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 64));
    if (!removed) return res.status(404).json({ error: 'Connection not found' });
    res.json({ ok: true, message: 'Disconnected' });
});

/**
 * POST /api/connect/:id/heartbeat
 * CLI sends heartbeat + optional token usage.
 * Body: { inputTokens?, outputTokens?, model? }
 */
app.post('/api/connect/:id/heartbeat', (req, res) => {
    const id = req.params.id;
    const { inputTokens, outputTokens, model } = req.body || {};
    const conn = cliConnections.heartbeat(id, { inputTokens, outputTokens, model });
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    res.json({ ok: true, lastHeartbeat: conn.lastHeartbeat });
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
    // Load .missiondeck env file if present and not already set
    const missionDeckEnvFile = path.join(__dirname, '..', '.missiondeck');
    if (!process.env.MISSIONDECK_API_KEY && require('fs').existsSync(missionDeckEnvFile)) {
        require('fs').readFileSync(missionDeckEnvFile, 'utf8')
            .split('\n')
            .filter(l => l && !l.startsWith('#'))
            .forEach(l => {
                const [k, ...v] = l.split('=');
                if (k && v.length) process.env[k.trim()] = v.join('=').trim();
            });
    }

    // Start MissionDeck sync if configured
    if (process.env.MISSIONDECK_API_KEY) {
        const { startMissionDeckSync, startCloudPull } = require('./missiondeck-sync');
        startMissionDeckSync({
            missionControlDir: MISSION_CONTROL_DIR,
            apiKey: process.env.MISSIONDECK_API_KEY,
            clientVersion: '1.0.1',
        });
        // Pull cloud-created tasks back to local so agents get Telegram notifications
        if (process.env.MISSIONDECK_SLUG) {
            startCloudPull({
                missionControlDir: MISSION_CONTROL_DIR,
                apiKey: process.env.MISSIONDECK_API_KEY,
                slug: process.env.MISSIONDECK_SLUG,
                intervalMs: 30000,
            });
        }
    }

    // Start Claude Code session scanner
    claudeSessions.startScanner();

    const mdLine = process.env.MISSIONDECK_API_KEY
        ? `║   MissionDeck:  https://missiondeck.ai/workspace/${process.env.MISSIONDECK_SLUG || '???'}    ║`
        : '║   MissionDeck:  Not connected (run scripts/connect-missiondeck.sh)  ║';

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
${mdLine}
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});
