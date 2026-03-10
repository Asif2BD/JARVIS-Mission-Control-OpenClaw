/**
 * OpenClaw Sessions Panel — JARVIS Mission Control v2.1.0
 * Displays OpenClaw gateway sessions across all agents with token usage.
 */

let openclawSessionsData = null;

// ── Sidebar badge refresh ──────────────────────────────────────────────────
async function refreshOpenclawSessionsBadge() {
    try {
        const res = await fetch('/api/openclaw/sessions');
        if (!res.ok) return;
        const data = await res.json();
        openclawSessionsData = data;
        
        const sub = document.getElementById('openclaw-sessions-subtitle');
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
refreshOpenclawSessionsBadge();
setInterval(refreshOpenclawSessionsBadge, 60_000);

// ── Panel open/close ───────────────────────────────────────────────────────
async function openOpenclawSessions() {
    const panel = document.getElementById('openclaw-sessions-panel');
    if (!panel) return;
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.classList.add('open');
    await loadOpenclawSessionsPanel();
}

function closeOpenclawSessions() {
    const panel = document.getElementById('openclaw-sessions-panel');
    if (panel) {
        panel.classList.remove('open');
        panel.style.display = 'none';
    }
}

// ── Panel content ──────────────────────────────────────────────────────────
async function loadOpenclawSessionsPanel(forceRescan = false) {
    const listEl = document.getElementById('openclaw-sessions-list');
    const metaEl = document.getElementById('openclaw-sessions-meta');
    if (!listEl) return;

    listEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding:20px 0;">Scanning sessions…</div>';

    try {
        const url = forceRescan ? '/api/openclaw/sessions?scan=1' : '/api/openclaw/sessions';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        openclawSessionsData = data;

        // Meta bar
        if (metaEl) {
            const lastScan = data.lastScan ? new Date(data.lastScan).toLocaleTimeString() : 'never';
            const agents = data.agents ? data.agents.join(', ') : 'none';
            metaEl.innerHTML = `
                <span>🤖 Agents: ${DOMPurify.sanitize(agents)}</span>
                <span>🕐 Last scan: ${DOMPurify.sanitize(lastScan)}</span>
                <span style="cursor:pointer; color:var(--accent);" onclick="loadOpenclawSessionsPanel(true)" title="Force rescan">↻ Rescan</span>
            `;
        }

        if (!data.sessions || data.sessions.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center; padding:32px 16px; color:var(--text-muted);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px; opacity:0.4;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 6v6l4 2"></path>
                    </svg>
                    <p style="margin:0 0 6px; font-weight:500;">No OpenClaw sessions found</p>
                    <p style="margin:0; font-size:12px;">Sessions will appear when agents are active</p>
                </div>
            `;
            return;
        }

        // Group sessions by agent
        const byAgent = {};
        for (const s of data.sessions) {
            if (!byAgent[s.agent]) byAgent[s.agent] = [];
            byAgent[s.agent].push(s);
        }

        let html = '';
        for (const [agent, sessions] of Object.entries(byAgent)) {
            const activeCount = sessions.filter(s => s.active).length;
            const totalTokens = sessions.reduce((sum, s) => sum + (s.usedTokens || 0), 0);
            const tokenStr = totalTokens >= 1000 ? `${Math.round(totalTokens / 1000)}k` : totalTokens;
            
            html += `
                <div style="margin-bottom:16px;">
                    <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; margin-bottom:8px;">
                        <span style="font-weight:600; color:var(--accent);">${DOMPurify.sanitize(agent)}</span>
                        <span style="font-size:11px; color:var(--text-muted);">${sessions.length} sessions · ${tokenStr} tokens</span>
                        ${activeCount > 0 ? `<span style="font-size:10px; background:#22c55e; color:#fff; padding:1px 6px; border-radius:10px;">${activeCount} active</span>` : ''}
                    </div>
                    <div style="padding-left:12px;">
            `;

            for (const s of sessions.slice(0, 10)) { // Show top 10 per agent
                const contextBar = `
                    <div style="width:60px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                        <div style="width:${s.contextPercent}%; height:100%; background:${s.contextPercent > 80 ? '#ef4444' : s.contextPercent > 50 ? '#f59e0b' : '#22c55e'};"></div>
                    </div>
                `;
                
                const typeIcon = {
                    'telegram': '📱',
                    'discord': '💬',
                    'cron': '⏰',
                    'main': '🏠',
                    'direct': '📞',
                }[s.sessionType] || '💭';
                
                html += `
                    <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:12px;">
                        <span title="${DOMPurify.sanitize(s.sessionType)}">${typeIcon}</span>
                        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-secondary);" title="${DOMPurify.sanitize(s.key)}">${DOMPurify.sanitize(s.key.slice(0, 40))}${s.key.length > 40 ? '…' : ''}</span>
                        <span style="color:var(--text-muted); font-size:11px;">${DOMPurify.sanitize(s.age)}</span>
                        <span style="color:#888; font-size:10px;">${DOMPurify.sanitize(s.model)}</span>
                        ${contextBar}
                        <span style="font-size:10px; color:${s.contextPercent > 80 ? '#ef4444' : '#888'};">${s.contextPercent}%</span>
                    </div>
                `;
            }

            if (sessions.length > 10) {
                html += `<div style="font-size:11px; color:var(--text-muted); padding:8px 0;">+ ${sessions.length - 10} more sessions</div>`;
            }

            html += `</div></div>`;
        }

        listEl.innerHTML = html;
    } catch (err) {
        listEl.innerHTML = `<div style="color:#ef4444; font-size:13px; padding:12px 0;">Error loading sessions: ${DOMPurify.sanitize(err.message)}</div>`;
    }
}

// ── Stats widget for dashboard ─────────────────────────────────────────────
async function refreshOpenclawWidget() {
    try {
        const res = await fetch('/api/openclaw/stats');
        if (!res.ok) throw new Error('no data');
        const stats = await res.json();
        
        let dot = 'healthy';
        let mainClass = '';
        if (stats.avgContextPercent > 80) { dot = 'error'; mainClass = 'error'; }
        else if (stats.avgContextPercent > 50) { dot = 'warning'; mainClass = 'warning'; }
        
        if (typeof _setFCard === 'function') {
            _setFCard('openclaw', {
                main: stats.total,
                mainClass,
                secondary: `${stats.active} active · ${stats.agents} agents`,
                dot,
                time: `Avg context: ${stats.avgContextPercent}%`,
            });
        }
    } catch {
        if (typeof _setFCard === 'function') {
            _setFCard('openclaw', { main: '?', secondary: 'unavailable', dot: 'error', time: 'Last scan: failed' });
        }
    }
}
