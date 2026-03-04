/**
 * JARVIS Mission Control - Agent Soul Files Editor (v1.5.0)
 * View and edit agent SOUL.md / MEMORY.md / IDENTITY.md from the dashboard.
 */

const SOUL_API = window.API_BASE || '';

let soulCurrentAgent = null;
let soulCurrentFile = null;
let soulOriginalContent = null;

async function openSoulPanel() {
    const panel = document.getElementById('soul-panel');
    if (!panel) return;
    panel.style.display = 'block';
    await loadAgentList();
}

function closeSoulPanel() {
    const panel = document.getElementById('soul-panel');
    if (panel) panel.style.display = 'none';
}

async function loadAgentList() {
    const select = document.getElementById('soul-agent-select');
    if (!select) return;
    select.innerHTML = '<option value="">Loading…</option>';
    try {
        const res = await fetch(`${SOUL_API}/api/agents/list`);
        const data = await res.json();
        const agents = data.agents || [];

        const subtitle = document.getElementById('soul-agents-subtitle');
        if (subtitle) subtitle.textContent = `${agents.length} agent${agents.length !== 1 ? 's' : ''}`;

        select.innerHTML = '<option value="">— select agent —</option>';
        agents.forEach(agent => {
            const opt = document.createElement('option');
            opt.value = agent.id;
            const fileFlags = ['SOUL.md', 'MEMORY.md', 'IDENTITY.md'].map(f => agent.files[f] ? '✓' : '✗').join('');
            opt.textContent = `${agent.id}  [${fileFlags}]`;
            select.appendChild(opt);
        });

        // Auto-select first agent if available
        if (agents.length > 0) {
            select.value = agents[0].id;
            await loadSoulFiles();
        }
    } catch (e) {
        select.innerHTML = `<option value="">Error: ${escapeHtml(e.message)}</option>`;
    }
}

async function loadSoulFiles() {
    const select = document.getElementById('soul-agent-select');
    if (!select) return;
    const agentId = select.value;
    if (!agentId) {
        showSoulPlaceholder('Select an agent to view and edit its files.');
        return;
    }
    soulCurrentAgent = agentId;
    await loadSoulFile();
}

async function loadSoulFile() {
    const agentId = document.getElementById('soul-agent-select')?.value;
    const filename = document.getElementById('soul-file-select')?.value;
    if (!agentId || !filename) return;

    soulCurrentAgent = agentId;
    soulCurrentFile = filename;

    const wrapper = document.getElementById('soul-editor-wrapper');
    const placeholder = document.getElementById('soul-placeholder');
    const editor = document.getElementById('soul-editor');
    const metaEl = document.getElementById('soul-editor-meta');
    const saveStatus = document.getElementById('soul-save-status');

    if (placeholder) placeholder.style.display = 'none';
    if (wrapper) wrapper.style.display = 'block';
    if (editor) editor.value = 'Loading…';
    if (saveStatus) saveStatus.textContent = '';

    try {
        const res = await fetch(`${SOUL_API}/api/agents/soul/${encodeURIComponent(agentId)}`);
        const data = await res.json();

        if (!res.ok) {
            if (editor) editor.value = `Error: ${data.error || 'Failed to load'}`;
            return;
        }

        const fileData = data.files?.[filename];
        const content = fileData?.content || '';
        soulOriginalContent = content;

        if (editor) {
            editor.value = content;
            editor.style.color = fileData?.exists ? 'var(--text-primary,#e2e8f0)' : '#f59e0b';
        }
        if (metaEl) {
            metaEl.textContent = fileData?.exists
                ? `${agentId}/${filename} — ${formatBytes(content.length)}`
                : `${agentId}/${filename} — (new file)`;
        }
    } catch (e) {
        if (editor) editor.value = `Fetch error: ${e.message}`;
    }
}

async function saveSoulFile() {
    const agentId = soulCurrentAgent;
    const filename = soulCurrentFile;
    const editor = document.getElementById('soul-editor');
    const saveStatus = document.getElementById('soul-save-status');

    if (!agentId || !filename || !editor) return;

    const content = editor.value;
    if (saveStatus) { saveStatus.textContent = 'Saving…'; saveStatus.style.color = 'var(--text-muted)'; }

    try {
        const res = await fetch(`${SOUL_API}/api/agents/soul/${encodeURIComponent(agentId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Save failed');

        soulOriginalContent = content;
        if (saveStatus) {
            saveStatus.textContent = `✓ Saved ${formatBytes(data.size)} — ${new Date(data.timestamp).toLocaleTimeString()}`;
            saveStatus.style.color = '#22c55e';
        }
        editor.style.color = 'var(--text-primary,#e2e8f0)';
    } catch (e) {
        if (saveStatus) { saveStatus.textContent = `✗ ${e.message}`; saveStatus.style.color = '#ef4444'; }
    }
}

function discardSoulEdit() {
    const editor = document.getElementById('soul-editor');
    const saveStatus = document.getElementById('soul-save-status');
    if (editor && soulOriginalContent !== null) {
        editor.value = soulOriginalContent;
        editor.style.color = 'var(--text-primary,#e2e8f0)';
    }
    if (saveStatus) saveStatus.textContent = 'Changes discarded.';
}

function showSoulPlaceholder(msg) {
    const wrapper = document.getElementById('soul-editor-wrapper');
    const placeholder = document.getElementById('soul-placeholder');
    if (wrapper) wrapper.style.display = 'none';
    if (placeholder) { placeholder.style.display = 'block'; placeholder.textContent = msg; }
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
