/**
 * Webhooks Panel — Circuit Breaker + Delivery History (v1.13.0)
 * Shows circuit state badges, delivery history, and manual retry controls.
 */

const CIRCUIT_BADGES = {
    closed:      { emoji: '🟢', label: 'closed',    color: '#38a169' },
    open:        { emoji: '🔴', label: 'open',      color: '#e53e3e' },
    'half-open': { emoji: '🟡', label: 'half-open', color: '#d69e2e' },
};

const STATUS_STYLES = {
    success: { color: '#38a169', label: '✅ success' },
    failed:  { color: '#e53e3e', label: '❌ failed' },
    pending: { color: '#d69e2e', label: '⏳ pending' },
};

// ── Sidebar list ───────────────────────────────────────────────────────────

async function loadWebhooksList() {
    const listEl = document.getElementById('webhooks-list');
    const subtitleEl = document.getElementById('webhooks-subtitle');
    const badgeEl = document.getElementById('webhooks-open-badge');

    try {
        const webhooks = await api.getWebhooks();

        if (!webhooks || webhooks.length === 0) {
            if (subtitleEl) subtitleEl.textContent = 'No webhooks registered';
            if (listEl) listEl.innerHTML = '';
            if (badgeEl) badgeEl.style.display = 'none';
            return;
        }

        const openCount = webhooks.filter(w => w.circuitState === 'open').length;

        if (subtitleEl) subtitleEl.textContent = `${webhooks.length} registered`;
        if (badgeEl) {
            badgeEl.style.display = openCount > 0 ? 'inline' : 'none';
            badgeEl.textContent = `🔴 ${openCount}`;
        }

        if (listEl) {
            listEl.innerHTML = webhooks.map(w => {
                const badge = CIRCUIT_BADGES[w.circuitState] || CIRCUIT_BADGES.closed;
                const failures = w.failures || 0;
                const resetBtn = (w.circuitState === 'open' || w.circuitState === 'half-open')
                    ? `<button onclick="resetWebhookCircuit('${DOMPurify.sanitize(w.id)}')" style="padding:1px 6px; font-size:10px; background:#4f8ef7; color:#fff; border:none; border-radius:4px; cursor:pointer;">Reset</button>`
                    : '';
                return `
                <div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:12px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:3px;">
                        <span style="color:var(--text-secondary,#aaa); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:110px; cursor:pointer;" onclick="openDeliveryHistory('${DOMPurify.sanitize(w.id)}')" title="View delivery history for ${DOMPurify.sanitize(w.id)}">${DOMPurify.sanitize(w.id)}</span>
                        <span style="display:flex; align-items:center; gap:4px;">
                            <span style="color:${badge.color}; font-size:11px;">${badge.emoji} ${badge.label}</span>
                            ${failures > 0 ? `<span style="color:#aaa; font-size:10px;">(${failures}✗)</span>` : ''}
                        </span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button onclick="openDeliveryHistory('${DOMPurify.sanitize(w.id)}')" style="padding:1px 7px; font-size:10px; background:rgba(255,255,255,0.08); color:#ccc; border:1px solid rgba(255,255,255,0.12); border-radius:4px; cursor:pointer;">📋 History</button>
                        ${resetBtn}
                    </div>
                </div>`;
            }).join('');
        }
    } catch (err) {
        if (subtitleEl) subtitleEl.textContent = 'Error loading webhooks';
    }
}

// ── Delivery History Panel ────────────────────────────────────────────────

async function openDeliveryHistory(webhookId) {
    const panel = document.getElementById('webhook-delivery-panel');
    const titleEl = document.getElementById('webhook-delivery-title');
    const bodyEl = document.getElementById('webhook-delivery-body');

    if (!panel) return;

    titleEl.textContent = `Delivery History — ${webhookId}`;
    bodyEl.innerHTML = '<div style="color:var(--text-muted); padding:20px 0; font-size:13px;">Loading…</div>';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.classList.add('open');

    try {
        const res = await fetch(`/api/webhooks/${encodeURIComponent(webhookId)}/deliveries`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { deliveries, stats } = await res.json();

        const statsHtml = `
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:16px;">
            ${dChip('📬', 'Total', stats.total)}
            ${dChip('✅', 'Success', stats.success, '#38a169')}
            ${dChip('❌', 'Failed', stats.failed, '#e53e3e')}
            ${dChip('⏳', 'Pending', stats.pending, '#d69e2e')}
        </div>
        <div style="margin-bottom:12px; font-size:12px; display:flex; align-items:center; gap:8px;">
            <span>Circuit: ${(CIRCUIT_BADGES[stats.circuitState] || CIRCUIT_BADGES.closed).emoji} <b>${stats.circuitState}</b></span>
            ${stats.failures > 0 ? `<span style="color:#aaa;">${stats.failures} consecutive failures</span>` : ''}
            ${stats.circuitState !== 'closed' ? `<button onclick="resetWebhookCircuit('${DOMPurify.sanitize(webhookId)}', true)" style="padding:1px 8px; font-size:11px; background:#4f8ef7; color:#fff; border:none; border-radius:4px; cursor:pointer;">Reset Circuit</button>` : ''}
        </div>`;

        if (!deliveries || deliveries.length === 0) {
            bodyEl.innerHTML = statsHtml + '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">No deliveries yet</div>';
            return;
        }

        const rows = deliveries.map(d => {
            const style = STATUS_STYLES[d.status] || STATUS_STYLES.pending;
            const ts = new Date(d.createdAt).toLocaleString();
            const nextRetry = d.nextRetryAt && d.status === 'pending'
                ? `<div style="font-size:10px; color:#d69e2e; margin-top:2px;">Next retry: ${new Date(d.nextRetryAt).toLocaleTimeString()}</div>`
                : '';
            const retryBtn = (d.status === 'failed' || d.status === 'pending')
                ? `<button onclick="manualRetry('${DOMPurify.sanitize(webhookId)}', '${DOMPurify.sanitize(d.id)}')" style="padding:1px 7px; font-size:10px; background:rgba(255,255,255,0.08); color:#ccc; border:1px solid rgba(255,255,255,0.12); border-radius:4px; cursor:pointer; margin-top:4px;">↻ Retry</button>`
                : '';
            return `
            <div style="border:1px solid var(--border-color,#2d2d2d); border-radius:6px; padding:10px 12px; margin-bottom:8px; background:var(--card-bg,#1a1a1a);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="color:${style.color}; font-size:12px; font-weight:600;">${style.label}</span>
                    <span style="font-size:11px; color:var(--text-muted);">${ts}</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); font-family:monospace; margin-bottom:2px;">${DOMPurify.sanitize(d.id)}</div>
                <div style="font-size:11px; color:#aaa;">Attempts: ${d.attempts}/${5} · Event: ${DOMPurify.sanitize(d.event || '?')}</div>
                ${d.lastError ? `<div style="font-size:11px; color:#e53e3e; margin-top:2px;">Error: ${DOMPurify.sanitize(d.lastError)}</div>` : ''}
                ${nextRetry}
                ${retryBtn}
            </div>`;
        }).join('');

        bodyEl.innerHTML = statsHtml + rows;
    } catch (err) {
        bodyEl.innerHTML = `<div style="color:#e53e3e; font-size:13px; padding:12px 0;">Error: ${DOMPurify.sanitize(err.message)}</div>`;
    }
}

function closeDeliveryHistory() {
    const panel = document.getElementById('webhook-delivery-panel');
    if (panel) { panel.classList.remove('open'); panel.style.display = 'none'; }
}

async function manualRetry(webhookId, deliveryId) {
    try {
        const res = await fetch(`/api/webhooks/${encodeURIComponent(webhookId)}/retry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deliveryId }),
        });
        const data = await res.json();
        await openDeliveryHistory(webhookId); // refresh
        if (!data.ok) alert(`Retry failed: ${data.error || 'unknown'}`);
    } catch (err) {
        alert(`Retry error: ${err.message}`);
    }
}

// ── Circuit reset ─────────────────────────────────────────────────────────

async function resetWebhookCircuit(id, refreshHistory = false) {
    try {
        await fetch(`/api/webhooks/${encodeURIComponent(id)}/reset-circuit`, { method: 'POST' });
        await loadWebhooksList();
        if (refreshHistory) await openDeliveryHistory(id);
    } catch (err) {
        alert(`Failed to reset circuit for ${id}: ${err.message}`);
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function dChip(icon, label, value, color) {
    return `<div style="background:var(--bg-secondary,#252525); border:1px solid var(--border-color,#2d2d2d); border-radius:6px; padding:6px 8px; text-align:center;">
        <div style="font-size:11px; color:var(--text-muted);">${icon} ${label}</div>
        <div style="font-size:14px; font-weight:600; color:${color || 'inherit'};">${value}</div>
    </div>`;
}

// ── Panel open ─────────────────────────────────────────────────────────────

function openWebhooksPanel() {
    loadWebhooksList();
}

// ── Auto-refresh ───────────────────────────────────────────────────────────
setInterval(loadWebhooksList, 30_000);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWebhooksList);
} else {
    loadWebhooksList();
}
