/**
 * MissionDeck Cloud Sync Module
 *
 * Watches .mission-control/tasks/ and .mission-control/agents/ for changes
 * and pushes diffs to the MissionDeck API so the cloud dashboard stays live.
 *
 * Activated automatically when MISSIONDECK_API_KEY is set in config.yaml
 * or as environment variable MISSIONDECK_API_KEY.
 *
 * Usage (from server/index.js):
 *   const { startMissionDeckSync } = require('./missiondeck-sync');
 *   startMissionDeckSync({ missionControlDir, clientVersion });
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const MISSIONDECK_API = process.env.MISSIONDECK_URL || 'https://missiondeck.ai';
const SYNC_ENDPOINT = `${MISSIONDECK_API}/functions/v1/mc-sync`;
const DEBOUNCE_MS = 3000;       // wait 3s after last change before syncing
const FULL_SYNC_INTERVAL = 300000; // full sync every 5 minutes

let syncTimer = null;
let lastSyncHash = null;
let isRunning = false;

/**
 * Start watching for changes and syncing to MissionDeck.
 * @param {object} opts
 * @param {string} opts.missionControlDir - path to .mission-control directory
 * @param {string} [opts.apiKey]           - override env var
 * @param {string} [opts.clientVersion]    - e.g. "1.0.0"
 */
function startMissionDeckSync({ missionControlDir, apiKey, clientVersion = 'unknown' }) {
  const key = apiKey || process.env.MISSIONDECK_API_KEY;
  if (!key) return; // Not configured — skip silently

  const tasksDir = path.join(missionControlDir, 'tasks');
  const agentsDir = path.join(missionControlDir, 'agents');

  console.log('☁️  MissionDeck sync enabled — watching for changes...');
  isRunning = true;

  // Do an immediate full sync on startup
  doFullSync({ missionControlDir, apiKey: key, clientVersion });

  // Watch tasks directory
  watchDir(tasksDir, () => scheduleSync({ missionControlDir, apiKey: key, clientVersion }));

  // Watch agents directory (if exists)
  if (fs.existsSync(agentsDir)) {
    watchDir(agentsDir, () => scheduleSync({ missionControlDir, apiKey: key, clientVersion }));
  }

  // Periodic full sync as safety net
  setInterval(() => {
    doFullSync({ missionControlDir, apiKey: key, clientVersion });
  }, FULL_SYNC_INTERVAL);
}

function watchDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.watch(dir, { persistent: false }, (eventType, filename) => {
      if (filename && filename.endsWith('.json')) {
        callback();
      }
    });
  } catch (e) {
    console.warn('MissionDeck: could not watch', dir, '—', e.message);
  }
}

function scheduleSync(opts) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => doFullSync(opts), DEBOUNCE_MS);
}

async function doFullSync({ missionControlDir, apiKey, clientVersion }) {
  if (!isRunning) return;
  try {
    const tasks = readJsonDir(path.join(missionControlDir, 'tasks'));
    const agents = readJsonDir(path.join(missionControlDir, 'agents'));

    // Simple hash to avoid redundant syncs
    const hash = simpleHash(JSON.stringify({ tasks: tasks.length, agents: agents.length }));
    if (hash === lastSyncHash) return;

    const payload = JSON.stringify({ tasks, agents, deleted_ids: [], client_version: clientVersion });

    const result = await postJson(SYNC_ENDPOINT, payload, apiKey);

    if (result.ok) {
      lastSyncHash = hash;
      console.log(`☁️  MissionDeck synced — ${result.tasks_upserted} tasks → ${result.dashboard_url}`);
    } else {
      console.warn('MissionDeck sync failed:', result.error);
    }
  } catch (err) {
    console.warn('MissionDeck sync error:', err.message);
  }
}

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== '.gitkeep')
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
      catch (e) { return null; }
    })
    .filter(Boolean);
}

function postJson(url, payload, apiKey) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 15000,
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ ok: false, error: 'Invalid JSON response' }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Sync timeout')); });
    req.write(payload);
    req.end();
  });
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h.toString(36);
}

module.exports = { startMissionDeckSync };
