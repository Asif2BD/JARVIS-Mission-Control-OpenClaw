/**
 * Claude Code Sessions Panel — JARVIS Mission Control v1.2.0
 * Displays auto-discovered Claude Code sessions with token usage and cost info.
 */

let claudeSessionsData = null;

// ── Sidebar badge refresh (runs on normal poll cycle) ──────────────────────
async function refreshClaudeSessionsBadge() {
    try {
        const res = await fetch('/api/claude/sessions');
        if (!res.ok) return;
        const data = await res.json();
        claudeSessionsData = data;
        const sub = document.getElementById('claude-sessions-subtitle');
        if (sub) {
            const activeCount = data.activeCount || 0;
            const total = data.total || 0;
            sub.textContent = activeCount > 0
                ? `${activeCount} active · ${total} total`
                : `${total} session${total !== 1 ? 's' : ''}`;
        }
    } catch (_) {}
}

// Call once on page load and every 60s
refreshClaudeSessionsBadge();
setInterval(refreshClaudeSessionsBadge, 60_000);

// ── Panel open/close ───────────────────────────────────────────────────────
async function openClaudeSessions() {
    const panel = document.getElementById('claude-sessions-panel');
    if (!panel) return;
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.classList.add('open');
    await loadClaudeSessionsPanel();
}

function closeClaudeSessions() {
    const panel = document.getElementById('claude-sessions-panel');
    if (panel) {
        panel.classList.remove('open');
        panel.style.display = 'none';
    }
}

// ── Panel content ──────────────────────────────────────────────────────────
async function loadClaudeSessionsPanel(forceRescan = false) {
    const listEl = document.getElementById('claude-sessions-list');
    const metaEl = document.getElementById('claude-sessions-meta');
    if (!listEl) return;

    listEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding:20px 0;">Scanning sessions…</div>';

    try {
        const url = forceRescan ? '/api/claude/sessions?scan=1' : '/api/claude/sessions';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        claudeSessionsData = data;

        // Meta bar
        if (metaEl) {
            const lastScan = data.lastScan ? new Date(data.lastScan).toLocaleTimeString() : 'never';
            metaEl.innerHTML = `
                <span>📁 ${DOMPurify.sanitize(data.projectsDir || '~/.claude/projects')}</span>
                <span>🕐 Last scan: ${DOMPurify.sanitize(lastScan)}</span>
                <span style="cursor:pointer; color:var(--accent);" onclick="loadClaudeSessionsPanel(true)" title="Force rescan">↻ Rescan</span>
            `;
        }

        if (!data.sessions || data.sessions.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center; padding:32px 16px; color:var(--text-muted);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px; opacity:0.4;">
                        <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                        <path d="M8 21h8m-4-4v4"></path>
                    </svg>
                    <p style="margin:0 0 6px; font-weight:500;">No Claude Code sessions found</p>
                    <p style="margin:0; font-size:12px;">Sessions appear here when Claude Code is run locally.<br>Looking in: ${DOMPurify.sanitize(data.projectsDir || '~/.claude/projects')}</p>
                </div>`;
            return;
        }

        listEl.innerHTML = data.sessions.map(s => renderSessionCard(s)).join('');

    } catch (err) {
        listEl.innerHTML = `<div style="color:#ef4444; font-size:13px; padding:12px 0;">Error loading sessions: ${DOMPurify.sanitize(err.message)}</div>`;
    }
}

function renderSessionCard(s) {
    const isActive = s.active;
    const activeDot = isActive
        ? `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; margin-right:6px; flex-shrink:0;"></span>`
        : `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--text-muted); margin-right:6px; flex-shrink:0; opacity:0.4;"></span>`;

    const project = s.project || s.projectDir || 'Unknown';
    const projectShort = project.length > 40 ? '…' + project.slice(-37) : project;

    const lastSeen = s.lastSeen
        ? timeAgo(new Date(s.lastSeen))
        : 'never';

    const totalTokens = s.tokens ? formatTokens(s.tokens.total) : '—';
    const inputTokens = s.tokens ? formatTokens(s.tokens.input) : '—';
    const outputTokens = s.tokens ? formatTokens(s.tokens.output) : '—';
    const cost = s.cost && s.cost.estimated > 0
        ? `$${s.cost.estimated.toFixed(4)}`
        : s.tokens && s.tokens.total === 0 ? '$0.00' : '—';

    const model = s.model && s.model !== 'unknown' ? s.model : null;
    const branch = s.gitBranch || null;

    const errorBadge = s.hasError
        ? `<span style="background:#7f1d1d; color:#fca5a5; font-size:10px; padding:1px 6px; border-radius:4px; margin-left:6px;">error</span>`
        : '';

    return `
    <div style="
        border: 1px solid var(--border-color, #2d2d2d);
        border-radius: 8px;
        padding: 14px;
        margin-bottom: 10px;
        background: var(--card-bg, #1a1a1a);
        ${isActive ? 'border-left: 3px solid #22c55e;' : ''}
    ">
        <div style="display:flex; align-items:center; margin-bottom:8px;">
            ${activeDot}
            <span style="font-size:12px; font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${DOMPurify.sanitize(project)}">${DOMPurify.sanitize(projectShort)}</span>
            ${errorBadge}
            <span style="font-size:11px; color:var(--text-muted); white-space:nowrap; margin-left:8px;">${DOMPurify.sanitize(lastSeen)}</span>
        </div>

        <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px; font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${DOMPurify.sanitize(s.sessionId)}
        </div>

        ${model || branch ? `
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
            ${model ? `<span style="background:var(--bg-secondary,#252525); border:1px solid var(--border-color,#2d2d2d); color:#a78bfa; font-size:10px; padding:2px 7px; border-radius:4px;">🤖 ${DOMPurify.sanitize(model)}</span>` : ''}
            ${branch ? `<span style="background:var(--bg-secondary,#252525); border:1px solid var(--border-color,#2d2d2d); color:#60a5fa; font-size:10px; padding:2px 7px; border-radius:4px;">⎇ ${DOMPurify.sanitize(branch)}</span>` : ''}
        </div>` : ''}

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px;">
            ${statChip('💬', 'Messages', String(s.messageCount || 0))}
            ${statChip('⬆', 'Input', inputTokens)}
            ${statChip('⬇', 'Output', outputTokens)}
            ${statChip('💰', 'Cost', cost)}
        </div>

        ${s.hasError && s.lastError ? `
        <div style="margin-top:8px; font-size:11px; color:#fca5a5; background:#1c0a0a; border:1px solid #7f1d1d; border-radius:4px; padding:6px 8px;">
            ⚠ ${DOMPurify.sanitize(String(s.lastError))}
        </div>` : ''}
    </div>`;
}

function statChip(icon, label, value) {
    return `
    <div style="background:var(--bg-secondary,#252525); border:1px solid var(--border-color,#2d2d2d); border-radius:6px; padding:6px 8px; text-align:center;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">${icon} ${label}</div>
        <div style="font-size:13px; font-weight:600;">${DOMPurify.sanitize(value)}</div>
    </div>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTokens(n) {
    if (!n || n === 0) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

function timeAgo(date) {
    const now = Date.now();
    const diff = now - date.getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}
