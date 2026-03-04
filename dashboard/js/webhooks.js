/**
 * Webhooks Panel - Circuit Breaker Display (v1.9.0)
 * Shows circuit state badges for all registered webhooks.
 */

const CIRCUIT_BADGES = {
    closed:    { emoji: '🟢', label: 'closed',    color: '#38a169' },
    open:      { emoji: '🔴', label: 'open',      color: '#e53e3e' },
    'half-open': { emoji: '🟡', label: 'half-open', color: '#d69e2e' },
};

/**
 * Render the webhooks list in the sidebar.
 */
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
                    ? `<button onclick="resetWebhookCircuit('${w.id}')" style="margin-left:6px; padding:1px 6px; font-size:10px; background:#4f8ef7; color:#fff; border:none; border-radius:4px; cursor:pointer;" title="Reset circuit breaker">Reset</button>`
                    : '';
                return `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:12px;">
                        <span style="color:var(--text-secondary,#aaa); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px;" title="${w.id}">${w.id}</span>
                        <span style="display:flex; align-items:center; gap:4px; white-space:nowrap;">
                            <span style="color:${badge.color}; font-size:11px;" title="Circuit: ${badge.label} | Failures: ${failures}">${badge.emoji} ${badge.label}</span>
                            ${failures > 0 ? `<span style="color:#aaa; font-size:10px;">(${failures}✗)</span>` : ''}
                            ${resetBtn}
                        </span>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.warn('Failed to load webhooks:', err);
        if (subtitleEl) subtitleEl.textContent = 'Error loading webhooks';
    }
}

/**
 * Reset a webhook's circuit breaker.
 */
async function resetWebhookCircuit(id) {
    try {
        await api.resetWebhookCircuit(id);
        await loadWebhooksList();
        console.log(`Circuit reset for webhook: ${id}`);
    } catch (err) {
        console.error('Failed to reset circuit:', err);
        alert(`Failed to reset circuit for ${id}: ${err.message}`);
    }
}

/**
 * Open a simple modal/alert showing all webhook details.
 */
function openWebhooksPanel() {
    loadWebhooksList();
}

// Auto-refresh every 30s
setInterval(loadWebhooksList, 30000);

// Initial load on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWebhooksList);
} else {
    loadWebhooksList();
}
