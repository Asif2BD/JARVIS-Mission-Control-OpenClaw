/**
 * JARVIS Mission Control - Main Application
 * Local file-based system with real-time updates via WebSocket
 */

// State
let selectedTask = null;
let currentTheme = 'dark';

/**
 * Initialize the dashboard
 */
async function init() {
    console.log('Initializing JARVIS Mission Control...');

    // Initialize theme
    initTheme();

    // Load saved dashboard name
    loadDashboardName();

    // Check server connection
    await checkServerConnection();

    // Load data (from local API if connected, otherwise sample data)
    await window.missionControlData.loadData();

    // Render the dashboard
    renderDashboard();

    // Show instructions on first visit
    if (!localStorage.getItem('mc-instructions-seen')) {
        showInstructions();
    }

    console.log('Dashboard initialized');
}

// ============================================
// SERVER CONNECTION
// ============================================

/**
 * Check if local server is running and update status indicator
 */
async function checkServerConnection() {
    const statusDot = document.getElementById('server-status-dot');
    const statusText = document.getElementById('server-status-text');

    if (!statusDot || !statusText) return;

    try {
        if (window.MissionControlAPI) {
            const metrics = await window.MissionControlAPI.getMetrics();
            if (metrics) {
                statusDot.classList.remove('offline');
                statusDot.classList.add('online');
                statusText.textContent = `Connected (${metrics.wsClientsConnected || 0} clients)`;
                return true;
            }
        }
    } catch (error) {
        console.log('Server not available:', error.message);
    }

    statusDot.classList.remove('online');
    statusDot.classList.add('offline');
    statusText.textContent = 'Offline - Using sample data';
    return false;
}

/**
 * Periodically check server connection
 */
setInterval(checkServerConnection, 30000);

// ============================================
// LOADING & TOAST NOTIFICATIONS
// ============================================

/**
 * Show loading overlay
 */
function showLoading(message = 'Loading...') {
    let overlay = document.getElementById('loading-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${escapeHtml(message)}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.loading-text').textContent = message;
    }

    requestAnimationFrame(() => overlay.classList.add('active'));
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

/**
 * Show a toast notification
 */
function showToast(type, title, message) {
    let container = document.getElementById('toast-container');

    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ'}</span>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

/**
 * Initialize theme from localStorage or system preference
 */
function initTheme() {
    // Check localStorage first
    const savedTheme = localStorage.getItem('mc-theme');

    if (savedTheme) {
        currentTheme = savedTheme;
    } else {
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            currentTheme = 'light';
        }
    }

    // Apply theme
    applyTheme(currentTheme);

    // Setup theme toggle listeners
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            setTheme(theme);
        });
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('mc-theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
}

/**
 * Set and apply theme
 */
function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('mc-theme', theme);
    applyTheme(theme);
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Update toggle buttons
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

/**
 * Render the entire dashboard
 */
function renderDashboard() {
    renderMetrics();
    renderKanban();
    renderHumans();
    renderAgents();
    renderQueue();
}

/**
 * Render metrics in the header
 */
function renderMetrics() {
    const metrics = window.missionControlData.getMetrics();

    document.getElementById('total-tasks').textContent = metrics.totalTasks;
    document.getElementById('in-progress').textContent = metrics.tasksByStatus.IN_PROGRESS || 0;
    document.getElementById('completed-today').textContent = metrics.tasksByStatus.DONE || 0;
    document.getElementById('active-agents').textContent = metrics.activeAgents;
}

/**
 * Render the Kanban board
 */
function renderKanban() {
    const statuses = ['INBOX', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE'];

    statuses.forEach(status => {
        const tasks = window.missionControlData.getTasksByStatus(status);
        const container = document.getElementById(`tasks-${status}`);
        const countBadge = document.getElementById(`count-${status}`);

        // Update count
        countBadge.textContent = tasks.length;

        // Clear existing tasks
        container.innerHTML = '';

        // Render tasks
        tasks.forEach(task => {
            container.appendChild(createTaskCard(task));
        });
    });
}

/**
 * Create a task card element
 */
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority}`;
    card.dataset.taskId = task.id;
    card.dataset.assignee = task.assignee || '';
    card.onclick = () => openTaskModal(task);

    // Get assignee name
    const assignee = task.assignee ?
        window.missionControlData.getAgent(task.assignee) : null;
    const assigneeName = assignee ? assignee.name : null;

    card.innerHTML = `
        <div class="task-card-content">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-id">${task.id}</div>
            ${assigneeName ? `
                <div class="task-assignee">
                    <span class="task-assignee-dot"></span>
                    ${escapeHtml(assigneeName)}
                </div>
            ` : ''}
            ${task.labels && task.labels.length > 0 ? `
                <div class="task-labels">
                    ${task.labels.map(label => `
                        <span class="label">${escapeHtml(label)}</span>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;

    return card;
}

/**
 * Render the humans section - compact inline design with avatars
 */
function renderHumans() {
    const humans = window.missionControlData.getHumans();
    const container = document.getElementById('humans-list');
    const subtitle = document.getElementById('humans-subtitle');

    if (!container) return;

    // Update subtitle
    const activeCount = humans.filter(h => h.status === 'online' || h.status === 'away').length;
    subtitle.textContent = `${activeCount} online`;

    container.innerHTML = humans.map(human => {
        const avatarHtml = human.avatar
            ? `<img src="${human.avatar}" alt="${escapeHtml(human.name)}" class="entity-avatar-img human" onerror="this.outerHTML='<div class=\\'entity-avatar human\\'>${getInitials(human.name)}</div>'"/>`
            : `<div class="entity-avatar human">${getInitials(human.name)}</div>`;

        const channelIcons = getChannelIcons(human.channels);

        return `
            <div class="entity-row human-row clickable" data-entity-id="${human.id}" onclick="highlightEntityTasks('${human.id}')">
                <div class="entity-status ${human.status}"></div>
                ${avatarHtml}
                <div class="entity-info">
                    <span class="entity-name">${escapeHtml(human.name)}</span>
                    <span class="entity-role ${human.role}">${human.role}</span>
                    ${channelIcons}
                </div>
                <span class="entity-tasks">${human.completed_tasks || 0}</span>
            </div>
        `;
    }).join('');
}

/**
 * Get channel icons HTML for an entity
 */
function getChannelIcons(channels) {
    if (!channels || channels.length === 0) return '';

    const icons = channels.map(ch => {
        switch(ch.type) {
            case 'telegram': return '<span class="channel-icon telegram" title="Telegram">T</span>';
            case 'whatsapp': return '<span class="channel-icon whatsapp" title="WhatsApp">W</span>';
            case 'slack': return '<span class="channel-icon slack" title="Slack">S</span>';
            case 'discord': return '<span class="channel-icon discord" title="Discord">D</span>';
            case 'email': return '<span class="channel-icon email" title="Email">@</span>';
            default: return '';
        }
    }).join('');

    return icons ? `<span class="channel-icons">${icons}</span>` : '';
}

/**
 * Render the agents sidebar - compact inline design with avatars
 */
function renderAgents() {
    const allAgents = window.missionControlData.getAgents();
    const container = document.getElementById('agents-list');
    const subtitle = document.getElementById('agents-subtitle');

    if (!container) return;

    // Update subtitle
    const activeCount = allAgents.filter(a => a.status === 'active' || a.status === 'busy').length;
    const subAgentCount = allAgents.filter(a => a.role === 'sub-agent').length;
    subtitle.textContent = `${activeCount} online${subAgentCount > 0 ? ` (${subAgentCount} sub)` : ''}`;

    // Get all agents except sub-agents
    const parentAgents = allAgents.filter(a => a.role !== 'sub-agent');

    container.innerHTML = parentAgents.map(agent => {
        const subAgents = window.missionControlData.getSubAgents(agent.id);
        const activeTasks = agent.current_tasks ? agent.current_tasks.length : 0;

        const avatarHtml = agent.avatar
            ? `<img src="${agent.avatar}" alt="${escapeHtml(agent.name)}" class="entity-avatar-img agent ${agent.role}" onerror="this.outerHTML='<div class=\\'entity-avatar agent ${agent.role}\\'>${getInitials(agent.name)}</div>'"/>`
            : `<div class="entity-avatar agent ${agent.role}">${getInitials(agent.name)}</div>`;

        const channelIcons = getChannelIcons(agent.channels);

        return `
            <div class="entity-row agent-row ${agent.role} clickable" data-entity-id="${agent.id}" onclick="highlightEntityTasks('${agent.id}')">
                <div class="entity-status ${agent.status}"></div>
                ${avatarHtml}
                <div class="entity-info">
                    <span class="entity-name">${escapeHtml(agent.name)}</span>
                    ${activeTasks > 0 ? `<span class="entity-active">${activeTasks}</span>` : ''}
                    ${channelIcons}
                </div>
                <span class="entity-tasks">${agent.completed_tasks || 0}</span>
            </div>
            ${subAgents.length > 0 ? subAgents.map(sub => {
                const subAvatarHtml = sub.avatar
                    ? `<img src="${sub.avatar}" alt="${escapeHtml(sub.name)}" class="entity-avatar-img sub-agent" onerror="this.outerHTML='<div class=\\'entity-avatar sub-agent\\'>↳</div>'"/>`
                    : `<div class="entity-avatar sub-agent">↳</div>`;

                return `
                    <div class="entity-row sub-agent-row">
                        <div class="entity-status ${sub.status}"></div>
                        ${subAvatarHtml}
                        <div class="entity-info">
                            <span class="entity-name sub">${escapeHtml(sub.name)}</span>
                        </div>
                        <span class="entity-tasks">${sub.completed_tasks || 0}</span>
                    </div>
                `;
            }).join('') : ''}
        `;
    }).join('');
}

/**
 * Render scheduled jobs in the right sidebar
 */
function renderQueue() {
    const queue = window.missionControlData.getQueue();
    const container = document.getElementById('jobs-list');
    const countEl = document.getElementById('jobs-running');

    if (!container) return;

    // Update running count
    const runningCount = queue.filter(q => q.status === 'running').length;
    if (countEl) countEl.textContent = `${runningCount} running`;

    container.innerHTML = queue.map(item => {
        const successRate = item.run_count > 0
            ? Math.round((item.success_count / item.run_count) * 100)
            : 100;
        const humanSchedule = cronToHuman(item.schedule);

        return `
            <div class="job-card ${item.status}">
                <div class="job-header">
                    <span class="job-status-dot ${item.status}"></span>
                    <span class="job-name">${escapeHtml(item.name)}</span>
                </div>
                <div class="job-schedule">
                    <span class="job-frequency">${humanSchedule}</span>
                    <span class="job-type ${item.type}">${item.type}</span>
                </div>
                <div class="job-stats">
                    <span class="job-runs">${item.run_count} runs</span>
                    <span class="job-rate ${successRate < 90 ? 'warning' : ''}">${successRate}% success</span>
                </div>
                ${item.last_run ? `<div class="job-last-run">Last: ${formatDate(item.last_run)}</div>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Convert cron syntax to human-readable format
 */
function cronToHuman(schedule) {
    if (!schedule) return 'Unknown';

    // Handle special cases
    if (schedule === 'continuous') return 'Always running';
    if (schedule === 'manual') return 'Manual trigger';

    const parts = schedule.split(' ');
    if (parts.length !== 5) return schedule;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Every X minutes
    if (minute.startsWith('*/') && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        const mins = minute.substring(2);
        return `Every ${mins} min`;
    }

    // Every hour at specific minute
    if (minute !== '*' && !minute.includes('/') && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return minute === '0' ? 'Every hour' : `Hourly at :${minute.padStart(2, '0')}`;
    }

    // Every X hours
    if (minute === '0' && hour.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        const hrs = hour.substring(2);
        return `Every ${hrs} hours`;
    }

    // Daily at specific time
    if (minute !== '*' && hour !== '*' && !hour.includes('/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        const h = parseInt(hour);
        const m = minute.padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
        return `Daily at ${h12}:${m} ${ampm}`;
    }

    // Weekdays at specific time
    if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5') {
        const h = parseInt(hour);
        const m = minute.padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
        return `Weekdays ${h12}:${m} ${ampm}`;
    }

    // Weekly
    if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && /^[0-6]$/.test(dayOfWeek)) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `Weekly on ${days[parseInt(dayOfWeek)]}`;
    }

    // Fallback - return simplified version
    return schedule;
}

/**
 * Save dashboard name to localStorage
 */
function saveDashboardName() {
    const input = document.getElementById('dashboard-name');
    if (input && input.value.trim()) {
        const name = input.value.trim();
        localStorage.setItem('mc-dashboard-name', name);
        updateDashboardName(name);
        alert('Dashboard name saved!');
    }
}

/**
 * Update dashboard name in header
 */
function updateDashboardName(name) {
    const logo = document.querySelector('.logo');
    if (logo) {
        const icon = logo.querySelector('.logo-icon');
        logo.innerHTML = '';
        if (icon) logo.appendChild(icon);
        logo.appendChild(document.createTextNode(' ' + name));
    }
    document.title = name;
}

/**
 * Load saved dashboard name
 */
function loadDashboardName() {
    const savedName = localStorage.getItem('mc-dashboard-name');
    if (savedName) {
        updateDashboardName(savedName);
        const input = document.getElementById('dashboard-name');
        if (input) input.value = savedName;
    }
}

/**
 * Get icon for queue item type
 */
function getQueueIcon(type) {
    switch(type) {
        case 'cron':
            return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
        case 'watcher':
            return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        case 'seeder':
            return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"></path></svg>';
        default:
            return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>';
    }
}

/**
 * Open task detail modal
 */
function openTaskModal(task) {
    selectedTask = task;

    const modal = document.getElementById('task-modal');

    // Populate modal content
    document.getElementById('modal-task-title').textContent = task.title;
    document.getElementById('modal-description').textContent = task.description;

    // Priority badge
    const priorityBadge = document.getElementById('modal-priority');
    priorityBadge.textContent = capitalizeFirst(task.priority);
    priorityBadge.className = `priority-badge ${task.priority}`;

    // Status badge
    document.getElementById('modal-status').textContent = task.status.replace('_', ' ');

    // Assignee
    const assignee = task.assignee ?
        window.missionControlData.getAgent(task.assignee) : null;
    document.getElementById('modal-assignee').textContent =
        assignee ? assignee.name : 'Unassigned';

    // Labels
    const labelsContainer = document.getElementById('modal-labels');
    labelsContainer.innerHTML = task.labels && task.labels.length > 0 ?
        task.labels.map(label => `<span class="label">${escapeHtml(label)}</span>`).join('') :
        '<span class="text-muted">No labels</span>';

    // Comments
    const commentsContainer = document.getElementById('modal-comments');
    commentsContainer.innerHTML = task.comments && task.comments.length > 0 ?
        task.comments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(comment.author)}</span>
                    <span class="comment-time">${formatDate(comment.timestamp)}</span>
                </div>
                <div class="comment-content">${escapeHtml(comment.content)}</div>
            </div>
        `).join('') :
        '<p class="text-muted">No comments yet</p>';

    // Update URL with task ID
    history.pushState({ taskId: task.id }, '', `#${task.id}`);

    // Show modal
    modal.classList.add('open');
}

/**
 * Close task detail modal
 */
function closeModal() {
    const modal = document.getElementById('task-modal');
    modal.classList.remove('open');
    selectedTask = null;

    // Clear URL hash
    history.pushState({}, '', window.location.pathname);
}

/**
 * Open create task modal
 */
function openCreateTaskModal() {
    const modal = document.getElementById('create-task-modal');

    // Populate assignee dropdown
    const assigneeSelect = document.getElementById('task-assignee');
    const agents = window.missionControlData.getActiveAgents();

    assigneeSelect.innerHTML = '<option value="">Unassigned</option>' +
        agents.map(agent => `
            <option value="${agent.id}">${escapeHtml(agent.name)}</option>
        `).join('');

    // Clear form
    document.getElementById('task-title').value = '';
    document.getElementById('task-description').value = '';
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-labels').value = '';

    modal.classList.add('open');
}

/**
 * Close create task modal
 */
function closeCreateTaskModal() {
    const modal = document.getElementById('create-task-modal');
    modal.classList.remove('open');
}

/**
 * Create a new task
 */
async function createTask() {
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const priority = document.getElementById('task-priority').value;
    const assignee = document.getElementById('task-assignee').value || null;
    const labelsStr = document.getElementById('task-labels').value.trim();

    if (!title || !description) {
        showToast('error', 'Missing Fields', 'Please fill in title and description');
        return;
    }

    const labels = labelsStr ?
        labelsStr.split(',').map(l => l.trim()).filter(l => l) :
        [];

    // Create the task object locally first
    const taskData = {
        title,
        description,
        priority,
        assignee,
        labels,
        created_by: 'human-user'
    };

    // Close modal
    closeCreateTaskModal();

    // Try to save to local server API
    if (window.MissionControlAPI) {
        showLoading('Saving task...');

        try {
            const savedTask = await window.MissionControlAPI.createTask(taskData);

            if (savedTask && savedTask.id) {
                // Add to local data store
                window.missionControlData.tasks.push(savedTask);

                showToast('success', 'Task Created', `Task saved: ${savedTask.id}`);
                console.log('Task saved to server:', savedTask);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Failed to save task to server:', error);

            // Fall back to local-only storage
            const newTask = window.missionControlData.addTask(taskData);
            showToast('info', 'Task Created Locally',
                'Server unavailable. Task stored locally only.');
            showTaskJson(newTask);
        }

        hideLoading();
    } else {
        // No API available - create locally and show JSON
        const newTask = window.missionControlData.addTask(taskData);
        showToast('info', 'Task Created Locally',
            'Start the server to enable persistence.');
        showTaskJson(newTask);
    }

    // Refresh display
    renderDashboard();
    initDragAndDrop();
}

/**
 * Show task JSON for manual save (fallback when server not available)
 */
function showTaskJson(task) {
    const json = JSON.stringify(task, null, 2);
    const filename = `${task.id}.json`;

    console.log(`Save to .mission-control/tasks/${filename}:`);
    console.log(json);

    // Copy to clipboard if supported
    if (navigator.clipboard) {
        navigator.clipboard.writeText(json).then(() => {
            showToast('info', 'Copied!', 'Task JSON copied to clipboard');
        }).catch(() => {
            // Clipboard failed, that's ok
        });
    }
}

/**
 * Show instructions panel
 */
function showInstructions() {
    document.getElementById('instructions-panel').classList.add('show');
}

/**
 * Toggle instructions panel
 */
function toggleInstructions() {
    const panel = document.getElementById('instructions-panel');
    panel.classList.toggle('show');
    localStorage.setItem('mc-instructions-seen', 'true');
}

// Utility functions

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return 'just now';
    } else if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// ============================================
// TASK HIGHLIGHTING - Click on agent/human to highlight their tasks
// ============================================

let currentHighlightedEntity = null;

/**
 * Highlight tasks assigned to a specific entity (agent or human)
 * Clicking the same entity again removes the highlight
 */
function highlightEntityTasks(entityId) {
    const allTaskCards = document.querySelectorAll('.task-card');
    const allEntityRows = document.querySelectorAll('.entity-row');

    // If clicking the same entity, toggle off
    if (currentHighlightedEntity === entityId) {
        currentHighlightedEntity = null;

        // Remove all highlights
        allTaskCards.forEach(card => {
            card.classList.remove('highlighted', 'dimmed');
        });

        // Remove selected state from entity rows
        allEntityRows.forEach(row => {
            row.classList.remove('selected');
        });

        return;
    }

    // Set new highlighted entity
    currentHighlightedEntity = entityId;

    // Update entity row selection
    allEntityRows.forEach(row => {
        if (row.dataset.entityId === entityId) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });

    // Count matching tasks
    let matchCount = 0;

    // Highlight matching tasks, dim others
    allTaskCards.forEach(card => {
        if (card.dataset.assignee === entityId) {
            card.classList.add('highlighted');
            card.classList.remove('dimmed');
            matchCount++;
        } else {
            card.classList.remove('highlighted');
            card.classList.add('dimmed');
        }
    });

    // If no tasks found, still show the selection but don't dim anything
    if (matchCount === 0) {
        allTaskCards.forEach(card => {
            card.classList.remove('dimmed');
        });
    }
}

// Close modals on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeCreateTaskModal();
    }
});

// Close modals on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('open');
        }
    });
});

// ============================================
// DRAG AND DROP FUNCTIONALITY
// ============================================

let draggedTask = null;
let draggedElement = null;

/**
 * Initialize drag and drop for task cards
 */
function initDragAndDrop() {
    // Make all task cards draggable
    document.querySelectorAll('.task-card').forEach(card => {
        card.setAttribute('draggable', 'true');

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });

    // Setup drop zones (task lists)
    document.querySelectorAll('.task-list').forEach(list => {
        list.addEventListener('dragover', handleDragOver);
        list.addEventListener('dragenter', handleDragEnter);
        list.addEventListener('dragleave', handleDragLeave);
        list.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedElement = e.target.closest('.task-card');
    const taskId = draggedElement.querySelector('.task-id').textContent;
    draggedTask = window.missionControlData.tasks.find(t => t.id === taskId);

    draggedElement.classList.add('dragging');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);

    // Add slight delay for visual feedback
    setTimeout(() => {
        draggedElement.style.opacity = '0.4';
    }, 0);
}

function handleDragEnd(e) {
    draggedElement.classList.remove('dragging');
    draggedElement.style.opacity = '';

    // Remove all drag-over states
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });

    draggedTask = null;
    draggedElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    const taskList = e.target.closest('.task-list');
    if (taskList) {
        taskList.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const taskList = e.target.closest('.task-list');
    if (taskList && !taskList.contains(e.relatedTarget)) {
        taskList.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    e.preventDefault();

    const taskList = e.target.closest('.task-list');
    if (!taskList || !draggedTask) return;

    taskList.classList.remove('drag-over');

    // Get new status from column
    const column = taskList.closest('.kanban-column');
    const newStatus = column.dataset.status;

    // Update task status
    if (draggedTask.status !== newStatus) {
        const oldStatus = draggedTask.status;
        draggedTask.status = newStatus;
        draggedTask.updated_at = new Date().toISOString();

        // Add status change comment
        if (!draggedTask.comments) draggedTask.comments = [];
        draggedTask.comments.push({
            id: `comment-${Date.now()}`,
            author: 'system',
            content: `Status changed from ${oldStatus} to ${newStatus}`,
            timestamp: new Date().toISOString(),
            type: 'system'
        });

        console.log(`Task ${draggedTask.id} moved: ${oldStatus} -> ${newStatus}`);

        // Save to server if available
        if (window.MissionControlAPI) {
            try {
                await window.MissionControlAPI.updateTask(draggedTask.id, draggedTask);
            } catch (error) {
                console.error('Failed to save task update:', error);
                showToast('error', 'Save Failed', 'Task moved locally but not saved to server');
            }
        }

        // Re-render the board
        renderDashboard();

        // Re-initialize drag and drop for new elements
        initDragAndDrop();
    }
}

// ============================================
// TASK ASSIGNMENT
// ============================================

/**
 * Quick assign task to agent
 */
async function assignTask(taskId, assigneeId) {
    const task = window.missionControlData.tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldAssignee = task.assignee;
    task.assignee = assigneeId;
    task.updated_at = new Date().toISOString();

    // If moving from INBOX, set to ASSIGNED
    if (task.status === 'INBOX' && assigneeId) {
        task.status = 'ASSIGNED';
    }

    // Add comment
    if (!task.comments) task.comments = [];
    const assigneeName = assigneeId ?
        (window.missionControlData.getAgent(assigneeId)?.name || assigneeId) :
        'Unassigned';

    task.comments.push({
        id: `comment-${Date.now()}`,
        author: 'system',
        content: `Assigned to ${assigneeName}`,
        timestamp: new Date().toISOString(),
        type: 'system'
    });

    console.log(`Task ${taskId} assigned to ${assigneeName}`);

    // Save to server if available
    if (window.MissionControlAPI) {
        try {
            await window.MissionControlAPI.updateTask(task.id, task);
        } catch (error) {
            console.error('Failed to save assignment:', error);
        }
    }

    renderDashboard();
    initDragAndDrop();
}

// ============================================
// URL ROUTING - Deep linking to tasks
// ============================================

/**
 * Check URL hash and open task if present
 */
function checkUrlForTask() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#task-')) {
        const taskId = hash.substring(1); // Remove the #
        const task = window.missionControlData.tasks.find(t => t.id === taskId);
        if (task) {
            openTaskModal(task);
        }
    }
}

/**
 * Handle browser back/forward navigation
 */
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.taskId) {
        const task = window.missionControlData.tasks.find(t => t.id === e.state.taskId);
        if (task) {
            openTaskModal(task);
        }
    } else {
        closeModal();
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    init().then(() => {
        initDragAndDrop();
        // Check URL for task ID after data is loaded
        checkUrlForTask();
    });
});
