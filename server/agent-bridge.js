#!/usr/bin/env node
/**
 * JARVIS Mission Control - Agent Session Bridge
 * 
 * Monitors OpenClaw agent sessions and feeds activity to Mission Control.
 * 
 * Features:
 * - Auto-creates tasks when agents are spawned via sessions_spawn
 * - Tracks agent status: idle/working/blocked
 * - Streams agent messages to Mission Control logs
 * - Updates task status on agent completion
 * - WebSocket broadcast for real-time dashboard updates
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const chokidar = require('chokidar');
const readline = require('readline');

// Import agent sync module for auto-discovery
const agentSync = require('./agent-sync');
const telegramBridge = require('./telegram-bridge');

// Configuration with auto-detection
const MISSION_CONTROL_DIR = process.env.MISSION_CONTROL_DIR || path.join(__dirname, '..', '.mission-control');
const MC_SERVER_URL = process.env.MC_SERVER_URL || 'http://localhost:3000';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 2000; // 2 seconds
const AGENT_SYNC_INTERVAL = parseInt(process.env.AGENT_SYNC_INTERVAL) || 30000; // 30 seconds
const AUTO_CREATE_TASKS = process.env.AUTO_CREATE_TASKS !== 'false'; // Disable with AUTO_CREATE_TASKS=false

// Auto-detect OpenClaw agents directory
function detectAgentsDir() {
    // Priority 1: Environment variable
    if (process.env.OPENCLAW_AGENTS_DIR && fsSync.existsSync(process.env.OPENCLAW_AGENTS_DIR)) {
        return process.env.OPENCLAW_AGENTS_DIR;
    }
    
    // Priority 2: Common locations
    const possiblePaths = [
        path.join(os.homedir(), '.openclaw', 'agents'),
        '/root/.openclaw/agents',
        path.join(process.cwd(), '.openclaw', 'agents'),
    ];
    
    for (const agentPath of possiblePaths) {
        if (fsSync.existsSync(agentPath)) {
            return agentPath;
        }
    }
    
    // Fallback (may not exist)
    return path.join(os.homedir(), '.openclaw', 'agents');
}

const OPENCLAW_AGENTS_DIR = detectAgentsDir();

// Tracked state
const trackedSessions = new Map(); // sessionId -> { agent, lastLine, taskId, status }
const agentStatus = new Map(); // agentName -> { status, currentSession, lastActive }
const TASKS_DIR = path.join(MISSION_CONTROL_DIR, 'tasks');

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Parse a JSONL file line by line
 */
async function parseJsonlFile(filePath, startLine = 0) {
    const lines = [];
    
    if (!fsSync.existsSync(filePath)) return lines;
    
    const fileStream = fsSync.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    
    let lineNum = 0;
    for await (const line of rl) {
        if (lineNum >= startLine && line.trim()) {
            try {
                lines.push({ lineNum, data: JSON.parse(line) });
            } catch (e) {
                // Skip malformed lines
            }
        }
        lineNum++;
    }
    
    return lines;
}

/**
 * Read sessions.json to get active session metadata
 */
async function readSessionsJson(agentName) {
    const sessionsPath = path.join(OPENCLAW_AGENTS_DIR, agentName, 'sessions', 'sessions.json');
    
    try {
        const content = await fs.readFile(sessionsPath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        return {};
    }
}

/**
 * Call Mission Control API
 */
async function mcApi(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(`${MC_SERVER_URL}${endpoint}`, options);
        return await response.json();
    } catch (error) {
        console.error(`MC API Error [${method} ${endpoint}]:`, error.message);
        return null;
    }
}

/**
 * Log activity to Mission Control
 */
async function logActivity(actor, action, description) {
    return mcApi('/api/logs/activity', 'POST', { actor, action, description });
}

/**
 * Create or update task in Mission Control
 */
async function createTask(taskData) {
    return mcApi('/api/tasks', 'POST', taskData);
}

/**
 * Update existing task
 */
async function updateTask(taskId, updates) {
    return mcApi(`/api/tasks/${taskId}`, 'PATCH', updates);
}

/**
 * Update agent status in Mission Control
 */
async function updateAgentStatus(agentId, status, currentTask = null) {
    const agentData = await mcApi(`/api/agents/${agentId}`);
    
    if (agentData && !agentData.error) {
        agentData.status = status;
        agentData.last_active = new Date().toISOString();
        if (currentTask) {
            agentData.current_tasks = [currentTask];
        } else if (status === 'idle') {
            agentData.current_tasks = [];
        }
        
        return mcApi(`/api/agents/${agentId}`, 'PUT', agentData);
    }
    
    return null;
}

// ============================================
// TASK DEDUPLICATION
// ============================================

/**
 * Find existing task for a session ID (prevents duplicates on restart)
 */
async function findExistingTaskForSession(sessionId) {
    try {
        const files = await fs.readdir(TASKS_DIR);
        for (const file of files) {
            if (!file.endsWith('.json') || file === '.gitkeep') continue;
            
            const taskPath = path.join(TASKS_DIR, file);
            const content = await fs.readFile(taskPath, 'utf-8');
            const task = JSON.parse(content);
            
            // Check if this task is linked to the session
            if (task.metadata?.openclaw_session_id === sessionId) {
                return task;
            }
        }
    } catch (e) {
        // Directory might not exist yet
    }
    return null;
}

/**
 * Rehydrate trackedSessions from existing tasks on startup
 */
async function rehydrateFromDisk() {
    console.log('[Bridge] Rehydrating session tracking from existing tasks...');
    
    try {
        const files = await fs.readdir(TASKS_DIR);
        let rehydrated = 0;
        
        for (const file of files) {
            if (!file.endsWith('.json') || file === '.gitkeep') continue;
            
            const taskPath = path.join(TASKS_DIR, file);
            const content = await fs.readFile(taskPath, 'utf-8');
            const task = JSON.parse(content);
            
            const sessionId = task.metadata?.openclaw_session_id;
            const agentName = task.metadata?.openclaw_agent_name;
            
            if (sessionId && agentName && !trackedSessions.has(sessionId)) {
                trackedSessions.set(sessionId, {
                    agent: agentName,
                    sessionKey: null, // Will be updated on next scan
                    lastLine: 0,      // Will catch up on next poll
                    taskId: task.id,
                    status: task.status === 'REVIEW' ? 'completed' : 'working',
                    startTime: task.created_at
                });
                rehydrated++;
            }
        }
        
        console.log(`[Bridge] Rehydrated ${rehydrated} sessions from disk`);
    } catch (e) {
        console.log('[Bridge] No existing tasks to rehydrate from');
    }
}

// ============================================
// SESSION PROCESSING
// ============================================

/**
 * Extract task info from spawn message/prompt
 */
function extractTaskInfo(prompt, label) {
    // Try to extract task ID from prompt if it mentions one
    const taskIdMatch = prompt.match(/Task ID:\s*(task-[a-z0-9-]+)/i);
    
    // Generate title from label or first 100 chars of prompt
    let title = label || prompt.substring(0, 100);
    if (title.length < prompt.length && !label) {
        title += '...';
    }
    
    // Determine priority from keywords
    let priority = 'medium';
    if (/critical|urgent|emergency|asap/i.test(prompt)) {
        priority = 'critical';
    } else if (/high priority|important/i.test(prompt)) {
        priority = 'high';
    } else if (/low priority|when you have time/i.test(prompt)) {
        priority = 'low';
    }
    
    return {
        existingTaskId: taskIdMatch ? taskIdMatch[1] : null,
        title,
        priority,
        description: prompt
    };
}

/**
 * Process a new agent session
 */
async function processNewSession(agentName, sessionKey, sessionMeta) {
    const sessionId = sessionMeta.sessionId;
    
    // Already tracking this session?
    if (trackedSessions.has(sessionId)) return;
    
    console.log(`[Bridge] New session detected: ${agentName}/${sessionId}`);
    
    // Determine if this is a spawned subagent (from sessions_spawn)
    const isSubagent = sessionKey.includes(':subagent:');
    const spawnedBy = sessionMeta.spawnedBy || null;
    const label = sessionMeta.label || null;
    
    // Read the session JSONL to get the initial prompt
    const jsonlPath = path.join(OPENCLAW_AGENTS_DIR, agentName, 'sessions', `${sessionId}.jsonl`);
    const lines = await parseJsonlFile(jsonlPath, 0);
    
    let initialPrompt = 'Agent session started';
    let taskId = null;
    
    // Find the first user message
    for (const { data } of lines) {
        if (data.type === 'message' && data.message?.role === 'user') {
            const content = data.message.content;
            if (Array.isArray(content)) {
                const textContent = content.find(c => c.type === 'text');
                if (textContent) {
                    initialPrompt = textContent.text;
                    break;
                }
            } else if (typeof content === 'string') {
                initialPrompt = content;
                break;
            }
        }
    }
    
    // Extract task info
    const taskInfo = extractTaskInfo(initialPrompt, label);
    
    // If spawned by main agent, check for existing task or link to one
    if (isSubagent || spawnedBy) {
        // FIRST: Check if we already have a task for this session on disk
        const existingTask = await findExistingTaskForSession(sessionId);
        if (existingTask) {
            console.log(`[Bridge] Found existing task ${existingTask.id} for session ${sessionId} - linking`);
            taskId = existingTask.id;
            trackedSessions.set(sessionId, {
                agent: agentName,
                sessionKey,
                lastLine: lines.length,
                taskId,
                status: existingTask.status === 'REVIEW' ? 'completed' : 'working',
                startTime: existingTask.created_at
            });
            return; // Don't create duplicate
        }
        
        // Check if prompt references an existing task
        if (taskInfo.existingTaskId) {
            taskId = taskInfo.existingTaskId;
            // Update task to IN_PROGRESS and assign to this agent
            await updateTask(taskId, {
                status: 'IN_PROGRESS',
                assignee: `agent-${agentName}`,
                updated_by: 'agent-bridge'
            });
            await logActivity('agent-bridge', 'LINKED', `Session ${sessionId} to existing task ${taskId}`);
        } else if (AUTO_CREATE_TASKS) {
            // Auto-create task ONLY if enabled (disabled by default to reduce noise)
            const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
            taskId = `task-${date}-session-${Date.now()}`;
            
            await createTask({
                id: taskId,
                title: taskInfo.title,
                description: `**OpenClaw Session Task**\n\nAgent: ${agentName}\nSession: ${sessionId}\nSpawned by: ${spawnedBy || 'direct'}\n\n---\n\n${taskInfo.description}`,
                status: 'IN_PROGRESS',
                priority: taskInfo.priority,
                assignee: `agent-${agentName}`,
                created_by: spawnedBy || 'agent-bridge',
                labels: ['openclaw', 'auto-generated', agentName],
                metadata: {
                    openclaw_session_id: sessionId,
                    openclaw_agent_name: agentName,
                    spawned_by: spawnedBy
                }
            });
            
            await logActivity('agent-bridge', 'AUTO_TASK', `Created ${taskId} for ${agentName} session`);
        } else {
            // Auto-create disabled - just log the session without creating a task
            console.log(`[Bridge] Session ${sessionId} started but AUTO_CREATE_TASKS=false - no task created`);
            await logActivity('agent-bridge', 'SESSION', `Agent ${agentName} started session ${sessionId} (no task auto-created)`);
        }
    }
    
    // Track the session
    trackedSessions.set(sessionId, {
        agent: agentName,
        sessionKey,
        lastLine: lines.length,
        taskId,
        status: 'working',
        startTime: new Date().toISOString()
    });
    
    // Update agent status
    agentStatus.set(agentName, {
        status: 'working',
        currentSession: sessionId,
        lastActive: new Date().toISOString()
    });
    
    await updateAgentStatus(`agent-${agentName}`, 'busy', taskId);
    await logActivity(`agent-${agentName}`, 'SESSION_START', `Started session ${sessionId}${taskId ? ` (task: ${taskId})` : ''}`);
}

/**
 * Process session activity (incremental)
 */
async function processSessionActivity(sessionId) {
    const session = trackedSessions.get(sessionId);
    if (!session) return;
    
    const jsonlPath = path.join(OPENCLAW_AGENTS_DIR, session.agent, 'sessions', `${sessionId}.jsonl`);
    const newLines = await parseJsonlFile(jsonlPath, session.lastLine);
    
    if (newLines.length === 0) return;
    
    for (const { lineNum, data } of newLines) {
        session.lastLine = lineNum + 1;
        
        // Process different event types
        if (data.type === 'message') {
            const msg = data.message;
            
            // AUTO-CREATE TASKS FROM @MENTIONS in user messages
            if (msg.role === 'user' && msg.content) {
                const userContent = Array.isArray(msg.content) 
                    ? msg.content.find(c => c.type === 'text')?.text || ''
                    : msg.content;
                
                // Check for @mentions of other agents (not self)
                const mentions = telegramBridge.parseMentions(userContent);
                if (mentions.length > 0 && !mentions.includes(session.agent)) {
                    // This is a task assignment to another agent - create Mission Control task
                    // Extract sender from message format: "Username (id): message"
                    const senderMatch = userContent.match(/^([^(]+)\s*\([^)]+\):/);
                    const sender = senderMatch ? senderMatch[1].trim() : 'Architect';
                    
                    try {
                        await telegramBridge.createTaskFromTelegram({
                            from: sender,
                            message: userContent,
                            chat_id: session.sessionKey?.includes('group') ? '-5117663765' : 'dm',
                            message_id: `${Date.now()}`,
                            timestamp: new Date().toISOString()
                        });
                        console.log(`[Bridge] Created task from @mention: ${telegramBridge.extractTitle(userContent)}`);
                    } catch (err) {
                        console.error('[Bridge] Failed to create task from @mention:', err.message);
                    }
                }
            }
            
            if (msg.role === 'assistant' && msg.content) {
                // Assistant response - extract meaningful updates
                const content = Array.isArray(msg.content) 
                    ? msg.content.find(c => c.type === 'text')?.text || ''
                    : msg.content;
                
                // Check for completion signals
                if (content.includes('HEARTBEAT_OK') || 
                    content.includes('Task completed') ||
                    content.includes('Done!') ||
                    content.includes('✅')) {
                    // Potential completion
                }
                
                // Check for tool calls
                const toolCalls = Array.isArray(msg.content) 
                    ? msg.content.filter(c => c.type === 'toolCall')
                    : [];
                
                if (toolCalls.length > 0) {
                    const toolNames = toolCalls.map(t => t.name).join(', ');
                    await logActivity(`agent-${session.agent}`, 'TOOL_USE', `${toolNames} in session ${sessionId.substring(0, 8)}...`);
                }
                
                // Log significant text responses (not tool calls, not too short)
                if (content.length > 50 && content.length < 500 && !content.includes('{"type":')) {
                    // Truncate for log
                    const logContent = content.substring(0, 150).replace(/\n/g, ' ');
                    await logActivity(`agent-${session.agent}`, 'PROGRESS', `"${logContent}${content.length > 150 ? '...' : ''}"`);
                }
            }
            
            if (msg.role === 'toolResult') {
                // Tool completed
                const toolName = msg.toolName;
                const isError = msg.isError;
                
                if (isError) {
                    await logActivity(`agent-${session.agent}`, 'TOOL_ERROR', `${toolName} failed in session ${sessionId.substring(0, 8)}...`);
                    
                    // Update task status to blocked if there's a linked task
                    if (session.taskId) {
                        await updateTask(session.taskId, {
                            status: 'BLOCKED',
                            updated_by: 'agent-bridge'
                        });
                    }
                }
            }
        }
        
        // Check for session end signals
        if (data.type === 'session_end' || data.type === 'error') {
            await handleSessionEnd(sessionId, data.type === 'error' ? 'error' : 'completed');
        }
    }
}

/**
 * Handle session completion
 */
async function handleSessionEnd(sessionId, reason = 'completed') {
    const session = trackedSessions.get(sessionId);
    if (!session) return;
    
    console.log(`[Bridge] Session ended: ${session.agent}/${sessionId} (${reason})`);
    
    // Update task if linked
    if (session.taskId) {
        if (reason === 'completed') {
            await updateTask(session.taskId, {
                status: 'REVIEW',
                updated_by: 'agent-bridge'
            });
            await logActivity('agent-bridge', 'TASK_COMPLETE', `${session.taskId} moved to REVIEW (agent: ${session.agent})`);
        } else if (reason === 'error') {
            await updateTask(session.taskId, {
                status: 'BLOCKED',
                updated_by: 'agent-bridge'
            });
            await logActivity('agent-bridge', 'TASK_BLOCKED', `${session.taskId} blocked due to error (agent: ${session.agent})`);
        }
    }
    
    // Update agent status
    await updateAgentStatus(`agent-${session.agent}`, 'idle');
    await logActivity(`agent-${session.agent}`, 'SESSION_END', `Session ${sessionId} ${reason}`);
    
    // Remove from tracking
    session.status = reason;
    agentStatus.set(session.agent, {
        status: 'idle',
        currentSession: null,
        lastActive: new Date().toISOString()
    });
}

// ============================================
// MAIN POLLING LOOP
// ============================================

/**
 * Scan all agents for new/active sessions
 * Uses dynamic agent discovery from OpenClaw
 */
async function scanAllAgents() {
    // Dynamically discover agents instead of hardcoding
    let agents;
    try {
        agents = await agentSync.getDiscoveredAgentIds();
        if (agents.length === 0) {
            // Fallback to directory scan if config not available
            const entries = await fs.readdir(OPENCLAW_AGENTS_DIR, { withFileTypes: true });
            agents = entries
                .filter(e => e.isDirectory() && !e.name.startsWith('.'))
                .map(e => e.name);
        }
    } catch (error) {
        console.error('[Bridge] Error discovering agents:', error.message);
        agents = [];
    }
    
    for (const agentName of agents) {
        try {
            const sessions = await readSessionsJson(agentName);
            
            for (const [sessionKey, sessionMeta] of Object.entries(sessions)) {
                // Skip if not a valid session
                if (!sessionMeta.sessionId) continue;
                
                // Check if this is a new session
                if (!trackedSessions.has(sessionMeta.sessionId)) {
                    await processNewSession(agentName, sessionKey, sessionMeta);
                }
                
                // Process any new activity
                await processSessionActivity(sessionMeta.sessionId);
            }
        } catch (error) {
            console.error(`[Bridge] Error scanning ${agentName}:`, error.message);
        }
    }
}

/**
 * Check for stale sessions (no activity for 5 minutes = likely completed)
 */
async function checkStaleSessions() {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    for (const [sessionId, session] of trackedSessions) {
        if (session.status === 'working') {
            const jsonlPath = path.join(OPENCLAW_AGENTS_DIR, session.agent, 'sessions', `${sessionId}.jsonl`);
            
            try {
                const stats = await fs.stat(jsonlPath);
                const lastModified = new Date(stats.mtime).getTime();
                
                if (now - lastModified > staleThreshold) {
                    console.log(`[Bridge] Session ${sessionId} appears stale, marking as completed`);
                    await handleSessionEnd(sessionId, 'completed');
                }
            } catch (e) {
                // File might be gone
                await handleSessionEnd(sessionId, 'completed');
            }
        }
    }
}

// ============================================
// FILE WATCHER (for instant updates)
// ============================================

async function setupFileWatcher() {
    // Dynamically build watch paths from discovered agents
    let watchPaths = [];
    
    try {
        const agents = await agentSync.getDiscoveredAgentIds();
        if (agents.length > 0) {
            watchPaths = agents.map(agent => 
                path.join(OPENCLAW_AGENTS_DIR, agent, 'sessions')
            );
        } else {
            // Fallback: scan directory
            const entries = await fs.readdir(OPENCLAW_AGENTS_DIR, { withFileTypes: true });
            watchPaths = entries
                .filter(e => e.isDirectory() && !e.name.startsWith('.'))
                .map(e => path.join(OPENCLAW_AGENTS_DIR, e.name, 'sessions'));
        }
    } catch (error) {
        console.warn('[Bridge] Could not discover agents for file watcher:', error.message);
        // Empty watch paths will gracefully handle missing OpenClaw
    }
    
    if (watchPaths.length === 0) {
        console.log('[Bridge] No agent session paths to watch');
        return;
    }
    
    const watcher = chokidar.watch(watchPaths, {
        ignored: /\.lock$/,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100
        }
    });
    
    watcher.on('change', async (filePath) => {
        if (filePath.endsWith('.jsonl')) {
            const sessionId = path.basename(filePath, '.jsonl');
            if (trackedSessions.has(sessionId)) {
                await processSessionActivity(sessionId);
            }
        } else if (filePath.endsWith('sessions.json')) {
            // New session might have been added
            await scanAllAgents();
        }
    });
    
    watcher.on('add', async (filePath) => {
        if (filePath.endsWith('.jsonl')) {
            // New session file - will be picked up by next scan
            await scanAllAgents();
        }
    });
    
    console.log('[Bridge] File watcher started');
}

// ============================================
// STARTUP
// ============================================

async function main() {
    // Discover agents for display
    let discoveredAgents = [];
    try {
        discoveredAgents = await agentSync.getDiscoveredAgentIds();
    } catch (e) {
        // Will show empty list
    }
    
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        JARVIS MISSION CONTROL - AGENT BRIDGE                  ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   Monitoring: ${OPENCLAW_AGENTS_DIR}
║   MC Server:  ${MC_SERVER_URL}
║   Poll Int:   ${POLL_INTERVAL}ms
║   Sync Int:   ${AGENT_SYNC_INTERVAL}ms
║   Agents:     ${discoveredAgents.length > 0 ? discoveredAgents.join(', ') : '(discovering...)'}
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
    
    // Start agent auto-sync (creates/updates Mission Control agent files)
    console.log('[Bridge] Starting agent auto-sync from OpenClaw...');
    const syncResults = await agentSync.syncAllAgents();
    if (syncResults.created.length > 0) {
        console.log(`[Bridge] Auto-created ${syncResults.created.length} agent(s): ${syncResults.created.join(', ')}`);
    }
    
    // Start periodic agent sync
    agentSync.startPeriodicSync(AGENT_SYNC_INTERVAL);
    
    // Rehydrate from existing task files (prevents duplicates on restart)
    await rehydrateFromDisk();
    
    // Initial scan
    await scanAllAgents();
    
    // Setup file watcher for instant updates
    await setupFileWatcher();
    
    // Polling loop for reliability
    setInterval(async () => {
        await scanAllAgents();
        await checkStaleSessions();
    }, POLL_INTERVAL);
    
    console.log('[Bridge] Agent bridge running. Press Ctrl+C to stop.');
}

main().catch(console.error);
