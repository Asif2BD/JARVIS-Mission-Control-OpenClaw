/**
 * JARVIS Mission Control - CLI Console (v1.3.0)
 * Allows running whitelisted OpenClaw/system commands from the dashboard.
 */

const CLI_API = window.API_BASE || '';

let cliRunning = false;

async function openCliPanel() {
    const panel = document.getElementById('cli-panel');
    if (!panel) return;
    panel.style.display = 'block';
    await loadCliCommands();
}

function closeCliPanel() {
    const panel = document.getElementById('cli-panel');
    if (panel) panel.style.display = 'none';
}

async function loadCliCommands() {
    const container = document.getElementById('cli-buttons');
    if (!container) return;
    container.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Loading commands…</span>';
    try {
        const res = await fetch(`${CLI_API}/api/cli/commands`);
        const data = await res.json();
        container.innerHTML = '';
        (data.commands || []).forEach(cmd => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.style.cssText = 'font-size:12px; padding:6px 12px; display:flex; align-items:center; gap:6px;';
            btn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                ${escapeHtml(cmd.label)}
            `;
            btn.onclick = () => runCliCommand(cmd.id, cmd.label);
            container.appendChild(btn);
        });
    } catch (e) {
        container.innerHTML = `<span style="color:#ef4444; font-size:12px;">Failed to load commands: ${escapeHtml(e.message)}</span>`;
    }
}

async function runCliCommand(commandId, label) {
    if (cliRunning) return;
    cliRunning = true;

    const outputContainer = document.getElementById('cli-output-container');
    const outputEl = document.getElementById('cli-output');
    const metaEl = document.getElementById('cli-output-meta');

    outputContainer.style.display = 'block';
    outputEl.textContent = `$ ${commandId}\nRunning…`;
    metaEl.textContent = `Running: ${label}`;

    // Disable all buttons while running
    const buttons = document.querySelectorAll('#cli-buttons button');
    buttons.forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });

    try {
        const res = await fetch(`${CLI_API}/api/cli/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: commandId }),
        });
        const data = await res.json();

        if (!res.ok) {
            outputEl.textContent = `$ ${commandId}\n\nERROR: ${data.error || 'Unknown error'}`;
            metaEl.textContent = `Error running: ${label}`;
        } else {
            const combined = [data.stdout, data.stderr].filter(Boolean).join('\n').trim();
            outputEl.textContent = `$ ${commandId}\n\n${combined || '(no output)'}`;
            const status = data.exitCode === 0 ? '✓' : `✗ exit ${data.exitCode}`;
            metaEl.textContent = `${label} — ${status} — ${data.elapsed}ms — ${new Date(data.timestamp).toLocaleTimeString()}`;
            outputEl.style.color = data.exitCode === 0 ? '#22c55e' : '#ef4444';
        }
    } catch (e) {
        outputEl.textContent = `$ ${commandId}\n\nFetch error: ${e.message}`;
        metaEl.textContent = `Failed: ${label}`;
        outputEl.style.color = '#ef4444';
    } finally {
        cliRunning = false;
        buttons.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
        // Scroll to bottom
        outputEl.scrollTop = outputEl.scrollHeight;
    }
}

function clearCliOutput() {
    const outputContainer = document.getElementById('cli-output-container');
    const outputEl = document.getElementById('cli-output');
    const metaEl = document.getElementById('cli-output-meta');
    if (outputContainer) outputContainer.style.display = 'none';
    if (outputEl) { outputEl.textContent = ''; outputEl.style.color = '#22c55e'; }
    if (metaEl) metaEl.textContent = '';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
