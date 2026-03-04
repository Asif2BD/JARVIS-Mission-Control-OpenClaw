/**
 * JARVIS Mission Control — Webhook Delivery Manager
 *
 * Persistent delivery log + retry queue using JSON file storage
 * (matches project's existing file-based storage pattern).
 *
 * Features:
 * - Persists every delivery attempt to .mission-control/webhook-deliveries/
 * - Exponential backoff: 1s → 2s → 4s → 8s → 16s (max 5 attempts)
 * - Circuit breaker: ≥3 consecutive failures → disable webhook
 * - Background worker polls pending retries every 60s
 * - Survives server restarts (all state on disk)
 *
 * v1.13.0 — Week 2 persistent delivery
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000]; // per attempt index
const MAX_ATTEMPTS = 5;
const CIRCUIT_FAILURE_THRESHOLD = 3; // consecutive failures to open circuit
const CIRCUIT_RESET_MS = 60_000;     // 60s before half-open probe

let deliveriesDir = null;
let workerInterval = null;

// In-process circuit state cache (synced from webhook registry)
// Key: webhookId, Value: { failures, circuitState, circuitOpenedAt }
let circuitCache = new Map();

// Reference to the webhooks Map from index.js — injected at init
let webhooksRef = null;

// ── Init ─────────────────────────────────────────────────────────────────────

async function init(missionControlDir, webhooks) {
    deliveriesDir = path.join(missionControlDir, 'webhook-deliveries');
    webhooksRef = webhooks;

    try {
        await fs.mkdir(deliveriesDir, { recursive: true });
    } catch {}

    // Load circuit state from webhook registry
    for (const [id, wh] of webhooks.entries()) {
        circuitCache.set(id, {
            failures: wh.failures || 0,
            circuitState: wh.circuitState || 'closed',
            circuitOpenedAt: wh.circuitOpenedAt || null,
        });
    }

    startWorker();
}

// ── Delivery record helpers ───────────────────────────────────────────────────

function deliveryPath(deliveryId) {
    return path.join(deliveriesDir, `${deliveryId}.json`);
}

async function saveDelivery(delivery) {
    await fs.writeFile(deliveryPath(delivery.id), JSON.stringify(delivery, null, 2));
}

async function loadDelivery(deliveryId) {
    try {
        const raw = await fs.readFile(deliveryPath(deliveryId), 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function listDeliveries(webhookId, limit = 50) {
    try {
        const files = await fs.readdir(deliveriesDir);
        const results = [];
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const raw = await fs.readFile(path.join(deliveriesDir, file), 'utf8');
                const d = JSON.parse(raw);
                if (d.webhookId === webhookId) results.push(d);
            } catch {}
        }
        results.sort((a, b) => b.createdAt - a.createdAt);
        return results.slice(0, limit);
    } catch {
        return [];
    }
}

async function listPendingRetries() {
    try {
        const files = await fs.readdir(deliveriesDir);
        const now = Date.now();
        const results = [];
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const raw = await fs.readFile(path.join(deliveriesDir, file), 'utf8');
                const d = JSON.parse(raw);
                if (d.status === 'pending' && d.nextRetryAt && d.nextRetryAt <= now) {
                    results.push(d);
                }
            } catch {}
        }
        return results.slice(0, 20); // max 20 per worker tick
    } catch {
        return [];
    }
}

// ── Enqueue a new delivery ────────────────────────────────────────────────────

async function enqueue(webhookId, url, event, payload) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const delivery = {
        id,
        webhookId,
        url,
        event,
        payload,
        status: 'pending',
        attempts: 0,
        nextRetryAt: now, // eligible immediately
        lastError: null,
        createdAt: now,
        updatedAt: now,
    };
    await saveDelivery(delivery);
    return delivery;
}

// ── Attempt a single delivery ─────────────────────────────────────────────────

async function attemptDelivery(delivery) {
    const circuit = circuitCache.get(delivery.webhookId);
    const webhook = webhooksRef ? webhooksRef.get(delivery.webhookId) : null;

    // Check circuit breaker
    if (circuit && circuit.circuitState === 'open') {
        const elapsed = Date.now() - (circuit.circuitOpenedAt || 0);
        if (elapsed < CIRCUIT_RESET_MS) {
            // Still open — postpone delivery by 60s
            delivery.nextRetryAt = Date.now() + CIRCUIT_RESET_MS;
            delivery.updatedAt = Date.now();
            await saveDelivery(delivery);
            return { success: false, circuitOpen: true };
        }
        // Transition to half-open
        circuit.circuitState = 'half-open';
        if (webhook) webhook.circuitState = 'half-open';
        circuitCache.set(delivery.webhookId, circuit);
    }

    delivery.attempts++;
    delivery.updatedAt = Date.now();

    let success = false;
    let statusCode = null;
    let errorMsg = null;

    try {
        const response = await fetch(delivery.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'JARVIS-Mission-Control/1.0',
                'X-Webhook-Event': delivery.event,
                'X-Delivery-ID': delivery.id,
            },
            body: JSON.stringify(delivery.payload),
            signal: AbortSignal.timeout(10_000),
        });
        statusCode = response.status;
        success = response.ok;
        if (!success) errorMsg = `HTTP ${statusCode}`;
    } catch (err) {
        errorMsg = err.message;
    }

    if (success) {
        delivery.status = 'success';
        delivery.lastError = null;
        // Close circuit on success
        if (circuit) {
            circuit.failures = 0;
            circuit.circuitState = 'closed';
            circuit.circuitOpenedAt = null;
            circuitCache.set(delivery.webhookId, circuit);
            if (webhook) {
                webhook.failures = 0;
                webhook.circuitState = 'closed';
                webhook.circuitOpenedAt = null;
            }
        }
    } else {
        delivery.lastError = errorMsg;
        const attemptIdx = Math.min(delivery.attempts, BACKOFF_MS.length - 1);

        if (delivery.attempts >= MAX_ATTEMPTS) {
            delivery.status = 'failed';
            delivery.nextRetryAt = null;
        } else {
            delivery.status = 'pending';
            delivery.nextRetryAt = Date.now() + BACKOFF_MS[attemptIdx];
        }

        // Update circuit breaker failure count
        if (circuit) {
            circuit.failures = (circuit.failures || 0) + 1;
            if (circuit.circuitState === 'half-open' || circuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
                circuit.circuitState = 'open';
                circuit.circuitOpenedAt = Date.now();
            }
            circuitCache.set(delivery.webhookId, circuit);
            if (webhook) {
                webhook.failures = circuit.failures;
                webhook.circuitState = circuit.circuitState;
                webhook.circuitOpenedAt = circuit.circuitOpenedAt;
            }
        }
    }

    delivery.updatedAt = Date.now();
    await saveDelivery(delivery);
    return { success, statusCode, errorMsg };
}

// ── Manual retry ─────────────────────────────────────────────────────────────

async function retryDelivery(deliveryId) {
    const delivery = await loadDelivery(deliveryId);
    if (!delivery) return { error: 'Delivery not found' };
    if (delivery.status === 'success') return { error: 'Already succeeded' };

    // Reset to pending for immediate retry
    delivery.status = 'pending';
    delivery.nextRetryAt = Date.now();
    delivery.updatedAt = Date.now();
    await saveDelivery(delivery);

    return attemptDelivery(delivery);
}

// ── Circuit breaker reset ─────────────────────────────────────────────────────

async function resetCircuit(webhookId) {
    const circuit = circuitCache.get(webhookId) || {};
    circuit.failures = 0;
    circuit.circuitState = 'closed';
    circuit.circuitOpenedAt = null;
    circuitCache.set(webhookId, circuit);

    const webhook = webhooksRef ? webhooksRef.get(webhookId) : null;
    if (webhook) {
        webhook.failures = 0;
        webhook.circuitState = 'closed';
        webhook.circuitOpenedAt = null;
    }
    return { ok: true };
}

// ── Background worker ─────────────────────────────────────────────────────────

function startWorker() {
    if (workerInterval) return;
    workerInterval = setInterval(async () => {
        try {
            const pending = await listPendingRetries();
            for (const delivery of pending) {
                await attemptDelivery(delivery);
            }
        } catch {}
    }, 60_000);
    console.log('[webhook-delivery] Retry worker started (60s interval)');
}

function stopWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
    }
}

// ── Summary stats ─────────────────────────────────────────────────────────────

async function getStats(webhookId) {
    const deliveries = await listDeliveries(webhookId, 100);
    return {
        total: deliveries.length,
        success: deliveries.filter(d => d.status === 'success').length,
        failed: deliveries.filter(d => d.status === 'failed').length,
        pending: deliveries.filter(d => d.status === 'pending').length,
        circuitState: circuitCache.get(webhookId)?.circuitState || 'closed',
        failures: circuitCache.get(webhookId)?.failures || 0,
    };
}

module.exports = {
    init,
    enqueue,
    attemptDelivery,
    retryDelivery,
    resetCircuit,
    loadDelivery,
    listDeliveries,
    getStats,
    startWorker,
    stopWorker,
};
