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

const cookieParser = require('cookie-parser');
const Tokens = require('csrf');

const rateLimit = require('express-rate-limit');
const logger = require('./logger');
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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// =====================================
// CSRF PROTECTION (v1.6.0)
// =====================================

const csrfTokens = new Tokens();

// CSRF cookie name
const CSRF_SECRET_COOKIE = 'mc-csrf-secret';

/**
 * GET /api/csrf-token
 * Returns a CSRF token for use in X-CSRF-Token header.
 * Generates a per-session secret stored in an HttpOnly cookie.
 */
// (route registered below with other routes)

/**
 * CSRF validation middleware for state-changing routes (POST/PUT/DELETE/PATCH).
 *
 * Skip strategy:
 *   1. GET/HEAD/OPTIONS — always safe, skip
 *   2. No CSRF cookie present → API client (not a browser session), skip
 *      (CSRF attacks require cookies; if no cookie, there's no forging risk)
 *   3. CSRF cookie present → must have a valid X-CSRF-Token header
 *
 * This keeps CLI tool calls (POST /api/connect, etc.) working without tokens
 * while protecting browser-initiated mutations.
 */
function csrfProtection(req, res, next) {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) return next();

    // If there's no secret cookie, this is an API-to-API request — skip CSRF
    const secret = req.cookies && req.cookies[CSRF_SECRET_COOKIE];
    if (!secret) return next();

    // Browser request: validate the token
    const token = req.headers['x-csrf-token'] || (req.body && req.body._csrf);
    if (!token) {
        return res.status(403).json({ error: 'CSRF token missing', code: 'CSRF_MISSING' });
    }
    if (!csrfTokens.verify(secret, token)) {
        return res.status(403).json({ error: 'CSRF token invalid', code: 'CSRF_INVALID' });
    }
    next();
}

app.use(csrfProtection);

// =====================================
// RATE LIMITING (v1.7.0)
// =====================================

/**
 * General API rate limiter: 100 requests per minute per IP.
 * Applied to all /api/* routes.
 */
const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: 'draft-7', // Retry-After + RateLimit-* headers (RFC standard)
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
    handler: (req, res, next, options) => {
        res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
        res.status(429).json(options.message);
    },
    skip: (req) => {
        // Skip rate limiting for WebSocket upgrade requests
        return req.headers.upgrade === 'websocket';
    },
});

/**
 * Strict rate limiter: 10 requests per minute per IP.
 * Applied to auth-sensitive routes.
 */
const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests on this endpoint, please try again later.', code: 'RATE_LIMIT_STRICT' },
    handler: (req, res, next, options) => {
        res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
        res.status(429).json(options.message);
    },
});

// Apply general limiter to all /api/* routes
app.use('/api', generalLimiter);

// Apply strict limiter to credential and auth-sensitive routes
app.use('/api/credentials', strictLimiter);
app.use('/api/github/config', strictLimiter);

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

// =====================================
// SECURITY UTILITIES
// =====================================

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

// =====================================
// UTILITY FUNCTIONS
// =====================================

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
                    logger.error({ file, err: e.message }, 'Error reading data file');
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

// =====================================
// WEBSOCKET - Real-time Updates
// =====================================

const wsClients = new Set();

wss.on('connection', (ws) => {
    wsClients.add(ws);
    logger.info({ event: 'ws_connect' }, 'WebSocket client connected. Total:', wsClients.size);

    ws.on('close', () => {
        wsClients.delete(ws);
        logger.info({ event: 'ws_disconnect' }, 'WebSocket client disconnected. Total:', wsClients.size);
    });

    ws.on('error', (error) => {
        logger.error({ err: error }, 'WebSocket error');
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

// =====================================
// WEBHOOKS - Agent Notifications
// =====================================

/**
 * Register a webhook
 */
function registerWebhook(id, url, events) {
    const existing = webhooks.get(id) || {};
    webhooks.set(id, {
        url,
        events,
        registered_at: existing.registered_at || new Date().toISOString(),
        // Circuit breaker state (preserve if re-registering)
        failures: existing.failures || 0,
        circuitState: existing.circuitState || 'closed',
        circuitOpenedAt: existing.circuitOpenedAt || null,
    });
    logger.info({ event: 'webhook_register' }, `Webhook registered: ${id} -> ${url} for events: ${events.join(', ')}`);
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fire a single webhook HTTP request (no retry logic).
 * Returns true on success (2xx), throws on failure.
 */
async function fireWebhook(webhook, event, data) {
    const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data, timestamp: new Date().toISOString() })
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return true;
}

/**
 * Trigger webhooks for an event — with retry (exponential backoff) and circuit breaker.
 *
 * Circuit breaker states:
 *  - closed   → normal; failures < 5
 *  - open     → paused for 60s after 5 consecutive failures
 *  - half-open → after 60s, allow ONE test request; success → closed, fail → open again
 */
async function triggerWebhooks(event, data) {
    const CIRCUIT_OPEN_TIMEOUT_MS = 60 * 1000; // 60s
    const MAX_CONSECUTIVE_FAILURES = 5;
    const RETRY_DELAYS_MS = [1000, 2000, 4000]; // 3 retries with exponential backoff

    for (const [id, webhook] of webhooks) {
        if (!webhook.events.includes(event) && !webhook.events.includes('*')) continue;

        const now = Date.now();

        // ----- Circuit Breaker: check state -----
        if (webhook.circuitState === 'open') {
            const elapsed = now - (webhook.circuitOpenedAt || 0);
            if (elapsed < CIRCUIT_OPEN_TIMEOUT_MS) {
                logger.warn({ event: 'webhook_circuit_open', webhookId: id }, `Webhook ${id} circuit OPEN — skipping`);
                continue;
            }
            // Transition to half-open: allow one probe request
            webhook.circuitState = 'half-open';
            logger.info({ event: 'webhook_circuit_halfopen', webhookId: id }, `Webhook ${id} circuit HALF-OPEN — probing`);
        }

        const isHalfOpen = webhook.circuitState === 'half-open';
        let success = false;
        let lastError = null;

        // ----- Retry loop (max 3 retries; half-open only gets 1 try) -----
        const attempts = isHalfOpen ? 1 : RETRY_DELAYS_MS.length + 1;

        for (let attempt = 0; attempt < attempts; attempt++) {
            if (attempt > 0) {
                const delay = RETRY_DELAYS_MS[attempt - 1];
                logger.warn({ event: 'webhook_retry', webhookId: id, attempt }, `Webhook ${id} retry #${attempt} after ${delay}ms`);
                await sleep(delay);
            }
            try {
                await fireWebhook(webhook, event, data);
                success = true;
                logger.info({ event: 'webhook_trigger', webhookId: id, attempt }, `Webhook ${id} triggered for ${event} (attempt ${attempt + 1})`);
                break;
            } catch (err) {
                lastError = err;
                logger.warn({ event: 'webhook_attempt_failed', webhookId: id, attempt, err: err.message }, `Webhook ${id} attempt ${attempt + 1} failed`);
            }
        }

        // ----- Update circuit breaker state -----
        if (success) {
            webhook.failures = 0;
            webhook.successCount = (webhook.successCount || 0) + 1;
            webhook.lastDelivery = new Date().toISOString();
            webhook.circuitState = 'closed';
            webhook.circuitOpenedAt = null;
        } else {
            webhook.failures = (webhook.failures || 0) + 1;
            logger.error({ event: 'webhook_error', webhookId: id, failures: webhook.failures, err: lastError && lastError.message }, `Webhook ${id} failed after retries`);

            if (isHalfOpen || webhook.failures >= MAX_CONSECUTIVE_FAILURES) {
                webhook.circuitState = 'open';
                webhook.circuitOpenedAt = now;
                logger.error({ event: 'webhook_circuit_opened', webhookId: id }, `Webhook ${id} circuit OPENED after ${webhook.failures} failures`);
                broadcast('webhook.circuit_opened', { id, failures: webhook.failures });
            }
        }
    }
}

// =====================================
// FILE WATCHER - Detect External Changes
// =====================================

const watcher = chokidar.watch(MISSION_CONTROL_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
});

watcher
    .on('add', (filePath) => {
        logger.debug({ event: 'file_add' }, `File added: ${filePath}`);
        handleFileChange('created', filePath);
    })
    .on('change', (filePath) => {
        logger.debug({ event: 'file_change' }, `File changed: ${filePath}`);
        handleFileChange('updated', filePath);
    })
    .on('unlink', (filePath) => {
        logger.debug({ event: 'file_delete' }, `File deleted: ${filePath}`);
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

// =====================================
// REST API ROUTES
// =====================================

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
        const allowedFields = ['status', 'assignee', 'priority', 'title', 'description', 'labels', 'subtasks', 'deliverables', 'review_required'];
        const updates = req.body;
        const changes = [];

        // Quality Review Gate (v1.12.0):
        // Block moving to DONE if review_required is true and a pending review exists
        if (updates.status === 'DONE' && task.review_required === true) {
            const pendingReview = (task.reviews || []).find(r => r.status === 'pending');
            if (pendingReview) {
                return res.status(400).json({
                    error: 'Review required before completion',
                    code: 'REVIEW_REQUIRED',
                    review_id: pendingReview.id,
                });
            }
        }

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

// --- TASK QUALITY REVIEW GATES (v1.12.0) ---

/**
 * POST /api/tasks/:id/request-review
 * Flag a task as needing review. Creates a pending review entry.
 * Body: { reviewer?, notes? }
 */
app.post('/api/tasks/:id/request-review', async (req, res) => {
    try {
        const id = sanitizeId(req.params.id);
        let task;
        try {
            task = await readJsonFile(`tasks/${id}.json`);
        } catch (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const { reviewer, notes } = req.body;

        const reviewEntry = {
            id: `review-${Date.now()}`,
            status: 'pending',
            requested_at: new Date().toISOString(),
            requested_by: req.headers['x-agent-id'] || 'system',
            reviewer: reviewer || null,
            notes: notes || null,
            result: null,
            result_at: null,
            result_by: null,
            result_notes: null,
        };

        task.review_required = true;
        task.reviews = task.reviews || [];
        task.reviews.push(reviewEntry);
        task.updated_at = new Date().toISOString();

        await writeJsonFile(`tasks/${task.id}.json`, task);
        await logActivity(reviewEntry.requested_by, 'REVIEW_REQUESTED', `Task ${task.id}: review requested`);

        broadcast('task.updated', task);
        triggerWebhooks('task.review_requested', { task_id: task.id, review: reviewEntry });

        res.status(201).json({ task, review: reviewEntry });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/tasks/:id/approve-review
 * Approve the pending review. Marks task as approved for completion.
 * Body: { reviewer, notes? }
 */
app.post('/api/tasks/:id/approve-review', async (req, res) => {
    try {
        const id = sanitizeId(req.params.id);
        let task;
        try {
            task = await readJsonFile(`tasks/${id}.json`);
        } catch (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const { reviewer, notes } = req.body;
        if (!reviewer) {
            return res.status(400).json({ error: 'reviewer is required' });
        }

        const pendingReview = (task.reviews || []).find(r => r.status === 'pending');
        if (!pendingReview) {
            return res.status(400).json({ error: 'No pending review found' });
        }

        pendingReview.status = 'approved';
        pendingReview.result = 'approved';
        pendingReview.result_at = new Date().toISOString();
        pendingReview.result_by = reviewer;
        pendingReview.result_notes = notes || null;

        // Clear review_required gate so task can move to DONE
        task.review_required = false;
        task.updated_at = new Date().toISOString();

        await writeJsonFile(`tasks/${task.id}.json`, task);
        await logActivity(reviewer, 'REVIEW_APPROVED', `Task ${task.id}: approved by ${reviewer}`);

        broadcast('task.updated', task);
        triggerWebhooks('task.review_approved', { task_id: task.id, review: pendingReview });

        res.json({ task, review: pendingReview });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/tasks/:id/reject-review
 * Reject the pending review. Moves task back to IN_PROGRESS.
 * Body: { reviewer, notes?, reason }
 */
app.post('/api/tasks/:id/reject-review', async (req, res) => {
    try {
        const id = sanitizeId(req.params.id);
        let task;
        try {
            task = await readJsonFile(`tasks/${id}.json`);
        } catch (error) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const { reviewer, notes, reason } = req.body;
        if (!reviewer) {
            return res.status(400).json({ error: 'reviewer is required' });
        }
        if (!reason) {
            return res.status(400).json({ error: 'reason is required' });
        }

        const pendingReview = (task.reviews || []).find(r => r.status === 'pending');
        if (!pendingReview) {
            return res.status(400).json({ error: 'No pending review found' });
        }

        pendingReview.status = 'rejected';
        pendingReview.result = 'rejected';
        pendingReview.result_at = new Date().toISOString();
        pendingReview.result_by = reviewer;
        pendingReview.result_notes = notes || null;
        pendingReview.reason = reason;

        // Move task back to IN_PROGRESS
        task.status = 'IN_PROGRESS';
        task.review_required = true; // still requires review
        task.updated_at = new Date().toISOString();

        await writeJsonFile(`tasks/${task.id}.json`, task);
        await logActivity(reviewer, 'REVIEW_REJECTED', `Task ${task.id}: rejected by ${reviewer} — ${reason}`);

        broadcast('task.updated', task);
        triggerWebhooks('task.review_rejected', { task_id: task.id, review: pendingReview });

        res.json({ task, review: pendingReview });
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
    const list = Array.from(webhooks.entries()).map(([id, data]) => ({
        id,
        url: data.url,
        events: data.events,
        registered_at: data.registered_at,
        failures: data.failures || 0,
        circuitState: data.circuitState || 'closed',
        circuitOpenedAt: data.circuitOpenedAt || null,
    }));
    res.json(list);
});

/**
 * GET /api/webhooks/status
 * Returns per-URL delivery stats: success count, fail count, circuit state.
 */
app.get('/api/webhooks/status', (req, res) => {
    const status = Array.from(webhooks.entries()).map(([id, data]) => ({
        id,
        url: data.url,
        events: data.events,
        successCount: data.successCount || 0,
        failCount: data.failures || 0,
        circuitState: data.circuitState || 'closed',
        circuitOpenedAt: data.circuitOpenedAt || null,
        lastDelivery: data.lastDelivery || null,
    }));
    res.json({ webhooks: status, total: status.length });
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

/**
 * POST /api/webhooks/:id/reset-circuit
 * Manually reset a tripped circuit breaker back to 'closed'.
 */
app.post('/api/webhooks/:id/reset-circuit', (req, res) => {
    const id = req.params.id;
    const webhook = webhooks.get(id);
    if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
    }
    webhook.failures = 0;
    webhook.circuitState = 'closed';
    webhook.circuitOpenedAt = null;
    logger.info({ event: 'webhook_circuit_reset', webhookId: id }, `Webhook ${id} circuit manually reset`);
    broadcast('webhook.circuit_reset', { id });
    res.json({ success: true, id, circuitState: 'closed' });
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

// =====================================
// RESOURCE MANAGEMENT
// =====================================

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

// =====================================
// QUALITY CONTROL & REVIEW SYSTEM
// =====================================

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
        logger.warn({ err: error.message }, 'Could not read OpenClaw cron jobs');
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

// =====================================
// RELEASES / UPDATE CHECK (v1.10.0)
// =====================================

// 1-hour cache for release check
let releaseCheckCache = { data: null, expiresAt: 0 };

/**
 * GET /api/releases/check
 * Fetches the latest GitHub release and compares with current version.
 * Returns { current, latest, updateAvailable, releaseUrl }.
 * Result cached for 1 hour.
 */
app.get('/api/releases/check', async (req, res) => {
    try {
        const now = Date.now();

        // Return cached result if still valid
        if (releaseCheckCache.data && now < releaseCheckCache.expiresAt) {
            return res.json(releaseCheckCache.data);
        }

        const pkgPath = path.join(__dirname, '..', 'package.json');
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
        const current = pkg.version;

        let latest = null;
        let releaseUrl = null;
        let updateAvailable = false;

        try {
            const response = await fetch(
                'https://api.github.com/repos/Asif2BD/JARVIS-Mission-Control-OpenClaw/releases/latest',
                {
                    headers: {
                        'User-Agent': `JARVIS-Mission-Control/${current}`,
                        'Accept': 'application/vnd.github+json',
                    },
                    signal: AbortSignal.timeout(5000),
                }
            );

            if (response.ok) {
                const release = await response.json();
                latest = release.tag_name ? release.tag_name.replace(/^v/, '') : null;
                releaseUrl = release.html_url || null;

                if (latest) {
                    // Simple semver comparison (major.minor.patch)
                    const parseVer = v => v.split('.').map(Number);
                    const [cMaj, cMin, cPat] = parseVer(current);
                    const [lMaj, lMin, lPat] = parseVer(latest);
                    updateAvailable = (
                        lMaj > cMaj ||
                        (lMaj === cMaj && lMin > cMin) ||
                        (lMaj === cMaj && lMin === cMin && lPat > cPat)
                    );
                }
            }
        } catch (fetchErr) {
            logger.warn({ err: fetchErr.message }, 'Could not fetch latest release from GitHub');
        }

        const result = { current, latest, updateAvailable, releaseUrl };

        // Cache for 1 hour
        releaseCheckCache = { data: result, expiresAt: now + 3600_000 };

        res.json(result);
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

// =====================================
// Claude Code Session Routes (v1.2.0)
// =====================================

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

// =====================================
// CLI INTEGRATION (v1.3.0)
// =====================================

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

// =====================================
// CSRF TOKEN ENDPOINT (v1.6.0)
// =====================================

/**
 * GET /api/csrf-token
 * Returns a fresh CSRF token.
 * Sets mc-csrf-secret cookie (HttpOnly, SameSite=Strict) for the session.
 * Dashboard JS should call this once on load and cache the token.
 */
app.get('/api/csrf-token', (req, res) => {
    // Reuse existing secret if present, otherwise generate a new one
    let secret = req.cookies && req.cookies[CSRF_SECRET_COOKIE];
    if (!secret) {
        secret = csrfTokens.secretSync();
        res.cookie(CSRF_SECRET_COOKIE, secret, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 86400 * 1000, // 24h
        });
    }
    const token = csrfTokens.create(secret);
    res.json({ token, expires: new Date(Date.now() + 3600_000).toISOString() });
});

// =====================================
// CLI CONNECTIONS API (v1.3.0)
// =====================================

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

// =====================================
// GITHUB ISSUES SYNC (v1.4.0)
// =====================================

/**
 * GET /api/github/issues
 * Fetch open issues from the configured GitHub repo.
 * Reads GITHUB_TOKEN + GITHUB_REPO from env or .github-sync config file.
 */
app.get('/api/github/issues', async (req, res) => {
    try {
        const { token, repo } = getGithubConfig();
        if (!repo) return res.status(400).json({ error: 'GITHUB_REPO not configured. Set env var or create .github-sync file.' });

        const headers = { 'User-Agent': 'JARVIS-Mission-Control/1.4.0', 'Accept': 'application/vnd.github+json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const url = `https://api.github.com/repos/${repo}/issues?state=open&per_page=50`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const err = await response.text();
            return res.status(response.status).json({ error: `GitHub API error: ${response.status}`, detail: err.slice(0, 500) });
        }
        const issues = await response.json();
        // Filter out pull requests (they appear in /issues)
        const filtered = issues.filter(i => !i.pull_request);
        res.json({ repo, issues: filtered, count: filtered.length, timestamp: new Date().toISOString() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/github/sync
 * Auto-create JARVIS task cards from open GitHub issues.
 * Idempotent: won't duplicate tasks already created for the same issue number.
 */
app.post('/api/github/sync', async (req, res) => {
    try {
        const { token, repo } = getGithubConfig();
        if (!repo) return res.status(400).json({ error: 'GITHUB_REPO not configured.' });

        const headers = { 'User-Agent': 'JARVIS-Mission-Control/1.4.0', 'Accept': 'application/vnd.github+json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const url = `https://api.github.com/repos/${repo}/issues?state=open&per_page=50`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const err = await response.text();
            return res.status(response.status).json({ error: `GitHub API error: ${response.status}`, detail: err.slice(0, 500) });
        }
        const allIssues = await response.json();
        const issues = allIssues.filter(i => !i.pull_request);

        // Load existing tasks to check for already-synced issues
        const tasksDir = path.join(MISSION_CONTROL_DIR, 'tasks');
        await fs.mkdir(tasksDir, { recursive: true });
        const existingFiles = await fs.readdir(tasksDir).catch(() => []);
        const existingTasks = await Promise.all(existingFiles.filter(f => f.endsWith('.json')).map(async f => {
            try { return JSON.parse(await fs.readFile(path.join(tasksDir, f), 'utf8')); } catch { return null; }
        }));
        const syncedIssueNums = new Set(existingTasks.filter(Boolean).map(t => t.github_issue_number).filter(Boolean));

        const created = [];
        const skipped = [];

        for (const issue of issues) {
            if (syncedIssueNums.has(issue.number)) {
                skipped.push(issue.number);
                continue;
            }
            const taskId = `task-github-${repo.replace('/', '-')}-issue-${issue.number}`;
            const task = {
                id: taskId,
                title: `[GH #${issue.number}] ${issue.title}`,
                description: (issue.body || '').slice(0, 2000),
                status: 'INBOX',
                priority: issue.labels.some(l => l.name.toLowerCase().includes('bug') || l.name.toLowerCase().includes('critical')) ? 'high' : 'normal',
                assignee: null,
                created_by: 'github-sync',
                labels: ['github', ...issue.labels.map(l => l.name).slice(0, 5)],
                comments: [],
                attachments: [],
                github_issue_number: issue.number,
                github_issue_url: issue.html_url,
                github_repo: repo,
                created_at: issue.created_at,
                updated_at: new Date().toISOString(),
            };
            await fs.writeFile(path.join(tasksDir, `${taskId}.json`), JSON.stringify(task, null, 2));
            created.push(issue.number);
        }

        // Broadcast WebSocket update
        broadcast('github-sync', { created: created.length, skipped: skipped.length });

        res.json({ ok: true, repo, created, skipped, message: `Created ${created.length} task(s), skipped ${skipped.length} already synced.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/github/config
 * Return current GitHub config (without exposing the token).
 */
app.get('/api/github/config', (req, res) => {
    const { token, repo } = getGithubConfig();
    res.json({ repo: repo || null, hasToken: !!token });
});

/**
 * POST /api/github/config
 * Save GitHub config to .github-sync file.
 */
app.post('/api/github/config', async (req, res) => {
    const { token, repo } = req.body || {};
    if (!repo || typeof repo !== 'string' || !/^[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+$/.test(repo)) {
        return res.status(400).json({ error: 'repo must be in owner/name format' });
    }
    const configPath = path.join(MISSION_CONTROL_DIR, '.github-sync');
    const lines = [`GITHUB_REPO=${repo}`];
    if (token && typeof token === 'string') lines.push(`GITHUB_TOKEN=${token.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 100)}`);
    await fs.writeFile(configPath, lines.join('\n') + '\n');
    res.json({ ok: true, repo, hasToken: !!token });
});

/** Helper: read GITHUB_TOKEN + GITHUB_REPO from env or .github-sync config file */
function getGithubConfig() {
    let token = process.env.GITHUB_TOKEN || '';
    let repo = process.env.GITHUB_REPO || '';
    try {
        const configPath = path.join(MISSION_CONTROL_DIR, '.github-sync');
        if (fsSync.existsSync(configPath)) {
            fsSync.readFileSync(configPath, 'utf8').split('\n').forEach(line => {
                const [k, ...v] = line.split('=');
                if (!k || !v.length) return;
                const val = v.join('=').trim();
                if (k.trim() === 'GITHUB_TOKEN' && !token) token = val;
                if (k.trim() === 'GITHUB_REPO' && !repo) repo = val;
            });
        }
    } catch { /* ignore */ }
    return { token, repo };
}

// =====================================
// AGENT SOUL WORKSPACE SYNC (v1.5.0)
// =====================================

const AGENTS_WORKSPACE_DIR = process.env.AGENTS_DIR || '/root/.openclaw/workspace/agents';
const SOUL_FILES = ['SOUL.md', 'MEMORY.md', 'IDENTITY.md'];

/** Validate agentId — only word chars, hyphens, dots */
function isValidAgentId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_\-\.]{1,64}$/.test(id);
}

/** Validate filename is in the allowed SOUL_FILES list */
function isValidSoulFile(filename) {
    return SOUL_FILES.includes(filename);
}

/**
 * GET /api/agents/list
 * List all agents in the workspace directory with their file availability.
 */
app.get('/api/agents/list', async (req, res) => {
    try {
        const entries = await fs.readdir(AGENTS_WORKSPACE_DIR, { withFileTypes: true });
        const agents = [];
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (!isValidAgentId(entry.name)) continue;
            const agentDir = path.join(AGENTS_WORKSPACE_DIR, entry.name);
            const files = {};
            for (const f of SOUL_FILES) {
                try { await fs.access(path.join(agentDir, f)); files[f] = true; } catch { files[f] = false; }
            }
            agents.push({ id: entry.name, dir: agentDir, files });
        }
        res.json({ agents, count: agents.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/agents/soul/:agentId
 * Returns all soul/memory files for an agent (SOUL.md, MEMORY.md, IDENTITY.md).
 */
app.get('/api/agents/soul/:agentId', async (req, res) => {
    const { agentId } = req.params;
    if (!isValidAgentId(agentId)) return res.status(400).json({ error: 'Invalid agentId' });

    const agentDir = path.resolve(AGENTS_WORKSPACE_DIR, agentId);
    const workspaceResolved = path.resolve(AGENTS_WORKSPACE_DIR);
    if (!agentDir.startsWith(workspaceResolved + path.sep) && agentDir !== workspaceResolved) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        await fs.access(agentDir);
    } catch {
        return res.status(404).json({ error: `Agent directory not found: ${agentId}` });
    }

    const files = {};
    for (const filename of SOUL_FILES) {
        const filePath = path.join(agentDir, filename);
        try {
            const content = await fs.readFile(filePath, 'utf8');
            files[filename] = { content, exists: true, size: Buffer.byteLength(content, 'utf8') };
        } catch {
            files[filename] = { content: '', exists: false, size: 0 };
        }
    }

    res.json({ agentId, dir: agentDir, files, availableFiles: SOUL_FILES });
});

/**
 * PUT /api/agents/soul/:agentId
 * Write updated content for a specific file (with auto-backup).
 * Body: { filename: 'SOUL.md', content: '...' }
 */
app.put('/api/agents/soul/:agentId', async (req, res) => {
    const { agentId } = req.params;
    const { filename, content } = req.body || {};

    if (!isValidAgentId(agentId)) return res.status(400).json({ error: 'Invalid agentId' });
    if (!isValidSoulFile(filename)) return res.status(400).json({ error: `File not allowed. Must be one of: ${SOUL_FILES.join(', ')}` });
    if (typeof content !== 'string') return res.status(400).json({ error: 'content must be a string' });
    if (content.length > 500_000) return res.status(400).json({ error: 'Content too large (max 500KB)' });

    const agentDir = path.resolve(AGENTS_WORKSPACE_DIR, agentId);
    const workspaceResolved = path.resolve(AGENTS_WORKSPACE_DIR);
    if (!agentDir.startsWith(workspaceResolved + path.sep) && agentDir !== workspaceResolved) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        await fs.access(agentDir);
    } catch {
        return res.status(404).json({ error: `Agent directory not found: ${agentId}` });
    }

    const filePath = path.join(agentDir, filename);
    // Create automatic backup before overwriting
    try {
        const existing = await fs.readFile(filePath, 'utf8');
        const backupPath = filePath.replace('.md', `.backup-${Date.now()}.md`);
        await fs.writeFile(backupPath, existing);
    } catch { /* file didn't exist yet — no backup needed */ }

    await fs.writeFile(filePath, content, 'utf8');
    const size = Buffer.byteLength(content, 'utf8');
    res.json({ ok: true, agentId, filename, size, timestamp: new Date().toISOString() });
});

// =====================================
// Serve dashboard static files (MUST be before catch-all route)
app.use(express.static(DASHBOARD_DIR));

// Fallback to dashboard for SPA routing (MUST be last)
app.get('*', (req, res) => {
    res.sendFile(path.join(DASHBOARD_DIR, 'index.html'));
});

// =====================================
// UPDATE CHECK ENDPOINT (v1.11.0)
// =====================================

/**
 * GET /api/update/check
 * Checks npm registry for latest version of jarvis-mission-control
 * and compares with current package version.
 */
app.get('/api/update/check', async (req, res) => {
    try {
        const currentVersion = require('../package.json').version;
        const registryUrl = 'https://registry.npmjs.org/jarvis-mission-control/latest';

        const response = await fetch(registryUrl, {
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            return res.json({
                current: currentVersion,
                latest: null,
                updateAvailable: false,
                error: `Registry responded with ${response.status}`,
            });
        }

        const data = await response.json();
        const latest = data.version || null;

        const updateAvailable = latest ? latest !== currentVersion && compareVersions(latest, currentVersion) > 0 : false;

        res.json({
            current: currentVersion,
            latest,
            updateAvailable,
            downloadUrl: latest ? `https://www.npmjs.com/package/jarvis-mission-control/v/${latest}` : null,
        });
    } catch (err) {
        logger.warn({ err: err.message }, 'Update check failed');
        const currentVersion = require('../package.json').version;
        res.json({
            current: currentVersion,
            latest: null,
            updateAvailable: false,
            error: err.message,
        });
    }
});

/**
 * Simple semver comparison: returns 1 if a > b, -1 if a < b, 0 if equal.
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return 1;
        if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    }
    return 0;
}

// START SERVER
// =====================================

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

    logger.info({ event: 'server_start', port: PORT, dataDir: MISSION_CONTROL_DIR }, `
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
