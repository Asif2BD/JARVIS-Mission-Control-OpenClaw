#!/usr/bin/env node
/**
 * Mission Control CLI (mc)
 * 
 * A command-line interface for AI agents to interact with Mission Control
 * without needing the dashboard.
 * 
 * Usage:
 *   mc tasks                           # List all tasks
 *   mc tasks --status in_progress      # Filter by status
 *   mc tasks --assignee agent-morpheus # Filter by assignee
 *   mc task <id>                        # View task details
 *   mc task:status <id> <status>        # Update task status
 *   mc task:comment <id> "message"      # Add comment to task
 *   mc subtask:add <id> "text"          # Add subtask
 *   mc subtask:check <id> <index>       # Toggle subtask done
 *   mc deliver <id> "name" --url <url>  # Add deliverable
 *   mc deliver <id> "name" --path <path># Add file deliverable
 *   mc activity                         # View activity feed
 *   mc activity --limit 20              # Limit results
 *   mc squad                            # View agent status
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const MC_HOST = process.env.MC_HOST || 'localhost';
const MC_PORT = process.env.MC_PORT || '3000';
const MC_PROTOCOL = process.env.MC_PROTOCOL || 'http';
const MC_AGENT = process.env.MC_AGENT || process.env.AGENT_ID || 'cli-user';

const BASE_URL = `${MC_PROTOCOL}://${MC_HOST}:${MC_PORT}`;

// ============================================
// HTTP Client
// ============================================

function request(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Agent-ID': MC_AGENT
            }
        };

        const client = url.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode >= 400) {
                        reject(new Error(json.error || `HTTP ${res.statusCode}`));
                    } else {
                        resolve(json);
                    }
                } catch (e) {
                    reject(new Error(`Invalid JSON response: ${body.slice(0, 100)}`));
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// ============================================
// Formatters
// ============================================

const STATUS_ICONS = {
    'INBOX': '📥',
    'TODO': '📋',
    'IN_PROGRESS': '🔄',
    'REVIEW': '👀',
    'DONE': '✅',
    'BLOCKED': '🚫'
};

const PRIORITY_ICONS = {
    'critical': '🔴',
    'high': '🟠',
    'medium': '🟡',
    'low': '🟢'
};

function formatTask(task, verbose = false) {
    const status = STATUS_ICONS[task.status] || task.status;
    const priority = PRIORITY_ICONS[task.priority] || '';
    const assignee = task.assignee ? `@${task.assignee}` : '';
    
    let output = `${status} ${priority} ${task.id}\n`;
    output += `   ${task.title}\n`;
    
    if (verbose) {
        if (task.description) {
            output += `   ───\n`;
            task.description.split('\n').forEach(line => {
                output += `   ${line}\n`;
            });
        }
        
        if (task.subtasks && task.subtasks.length > 0) {
            output += `   ─── Subtasks ───\n`;
            task.subtasks.forEach((st, i) => {
                const check = st.done ? '✓' : '○';
                output += `   [${i}] ${check} ${st.text}\n`;
            });
        }
        
        if (task.deliverables && task.deliverables.length > 0) {
            output += `   ─── Deliverables ───\n`;
            task.deliverables.forEach((d, i) => {
                const link = d.url || d.path || '';
                output += `   [${i}] 📦 ${d.name} → ${link}\n`;
            });
        }
        
        if (task.comments && task.comments.length > 0) {
            output += `   ─── Comments (${task.comments.length}) ───\n`;
            task.comments.slice(-3).forEach(c => {
                const time = new Date(c.timestamp).toLocaleString();
                output += `   💬 ${c.author} (${time}):\n`;
                output += `      ${c.content}\n`;
            });
        }
        
        output += `   ───\n`;
        output += `   Assignee: ${assignee || 'unassigned'}\n`;
        output += `   Created: ${task.created_at}\n`;
        output += `   Updated: ${task.updated_at}\n`;
    } else {
        output += `   ${assignee}\n`;
    }
    
    return output;
}

function formatAgent(agent) {
    const status = agent.status === 'active' ? '🟢' : '⚫';
    const lastActive = agent.last_active 
        ? new Date(agent.last_active).toLocaleString() 
        : 'never';
    
    return `${status} ${agent.name} (${agent.id})\n   Role: ${agent.role || 'agent'}\n   Last: ${lastActive}\n`;
}

function formatActivity(entry) {
    // Parse log line: "2026-02-18T12:00:00.000Z [actor] ACTION: description"
    const match = entry.match(/^(\S+)\s+\[([^\]]+)\]\s+(\w+):\s+(.*)$/);
    if (!match) return entry;
    
    const [, timestamp, actor, action, description] = match;
    const time = new Date(timestamp).toLocaleString();
    
    const actionIcons = {
        'CREATED': '➕',
        'UPDATED': '📝',
        'PATCHED': '🔧',
        'DELETED': '🗑️',
        'COMMENT': '💬',
        'SUBTASK': '☑️',
        'DELIVER': '📦'
    };
    
    const icon = actionIcons[action] || '•';
    return `${icon} [${time}] ${actor}: ${description}`;
}

// ============================================
// Commands
// ============================================

async function listTasks(args) {
    const tasks = await request('GET', '/api/tasks');
    
    // Filter
    let filtered = tasks;
    
    const statusIdx = args.indexOf('--status');
    if (statusIdx !== -1 && args[statusIdx + 1]) {
        const status = args[statusIdx + 1].toUpperCase();
        filtered = filtered.filter(t => t.status === status);
    }
    
    const assigneeIdx = args.indexOf('--assignee');
    if (assigneeIdx !== -1 && args[assigneeIdx + 1]) {
        const assignee = args[assigneeIdx + 1];
        filtered = filtered.filter(t => t.assignee === assignee);
    }
    
    const mineIdx = args.indexOf('--mine');
    if (mineIdx !== -1) {
        filtered = filtered.filter(t => t.assignee === MC_AGENT);
    }
    
    if (filtered.length === 0) {
        console.log('No tasks found.');
        return;
    }
    
    console.log(`\n📋 Tasks (${filtered.length})\n${'─'.repeat(40)}`);
    filtered.forEach(t => console.log(formatTask(t)));
}

async function viewTask(taskId) {
    const task = await request('GET', `/api/tasks/${taskId}`);
    console.log(`\n${'─'.repeat(50)}`);
    console.log(formatTask(task, true));
}

async function updateTaskStatus(taskId, newStatus) {
    const status = newStatus.toUpperCase();
    const validStatuses = ['INBOX', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];
    
    if (!validStatuses.includes(status)) {
        console.error(`Invalid status. Valid: ${validStatuses.join(', ')}`);
        process.exit(1);
    }
    
    const task = await request('PATCH', `/api/tasks/${taskId}`, {
        status: status,
        updated_by: MC_AGENT
    });
    
    console.log(`✅ Task ${taskId} status → ${STATUS_ICONS[status]} ${status}`);
}

async function addComment(taskId, content) {
    const result = await request('POST', `/api/tasks/${taskId}/comments`, {
        content: content,
        author: MC_AGENT
    });
    
    console.log(`💬 Comment added to ${taskId}`);
}

async function addSubtask(taskId, text) {
    const result = await request('POST', `/api/tasks/${taskId}/subtasks`, {
        text: text
    });
    
    console.log(`☑️ Subtask added to ${taskId}: "${text}"`);
}

async function toggleSubtask(taskId, index) {
    const idx = parseInt(index, 10);
    if (isNaN(idx)) {
        console.error('Invalid subtask index');
        process.exit(1);
    }
    
    const result = await request('PATCH', `/api/tasks/${taskId}/subtasks/${idx}`, {});
    
    const status = result.done ? '✓ done' : '○ undone';
    console.log(`☑️ Subtask ${idx} → ${status}`);
}

async function addDeliverable(taskId, name, args) {
    const urlIdx = args.indexOf('--url');
    const pathIdx = args.indexOf('--path');
    
    const deliverable = { name };
    
    if (urlIdx !== -1 && args[urlIdx + 1]) {
        deliverable.url = args[urlIdx + 1];
        deliverable.type = 'url';
    } else if (pathIdx !== -1 && args[pathIdx + 1]) {
        deliverable.path = args[pathIdx + 1];
        deliverable.type = 'file';
        
        // Check if file exists
        if (!fs.existsSync(deliverable.path)) {
            console.error(`File not found: ${deliverable.path}`);
            process.exit(1);
        }
    } else {
        console.error('Must specify --url <url> or --path <filepath>');
        process.exit(1);
    }
    
    const result = await request('POST', `/api/tasks/${taskId}/deliverables`, deliverable);
    
    console.log(`📦 Deliverable added to ${taskId}: "${name}"`);
}

async function viewActivity(args) {
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 20;
    
    const result = await request('GET', `/api/activity?limit=${limit}`);
    
    console.log(`\n📜 Activity Feed\n${'─'.repeat(50)}`);
    
    if (result.entries && result.entries.length > 0) {
        result.entries.forEach(entry => {
            console.log(formatActivity(entry));
        });
    } else if (result.lines && result.lines.length > 0) {
        // Fallback to old format
        result.lines.slice(-limit).forEach(line => {
            console.log(formatActivity(line));
        });
    } else {
        console.log('No activity yet.');
    }
}

async function viewSquad() {
    const agents = await request('GET', '/api/agents');
    
    console.log(`\n🤖 Squad Status\n${'─'.repeat(40)}`);
    
    if (agents.length === 0) {
        console.log('No agents registered.');
        return;
    }
    
    agents.forEach(a => console.log(formatAgent(a)));
}

// ============================================
// Main
// ============================================

function showHelp() {
    console.log(`
Mission Control CLI (mc)

USAGE:
  mc <command> [args]

COMMANDS:
  tasks                              List all tasks
    --status <status>                Filter by status
    --assignee <agent-id>            Filter by assignee
    --mine                           Show only my tasks

  task <id>                          View task details
  task:status <id> <status>          Update task status
  task:comment <id> "message"        Add comment to task

  subtask:add <id> "text"            Add subtask to task
  subtask:check <id> <index>         Toggle subtask completion

  deliver <id> "name" --url <url>    Add URL deliverable
  deliver <id> "name" --path <file>  Add file deliverable

  activity                           View activity feed
    --limit <n>                      Number of entries (default: 20)

  squad                              View agent status

ENVIRONMENT:
  MC_HOST      Server host (default: localhost)
  MC_PORT      Server port (default: 3000)
  MC_AGENT     Agent ID for attribution (default: AGENT_ID or cli-user)

EXAMPLES:
  mc tasks --mine
  mc task:status task-123 in_progress
  mc task:comment task-123 "Working on this now"
  mc subtask:add task-123 "Write unit tests"
  mc subtask:check task-123 0
  mc deliver task-123 "PR" --url https://github.com/...
`);
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
        showHelp();
        return;
    }
    
    const command = args[0];
    
    try {
        switch (command) {
            case 'tasks':
                await listTasks(args.slice(1));
                break;
                
            case 'task':
                if (!args[1]) {
                    console.error('Usage: mc task <task-id>');
                    process.exit(1);
                }
                await viewTask(args[1]);
                break;
                
            case 'task:status':
                if (!args[1] || !args[2]) {
                    console.error('Usage: mc task:status <task-id> <status>');
                    process.exit(1);
                }
                await updateTaskStatus(args[1], args[2]);
                break;
                
            case 'task:comment':
                if (!args[1] || !args[2]) {
                    console.error('Usage: mc task:comment <task-id> "message"');
                    process.exit(1);
                }
                await addComment(args[1], args.slice(2).join(' '));
                break;
                
            case 'subtask:add':
                if (!args[1] || !args[2]) {
                    console.error('Usage: mc subtask:add <task-id> "text"');
                    process.exit(1);
                }
                await addSubtask(args[1], args.slice(2).join(' '));
                break;
                
            case 'subtask:check':
                if (!args[1] || args[2] === undefined) {
                    console.error('Usage: mc subtask:check <task-id> <index>');
                    process.exit(1);
                }
                await toggleSubtask(args[1], args[2]);
                break;
                
            case 'deliver':
                if (!args[1] || !args[2]) {
                    console.error('Usage: mc deliver <task-id> "name" --url <url> | --path <file>');
                    process.exit(1);
                }
                await addDeliverable(args[1], args[2], args.slice(3));
                break;
                
            case 'activity':
                await viewActivity(args.slice(1));
                break;
                
            case 'squad':
                await viewSquad();
                break;
                
            default:
                console.error(`Unknown command: ${command}`);
                console.error('Run "mc help" for usage.');
                process.exit(1);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

main();
