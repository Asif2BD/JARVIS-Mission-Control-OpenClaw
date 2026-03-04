/**
 * Smart Panels — v2.0.3
 * Chat, Reports & Files, Scheduled Jobs as proper slide-out panels.
 * Replaces the old right sidebar + floating chat widget.
 */

/* ================================================================
   SHARED UTILITIES
   ================================================================ */

function _closeAllSmartPanels(except) {
    ['smart-chat-panel','reports-panel','schedules-panel'].forEach(id => {
        if (id === except) return;
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

function _openPanel(id) {
    _closeAllSmartPanels(id);
    const el = document.getElementById(id);
    if (!el) return;
    if (el.style.display !== 'none') {
        // Toggle: close if already open
        el.style.display = 'none';
        return true; // was open, now closed
    }
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    return false; // was closed, now open
}

/* ================================================================
   CHAT PANEL
   ================================================================ */

let _chatOpen = false;
let _chatMessages = [];
let _chatCurrentUser = 'user'; // will use connected agent name if available

function openChatPanel() {
    _chatOpen = !_openPanel('smart-chat-panel');
    if (_chatOpen) {
        _loadChatMessages();
        setTimeout(() => {
            const input = document.getElementById('smart-chat-input');
            if (input) input.focus();
        }, 100);
        // Clear unread badge
        const badge = document.getElementById('chat-unread-badge');
        if (badge) badge.style.display = 'none';
        _chatUnread = 0;
    }
}

function closeChatPanel() {
    const el = document.getElementById('smart-chat-panel');
    if (el) el.style.display = 'none';
    _chatOpen = false;
}

let _chatUnread = 0;

async function _loadChatMessages() {
    const container = document.getElementById('smart-chat-messages');
    if (!container) return;

    try {
        const msgs = await window.MissionControlAPI.getMessages();
        _chatMessages = (msgs || [])
            .filter(m => m.type === 'chat' || m.thread_id === 'chat-general' || (!m.type || m.type === 'direct'))
            .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        _renderChatMessages();
    } catch (e) {
        container.innerHTML = `<div style="color:#e53e3e;font-size:12px;padding:8px;">Failed to load messages</div>`;
    }
}

function _renderChatMessages() {
    const container = document.getElementById('smart-chat-messages');
    if (!container) return;

    if (_chatMessages.length === 0) {
        container.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); text-align:center; padding:24px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="opacity:0.3; margin-bottom:12px;">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p style="margin:0 0 4px; font-size:13px; font-weight:500;">No messages yet</p>
            <p style="margin:0; font-size:11px;">Send a message to all agents or start a conversation</p>
        </div>`;
        return;
    }

    container.innerHTML = _chatMessages.map(msg => {
        const isMe = msg.from === _chatCurrentUser || msg.from === 'user';
        const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
        const sender = DOMPurify ? DOMPurify.sanitize(msg.from || 'Unknown') : (msg.from || 'Unknown');
        const content = DOMPurify ? DOMPurify.sanitize(msg.content || '') : (msg.content || '');
        const avatar = _getAgentEmoji(msg.from);

        return `
        <div style="display:flex; gap:8px; align-items:flex-start; ${isMe ? 'flex-direction:row-reverse;' : ''}">
            <div style="width:28px; height:28px; border-radius:50%; background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.25); display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;">${avatar}</div>
            <div style="max-width:75%; ${isMe ? 'align-items:flex-end;' : ''} display:flex; flex-direction:column; gap:2px;">
                <div style="font-size:10px; color:var(--text-muted); ${isMe ? 'text-align:right;' : ''}">${sender} · ${time}</div>
                <div style="background:${isMe ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.06)'}; border:1px solid ${isMe ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.1)'}; border-radius:${isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px'}; padding:7px 11px; font-size:13px; line-height:1.4; word-break:break-word;">${content}</div>
            </div>
        </div>`;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function _getAgentEmoji(agentId) {
    const map = { tank:'🔧', oracle:'🔮', morpheus:'🧠', shuri:'🔬', keymaker:'🔑', link:'🔗', user:'👤' };
    if (!agentId) return '💬';
    const key = agentId.toLowerCase();
    for (const [k,v] of Object.entries(map)) { if (key.includes(k)) return v; }
    return '🤖';
}

async function smartSendChat() {
    const input = document.getElementById('smart-chat-input');
    if (!input || !input.value.trim()) return;

    const content = input.value.trim();
    input.value = '';
    input.disabled = true;

    try {
        const msg = {
            from: _chatCurrentUser,
            to: 'all',
            content,
            type: 'chat',
            thread_id: 'chat-general',
            timestamp: new Date().toISOString()
        };
        await window.MissionControlAPI.sendMessage(msg);
        // Optimistic update
        _chatMessages.push(msg);
        _renderChatMessages();
    } catch (e) {
        // Show inline error
        const container = document.getElementById('smart-chat-messages');
        if (container) {
            const errEl = document.createElement('div');
            errEl.style.cssText = 'color:#e53e3e;font-size:11px;padding:4px 8px;';
            errEl.textContent = 'Failed to send: ' + e.message;
            container.appendChild(errEl);
        }
    } finally {
        input.disabled = false;
        input.focus();
    }
}

// WebSocket listener — update chat panel when new message arrives
function _setupChatWebSocket() {
    if (!window.MissionControlAPI || !window.MissionControlAPI.on) return;
    window.MissionControlAPI.on('message.created', (data) => {
        const msg = data.data || data;
        // Only show chat-type messages
        if (msg.type !== 'chat' && msg.thread_id !== 'chat-general') return;

        // Add to local store if not duplicate
        const exists = _chatMessages.some(m => m.id === msg.id && m.timestamp === msg.timestamp);
        if (!exists) _chatMessages.push(msg);

        if (_chatOpen) {
            _renderChatMessages();
        } else {
            // Show unread badge
            _chatUnread++;
            const badge = document.getElementById('chat-unread-badge');
            if (badge) { badge.textContent = _chatUnread; badge.style.display = 'block'; }
        }
    });
}

/* ================================================================
   REPORTS & FILES PANEL
   ================================================================ */

let _reportsCurrentDir = 'reports';

async function openReportsPanel() {
    _openPanel('reports-panel');
    await _loadReportsPanelFiles(_reportsCurrentDir);
}

function closeReportsPanel() {
    const el = document.getElementById('reports-panel');
    if (el) el.style.display = 'none';
}

async function switchReportsTab(dir) {
    _reportsCurrentDir = dir;
    ['reports','logs','archived-tasks'].forEach(d => {
        const id = d === 'archived-tasks' ? 'rtab-archive' : `rtab-${d}`;
        const btn = document.getElementById(id);
        if (btn) btn.style.opacity = d === dir ? '1' : '0.5';
    });
    await _loadReportsPanelFiles(dir);
}

// Keep old name for backward compat
function switchFilesTab(dir) { switchReportsTab(dir); }

async function _loadReportsPanelFiles(dir) {
    const listEl = document.getElementById('reports-panel-list');
    const countEl = document.getElementById('reports-panel-count');
    if (!listEl) return;

    listEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px 0;">Loading…</div>';

    try {
        const result = await window.MissionControlAPI.getFiles(dir);
        const files = result.files || [];
        if (countEl) countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;

        if (files.length === 0) {
            listEl.innerHTML = `
            <div style="text-align:center; padding:32px 16px; color:var(--text-muted);">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:10px; opacity:0.3;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <p style="margin:0 0 4px; font-weight:500; font-size:13px;">No files in ${DOMPurify.sanitize(dir)}</p>
                <p style="margin:0; font-size:11px;">Reports saved by agents appear here automatically</p>
            </div>`;
            return;
        }

        listEl.innerHTML = files.map(f => {
            const ext = (f.ext || '').replace('.','').toUpperCase() || 'FILE';
            const size = _formatBytes(f.size);
            const date = f.modified ? new Date(f.modified).toLocaleDateString() : '—';
            const safeName = DOMPurify.sanitize(f.name);
            return `
            <div style="display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,0.06); cursor:pointer;"
                 onclick="openFileViewer('${DOMPurify.sanitize(dir)}','${safeName}')" title="${safeName}">
                <div style="min-width:36px; height:36px; background:rgba(0,255,65,0.08); border:1px solid rgba(0,255,65,0.2); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; color:var(--accent-primary,#4f8ef7); font-family:monospace; flex-shrink:0;">${ext}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:12px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeName}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${size} · ${date}</div>
                </div>
                <a href="/api/files/${encodeURIComponent(DOMPurify.sanitize(f.path || f.name))}?download=true"
                   onclick="event.stopPropagation()" style="color:var(--text-muted); padding:4px;" title="Download" download>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </a>
            </div>`;
        }).join('');
    } catch (err) {
        listEl.innerHTML = `<div style="color:#e53e3e; font-size:13px; padding:12px 0;">Error: ${DOMPurify.sanitize(err.message)}</div>`;
    }
}

function _formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

/* ================================================================
   SCHEDULED JOBS PANEL
   ================================================================ */

let _allSchedules = [];
let _schedulesFilter = 'all';

async function openSchedulesPanel() {
    _openPanel('schedules-panel');
    await _loadSchedules();
}

function closeSchedulesPanel() {
    const el = document.getElementById('schedules-panel');
    if (el) el.style.display = 'none';
}

function filterSchedules(filter) {
    _schedulesFilter = filter;
    ['all','enabled','disabled'].forEach(f => {
        const btn = document.getElementById(`sfil-${f}`);
        if (btn) btn.style.opacity = f === filter ? '1' : '0.5';
    });
    _renderSchedules();
}

async function _loadSchedules() {
    const listEl = document.getElementById('schedules-panel-list');
    const loading = document.getElementById('schedules-loading');
    if (!listEl) return;

    listEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px 0;">Loading…</div>';
    if (loading) loading.textContent = 'Loading…';

    try {
        // Use /api/schedules which merges local queue + OpenClaw cron jobs
        const resp = await fetch('/api/schedules', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        _allSchedules = await resp.json();
        if (loading) loading.textContent = '';
        _renderSchedules();
    } catch (e) {
        listEl.innerHTML = `<div style="color:#e53e3e; font-size:13px; padding:12px 0;">Error: ${e.message}</div>`;
        if (loading) loading.textContent = '';
    }
}

const SCHEDULE_KINDS = { every:'⏱', cron:'📅', at:'📌' };

function _renderSchedules() {
    const listEl = document.getElementById('schedules-panel-list');
    const countEl = document.getElementById('schedules-count');
    if (!listEl) return;

    const filtered = _allSchedules.filter(j => {
        if (_schedulesFilter === 'enabled') return j.status !== 'disabled';
        if (_schedulesFilter === 'disabled') return j.status === 'disabled';
        return true;
    });

    if (countEl) countEl.textContent = `${filtered.length} job${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        listEl.innerHTML = `
        <div style="text-align:center; padding:32px 16px; color:var(--text-muted);">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:10px; opacity:0.3;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <p style="margin:0; font-size:13px; font-weight:500;">No jobs match filter</p>
        </div>`;
        return;
    }

    listEl.innerHTML = filtered.map(job => {
        const isEnabled = job.status !== 'disabled';
        const kindIcon = SCHEDULE_KINDS[job.schedule?.kind] || '⏰';
        const agentName = DOMPurify.sanitize(job.agent || job.agentId || 'system');
        const jobName = DOMPurify.sanitize(job.name || 'Unnamed Job');
        const schedule = _formatSchedule(job.schedule);
        const lastRun = job.last_run ? new Date(job.last_run).toLocaleString() : '—';
        const agentEmoji = _getAgentEmoji(job.agent || job.agentId);

        return `
        <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="font-size:14px;">${kindIcon}</span>
                <span style="font-size:12px; font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${jobName}</span>
                <span style="font-size:10px; padding:2px 7px; border-radius:10px; background:${isEnabled ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.07)'}; color:${isEnabled ? '#00ff41' : 'var(--text-muted)'}; border:1px solid ${isEnabled ? 'rgba(0,255,65,0.25)' : 'rgba(255,255,255,0.1)'}; flex-shrink:0;">${isEnabled ? 'active' : 'disabled'}</span>
            </div>
            <div style="display:flex; gap:12px; font-size:11px; color:var(--text-muted); padding-left:22px;">
                <span>${agentEmoji} ${agentName}</span>
                <span>📅 ${schedule}</span>
                <span>Last: ${lastRun}</span>
            </div>
        </div>`;
    }).join('');
}

function _formatSchedule(schedule) {
    if (!schedule) return '—';
    if (schedule.kind === 'every') {
        const ms = schedule.everyMs || 0;
        if (ms >= 86400000) return `Every ${Math.round(ms/86400000)}d`;
        if (ms >= 3600000) return `Every ${Math.round(ms/3600000)}h`;
        if (ms >= 60000) return `Every ${Math.round(ms/60000)}m`;
        return `Every ${ms}ms`;
    }
    if (schedule.kind === 'cron') return `Cron: ${schedule.expr || '?'}`;
    if (schedule.kind === 'at') return `At: ${schedule.at ? new Date(schedule.at).toLocaleString() : '?'}`;
    return '—';
}

/* ================================================================
   INIT
   ================================================================ */

// Wire up WebSocket for real-time chat after API is ready
window.addEventListener('DOMContentLoaded', () => {
    // Retry until MissionControlAPI is available
    let attempts = 0;
    const trySetup = setInterval(() => {
        if (window.MissionControlAPI && window.MissionControlAPI.on) {
            _setupChatWebSocket();
            clearInterval(trySetup);
        }
        if (++attempts > 40) clearInterval(trySetup);
    }, 250);
});
