/**
 * Claude Code Session Scanner
 *
 * Auto-discovers local Claude Code sessions by scanning ~/.claude/projects/.
 * Extracts token usage, model info, message counts, cost estimates, and active status
 * from JSONL transcripts. Scans every 60 seconds via background scheduler.
 *
 * v1.2.0 feature — Week 2, Task 1
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

// Configurable via MC_CLAUDE_HOME env var.
// Auto-detect: check common locations if default ~/.claude doesn't exist.
function detectClaudeHome() {
    if (process.env.MC_CLAUDE_HOME) return process.env.MC_CLAUDE_HOME;
    const candidates = [
        path.join(os.homedir(), '.claude'),
        '/home/xcloud/.claude',
        '/root/.claude',
    ];
    for (const c of candidates) {
        if (fsSync.existsSync(path.join(c, 'projects'))) return c;
    }
    return candidates[0]; // fall back to default even if missing
}
const CLAUDE_HOME = detectClaudeHome();
const PROJECTS_DIR = path.join(CLAUDE_HOME, 'projects');

// Approximate cost per 1M tokens (USD) — fallback if no model-specific pricing
const MODEL_PRICING = {
  'claude-opus-4':      { input: 15.00, output: 75.00 },
  'claude-opus-4-5':    { input: 15.00, output: 75.00 },
  'claude-sonnet-4':    { input: 3.00,  output: 15.00 },
  'claude-sonnet-4-5':  { input: 3.00,  output: 15.00 },
  'claude-sonnet-4-6':  { input: 3.00,  output: 15.00 },
  'claude-haiku-4':     { input: 0.80,  output: 4.00  },
  'claude-haiku-4-5':   { input: 0.80,  output: 4.00  },
  'claude-3-5-sonnet':  { input: 3.00,  output: 15.00 },
  'claude-3-5-haiku':   { input: 0.80,  output: 4.00  },
  'claude-3-opus':      { input: 15.00, output: 75.00 },
  default:              { input: 3.00,  output: 15.00 },
};

// Session is considered "active" if last message was within 30 minutes
const ACTIVE_THRESHOLD_MS = 30 * 60 * 1000;

// In-memory cache: sessionId → session data
let sessionCache = new Map();
let lastScan = null;
let scanInterval = null;

/**
 * Convert a project directory name to a human-readable project path.
 * Claude encodes paths as: -root--openclaw-workspace-foo → /root/.openclaw/workspace/foo
 */
function decodeProjectDir(dirName) {
  // Replace leading dash + double dashes to reconstruct the path
  return dirName
    .replace(/^-/, '/')          // leading - → /
    .replace(/--/g, '/')         // -- → /
    .replace(/-([^-])/g, '/$1'); // remaining -x → /x  (handles single dashes in dir names poorly, best effort)
}

/**
 * Parse a single JSONL session file and extract session metadata.
 */
async function parseSessionFile(filePath, projectDir) {
  const sessionId = path.basename(filePath, '.jsonl');
  let firstTimestamp = null;
  let lastTimestamp = null;
  let messageCount = 0;
  let userMessages = 0;
  let assistantMessages = 0;
  let model = null;
  let version = null;
  let gitBranch = null;
  let cwd = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;
  let hasError = false;
  let lastError = null;

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue; // Skip malformed lines
      }

      if (!entry.timestamp) continue;

      const ts = new Date(entry.timestamp).getTime();
      if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
      if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;

      // Extract metadata from user/assistant messages
      if (entry.type === 'user') {
        userMessages++;
        messageCount++;
        if (!version && entry.version) version = entry.version;
        if (!gitBranch && entry.gitBranch) gitBranch = entry.gitBranch;
        if (!cwd && entry.cwd) cwd = entry.cwd;
      }

      if (entry.type === 'assistant') {
        assistantMessages++;
        messageCount++;
        if (!version && entry.version) version = entry.version;
        if (!gitBranch && entry.gitBranch) gitBranch = entry.gitBranch;
        if (!cwd && entry.cwd) cwd = entry.cwd;

        // Extract token usage from assistant messages
        if (entry.message && entry.message.usage) {
          const u = entry.message.usage;
          totalInputTokens += (u.input_tokens || 0);
          totalOutputTokens += (u.output_tokens || 0);
          totalCacheReadTokens += (u.cache_read_input_tokens || 0);
          totalCacheCreationTokens += (u.cache_creation_input_tokens || 0);
        }

        // Extract model
        if (!model && entry.message && entry.message.model) {
          model = entry.message.model;
        }

        // Track errors
        if (entry.error) {
          hasError = true;
          lastError = entry.error;
        }
        if (entry.isApiErrorMessage) {
          hasError = true;
        }
      }

      // Also check summary/usage entries some versions emit
      if (entry.type === 'usage' || entry.type === 'summary') {
        if (entry.usage) {
          totalInputTokens += (entry.usage.input_tokens || 0);
          totalOutputTokens += (entry.usage.output_tokens || 0);
        }
        if (entry.model && !model) model = entry.model;
      }
    }
  } catch (err) {
    // File read error — return minimal session
    return {
      sessionId,
      projectDir,
      project: decodeProjectDir(projectDir),
      error: err.message,
      messageCount: 0,
      active: false,
    };
  }

  // Cost estimate
  const pricing = getModelPricing(model);
  const inputCost = (totalInputTokens / 1_000_000) * pricing.input;
  const outputCost = (totalOutputTokens / 1_000_000) * pricing.output;
  const cacheReadCost = (totalCacheReadTokens / 1_000_000) * (pricing.input * 0.1); // cache read ~10% of input
  const estimatedCost = inputCost + outputCost + cacheReadCost;

  const now = Date.now();
  const active = lastTimestamp ? (now - lastTimestamp) < ACTIVE_THRESHOLD_MS : false;

  return {
    sessionId,
    projectDir,
    project: cwd || decodeProjectDir(projectDir),
    model: model || 'unknown',
    version: version || 'unknown',
    gitBranch: gitBranch || null,
    messageCount,
    userMessages,
    assistantMessages,
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      cacheRead: totalCacheReadTokens,
      cacheCreation: totalCacheCreationTokens,
      total: totalInputTokens + totalOutputTokens,
    },
    cost: {
      estimated: Math.round(estimatedCost * 10000) / 10000, // 4 decimal places
      currency: 'USD',
    },
    firstSeen: firstTimestamp ? new Date(firstTimestamp).toISOString() : null,
    lastSeen: lastTimestamp ? new Date(lastTimestamp).toISOString() : null,
    active,
    hasError,
    lastError: lastError || null,
  };
}

function getModelPricing(model) {
  if (!model) return MODEL_PRICING.default;
  const key = Object.keys(MODEL_PRICING).find(k => model.includes(k));
  return key ? MODEL_PRICING[key] : MODEL_PRICING.default;
}

/**
 * Scan all projects and sessions under CLAUDE_HOME/projects/.
 * Returns array of session objects.
 */
async function scanSessions() {
  try {
    await fs.access(PROJECTS_DIR);
  } catch {
    // No projects directory — Claude Code not installed or no sessions yet
    return [];
  }

  const sessions = [];
  let projectDirs;

  try {
    projectDirs = await fs.readdir(PROJECTS_DIR);
  } catch {
    return [];
  }

  for (const projectDir of projectDirs) {
    const projectPath = path.join(PROJECTS_DIR, projectDir);
    let stat;
    try {
      stat = await fs.stat(projectPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    let files;
    try {
      files = await fs.readdir(projectPath);
    } catch {
      continue;
    }

    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    for (const file of jsonlFiles) {
      const filePath = path.join(projectPath, file);
      const session = await parseSessionFile(filePath, projectDir);
      sessions.push(session);
    }
  }

  // Sort: active first, then by lastSeen desc
  sessions.sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    const aTs = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
    const bTs = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
    return bTs - aTs;
  });

  // Update cache
  sessionCache = new Map(sessions.map(s => [s.sessionId, s]));
  lastScan = new Date().toISOString();

  return sessions;
}

/**
 * Get sessions from cache (instant, no disk I/O).
 */
function getCachedSessions() {
  return {
    sessions: Array.from(sessionCache.values()),
    lastScan,
    claudeHome: CLAUDE_HOME,
    projectsDir: PROJECTS_DIR,
  };
}

/**
 * Start background scanner — scans every 60 seconds.
 */
function startScanner() {
  if (scanInterval) return; // Already running

  // Initial scan
  scanSessions().catch(err => console.error('[claude-sessions] Initial scan error:', err));

  scanInterval = setInterval(() => {
    scanSessions().catch(err => console.error('[claude-sessions] Scan error:', err));
  }, 60_000);

  console.log(`[claude-sessions] Scanner started — watching ${PROJECTS_DIR} every 60s`);
}

/**
 * Stop background scanner.
 */
function stopScanner() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
}

module.exports = {
  startScanner,
  stopScanner,
  scanSessions,
  getCachedSessions,
  CLAUDE_HOME,
  PROJECTS_DIR,
};
