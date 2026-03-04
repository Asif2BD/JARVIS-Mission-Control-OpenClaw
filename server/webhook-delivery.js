/**
 * JARVIS Mission Control — Webhook Delivery Manager (SQLite)
 *
 * Production-grade persistent delivery log using SQLite (better-sqlite3, WAL mode).
 * Upgrades the file-based v1.13.0 to a proper DB-backed system.
 *
 * v1.14.0-pre (ships as part of v1.13.0 SQLite upgrade)
 *
 * DB location: .mission-control/webhook-deliveries.db
 *
 * Retry schedule (exponential backoff, max 5 attempts):
 *   Attempt 1 → immediate
 *   Attempt 2 → +1s
 *   Attempt 3 → +2s
 *   Attempt 4 → +4s
 *   Attempt 5 → +8s
 *   After 5   → permanently failed
 *
 * Circuit breaker (per webhook, derived from last 5 deliveries):
 *   ≥3 failures in last 5 → circuit opens (60s cooldown)
 *   POST /api/webhooks/:id/reset-circuit → manual reset
 */

'use strict';

const Database = require('better-sqlite3');
const crypto   = require('crypto');
const path     = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const BACKOFF_MS          = [0, 1000, 2000, 4000, 8000]; // by attempt index (0=immediate)
const MAX_ATTEMPTS        = 5;
const CIRCUIT_WINDOW      = 5;          // last N completed deliveries
const CIRCUIT_THRESH      = 3;          // failures in window to open circuit
const CIRCUIT_TTL_MS      = 60_000;     // 60s before half-open probe
const WORKER_INTERVAL_MS  = 60_000;
const FETCH_TIMEOUT_MS    = 10_000;

// ── State ─────────────────────────────────────────────────────────────────────
let db          = null;
let workerTimer = null;
let webhooksRef = null;   // injected Map from index.js

// In-memory circuit override (reset/half-open state, cleared on restart — re-derived from DB)
const _circuitOverride = new Map(); // webhookId → { state, openedAt }

// ── Schema ────────────────────────────────────────────────────────────────────
const SCHEMA = `
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id            TEXT PRIMARY KEY,
    webhook_id    TEXT NOT NULL,
    url           TEXT NOT NULL,
    event         TEXT NOT NULL,
    payload       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    attempts      INTEGER NOT NULL DEFAULT 0,
    next_retry_at INTEGER,
    last_error    TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wd_webhook   ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wd_pending   ON webhook_deliveries(status, next_retry_at)
    WHERE status = 'pending';
`;

// ── Init ──────────────────────────────────────────────────────────────────────

function init(missionControlDir, webhooks) {
    if (db) return;
    webhooksRef = webhooks;

    const dbPath = path.join(missionControlDir, 'webhook-deliveries.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(SCHEMA);

    console.log(`[webhook-delivery] SQLite DB ready: ${dbPath}`);
    _startWorker();
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

function enqueue(webhookId, url, event, payload) {
    _assertReady();
    const id  = crypto.randomUUID();
    const now = Date.now();
    db.prepare(`
        INSERT INTO webhook_deliveries
            (id, webhook_id, url, event, payload, status, attempts, next_retry_at, last_error, created_at, updated_at)
        VALUES (?,?,?,?,?,'pending',0,?,NULL,?,?)
    `).run(id, webhookId, url, event, JSON.stringify(payload), now, now, now);
    return db.prepare('SELECT * FROM webhook_deliveries WHERE id=?').get(id);
}

// ── Attempt ───────────────────────────────────────────────────────────────────

async function attemptDelivery(row) {
    _assertReady();
    const webhookId = row.webhook_id;
    const circuit   = _getCircuit(webhookId);

    // ── Circuit breaker gate ──
    if (circuit.state === 'open') {
        const elapsed = Date.now() - (circuit.openedAt || 0);
        if (elapsed < CIRCUIT_TTL_MS) {
            // Still tripped — postpone
            db.prepare(`UPDATE webhook_deliveries SET next_retry_at=?, updated_at=? WHERE id=?`)
              .run(circuit.openedAt + CIRCUIT_TTL_MS + 1000, Date.now(), row.id);
            return { success: false, circuitOpen: true };
        }
        // Transition to half-open
        _circuitOverride.set(webhookId, { state: 'half-open', openedAt: circuit.openedAt });
    }

    const newAttempts = row.attempts + 1;
    let success    = false;
    let lastError  = null;
    let statusCode = null;

    try {
        const response = await fetch(row.url, {
            method:  'POST',
            headers: {
                'Content-Type':   'application/json',
                'User-Agent':     'JARVIS-Mission-Control/1.0',
                'X-Webhook-Event': row.event,
                'X-Delivery-ID':  row.id,
            },
            body:   row.payload,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        statusCode = response.status;
        success    = response.ok;
        if (!success) lastError = `HTTP ${statusCode}`;
    } catch (err) {
        lastError = err.message;
    }

    const now    = Date.now();
    const isHalf = _getCircuit(webhookId).state === 'half-open';

    if (success) {
        db.prepare(`UPDATE webhook_deliveries SET status='success', attempts=?, last_error=NULL, next_retry_at=NULL, updated_at=? WHERE id=?`)
          .run(newAttempts, now, row.id);
        _circuitOverride.delete(webhookId);
        _syncWebhook(webhookId, { failures: 0, circuitState: 'closed', circuitOpenedAt: null });
    } else {
        const permanent  = newAttempts >= MAX_ATTEMPTS || isHalf;
        const nextRetry  = permanent ? null : now + (BACKOFF_MS[newAttempts] || 16_000);
        db.prepare(`UPDATE webhook_deliveries SET status=?, attempts=?, last_error=?, next_retry_at=?, updated_at=? WHERE id=?`)
          .run(permanent ? 'failed' : 'pending', newAttempts, lastError, nextRetry, now, row.id);

        // Re-derive circuit state from last CIRCUIT_WINDOW completed deliveries
        const recent = db.prepare(`
            SELECT status FROM webhook_deliveries
            WHERE webhook_id=? AND status IN ('success','failed')
            ORDER BY updated_at DESC LIMIT ?
        `).all(webhookId, CIRCUIT_WINDOW);
        const failures = recent.filter(r => r.status === 'failed').length;

        if (failures >= CIRCUIT_THRESH || isHalf) {
            const openedAt = _getCircuit(webhookId).openedAt || now;
            _circuitOverride.set(webhookId, { state: 'open', openedAt });
            _syncWebhook(webhookId, { failures, circuitState: 'open', circuitOpenedAt: openedAt });
            broadcast('webhook.circuit_opened', { id: webhookId, failures });
        } else {
            _syncWebhook(webhookId, { failures });
        }
    }

    return { success, statusCode, lastError };
}

// ── Manual retry ──────────────────────────────────────────────────────────────

async function retryDelivery(deliveryId) {
    _assertReady();
    const row = db.prepare('SELECT * FROM webhook_deliveries WHERE id=?').get(deliveryId);
    if (!row)                   return { error: 'Delivery not found' };
    if (row.status === 'success') return { error: 'Already succeeded' };

    db.prepare(`UPDATE webhook_deliveries SET status='pending', next_retry_at=?, updated_at=? WHERE id=?`)
      .run(Date.now(), Date.now(), deliveryId);

    return attemptDelivery(db.prepare('SELECT * FROM webhook_deliveries WHERE id=?').get(deliveryId));
}

// ── Reset circuit ─────────────────────────────────────────────────────────────

function resetCircuit(webhookId) {
    _circuitOverride.delete(webhookId);
    _syncWebhook(webhookId, { failures: 0, circuitState: 'closed', circuitOpenedAt: null });
    return { ok: true, webhookId, circuitState: 'closed' };
}

// ── Queries ───────────────────────────────────────────────────────────────────

function listDeliveries(webhookId, limit = 50) {
    _assertReady();
    return db.prepare(`
        SELECT * FROM webhook_deliveries WHERE webhook_id=? ORDER BY created_at DESC LIMIT ?
    `).all(webhookId, Math.min(limit, 100)).map(_hydrate);
}

function getStats(webhookId) {
    _assertReady();
    const r = db.prepare(`
        SELECT COUNT(*) AS total,
               SUM(status='success') AS success,
               SUM(status='failed')  AS failed,
               SUM(status='pending') AS pending
        FROM webhook_deliveries WHERE webhook_id=?
    `).get(webhookId);
    const wh = webhooksRef ? webhooksRef.get(webhookId) : null;
    const circuit = _getCircuit(webhookId);
    return {
        total:        r?.total   || 0,
        success:      r?.success || 0,
        failed:       r?.failed  || 0,
        pending:      r?.pending || 0,
        circuitState: circuit.state,
        failures:     wh?.failures || 0,
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _getCircuit(webhookId) {
    // Manual override takes precedence (reset / half-open)
    const override = _circuitOverride.get(webhookId);
    if (override) return override;

    // Derive from recent deliveries
    if (!db) return { state: 'closed', openedAt: null };
    const recent = db.prepare(`
        SELECT status FROM webhook_deliveries
        WHERE webhook_id=? AND status IN ('success','failed')
        ORDER BY updated_at DESC LIMIT ?
    `).all(webhookId, CIRCUIT_WINDOW);
    const failures = recent.filter(r => r.status === 'failed').length;

    if (failures >= CIRCUIT_THRESH) {
        // Find when circuit opened (updated_at of oldest failure in the bad streak)
        const openedAt = Date.now(); // approximate
        _circuitOverride.set(webhookId, { state: 'open', openedAt });
        return { state: 'open', openedAt };
    }
    return { state: 'closed', openedAt: null };
}

function _syncWebhook(webhookId, fields) {
    const wh = webhooksRef ? webhooksRef.get(webhookId) : null;
    if (!wh) return;
    if ('failures'       in fields) wh.failures       = fields.failures;
    if ('circuitState'   in fields) wh.circuitState   = fields.circuitState;
    if ('circuitOpenedAt' in fields) wh.circuitOpenedAt = fields.circuitOpenedAt;
}

function _hydrate(row) {
    try { row.payload = JSON.parse(row.payload); } catch {}
    return row;
}

function _assertReady() {
    if (!db) throw new Error('webhook-delivery: call init() first');
}

// ── Background worker ─────────────────────────────────────────────────────────

function _startWorker() {
    if (workerTimer) return;
    workerTimer = setInterval(async () => {
        try {
            const rows = db.prepare(`
                SELECT * FROM webhook_deliveries
                WHERE status='pending' AND next_retry_at IS NOT NULL AND next_retry_at <= ?
                ORDER BY next_retry_at ASC LIMIT 20
            `).all(Date.now());
            for (const row of rows) {
                try { await attemptDelivery(row); } catch {}
            }
        } catch {}
    }, WORKER_INTERVAL_MS);
    console.log('[webhook-delivery] Retry worker started (60s interval)');
}

function stopWorker() {
    if (workerTimer) { clearInterval(workerTimer); workerTimer = null; }
}

// broadcast is set from index.js after init — make it patchable
let broadcast = () => {};
function setBroadcast(fn) { broadcast = fn; }

module.exports = { init, enqueue, attemptDelivery, retryDelivery, resetCircuit, listDeliveries, getStats, stopWorker, setBroadcast };
