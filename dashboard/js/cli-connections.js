/**
 * CLI Connections Panel — JARVIS Mission Control v1.3.0
 *
 * Displays live CLI tool connections registered via POST /api/connect.
 * Shows tool name, version, cwd, status (active/idle), last heartbeat, and token totals.
 */

// ── Sidebar badge refresh ─────────────────────────────────────────────────
async function refreshCliConnectionsBadge() {
    try {
        const res = await fetch('/api/connect');
        if (!res.ok) return;
        const data = await res.json();
        const sub = document.getElementById('cli-connections-subtitle');
        const badge = document.getElementById('cli-connections-badge');
        const activeCount = data.activeCount || 0;
        const total = data.total || 0;

        if (sub) {
            sub.textContent = activeCount > 0
                ? `${activeCount} active · ${total} total`
                : total > 0
                    ? `${total} connection${total !== 1 ? 's' : ''} (idle)`
                    : 'No connections';
        }
        if (badge) {
            if (activeCount > 0) {
                badge.textContent = activeCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (_) {}
}

// Poll every 15 seconds
refreshCliConnectionsBadge();
setInterval(refreshCliConnectionsBadge, 15_000);

// ── Panel open/close ──────────────────────────────────────────────────────
function openCliConnections() {
    const panel = document.getElementById('cli-connections-panel');
    if (!panel) return;
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.classList.add('open');
    loadCliConnectionsPanel();
}

function closeCliConnections() {
    const panel = document.getElementById('cli-connections-panel');
    if (panel) {
        panel.classList.remove('open');
        panel.style.display = 'none';
    }
}

async function refreshCliConnectionsPanel() {
    await loadCliConnectionsPanel();
}

// ── Panel content ─────────────────────────────────────────────────────────
async function loadCliConnectionsPanel() {
    const listEl = document.getElementById('cli-connections-list');
    const metaEl = document.getElementById('cli-connections-meta');
    if (!listEl) return;

    listEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding:20px 0;">Loading connections…</div>';

    try {
        const res = await fetch('/api/connect');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const { connections = [], total = 0, activeCount = 0 } = data;

        if (metaEl) {
            metaEl.innerHTML = `
                <span>Total: <strong>${total}</strong></span>
                &nbsp;·&nbsp;
                <span style="color:${activeCount > 0 ? '#22c55e' : 'inherit'}">Active: <strong>${activeCount}</strong></span>
                &nbsp;·&nbsp;
                <span style="color:var(--text-muted); font-size:11px;">Refreshes every 15s</span>
            `;
        }

        if (connections.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px; opacity:0.4;">
                        <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                        <path d="M7 9l5 5 5-5"></path>
                    </svg>
                    <div style="font-size:13px;">No CLI connections registered</div>
                    <div style="font-size:11px; margin-top:6px; opacity:0.7;">
                        Use <code style="background:var(--bg-secondary); padding:1px 5px; border-radius:3px;">POST /api/connect</code> to register a CLI tool
                    </div>
                </div>
            `;
            return;
        }

        listEl.innerHTML = connections.map(conn => renderConnection(conn)).join('');

    } catch (err) {
        listEl.innerHTML = `<div style="color:#ef4444; font-size:13px; padding:16px 0;">Error loading connections: ${escapeHtml(err.message)}</div>`;
    }
}

function renderConnection(conn) {
    const isActive = conn.status === 'active';
    const statusColor = isActive ? '#22c55e' : '#f59e0b';
    const statusDot = `<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${statusColor}; margin-right:5px; vertical-align:middle;"></span>`;

    const totalTokens = (conn.tokens?.total || 0).toLocaleString();
    const inputTokens = (conn.tokens?.input || 0).toLocaleString();
    const outputTokens = (conn.tokens?.output || 0).toLocaleString();

    return `
        <div style="
            border: 1px solid var(--border-color, #30363d);
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 10px;
            background: var(--bg-secondary, #0d1117);
        ">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#4f8ef7; flex-shrink:0;">
                        <polyline points="4 17 10 11 4 5"></polyline>
                        <line x1="12" y1="19" x2="20" y2="19"></line>
                    </svg>
                    <strong style="font-size:14px;">${escapeHtml(conn.name)}</strong>
                    <span style="font-size:11px; color:var(--text-muted);">v${escapeHtml(conn.version)}</span>
                </div>
                <span style="font-size:11px; font-weight:600;">
                    ${statusDot}${isActive ? 'Active' : 'Idle'}
                </span>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px; font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(conn.cwd)}">
                📁 ${escapeHtml(conn.cwd)}
            </div>
            ${conn.model ? `<div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">🤖 ${escapeHtml(conn.model)}</div>` : ''}
            <div style="display:flex; gap:16px; font-size:11px; color:var(--text-muted); margin-top:8px; flex-wrap:wrap;">
                <span title="Last heartbeat">🕐 ${escapeHtml(conn.lastHeartbeatAgo || 'never')}</span>
                <span title="Total tokens">🔢 ${totalTokens} tokens total</span>
                <span title="Input / Output tokens" style="color:var(--text-muted);">(↓${inputTokens} / ↑${outputTokens})</span>
                <span title="Heartbeat count">💓 ${conn.heartbeatCount || 0} heartbeats</span>
            </div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:6px; opacity:0.5;">
                ID: ${escapeHtml(conn.id)} · Connected ${escapeHtml(conn.connectedAt ? new Date(conn.connectedAt).toLocaleString() : 'unknown')}
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
