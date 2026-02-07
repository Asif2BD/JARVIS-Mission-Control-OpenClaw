#!/usr/bin/env node
/**
 * Telegram → Mission Control Bridge
 * 
 * Receives task assignments from Telegram (via OpenClaw webhook or direct call)
 * and creates Mission Control tasks.
 * 
 * Usage:
 *   POST /api/telegram/task
 *   {
 *     "from": "User Name",
 *     "message": "@MyAgentBot fix the dashboard",
 *     "chat_id": "-123456789",
 *     "message_id": "123",
 *     "timestamp": "2026-02-07T06:41:00Z"
 *   }
 */

const fs = require('fs').promises;
const path = require('path');

const MISSION_CONTROL_DIR = process.env.MISSION_CONTROL_DIR || 
    path.join(__dirname, '..', '.mission-control');

/**
 * Agent bot username → agent id mapping
 * Configure via AGENT_MAP env var (JSON) or agents.json config file
 * 
 * Example env: AGENT_MAP='{"@MyBot":"agent1","@OtherBot":"agent2"}'
 * Example file: .mission-control/config/agents.json
 */
function loadAgentMap() {
    // Priority 1: Environment variable
    if (process.env.AGENT_MAP) {
        try {
            return JSON.parse(process.env.AGENT_MAP);
        } catch (e) {
            console.warn('Invalid AGENT_MAP env var, using defaults');
        }
    }
    
    // Priority 2: Config file
    const configPath = path.join(MISSION_CONTROL_DIR, 'config', 'agents.json');
    try {
        if (require('fs').existsSync(configPath)) {
            const config = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
            if (config.botMapping) return config.botMapping;
        }
    } catch (e) {
        // Config file doesn't exist or is invalid
    }
    
    // Priority 3: Default examples (replace with your own)
    return {
        '@AgentOne_Bot': 'agent-one',
        '@AgentTwo_Bot': 'agent-two'
    };
}

const AGENT_MAP = loadAgentMap();

/**
 * Parse mentions from message text
 */
function parseMentions(text) {
    const mentions = [];
    for (const [botUsername, agentId] of Object.entries(AGENT_MAP)) {
        if (text.includes(botUsername)) {
            mentions.push(agentId);
        }
    }
    return mentions;
}

/**
 * Extract task title from message
 * Removes @mentions and cleans up
 */
function extractTitle(text) {
    let title = text;
    for (const botUsername of Object.keys(AGENT_MAP)) {
        title = title.replace(new RegExp(botUsername, 'gi'), '').trim();
    }
    // Capitalize first letter, limit length
    title = title.charAt(0).toUpperCase() + title.slice(1);
    return title.slice(0, 100) || 'Task from Telegram';
}

/**
 * Check if task already exists (deduplication)
 */
async function taskExists(message) {
    const tasksDir = path.join(MISSION_CONTROL_DIR, 'tasks');
    try {
        const files = await fs.readdir(tasksDir);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const content = await fs.readFile(path.join(tasksDir, file), 'utf-8');
            const task = JSON.parse(content);
            // Check if same message within last 5 minutes
            if (task.description === message && task.source === 'telegram') {
                const taskTime = new Date(task.createdAt).getTime();
                const now = Date.now();
                if (now - taskTime < 5 * 60 * 1000) {
                    return true; // Duplicate within 5 min
                }
            }
        }
    } catch (e) {
        // Directory might not exist yet
    }
    return false;
}

/**
 * Create task from Telegram message
 */
async function createTaskFromTelegram({ from, message, chat_id, message_id, timestamp }) {
    const mentions = parseMentions(message);
    if (mentions.length === 0) {
        return { success: false, error: 'No agent mentioned' };
    }

    // Deduplication check
    if (await taskExists(message)) {
        return { success: false, error: 'Duplicate task (already exists)' };
    }

    const assignee = mentions[0]; // Primary assignee is first mentioned
    const title = extractTitle(message);
    const taskId = `task-tg-${Date.now()}`;

    const task = {
        id: taskId,
        title: title,
        description: message,
        status: 'pending',
        priority: 'normal',
        assignee: assignee,
        mentions: mentions,
        source: 'telegram',
        sourceData: {
            chat_id,
            message_id,
            from
        },
        createdAt: timestamp || new Date().toISOString(),
        createdBy: from || 'architect',
        progress: 0
    };

    const taskPath = path.join(MISSION_CONTROL_DIR, 'tasks', `${taskId}.json`);
    await fs.writeFile(taskPath, JSON.stringify(task, null, 2));

    // Log activity
    const logPath = path.join(MISSION_CONTROL_DIR, 'logs', 'activity.log');
    const logEntry = `[${new Date().toISOString()}] TASK_CREATED: ${taskId} - "${title}" assigned to ${assignee} (from: ${from})\n`;
    await fs.appendFile(logPath, logEntry).catch(() => {});

    return { success: true, taskId, task };
}

/**
 * Express route handler for POST /api/telegram/task
 */
function registerRoutes(app) {
    app.post('/api/telegram/task', async (req, res) => {
        try {
            const result = await createTaskFromTelegram(req.body);
            if (result.success) {
                res.json({ ok: true, taskId: result.taskId });
            } else {
                res.status(400).json({ ok: false, error: result.error });
            }
        } catch (err) {
            console.error('Telegram bridge error:', err);
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    console.log('📱 Telegram bridge registered: POST /api/telegram/task');
}

module.exports = { createTaskFromTelegram, parseMentions, extractTitle, registerRoutes };
