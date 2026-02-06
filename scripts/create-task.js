#!/usr/bin/env node
/**
 * Create Task CLI - Mission Control
 * 
 * Creates meaningful tasks from command line or programmatically.
 * Usage:
 *   node create-task.js "Task Title" "Description" --assignee oracle --priority high --labels "feature,important"
 *   
 * Or via API:
 *   curl -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" \
 *     -d '{"title":"Task Title","description":"Description","assignee":"oracle"}'
 */

const fs = require('fs').promises;
const path = require('path');

const MISSION_CONTROL_DIR = path.join(__dirname, '..', '.mission-control');
const TASKS_DIR = path.join(MISSION_CONTROL_DIR, 'tasks');

/**
 * Generate a task ID
 */
function generateTaskId() {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 8);
    return `task-${date}-${rand}`;
}

/**
 * Create a new task
 */
async function createTask(options) {
    const {
        title,
        description,
        assignee = null,
        priority = 'medium',
        labels = [],
        status = 'INBOX',
        created_by = 'system'
    } = options;

    if (!title) {
        throw new Error('Task title is required');
    }

    const task = {
        id: generateTaskId(),
        title,
        description: description || '',
        status,
        priority,
        assignee,
        created_by,
        labels: Array.isArray(labels) ? labels : labels.split(',').map(l => l.trim()).filter(Boolean),
        comments: [],
        attachments: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    // Ensure directory exists
    await fs.mkdir(TASKS_DIR, { recursive: true });

    // Write task file
    const filePath = path.join(TASKS_DIR, `${task.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(task, null, 2));

    console.log(`✅ Task created: ${task.id}`);
    console.log(`   Title: ${task.title}`);
    console.log(`   Priority: ${task.priority}`);
    console.log(`   Assignee: ${task.assignee || 'Unassigned'}`);
    console.log(`   File: ${filePath}`);

    return task;
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {
        title: null,
        description: null,
        assignee: null,
        priority: 'medium',
        labels: [],
        status: 'INBOX',
        created_by: 'cli'
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];

        if (arg === '--assignee' || arg === '-a') {
            options.assignee = args[++i];
        } else if (arg === '--priority' || arg === '-p') {
            options.priority = args[++i];
        } else if (arg === '--labels' || arg === '-l') {
            options.labels = args[++i].split(',').map(l => l.trim());
        } else if (arg === '--status' || arg === '-s') {
            options.status = args[++i];
        } else if (arg === '--created-by' || arg === '-c') {
            options.created_by = args[++i];
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Usage: node create-task.js "Title" "Description" [options]

Options:
  -a, --assignee    Agent ID to assign (e.g., oracle, tank, morpheus)
  -p, --priority    Priority level (low, medium, high, critical)
  -l, --labels      Comma-separated labels
  -s, --status      Initial status (INBOX, ASSIGNED, IN_PROGRESS, REVIEW, DONE)
  -c, --created-by  Creator identifier
  -h, --help        Show this help

Examples:
  node create-task.js "Setup Piper TTS" "Install and configure local TTS system" -a oracle -p high
  node create-task.js "Review PR #42" "Review dashboard fixes" -a tank -l "review,code" -p medium
`);
            process.exit(0);
        } else if (!options.title) {
            options.title = arg;
        } else if (!options.description) {
            options.description = arg;
        }
        i++;
    }

    return options;
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Error: Task title required. Use --help for usage.');
        process.exit(1);
    }

    const options = parseArgs(args);
    
    createTask(options)
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Error:', err.message);
            process.exit(1);
        });
}

module.exports = { createTask, generateTaskId };
