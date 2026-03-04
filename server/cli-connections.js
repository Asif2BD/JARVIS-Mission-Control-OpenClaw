/**
 * CLI Connections Manager — JARVIS Mission Control v1.3.0
 *
 * Ephemeral in-memory registry of connected CLI tools.
 * CLI tools register via POST /api/connect and send periodic heartbeats.
 * No file persistence — connections are lost on server restart by design.
 */

const { randomUUID } = require('crypto');

// Active connection threshold: 5 minutes
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;

// In-memory store: id → connection object
const connections = new Map();

/**
 * Register a new CLI connection.
 * @param {object} opts - { name, version, cwd, token }
 * @returns {object} connection record
 */
function registerConnection({ name, version, cwd, token } = {}) {
    const id = randomUUID();
    const now = Date.now();
    const conn = {
        id,
        name: String(name || 'unknown').slice(0, 128),
        version: String(version || '0.0.0').slice(0, 64),
        cwd: String(cwd || '/').slice(0, 512),
        connectedAt: new Date(now).toISOString(),
        lastHeartbeat: new Date(now).toISOString(),
        lastHeartbeatMs: now,
        tokens: {
            input: 0,
            output: 0,
            total: 0,
        },
        model: null,
        heartbeatCount: 0,
    };
    connections.set(id, conn);
    return conn;
}

/**
 * Record a heartbeat for a connection.
 * @param {string} id - connection UUID
 * @param {object} usage - { inputTokens, outputTokens, model }
 * @returns {object|null} updated connection or null if not found
 */
function heartbeat(id, { inputTokens, outputTokens, model } = {}) {
    const conn = connections.get(id);
    if (!conn) return null;

    const now = Date.now();
    conn.lastHeartbeat = new Date(now).toISOString();
    conn.lastHeartbeatMs = now;
    conn.heartbeatCount++;

    if (typeof inputTokens === 'number' && inputTokens >= 0) {
        conn.tokens.input += inputTokens;
        conn.tokens.total += inputTokens;
    }
    if (typeof outputTokens === 'number' && outputTokens >= 0) {
        conn.tokens.output += outputTokens;
        conn.tokens.total += outputTokens;
    }
    if (model && typeof model === 'string') {
        conn.model = model.slice(0, 128);
    }

    return conn;
}

/**
 * Disconnect / unregister a CLI session.
 * @param {string} id
 * @returns {boolean} true if found and removed
 */
function disconnect(id) {
    return connections.delete(id);
}

/**
 * Get all connections with computed status fields.
 * @returns {Array} list of connection objects with status
 */
function listConnections() {
    const now = Date.now();
    return Array.from(connections.values()).map(conn => ({
        ...conn,
        status: (now - conn.lastHeartbeatMs) < ACTIVE_THRESHOLD_MS ? 'active' : 'idle',
        lastHeartbeatAgo: formatAgo(now - conn.lastHeartbeatMs),
    })).sort((a, b) => {
        // active first, then by lastHeartbeat desc
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return b.lastHeartbeatMs - a.lastHeartbeatMs;
    });
}

/**
 * Get active connection count.
 */
function getActiveCount() {
    const now = Date.now();
    let count = 0;
    for (const conn of connections.values()) {
        if ((now - conn.lastHeartbeatMs) < ACTIVE_THRESHOLD_MS) count++;
    }
    return count;
}

/**
 * Format milliseconds into a human-readable "X ago" string.
 */
function formatAgo(ms) {
    if (ms < 1000) return 'just now';
    if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    return `${Math.floor(ms / 3_600_000)}h ago`;
}

module.exports = {
    registerConnection,
    heartbeat,
    disconnect,
    listConnections,
    getActiveCount,
    ACTIVE_THRESHOLD_MS,
};
