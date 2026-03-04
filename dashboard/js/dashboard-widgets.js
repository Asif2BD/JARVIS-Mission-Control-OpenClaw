/**
 * Dashboard Aggregate Widgets — JARVIS Mission Control v1.15.0
 *
 * Polls APIs every 60s and updates the header metric chips:
 *   🖥 Claude   — active Claude Code sessions
 *   ⚡ CLI       — connected CLI tools
 *   🐙 GitHub   — synced issues count
 *   🔔 Hooks    — webhook health (open circuits)
 */

const WIDGET_POLL_MS = 60_000;

// ── Update helpers ─────────────────────────────────────────────────────────

function _setWidget(id, value, title, color) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    if (color) el.style.color = color;
    if (title) el.parentElement.title = title;
}

// ── Claude Code Sessions ───────────────────────────────────────────────────

async function refreshClaudeWidget() {
    try {
        const res = await fetch('/api/claude/sessions');
        if (!res.ok) return;
        const data = await res.json();
        const active = data.activeCount || 0;
        const total  = data.total || 0;
        _setWidget(
            'widget-claude-value',
            active > 0 ? `${active}/${total}` : total,
            `Claude Code Sessions: ${active} active, ${total} total`,
            active > 0 ? '#22c55e' : null
        );
    } catch { _setWidget('widget-claude-value', '?'); }
}

// ── CLI Connections ────────────────────────────────────────────────────────

async function refreshCliWidget() {
    try {
        const res = await fetch('/api/connect');
        if (!res.ok) return;
        const data = await res.json();
        // data may be array or { connections: [] }
        const list   = Array.isArray(data) ? data : (data.connections || []);
        const active = list.filter(c => c.status === 'active' || c.active).length;
        const total  = list.length;
        _setWidget(
            'widget-cli-value',
            active > 0 ? `${active}/${total}` : total,
            `CLI Connections: ${active} active, ${total} total`,
            active > 0 ? '#60a5fa' : null
        );
    } catch { _setWidget('widget-cli-value', '?'); }
}

// ── GitHub Sync ────────────────────────────────────────────────────────────

async function refreshGithubWidget() {
    try {
        // GitHub synced issues appear as tasks with source:github or labels containing 'github'
        // Try the tasks endpoint and filter
        const res = await fetch('/api/tasks');
        if (!res.ok) return;
        const tasks = await res.json();
        const githubTasks = tasks.filter(t =>
            t.source === 'github' ||
            (Array.isArray(t.labels) && t.labels.some(l => String(l).toLowerCase().includes('github')))
        );
        _setWidget(
            'widget-github-value',
            githubTasks.length,
            `GitHub synced issues: ${githubTasks.length}`,
            githubTasks.length > 0 ? '#a78bfa' : null
        );
    } catch { _setWidget('widget-github-value', '?'); }
}

// ── Webhook Health ─────────────────────────────────────────────────────────

async function refreshWebhooksWidget() {
    try {
        const res = await fetch('/api/webhooks');
        if (!res.ok) return;
        const webhooks = await res.json();
        const total   = webhooks.length;
        const open    = webhooks.filter(w => w.circuitState === 'open').length;
        const halfOpen = webhooks.filter(w => w.circuitState === 'half-open').length;

        let value = total;
        let color = null;
        let tip   = `Webhooks: ${total} registered`;

        if (open > 0) {
            value = `${open}🔴`;
            color = '#e53e3e';
            tip   = `Webhooks: ${open} circuit(s) OPEN — click to view`;
        } else if (halfOpen > 0) {
            value = `${halfOpen}🟡`;
            color = '#d69e2e';
            tip   = `Webhooks: ${halfOpen} circuit(s) half-open`;
        }

        _setWidget('widget-webhooks-value', value, tip, color);
    } catch { _setWidget('widget-webhooks-value', '?'); }
}

// ── Poll all ───────────────────────────────────────────────────────────────

async function refreshAllWidgets() {
    await Promise.allSettled([
        refreshClaudeWidget(),
        refreshCliWidget(),
        refreshGithubWidget(),
        refreshWebhooksWidget(),
    ]);
}

// Initial load + periodic refresh
refreshAllWidgets();
setInterval(refreshAllWidgets, WIDGET_POLL_MS);
