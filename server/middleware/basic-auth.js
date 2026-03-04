/**
 * JARVIS Mission Control — Basic Auth Middleware
 * Protects the dashboard from unauthorized access.
 *
 * Set environment variables:
 *   MC_AUTH_USER=architect
 *   MC_AUTH_PASS=<strong-password>
 *
 * If MC_AUTH_PASS is not set, auth is disabled (dev mode).
 */

const REALM = 'Zion Matrix Control — Authorized Access Only';

function basicAuth(req, res, next) {
    // Skip if no password configured (local dev)
    if (!process.env.MC_AUTH_PASS) return next();

    // Always allow API requests from agents (Bearer token or no auth header on localhost)
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    if (isLocalhost) return next();

    // Allow API routes with valid agent token if configured
    if (req.path.startsWith('/api/') && process.env.MC_AGENT_TOKEN) {
        const bearer = req.headers['authorization'];
        if (bearer === `Bearer ${process.env.MC_AGENT_TOKEN}`) return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.set('WWW-Authenticate', `Basic realm="${REALM}"`);
        return res.status(401).send('Unauthorized');
    }

    const base64 = authHeader.slice(6);
    const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');

    const expectedUser = process.env.MC_AUTH_USER || 'architect';
    const expectedPass = process.env.MC_AUTH_PASS;

    if (user === expectedUser && pass === expectedPass) {
        return next();
    }

    res.set('WWW-Authenticate', `Basic realm="${REALM}"`);
    return res.status(401).send('Unauthorized');
}

module.exports = basicAuth;
