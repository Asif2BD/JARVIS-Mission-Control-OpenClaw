/**
 * JARVIS Mission Control - GitHub Issues Sync (v1.4.0)
 * Fetches open GitHub issues and creates JARVIS task cards from them.
 */

const GITHUB_API = window.API_BASE || '';

async function openGithubPanel() {
    const panel = document.getElementById('github-panel');
    if (!panel) return;
    panel.style.display = 'block';
    await loadGithubConfig();
}

function closeGithubPanel() {
    const panel = document.getElementById('github-panel');
    if (panel) panel.style.display = 'none';
}

async function loadGithubConfig() {
    try {
        const res = await fetch(`${GITHUB_API}/api/github/config`);
        const data = await res.json();
        if (data.repo) {
            document.getElementById('github-repo-input').value = data.repo;
            const statusEl = document.getElementById('github-config-status');
            statusEl.textContent = data.hasToken ? '● Token configured' : '● No token (public repos only)';
            statusEl.style.color = data.hasToken ? '#22c55e' : '#f59e0b';
        }
    } catch (e) {
        // Config not available yet — that's fine
    }
}

async function saveGithubConfig() {
    const repo = document.getElementById('github-repo-input').value.trim();
    const token = document.getElementById('github-token-input').value.trim(); // nosec — reads from UI input element, not hardcoded

    if (!repo) {
        alert('Please enter a repo in owner/name format.');
        return;
    }

    try {
        const res = await fetch(`${GITHUB_API}/api/github/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo, token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');

        const statusEl = document.getElementById('github-config-status');
        statusEl.textContent = `✓ Saved (${data.hasToken ? 'with token' : 'no token'})`;
        statusEl.style.color = '#22c55e';
        document.getElementById('github-token-input').value = '';
    } catch (e) {
        alert(`Failed to save config: ${e.message}`);
    }
}

async function loadGithubIssues() {
    const listEl = document.getElementById('github-issues-list');
    const subtitleEl = document.getElementById('github-issues-subtitle');
    listEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px 0;">Fetching issues…</p>'; // SAFE: static string

    try {
        const res = await fetch(`${GITHUB_API}/api/github/issues`);
        const data = await res.json();

        if (!res.ok) {
            listEl.innerHTML = `<p style="color:#ef4444;font-size:12px;padding:10px;">${escapeHtml(data.error || 'Failed to fetch issues')}</p>`;
            return;
        }

        if (subtitleEl) subtitleEl.textContent = `${data.count} open issue${data.count !== 1 ? 's' : ''}`;

        if (!data.issues || data.issues.length === 0) {
            listEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px 0;">No open issues found.</p>'; // SAFE: static string
            return;
        }

        listEl.innerHTML = data.issues.map(issue => `
            <div style="border:1px solid var(--border-color,#30363d); border-radius:6px; padding:10px 12px; margin-bottom:8px; background:var(--bg-secondary,#0d1117);">
                <div style="display:flex; align-items:flex-start; gap:8px;">
                    <span style="background:#1f6feb; color:#58a6ff; border-radius:50%; width:20px; height:20px; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">#${issue.number}</span>
                    <div style="flex:1; min-width:0;">
                        <a href="${escapeHtml(issue.html_url)}" target="_blank" style="color:var(--text-primary,#e2e8f0); text-decoration:none; font-size:13px; font-weight:500; line-height:1.4; display:block;">
                            ${escapeHtml(issue.title)}
                        </a>
                        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;">
                            ${issue.labels.map(l => `<span style="background:${labelBg(l.color)}; color:#fff; border-radius:10px; padding:1px 7px; font-size:10px; font-weight:600;">${escapeHtml(l.name)}</span>`).join('')}
                        </div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                            Opened ${formatDate(issue.created_at)} by ${escapeHtml(issue.user?.login || 'unknown')}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = `<p style="color:#ef4444;font-size:12px;padding:10px;">Error: ${escapeHtml(e.message)}</p>`;
    }
}

async function syncGithubIssues() {
    const statusEl = document.getElementById('github-sync-status');
    statusEl.textContent = 'Syncing…';
    statusEl.style.color = 'var(--text-muted)';

    try {
        const res = await fetch(`${GITHUB_API}/api/github/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Sync failed');

        statusEl.textContent = `✓ ${data.message}`;
        statusEl.style.color = '#22c55e';

        // Refresh issues list + board
        await loadGithubIssues();
        if (typeof forceRefreshBoard === 'function') forceRefreshBoard();
    } catch (e) {
        statusEl.textContent = `✗ ${e.message}`;
        statusEl.style.color = '#ef4444';
    }
}

function labelBg(hexColor) {
    // GitHub label colors are hex without '#'
    const hex = hexColor ? hexColor.replace('#', '') : '6e7681';
    return `#${hex}44`;
}

function formatDate(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return iso; }
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
