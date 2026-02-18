#!/usr/bin/env node
/**
 * JARVIS CLI — Agent command-line interface for JARVIS Mission Control
 * Inspired by clawe (https://github.com/getclawe/clawe)
 *
 * Usage: jarvis <command> [args...]
 *
 * Config env vars:
 *   MC_API_URL  — Mission Control API base URL (default: http://localhost:3000)
 *   AGENT_ID    — Your agent identity (e.g. tank, oracle, morpheus)
 */

'use strict';

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const MC_API_URL = process.env.MC_API_URL || 'http://localhost:3000';
const AGENT_ID   = process.env.AGENT_ID   || 'tank';

// Resolve .mission-control dir (repo-root/.mission-control)
const MC_DIR = path.join(__dirname, '..', '.mission-control');

// ─────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
};

const STATUS_COLOR = {
  INBOX:       C.white,
  TODO:        C.cyan,
  IN_PROGRESS: C.yellow,
  REVIEW:      C.magenta,
  DONE:        C.green,
  BLOCKED:     C.red,
  CANCELLED:   C.dim,
};

const PRIORITY_COLOR = {
  critical: C.red,
  high:     C.yellow,
  medium:   C.cyan,
  low:      C.dim,
};

const colorStatus   = s => (STATUS_COLOR[s]   || '') + s + C.reset;
const colorPriority = p => (PRIORITY_COLOR[p] || '') + p + C.reset;
const bold          = s => C.bold    + s + C.reset;
const dim           = s => C.dim     + s + C.reset;
const green         = s => C.green   + s + C.reset;
const red           = s => C.red     + s + C.reset;
const cyan          = s => C.cyan    + s + C.reset;
const yellow        = s => C.yellow  + s + C.reset;
const magenta       = s => C.magenta + s + C.reset;

// ─────────────────────────────────────────────
// HTTP HELPERS
// ─────────────────────────────────────────────
function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const fullUrl  = new URL(urlPath, MC_API_URL);
    const transport = fullUrl.protocol === 'https:' ? https : http;
    const bodyStr  = body ? JSON.stringify(body) : null;

    const options = {
      hostname: fullUrl.hostname,
      port:     fullUrl.port || (fullUrl.protocol === 'https:' ? 443 : 80),
      path:     fullUrl.pathname + fullUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': AGENT_ID,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─────────────────────────────────────────────
// TASK FILE HELPERS  (direct file I/O fallback)
// ─────────────────────────────────────────────
function readTaskFile(id) {
  const p = path.join(MC_DIR, 'tasks', `${id}.json`);
  if (!fs.existsSync(p)) throw new Error(`Task file not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeTaskFile(task) {
  const p = path.join(MC_DIR, 'tasks', `${task.id}.json`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(task, null, 2));
}

async function fetchTask(id) {
  try {
    const r = await apiRequest('GET', `/api/tasks/${id}`);
    if (r.status === 200) return r.body;
  } catch { /* server down — fall through */ }
  return readTaskFile(id);
}

async function persistTask(task) {
  task.updated_at = new Date().toISOString();
  try {
    const r = await apiRequest('PUT', `/api/tasks/${task.id}`, task);
    if (r.status === 200 || r.status === 201) return r.body;
  } catch { /* server down */ }
  writeTaskFile(task);
  return task;
}

// ─────────────────────────────────────────────
// DISPLAY HELPERS
// ─────────────────────────────────────────────
const SEP = dim('─'.repeat(60));

function printTask(task) {
  console.log(SEP);
  console.log(`${bold(task.id)}  ${colorStatus(task.status)}  ${colorPriority(task.priority || 'medium')}`);
  console.log(`${bold('Title:')}     ${task.title}`);
  if (task.assignee)   console.log(`${bold('Assignee:')}  ${cyan(task.assignee)}`);
  if (task.description) {
    const firstLine = task.description.split('\n')[0];
    console.log(`${bold('Desc:')}      ${firstLine}${task.description.includes('\n') ? ' …' : ''}`);
  }
  if (task.labels && task.labels.length)
    console.log(`${bold('Labels:')}    ${task.labels.map(l => magenta('#' + l)).join(' ')}`);
  console.log(`${bold('Created:')}   ${dim(task.created_at || '—')}`);
  console.log(`${bold('Updated:')}   ${dim(task.updated_at || '—')}`);

  // Subtasks
  if (task.subtasks && task.subtasks.length) {
    console.log(`\n${bold('Subtasks:')}`);
    task.subtasks.forEach((st, i) => {
      const check = st.done ? green('✔') : dim('○');
      console.log(`  ${check}  [${i}] ${st.done ? dim(st.text) : st.text}`);
    });
    const done = task.subtasks.filter(s => s.done).length;
    console.log(dim(`       ${done}/${task.subtasks.length} complete`));
  }

  // Deliverables (stored as attachments with type=deliverable)
  const deliverables = (task.attachments || []).filter(a => a.type === 'deliverable');
  if (deliverables.length) {
    console.log(`\n${bold('Deliverables:')}`);
    deliverables.forEach(d => {
      console.log(`  ${green('📦')} ${bold(d.name)}  ${dim(d.url || d.path || '—')}`);
    });
  }

  // Comments (last 3)
  if (task.comments && task.comments.length) {
    console.log(`\n${bold('Comments:')} ${dim('(' + task.comments.length + ')')}`);
    task.comments.slice(-3).forEach(c => {
      console.log(`  ${cyan(c.author)}  ${dim((c.timestamp || '').slice(0, 16))}`);
      console.log(`    ${c.content}`);
    });
  }
  console.log(SEP);
}

// ─────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────

/** task:status <id> <status> */
async function cmdTaskStatus(id, status) {
  if (!id || !status) {
    console.error(red('Usage: jarvis task:status <task_id> <status>'));
    console.error(dim('  Statuses: INBOX TODO IN_PROGRESS REVIEW DONE BLOCKED CANCELLED'));
    process.exit(1);
  }
  const task = await fetchTask(id);
  const old  = task.status;
  task.status = status.toUpperCase();
  await persistTask(task);
  console.log(`${green('✔')} ${bold(id)} status: ${colorStatus(old)} → ${colorStatus(task.status)}`);
}

/** task:comment <id> "message" */
async function cmdTaskComment(id, message) {
  if (!id || !message) {
    console.error(red('Usage: jarvis task:comment <task_id> "message"'));
    process.exit(1);
  }
  const task = await fetchTask(id);
  if (!task.comments) task.comments = [];
  const comment = {
    id:        `comment-${crypto.randomBytes(4).toString('hex')}`,
    author:    AGENT_ID,
    content:   message,
    timestamp: new Date().toISOString(),
    type:      'agent',
  };
  task.comments.push(comment);
  await persistTask(task);
  console.log(`${green('✔')} Comment added to ${bold(id)} by ${cyan(AGENT_ID)}`);
  console.log(`  ${dim(comment.id)}  ${comment.content}`);
}

/** task:view <id> */
async function cmdTaskView(id) {
  if (!id) { console.error(red('Usage: jarvis task:view <task_id>')); process.exit(1); }
  const task = await fetchTask(id);
  printTask(task);
}

/** subtask:add <id> "description" */
async function cmdSubtaskAdd(id, desc) {
  if (!id || !desc) {
    console.error(red('Usage: jarvis subtask:add <task_id> "description"'));
    process.exit(1);
  }
  const task = await fetchTask(id);
  if (!task.subtasks) task.subtasks = [];
  const idx = task.subtasks.length;
  task.subtasks.push({ text: desc, done: false, added_by: AGENT_ID, added_at: new Date().toISOString() });
  await persistTask(task);
  console.log(`${green('✔')} Subtask [${idx}] added to ${bold(id)}: ${desc}`);
}

/** subtask:check <id> <index> */
async function cmdSubtaskCheck(id, indexStr) {
  if (!id || indexStr === undefined) {
    console.error(red('Usage: jarvis subtask:check <task_id> <index>'));
    process.exit(1);
  }
  const idx  = parseInt(indexStr, 10);
  const task = await fetchTask(id);
  if (!task.subtasks || !task.subtasks[idx]) {
    console.error(red(`Subtask [${idx}] not found on task ${id}`));
    process.exit(1);
  }
  task.subtasks[idx].done = !task.subtasks[idx].done;
  const state = task.subtasks[idx].done ? green('✔ done') : yellow('○ undone');
  await persistTask(task);
  console.log(`${green('✔')} Subtask [${idx}] toggled → ${state}: ${task.subtasks[idx].text}`);
}

/** subtask:list <id> */
async function cmdSubtaskList(id) {
  if (!id) { console.error(red('Usage: jarvis subtask:list <task_id>')); process.exit(1); }
  const task = await fetchTask(id);
  if (!task.subtasks || task.subtasks.length === 0) {
    console.log(dim(`No subtasks on ${id}`));
    return;
  }
  console.log(`${bold('Subtasks for')} ${cyan(id)}:`);
  console.log(SEP);
  task.subtasks.forEach((st, i) => {
    const check = st.done ? green('✔') : dim('○');
    console.log(`  ${check}  [${i}]  ${st.done ? dim(st.text) : st.text}`);
  });
  const done  = task.subtasks.filter(s => s.done).length;
  const total = task.subtasks.length;
  console.log(dim(`\n  ${done}/${total} complete`));
  console.log(SEP);
}

/** deliver <id> "name" --path ./file | --url https://... */
async function cmdDeliver(id, name, flags) {
  if (!id || !name) {
    console.error(red('Usage: jarvis deliver <task_id> "name" --path ./file.md'));
    console.error(red('       jarvis deliver <task_id> "name" --url https://...'));
    process.exit(1);
  }
  if (!flags.path && !flags.url) {
    console.error(red('Must provide --path or --url'));
    process.exit(1);
  }
  const task = await fetchTask(id);
  if (!task.attachments) task.attachments = [];
  const deliverable = {
    name,
    type:        'deliverable',
    description: flags.desc || '',
    added_by:    AGENT_ID,
    added_at:    new Date().toISOString(),
    ...(flags.path ? { path: flags.path } : {}),
    ...(flags.url  ? { url:  flags.url  } : {}),
  };
  task.attachments.push(deliverable);
  await persistTask(task);
  console.log(`${green('✔')} Deliverable "${bold(name)}" registered on ${bold(id)}`);
  console.log(`  ${dim(flags.url || flags.path)}`);
}

/** tasks [--status X] [--assignee Y] */
async function cmdTasks(flags) {
  let tasks = [];
  try {
    const r = await apiRequest('GET', '/api/tasks');
    if (r.status === 200 && Array.isArray(r.body)) tasks = r.body;
    else throw new Error('API error');
  } catch {
    // fallback: read files directly
    const dir = path.join(MC_DIR, 'tasks');
    if (!fs.existsSync(dir)) { console.log(dim('No tasks found.')); return; }
    tasks = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); } catch { return null; } })
      .filter(Boolean);
  }

  if (flags.status)   tasks = tasks.filter(t => t.status && t.status.toUpperCase() === flags.status.toUpperCase());
  if (flags.assignee) tasks = tasks.filter(t => t.assignee && t.assignee.includes(flags.assignee));

  if (tasks.length === 0) { console.log(dim('No tasks match.')); return; }

  console.log(`\n${bold('JARVIS Tasks')}  ${dim('(' + tasks.length + ')')}\n`);
  console.log(
    bold(padR('ID', 34)) +
    bold(padR('STATUS', 14)) +
    bold(padR('PRI', 10)) +
    bold(padR('ASSIGNEE', 18)) +
    bold('TITLE')
  );
  console.log(SEP);
  tasks.forEach(t => {
    console.log(
      padR(t.id, 34) +
      padR(t.status || '—', 14) +
      padR(t.priority || '—', 10) +
      padR(t.assignee || '—', 18) +
      (t.title || '').slice(0, 38)
    );
  });
  console.log(SEP + '\n');
}

/** notify "message" --to <agent> */
async function cmdNotify(message, flags) {
  if (!message) {
    console.error(red('Usage: jarvis notify "message" --to <agent>'));
    process.exit(1);
  }
  const to = flags.to || 'all';
  const body = {
    id:        `msg-${crypto.randomBytes(4).toString('hex')}`,
    from:      AGENT_ID,
    to,
    content:   message,
    timestamp: new Date().toISOString(),
    type:      'notification',
    read:      false,
  };

  let sent = false;
  try {
    const r = await apiRequest('POST', '/api/messages', body);
    if (r.status === 200 || r.status === 201) sent = true;
  } catch { /* server down */ }

  if (!sent) {
    const dir = path.join(MC_DIR, 'messages');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${body.id}.json`), JSON.stringify(body, null, 2));
  }

  console.log(`${green('✔')} Notification sent ${cyan(AGENT_ID)} → ${cyan(to)}`);
  console.log(`  "${message}"`);
}

/** squad — show all agents + their active task */
async function cmdSquad() {
  let agents = [];
  let tasks  = [];

  try {
    const r = await apiRequest('GET', '/api/agents');
    if (r.status === 200 && Array.isArray(r.body)) agents = r.body;
  } catch {}

  if (!agents.length) {
    const dir = path.join(MC_DIR, 'agents');
    if (fs.existsSync(dir)) {
      agents = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); } catch { return null; } })
        .filter(Boolean);
    }
  }

  try {
    const r = await apiRequest('GET', '/api/tasks');
    if (r.status === 200 && Array.isArray(r.body)) tasks = r.body;
  } catch {}

  if (!tasks.length) {
    const dir = path.join(MC_DIR, 'tasks');
    if (fs.existsSync(dir)) {
      tasks = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); } catch { return null; } })
        .filter(Boolean);
    }
  }

  const activeTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
  const taskByAssignee = {};
  activeTasks.forEach(t => { if (t.assignee) taskByAssignee[t.assignee] = t; });

  console.log(`\n${bold('⚡ JARVIS Squad Status')}\n`);
  console.log(SEP);

  if (!agents.length) {
    console.log(dim('  No agents found.'));
  } else {
    agents.forEach(a => {
      const status  = a.status || 'unknown';
      const dot     = status === 'online'  ? green('●') :
                      status === 'offline' ? red('●')   : yellow('●');
      const agentId = a.id || a.name || '?';
      const task    = taskByAssignee[agentId];
      const taskStr = task
        ? `${yellow(task.id)}  ${dim((task.title || '').slice(0, 35))}`
        : dim('— idle');
      console.log(`  ${dot}  ${bold(padR(agentId, 22))}  ${taskStr}`);
    });
  }

  console.log(SEP + '\n');
}

// ─────────────────────────────────────────────
// ARG PARSING
// ─────────────────────────────────────────────
function padR(str, len) {
  str = String(str);
  return str.length >= len ? str.slice(0, len - 1) + ' ' : str + ' '.repeat(len - str.length);
}

function parseArgs(args) {
  const flags      = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      flags[key] = (args[i + 1] && !args[i + 1].startsWith('--')) ? args[++i] : true;
    } else {
      positional.push(args[i]);
    }
  }
  return { flags, positional };
}

// ─────────────────────────────────────────────
// HELP
// ─────────────────────────────────────────────
function printHelp() {
  console.log(`
${bold(cyan('JARVIS CLI'))} — Mission Control Command Interface
${dim('Agent: ' + AGENT_ID + '  |  API: ' + MC_API_URL)}

${bold('Task Management')}
  ${yellow('jarvis task:status')} <id> <status>        Update task status
  ${yellow('jarvis task:comment')} <id> "msg"           Add a comment
  ${yellow('jarvis task:view')} <id>                   View full task details

${bold('Subtasks')}
  ${yellow('jarvis subtask:add')} <id> "desc"           Add a subtask
  ${yellow('jarvis subtask:check')} <id> <idx>          Toggle subtask done/undone
  ${yellow('jarvis subtask:list')} <id>                List all subtasks

${bold('Deliverables')}
  ${yellow('jarvis deliver')} <id> "name" --path ./f    Register a file deliverable
  ${yellow('jarvis deliver')} <id> "name" --url https   Register a URL deliverable

${bold('Listing')}
  ${yellow('jarvis tasks')}                             List all tasks
  ${yellow('jarvis tasks')} --status IN_PROGRESS        Filter by status
  ${yellow('jarvis tasks')} --assignee oracle            Filter by agent

${bold('Notifications & Squad')}
  ${yellow('jarvis notify')} "msg" --to oracle           Notify an agent
  ${yellow('jarvis squad')}                             Show all agents + active task

${bold('Valid Statuses:')}
  INBOX  TODO  IN_PROGRESS  REVIEW  DONE  BLOCKED  CANCELLED

${bold('Env Vars:')}
  MC_API_URL   API base URL  (default: http://localhost:3000)
  AGENT_ID     Your agent ID (default: tank)
  DEBUG        Set to 1 for stack traces on errors
`);
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') {
    printHelp();
    return;
  }

  const cmd                 = argv[0];
  const { flags, positional } = parseArgs(argv.slice(1));

  try {
    switch (cmd) {
      case 'task:status':  await cmdTaskStatus(positional[0], positional[1]);           break;
      case 'task:comment': await cmdTaskComment(positional[0], positional[1]);          break;
      case 'task:view':    await cmdTaskView(positional[0]);                            break;
      case 'subtask:add':  await cmdSubtaskAdd(positional[0], positional[1]);           break;
      case 'subtask:check':await cmdSubtaskCheck(positional[0], positional[1]);         break;
      case 'subtask:list': await cmdSubtaskList(positional[0]);                         break;
      case 'deliver':      await cmdDeliver(positional[0], positional[1], flags);       break;
      case 'tasks':        await cmdTasks(flags);                                       break;
      case 'notify':       await cmdNotify(positional[0], flags);                      break;
      case 'squad':        await cmdSquad();                                            break;
      default:
        console.error(red(`Unknown command: ${cmd}`));
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(red(`Error: ${err.message}`));
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
