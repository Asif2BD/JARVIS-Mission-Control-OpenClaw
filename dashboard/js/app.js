/**
 * JARVIS Mission Control - Main Application
 * Local file-based system with real-time updates via WebSocket
 */

// State
let selectedTask = null;
let currentTheme = 'dark';
let currentColorTheme = 'matrix';
let currentProfileAgent = null;
let currentProfileTab = 'attention';
let currentThreadId = null;
let currentThreadAgentId = null;
let chatPanelOpen = false;

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

    // Load reports
    loadFiles('reports');

    // Load chat messages
    loadChatMessages();

    // Setup real-time message listeners
    setupMessageListeners();

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
    // Check localStorage for saved preferences
    const savedTheme = localStorage.getItem('mc-theme');
    const savedColorTheme = localStorage.getItem('mc-color-theme');

    if (savedTheme) {
        currentTheme = savedTheme;
    } else {
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            currentTheme = 'light';
        }
    }

    if (savedColorTheme) {
        currentColorTheme = savedColorTheme;
    }

    // Apply themes
    applyTheme(currentTheme);
    applyColorTheme(currentColorTheme);

    // Setup dark/light mode toggle listeners (both old and new selectors)
    document.querySelectorAll('.theme-toggle-btn, .mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            setTheme(theme);
        });
    });

    // Setup color theme grid in sidebar
    document.querySelectorAll('.theme-card').forEach(btn => {
        btn.addEventListener('click', () => {
            const colorTheme = btn.dataset.colorTheme;
            setColorTheme(colorTheme);
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
 * Set and apply dark/light theme
 */
function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('mc-theme', theme);
    applyTheme(theme);
}

/**
 * Apply dark/light theme to document
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Update all toggle buttons (both old and new selectors)
    document.querySelectorAll('.theme-toggle-btn, .mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

/**
 * Set and apply color theme
 */
function setColorTheme(colorTheme) {
    currentColorTheme = colorTheme;
    localStorage.setItem('mc-color-theme', colorTheme);
    applyColorTheme(colorTheme);
}

/**
 * Apply color theme to document
 */
function applyColorTheme(colorTheme) {
    document.documentElement.setAttribute('data-color-theme', colorTheme);

    // Update theme cards in sidebar
    document.querySelectorAll('.theme-card').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.colorTheme === colorTheme);
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
    
    // Use addEventListener instead of onclick property for better reliability
    card.addEventListener('click', (e) => {
        // Only open modal if not dragging
        if (!card.classList.contains('dragging')) {
            openTaskModal(task);
        }
    });

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
            <div class="entity-row agent-row ${agent.role} clickable" data-entity-id="${agent.id}" onclick="openAgentProfile('${agent.id}')">
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

    // Attachments
    renderTaskAttachments(task);

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
        if (currentProfileAgent) {
            closeAgentProfile();
        } else {
            closeModal();
            closeCreateTaskModal();
        }
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
        const taskId = hash.substring(1);
        const task = window.missionControlData.tasks.find(t => t.id === taskId);
        if (task) {
            openTaskModal(task);
        }
    } else if (hash && hash.startsWith('#agent-')) {
        const agentId = hash.substring(1);
        openAgentProfile(agentId);
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

// ============================================
// FEATURE 1-3: AGENT PROFILE PANEL
// ============================================

/**
 * Open the agent profile panel
 */
function openAgentProfile(agentId) {
    const agent = window.missionControlData.getAgent(agentId);
    if (!agent) return;

    currentProfileAgent = agent;
    currentProfileTab = 'attention';

    const panel = document.getElementById('agent-profile-panel');
    if (!panel) return;

    // Avatar
    const avatarImg = document.getElementById('profile-avatar');
    const avatarFallback = document.getElementById('profile-avatar-fallback');
    if (agent.avatar) {
        avatarImg.src = agent.avatar;
        avatarImg.alt = agent.name;
        avatarImg.style.display = '';
        avatarFallback.style.display = 'none';
    } else {
        avatarImg.style.display = 'none';
        avatarFallback.style.display = 'flex';
        avatarFallback.textContent = getInitials(agent.name);
        avatarFallback.className = `profile-avatar-fallback ${agent.role}`;
    }

    // Name & designation
    document.getElementById('profile-name').textContent = agent.name;
    document.getElementById('profile-designation').textContent = agent.designation || agent.role;

    // Role badge
    const roleBadge = document.getElementById('profile-role-badge');
    roleBadge.textContent = capitalizeFirst(agent.role);
    roleBadge.className = `role-badge ${agent.role}`;

    // Status
    const statusDot = document.getElementById('profile-status-dot');
    const statusText = document.getElementById('profile-status-text');
    const statusMap = { active: 'ACTIVE', busy: 'WORKING', idle: 'IDLE', offline: 'OFFLINE' };
    statusDot.className = `profile-status-dot ${agent.status}`;
    statusText.textContent = statusMap[agent.status] || agent.status.toUpperCase();

    // Personality / About (Feature 2)
    const aboutEl = document.getElementById('profile-about');
    if (agent.personality && agent.personality.about) {
        aboutEl.textContent = agent.personality.about;
    } else if (agent.metadata && agent.metadata.description) {
        aboutEl.textContent = agent.metadata.description;
    } else {
        aboutEl.textContent = 'No description available.';
    }

    // Skills / Capabilities (Feature 3)
    const skillsEl = document.getElementById('profile-skills');
    if (agent.capabilities && agent.capabilities.length > 0) {
        skillsEl.innerHTML = agent.capabilities.map(skill =>
            `<span class="skill-tag">${escapeHtml(skill)}</span>`
        ).join('');
    } else {
        skillsEl.innerHTML = '<span class="text-muted">No skills listed</span>';
    }

    // Reset tabs
    switchProfileTab('attention');

    // Load tab data
    loadAttentionItems(agentId);
    loadTimeline(agentId);
    loadConversations(agentId);

    // URL routing
    history.pushState({ agentId: agentId }, '', `#${agentId}`);

    // Highlight entity in sidebar
    highlightEntityTasks(agentId);

    // Open panel
    panel.classList.add('open');
}

/**
 * Close agent profile panel
 */
function closeAgentProfile() {
    const panel = document.getElementById('agent-profile-panel');
    if (panel) {
        panel.classList.remove('open');
    }
    currentProfileAgent = null;

    // Clear entity highlight
    if (currentHighlightedEntity) {
        highlightEntityTasks(currentHighlightedEntity); // Toggle off
    }

    // Clear URL
    history.pushState({}, '', window.location.pathname);
}

/**
 * Switch between profile tabs
 */
function switchProfileTab(tabName) {
    currentProfileTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });
}

// ============================================
// FEATURE 4: ATTENTION CENTER
// ============================================

/**
 * Load attention items for an agent
 */
async function loadAttentionItems(agentId) {
    const container = document.getElementById('attention-list');
    if (!container) return;

    let items = [];

    // Try API first
    if (window.MissionControlAPI) {
        try {
            items = await window.MissionControlAPI.getAgentAttention(agentId);
        } catch (e) {
            // Fall back to local computation
        }
    }

    // Fallback: compute from local data
    if (items.length === 0) {
        items = computeAttentionItems(agentId);
    }

    renderAttentionItems(container, items);

    // Update badge
    const badge = document.getElementById('attention-badge');
    if (badge) {
        if (items.length > 0) {
            badge.textContent = items.length;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    }
}

/**
 * Compute attention items from local data
 */
function computeAttentionItems(agentId) {
    const tasks = window.missionControlData.getTasks();
    const items = [];

    for (const task of tasks) {
        // Tasks assigned to this agent
        if (task.assignee === agentId && task.status !== 'DONE') {
            items.push({
                type: task.priority === 'critical' ? 'critical_task' : 'assigned_task',
                task_id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                timestamp: task.updated_at || task.created_at
            });
        }

        // Blocked tasks created by this agent
        if (task.status === 'BLOCKED' && task.created_by === agentId) {
            items.push({
                type: 'blocked_task',
                task_id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                timestamp: task.updated_at || task.created_at
            });
        }

        // @mentions in comments
        if (task.comments) {
            for (const comment of task.comments) {
                if (comment.content && (comment.content.includes(`@${agentId}`) || comment.content.includes(`@${agentId.replace('agent-', '')}`))) {
                    items.push({
                        type: 'mention',
                        task_id: task.id,
                        title: task.title,
                        author: comment.author,
                        content: comment.content,
                        timestamp: comment.timestamp
                    });
                }
            }
        }
    }

    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return items;
}

/**
 * Render attention items
 */
function renderAttentionItems(container, items) {
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-state">No items needing attention</p>';
        return;
    }

    container.innerHTML = items.map(item => {
        let icon, label, colorClass;
        switch (item.type) {
            case 'critical_task':
                icon = '!!'; label = 'CRITICAL'; colorClass = 'critical';
                break;
            case 'assigned_task':
                icon = '>>'; label = 'ASSIGNED'; colorClass = 'assigned';
                break;
            case 'blocked_task':
                icon = '!!'; label = 'BLOCKED'; colorClass = 'blocked';
                break;
            case 'mention':
                icon = '@'; label = 'MENTION'; colorClass = 'mention';
                break;
            default:
                icon = '>>'; label = 'INFO'; colorClass = 'info';
        }

        return `
            <div class="attention-item ${colorClass}" onclick="${item.task_id ? `openTaskById('${item.task_id}')` : ''}">
                <div class="attention-icon">${icon}</div>
                <div class="attention-content">
                    <div class="attention-label">${label}</div>
                    <div class="attention-title">${escapeHtml(item.title)}</div>
                    ${item.author ? `<div class="attention-meta">by ${escapeHtml(item.author)}</div>` : ''}
                </div>
                <div class="attention-time">${formatDate(item.timestamp)}</div>
            </div>
        `;
    }).join('');
}

/**
 * Open a task by ID (helper for attention items)
 */
function openTaskById(taskId) {
    const task = window.missionControlData.tasks.find(t => t.id === taskId);
    if (task) {
        closeAgentProfile();
        openTaskModal(task);
    }
}

// ============================================
// FEATURE 5: AGENT ACTIVITY TIMELINE
// ============================================

/**
 * Load timeline for an agent
 */
async function loadTimeline(agentId) {
    const container = document.getElementById('timeline-list');
    if (!container) return;

    let items = [];

    // Try API first
    if (window.MissionControlAPI) {
        try {
            items = await window.MissionControlAPI.getAgentTimeline(agentId);
        } catch (e) {
            // Fall back to local computation
        }
    }

    // Fallback: compute from local data
    if (items.length === 0) {
        items = computeTimeline(agentId);
    }

    renderTimeline(container, items);
}

/**
 * Compute timeline from local data
 */
function computeTimeline(agentId) {
    const tasks = window.missionControlData.getTasks();
    const timeline = [];

    for (const task of tasks) {
        // Comments authored by this agent
        if (task.comments) {
            for (const comment of task.comments) {
                if (comment.author === agentId) {
                    timeline.push({
                        type: 'comment',
                        timestamp: comment.timestamp,
                        task_id: task.id,
                        task_title: task.title,
                        content: comment.content,
                        comment_type: comment.type
                    });
                }
            }
        }

        // Tasks created by this agent
        if (task.created_by === agentId) {
            timeline.push({
                type: 'log',
                timestamp: task.created_at,
                action: 'CREATED',
                description: `Created task: ${task.title}`
            });
        }

        // Tasks assigned to this agent (show as claimed)
        if (task.assignee === agentId) {
            timeline.push({
                type: 'log',
                timestamp: task.updated_at || task.created_at,
                action: task.status === 'DONE' ? 'COMPLETED' : 'CLAIMED',
                description: `${task.status === 'DONE' ? 'Completed' : 'Working on'}: ${task.title}`
            });
        }
    }

    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return timeline.slice(0, 50);
}

/**
 * Render timeline items
 */
function renderTimeline(container, items) {
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-state">No activity recorded yet</p>';
        return;
    }

    container.innerHTML = items.map((item, idx) => {
        let actionText, dotClass;

        if (item.type === 'comment') {
            const typeLabels = {
                progress: 'Updated progress',
                question: 'Asked a question',
                review: 'Submitted review',
                approval: 'Approved work',
                blocked: 'Reported blocker',
                system: 'System update'
            };
            actionText = typeLabels[item.comment_type] || 'Commented';
            dotClass = item.comment_type === 'approval' ? 'done' : 'comment';
        } else {
            actionText = item.action || 'Activity';
            dotClass = (item.action || '').toLowerCase();
            if (['completed', 'done'].includes(dotClass)) dotClass = 'done';
            else if (['claimed', 'started'].includes(dotClass)) dotClass = 'started';
            else if (['created'].includes(dotClass)) dotClass = 'created';
            else dotClass = 'default';
        }

        return `
            <div class="timeline-item">
                <div class="timeline-marker">
                    <div class="timeline-dot ${dotClass}"></div>
                    ${idx < items.length - 1 ? '<div class="timeline-line"></div>' : ''}
                </div>
                <div class="timeline-content">
                    <div class="timeline-action">${escapeHtml(actionText)}</div>
                    <div class="timeline-desc">${escapeHtml(item.description || item.content || '')}</div>
                    ${item.task_title ? `<div class="timeline-task">${escapeHtml(item.task_title)}</div>` : ''}
                    <div class="timeline-time">${formatDate(item.timestamp)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// FEATURE 7: MESSAGES TAB (CONVERSATIONS)
// ============================================

/**
 * Load conversations for an agent
 */
async function loadConversations(agentId) {
    const container = document.getElementById('conversations-list');
    if (!container) return;

    let messages = [];

    // Try API first
    if (window.MissionControlAPI) {
        try {
            messages = await window.MissionControlAPI.getMessages(agentId);
        } catch (e) {
            // Fall back to local data
        }
    }

    // Fallback: use sample data
    if (messages.length === 0 && window.missionControlData.getMessagesForAgent) {
        messages = window.missionControlData.getMessagesForAgent(agentId);
    }

    // Group by thread (exclude chat messages)
    const threads = {};
    for (const msg of messages) {
        if (msg.type === 'chat') continue;
        if (!threads[msg.thread_id]) {
            threads[msg.thread_id] = [];
        }
        threads[msg.thread_id].push(msg);
    }

    // Sort threads by latest message
    const threadList = Object.entries(threads)
        .map(([threadId, msgs]) => {
            msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            const lastMsg = msgs[msgs.length - 1];
            const otherAgentId = lastMsg.from === agentId ? lastMsg.to : lastMsg.from;
            const otherAgent = window.missionControlData.getAgent(otherAgentId);
            const unread = msgs.filter(m => m.to === agentId && !m.read).length;
            return {
                threadId,
                otherAgent: otherAgent || { id: otherAgentId, name: otherAgentId },
                lastMessage: lastMsg,
                unread,
                messages: msgs
            };
        })
        .sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));

    renderConversationsList(container, threadList, agentId);

    // Update badge
    const badge = document.getElementById('messages-badge');
    const totalUnread = threadList.reduce((sum, t) => sum + t.unread, 0);
    if (badge) {
        if (totalUnread > 0) {
            badge.textContent = totalUnread;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    }
}

/**
 * Render conversations list
 */
function renderConversationsList(container, threads, agentId) {
    if (threads.length === 0) {
        container.innerHTML = '<p class="empty-state">No conversations yet</p>';
        return;
    }

    container.innerHTML = threads.map(thread => {
        const agent = thread.otherAgent;
        const avatarHtml = agent.avatar
            ? `<img src="${agent.avatar}" class="conv-avatar" alt="${escapeHtml(agent.name)}" onerror="this.outerHTML='<div class=\\'conv-avatar-fallback\\'>${getInitials(agent.name)}</div>'">`
            : `<div class="conv-avatar-fallback">${getInitials(agent.name)}</div>`;

        const preview = thread.lastMessage.content.length > 60
            ? thread.lastMessage.content.substring(0, 60) + '...'
            : thread.lastMessage.content;

        return `
            <div class="conversation-item ${thread.unread > 0 ? 'unread' : ''}" onclick="openConversationThread('${thread.threadId}', '${agent.id}', '${escapeHtml(agent.name)}')">
                ${avatarHtml}
                <div class="conv-info">
                    <div class="conv-name">${escapeHtml(agent.name)}</div>
                    <div class="conv-preview">${escapeHtml(preview)}</div>
                </div>
                <div class="conv-meta">
                    <div class="conv-time">${formatDate(thread.lastMessage.timestamp)}</div>
                    ${thread.unread > 0 ? `<div class="conv-unread">${thread.unread}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Open a conversation thread
 */
async function openConversationThread(threadId, otherAgentId, otherAgentName) {
    currentThreadId = threadId;
    currentThreadAgentId = otherAgentId;

    // Hide conversations list, show thread
    document.getElementById('conversations-list').style.display = 'none';
    const threadEl = document.getElementById('conversation-thread');
    threadEl.style.display = 'flex';

    document.getElementById('thread-agent-name').textContent = otherAgentName;

    // Load messages
    let messages = [];

    if (window.MissionControlAPI) {
        try {
            messages = await window.MissionControlAPI.getMessageThread(threadId);
        } catch (e) { /* fallback */ }
    }

    if (messages.length === 0 && window.missionControlData.getMessagesByThread) {
        messages = window.missionControlData.getMessagesByThread(threadId);
    }

    renderThreadMessages(messages);
}

/**
 * Close conversation thread, go back to list
 */
function closeConversationThread() {
    currentThreadId = null;
    currentThreadAgentId = null;

    document.getElementById('conversations-list').style.display = '';
    document.getElementById('conversation-thread').style.display = 'none';
}

/**
 * Render messages in a thread
 */
function renderThreadMessages(messages) {
    const container = document.getElementById('thread-messages');
    if (!container) return;

    const myAgentId = currentProfileAgent ? currentProfileAgent.id : '';

    container.innerHTML = messages.map(msg => {
        const isMine = msg.from === myAgentId;
        const senderAgent = window.missionControlData.getAgent(msg.from);
        const senderName = senderAgent ? senderAgent.name : msg.from;

        return `
            <div class="message-bubble ${isMine ? 'sent' : 'received'}">
                ${!isMine ? `<div class="message-sender">${escapeHtml(senderName)}</div>` : ''}
                <div class="message-text">${escapeHtml(msg.content)}</div>
                <div class="message-time">${formatDate(msg.timestamp)}</div>
            </div>
        `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/**
 * Send a message in the current thread
 */
async function sendThreadMessage() {
    const input = document.getElementById('thread-message-input');
    const content = input.value.trim();
    if (!content || !currentProfileAgent || !currentThreadAgentId) return;

    const message = {
        from: currentProfileAgent.id,
        to: currentThreadAgentId,
        content: content,
        thread_id: currentThreadId,
        type: 'direct'
    };

    input.value = '';

    // Try to send via API
    if (window.MissionControlAPI) {
        try {
            await window.MissionControlAPI.sendMessage(message);
        } catch (e) {
            console.error('Failed to send message:', e);
        }
    }

    // Add locally and re-render
    message.id = `msg-${Date.now()}`;
    message.timestamp = new Date().toISOString();
    message.read = false;

    if (window.missionControlData.messages) {
        window.missionControlData.messages.push(message);
    }

    // Re-render thread
    let messages = [];
    if (window.missionControlData.getMessagesByThread) {
        messages = window.missionControlData.getMessagesByThread(currentThreadId);
    }
    renderThreadMessages(messages);
}

// ============================================
// FEATURE 8: DASHBOARD CHAT PANEL
// ============================================

/**
 * Toggle chat panel open/closed
 */
function toggleChatPanel() {
    chatPanelOpen = !chatPanelOpen;
    const panel = document.getElementById('chat-panel');
    const toggleBtn = document.getElementById('chat-toggle-btn');

    if (panel) {
        panel.classList.toggle('open', chatPanelOpen);
    }
    if (toggleBtn) {
        toggleBtn.style.display = chatPanelOpen ? 'none' : '';
    }

    if (chatPanelOpen) {
        loadChatMessages();
        // Focus input
        setTimeout(() => {
            const input = document.getElementById('chat-input');
            if (input) input.focus();
        }, 300);
    }
}

/**
 * Load chat messages (general channel)
 */
async function loadChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    let messages = [];

    // Try API first
    if (window.MissionControlAPI) {
        try {
            const allMsgs = await window.MissionControlAPI.getMessages();
            messages = allMsgs.filter(m => m.type === 'chat' || m.thread_id === 'chat-general');
        } catch (e) { /* fallback */ }
    }

    // Fallback: use sample data
    if (messages.length === 0 && window.missionControlData.getChatMessages) {
        messages = window.missionControlData.getChatMessages();
    }

    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    renderChatMessages(container, messages);
}

/**
 * Render chat messages
 */
function renderChatMessages(container, messages) {
    if (messages.length === 0) {
        container.innerHTML = '<p class="chat-empty">No messages yet. Start a conversation!</p>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isHuman = msg.from && msg.from.startsWith('human-');
        const sender = isHuman
            ? (window.missionControlData.getHumans().find(h => h.id === msg.from) || { name: msg.from })
            : (window.missionControlData.getAgent(msg.from) || { name: msg.from });

        return `
            <div class="chat-message ${isHuman ? 'human' : 'agent'}">
                <div class="chat-msg-header">
                    <span class="chat-msg-sender">${escapeHtml(sender.name || msg.from)}</span>
                    <span class="chat-msg-time">${formatDate(msg.timestamp)}</span>
                </div>
                <div class="chat-msg-content">${escapeHtml(msg.content)}</div>
            </div>
        `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/**
 * Send a chat message
 */
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    // Detect @mentions to set recipient
    const mentionMatch = content.match(/@(\w+)/);
    let to = 'agent-jarvis'; // Default recipient
    if (mentionMatch) {
        const agents = window.missionControlData.getAgents();
        const mentioned = agents.find(a =>
            a.name.toLowerCase() === mentionMatch[1].toLowerCase() ||
            a.id === `agent-${mentionMatch[1].toLowerCase()}`
        );
        if (mentioned) to = mentioned.id;
    }

    const message = {
        from: 'human-asif',
        to: to,
        content: content,
        thread_id: 'chat-general',
        type: 'chat'
    };

    input.value = '';

    // Try to send via API
    if (window.MissionControlAPI) {
        try {
            await window.MissionControlAPI.sendMessage(message);
        } catch (e) {
            console.error('Failed to send chat message:', e);
        }
    }

    // Add locally
    message.id = `msg-${Date.now()}`;
    message.timestamp = new Date().toISOString();
    message.read = true;

    if (window.missionControlData.messages) {
        window.missionControlData.messages.push(message);
    }

    // Re-render
    loadChatMessages();
}

// ============================================
// REPORTS & FILE BROWSER
// ============================================

let currentFilesDir = 'reports';
let currentViewerFile = null;

/**
 * Load and render files from a directory
 */
async function loadFiles(directory = 'reports') {
    const container = document.getElementById('reports-list');
    const countEl = document.getElementById('reports-count');
    
    if (!container) return;
    
    currentFilesDir = directory;
    
    // Show loading state
    container.innerHTML = '<p class="empty-state">Loading...</p>';
    
    try {
        let files = [];
        
        if (window.MissionControlAPI) {
            const result = await window.MissionControlAPI.getFiles(directory);
            files = result.files || [];
        }
        
        // Update count
        if (countEl) {
            countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
        }
        
        // Render files
        if (files.length === 0) {
            container.innerHTML = `<p class="empty-state">No files in ${directory}</p>`;
            return;
        }
        
        container.innerHTML = files.map(file => {
            const sizeStr = formatFileSize(file.size);
            const dateStr = formatDate(file.modified);
            
            return `
                <div class="report-item" onclick="openFileViewer('${directory}', '${escapeHtml(file.name)}')" title="${escapeHtml(file.name)}">
                    <div class="report-icon ${file.type}">${file.type.toUpperCase().substring(0, 4)}</div>
                    <div class="report-info">
                        <div class="report-name">${escapeHtml(file.name)}</div>
                        <div class="report-meta">
                            <span class="report-size">${sizeStr}</span>
                            <span class="report-date">${dateStr}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load files:', error);
        container.innerHTML = '<p class="empty-state">Failed to load files</p>';
    }
}

/**
 * Switch between file directories
 */
function switchFilesTab(directory) {
    // Update active tab
    document.querySelectorAll('.reports-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.dir === directory);
    });
    
    // Load files
    loadFiles(directory);
}

/**
 * Open file viewer modal
 */
async function openFileViewer(directory, filename) {
    const modal = document.getElementById('file-viewer-modal');
    const titleEl = document.getElementById('file-viewer-title');
    const badgeEl = document.getElementById('file-type-badge');
    const sizeEl = document.getElementById('file-viewer-size');
    const modifiedEl = document.getElementById('file-viewer-modified');
    const contentEl = document.getElementById('file-viewer-content');
    
    if (!modal || !contentEl) return;
    
    // Show loading
    titleEl.textContent = filename;
    contentEl.innerHTML = '<p class="text-muted">Loading...</p>';
    contentEl.className = 'file-content';
    modal.classList.add('open');
    
    try {
        let fileData;
        
        if (window.MissionControlAPI) {
            fileData = await window.MissionControlAPI.getFile(directory, filename);
        }
        
        if (!fileData) {
            contentEl.innerHTML = '<p class="text-muted">Failed to load file</p>';
            return;
        }
        
        currentViewerFile = fileData;
        
        // Update metadata
        titleEl.textContent = fileData.name;
        badgeEl.textContent = fileData.type.toUpperCase();
        badgeEl.className = `file-type-badge ${fileData.type}`;
        sizeEl.textContent = formatFileSize(fileData.size);
        modifiedEl.textContent = `Modified: ${new Date(fileData.modified).toLocaleString()}`;
        
        // Render content based on type
        if (fileData.type === 'md') {
            contentEl.className = 'file-content markdown';
            contentEl.innerHTML = renderMarkdown(fileData.content);
        } else if (fileData.type === 'json') {
            contentEl.className = 'file-content json-viewer';
            contentEl.innerHTML = renderJsonSyntax(fileData.content);
        } else {
            contentEl.className = 'file-content plain-text';
            contentEl.textContent = fileData.content;
        }
        
    } catch (error) {
        console.error('Failed to load file:', error);
        contentEl.innerHTML = `<p class="text-muted">Error: ${escapeHtml(error.message)}</p>`;
    }
}

/**
 * Close file viewer modal
 */
function closeFileViewer() {
    const modal = document.getElementById('file-viewer-modal');
    if (modal) {
        modal.classList.remove('open');
    }
    currentViewerFile = null;
}

/**
 * Copy file content to clipboard
 */
function copyFileContent() {
    if (!currentViewerFile || !currentViewerFile.content) return;
    
    navigator.clipboard.writeText(currentViewerFile.content)
        .then(() => showToast('success', 'Copied!', 'File content copied to clipboard'))
        .catch(() => showToast('error', 'Copy Failed', 'Could not copy to clipboard'));
}

/**
 * Download current file
 */
function downloadFile() {
    if (!currentViewerFile) return;
    
    const blob = new Blob([currentViewerFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentViewerFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Download attachment directly
 */
function downloadAttachment(path, filename) {
    const a = document.createElement('a');
    a.href = `/api/files/${path}?download=true`;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Simple Markdown renderer
 */
function renderMarkdown(text) {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    // Headers
    html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    
    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Blockquotes
    html = html.replace(/^&gt;\s+(.*)$/gm, '<blockquote>$1</blockquote>');
    
    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\*\*\*$/gm, '<hr>');
    
    // Lists
    html = html.replace(/^\s*[-*+]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)\n(<li>)/g, '$1$2');
    html = html.replace(/(<li>.*<\/li>)(?!\n<li>)/g, '<ul>$1</ul>');
    
    // Numbered lists
    html = html.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // Tables (simple)
    html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
        const cells = content.split('|').map(c => c.trim());
        if (cells.every(c => /^-+$/.test(c))) {
            return ''; // separator row
        }
        const cellTag = cells.some(c => c.match(/^\*\*.+\*\*$/)) ? 'th' : 'td';
        return '<tr>' + cells.map(c => `<${cellTag}>${c}</${cellTag}>`).join('') + '</tr>';
    });
    html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');
    
    // Paragraphs
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<table>)/g, '$1');
    html = html.replace(/(<\/table>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)/g, '$1');
    html = html.replace(/(<hr>)<\/p>/g, '$1');
    
    return html;
}

/**
 * Render JSON with syntax highlighting
 */
function renderJsonSyntax(text) {
    if (!text) return '';
    
    try {
        // Try to parse and re-format
        const parsed = JSON.parse(text);
        text = JSON.stringify(parsed, null, 2);
    } catch (e) {
        // Not valid JSON, just display as-is
    }
    
    // Escape HTML first
    let html = escapeHtml(text);
    
    // Syntax highlighting
    // Strings
    html = html.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="json-string">"$1"</span>');
    
    // Keys (before colon)
    html = html.replace(/<span class="json-string">"([^"]+)"<\/span>(\s*:)/g, 
        '<span class="json-key">"$1"</span>$2');
    
    // Numbers
    html = html.replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>');
    
    // Booleans
    html = html.replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>');
    
    // Null
    html = html.replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
    
    return html;
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Render attachments in task modal
 */
function renderTaskAttachments(task) {
    const container = document.getElementById('modal-attachments');
    if (!container) return;
    
    if (!task.attachments || task.attachments.length === 0) {
        container.innerHTML = '<p class="text-muted">No attachments</p>';
        return;
    }
    
    container.innerHTML = task.attachments.map(att => {
        // Support both path-based and url-based attachments
        const resolvedPath = att.path || att.url || '';
        const pathParts = resolvedPath.split('/');
        const filename = att.name || pathParts[pathParts.length - 1] || 'file';
        const dir = att.path ? pathParts.slice(0, -1).join('/') || 'reports' : 'reports';
        const downloadTarget = att.path || resolvedPath;
        
        return `
            <div class="attachment-item">
                <div class="attachment-icon" onclick="openFileViewer('${escapeHtml(dir)}', '${escapeHtml(filename)}')" style="cursor: pointer;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                </div>
                <div class="attachment-info" style="cursor: pointer; flex: 1;" onclick="${att.url ? `window.open('${escapeHtml(att.url)}', '_blank')` : `openFileViewer('${escapeHtml(dir)}', '${escapeHtml(filename)}')`}">
                    <div class="attachment-name">${escapeHtml(filename)}</div>
                    ${att.description ? `<div class="attachment-desc">${escapeHtml(att.description)}</div>` : ''}
                </div>
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); ${att.url ? `window.open('${escapeHtml(att.url)}', '_blank')` : `downloadAttachment('${escapeHtml(downloadTarget)}', '${escapeHtml(filename)}')`};" style="margin-left: auto;" title="Download">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

// ============================================
// REAL-TIME MESSAGE LISTENERS
// ============================================

/**
 * Setup WebSocket listeners for real-time message updates
 */
function setupMessageListeners() {
    if (!window.MissionControlAPI) return;

    window.MissionControlAPI.on('message.created', (data) => {
        // Add to local store
        if (window.missionControlData.messages) {
            window.missionControlData.messages.push(data);
        }

        // Update chat panel if open
        if (chatPanelOpen && (data.type === 'chat' || data.thread_id === 'chat-general')) {
            loadChatMessages();
        }

        // Update conversation thread if open
        if (currentThreadId && data.thread_id === currentThreadId) {
            let messages = [];
            if (window.missionControlData.getMessagesByThread) {
                messages = window.missionControlData.getMessagesByThread(currentThreadId);
            }
            renderThreadMessages(messages);
        }

        // Update profile badges if open
        if (currentProfileAgent) {
            loadConversations(currentProfileAgent.id);
        }

        // Show toast for new messages
        const sender = window.missionControlData.getAgent(data.from);
        const senderName = sender ? sender.name : data.from;
        showToast('info', `Message from ${senderName}`, data.content.substring(0, 80));
    });
    
    // Listen for task updates (including file watcher)
    window.MissionControlAPI.on('tasks.created', (data) => {
        console.log('[WebSocket] Task created:', data);
        if (data.data) {
            // Add to local store if not already present
            const exists = window.missionControlData.tasks.find(t => t.id === data.data.id);
            if (!exists) {
                window.missionControlData.tasks.push(data.data);
            }
        }
        // Refresh dashboard
        renderDashboard();
        initDragAndDrop();
        showToast('success', 'New Task', `Task "${data.data?.title || data.file}" was created`);
    });
    
    window.MissionControlAPI.on('tasks.updated', (data) => {
        console.log('[WebSocket] Task updated:', data);
        if (data.data) {
            const idx = window.missionControlData.tasks.findIndex(t => t.id === data.data.id);
            if (idx >= 0) {
                window.missionControlData.tasks[idx] = data.data;
            }
        }
        renderDashboard();
        initDragAndDrop();
    });
    
    window.MissionControlAPI.on('tasks.deleted', (data) => {
        console.log('[WebSocket] Task deleted:', data);
        if (data.data?.id) {
            window.missionControlData.tasks = window.missionControlData.tasks.filter(t => t.id !== data.data.id);
        }
        renderDashboard();
        initDragAndDrop();
    });
    
    // Listen for report changes
    window.MissionControlAPI.on('reports.changed', (data) => {
        console.log('[WebSocket] Report changed:', data);
        // Refresh reports list if we're on that tab
        if (currentFilesDir === 'reports') {
            loadFiles('reports');
        }
        showToast('info', 'Report Updated', `${data.file} was ${data.action}`);
    });
    
    // General data changed listener for any updates
    window.MissionControlAPI.on('data.changed', (data) => {
        console.log('[WebSocket] Data changed:', data.type);
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    init().then(() => {
        initDragAndDrop();
        // Check URL for task ID or agent ID after data is loaded
        checkUrlForTask();
    });
});

// ============================================
// RESOURCE MANAGEMENT
// ============================================

let resourcesData = {
    credentials: [],
    resources: [],
    bookings: [],
    costs: { total: 0, by_type: {}, by_agent: {}, items: [] },
    quotas: []
};

/**
 * Load resource management data
 */
async function loadResourcesData() {
    try {
        const [credentials, resources, bookings, costs, quotas] = await Promise.all([
            window.MissionControlAPI.getCredentials(),
            window.MissionControlAPI.getResources(),
            window.MissionControlAPI.getBookings(),
            window.MissionControlAPI.getCostSummary(),
            window.MissionControlAPI.getQuotas()
        ]);
        
        resourcesData = { credentials, resources, bookings, costs, quotas };
        updateResourceSummary();
        return resourcesData;
    } catch (error) {
        console.error('Error loading resources data:', error);
        return resourcesData;
    }
}

/**
 * Update resource summary in sidebar
 */
function updateResourceSummary() {
    document.getElementById('credentials-count').textContent = resourcesData.credentials.length;
    document.getElementById('resources-count').textContent = resourcesData.resources.length;
    document.getElementById('bookings-count').textContent = resourcesData.bookings.filter(b => b.status === 'confirmed').length;
    document.getElementById('total-costs').textContent = '$' + resourcesData.costs.total.toFixed(2);
    
    // Update quota warnings
    const warningQuotas = resourcesData.quotas.filter(q => 
        (q.current_usage / q.limit) >= q.warning_threshold
    );
    
    const quotaWarningsEl = document.getElementById('quota-warnings');
    const quotaWarningList = document.getElementById('quota-warning-list');
    
    if (warningQuotas.length > 0) {
        quotaWarningsEl.style.display = 'block';
        quotaWarningList.innerHTML = warningQuotas.map(q => {
            const percent = ((q.current_usage / q.limit) * 100).toFixed(0);
            return `<div class="quota-warning-item">${q.type}: ${percent}% used${q.agent_id ? ` (${q.agent_id})` : ''}</div>`;
        }).join('');
    } else {
        quotaWarningsEl.style.display = 'none';
    }
}

/**
 * Open resources modal
 */
async function openResourcesModal() {
    await loadResourcesData();
    renderCredentialsList();
    populateAgentSelects();
    document.getElementById('resources-modal').classList.add('active');
}

/**
 * Close resources modal
 */
function closeResourcesModal() {
    document.getElementById('resources-modal').classList.remove('active');
}

/**
 * Switch resource tab
 */
function switchResourceTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.resource-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab panes
    document.querySelectorAll('.resource-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `resource-tab-${tabName}`);
    });
    
    // Render content for the selected tab
    switch (tabName) {
        case 'credentials':
            renderCredentialsList();
            break;
        case 'resources':
            renderResourcesList();
            break;
        case 'bookings':
            renderBookingsList();
            break;
        case 'costs':
            renderCostsList();
            break;
        case 'quotas':
            renderQuotasList();
            break;
    }
}

/**
 * Populate agent select dropdowns
 */
function populateAgentSelects() {
    const agents = window.missionControlData?.agents || [];
    const selects = ['cred-owner', 'book-agent', 'cost-agent', 'quota-agent'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        // Keep first option (system/global)
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            option.textContent = agent.name;
            select.appendChild(option);
        });
    });
}

// --- CREDENTIALS ---

function renderCredentialsList() {
    const list = document.getElementById('credentials-list');
    if (!resourcesData.credentials.length) {
        list.innerHTML = '<p class="empty-state">No credentials stored yet. Add your first credential to get started.</p>';
        return;
    }
    
    list.innerHTML = resourcesData.credentials.map(cred => `
        <div class="credential-item">
            <div class="credential-icon">🔐</div>
            <div class="credential-info">
                <div class="credential-name">${escapeHtml(cred.name)}</div>
                <div class="credential-meta">
                    <span class="credential-type">${cred.type}</span>
                    <span>${cred.service || 'General'}</span>
                    <span>Owner: ${cred.owner}</span>
                    ${cred.last_used ? `<span>Last used: ${formatRelativeTime(cred.last_used)}</span>` : ''}
                </div>
            </div>
            <div class="credential-actions">
                <button class="btn-delete" onclick="deleteCredential('${cred.id}')" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function openAddCredentialForm() {
    document.getElementById('add-credential-modal').classList.add('active');
}

function closeAddCredentialForm() {
    document.getElementById('add-credential-modal').classList.remove('active');
    document.getElementById('add-credential-form').reset();
}

async function saveCredential() {
    const credential = {
        name: document.getElementById('cred-name').value,
        type: document.getElementById('cred-type').value,
        service: document.getElementById('cred-service').value,
        value: document.getElementById('cred-value').value,
        description: document.getElementById('cred-description').value,
        owner: document.getElementById('cred-owner').value || 'system'
    };
    
    try {
        await window.MissionControlAPI.createCredential(credential);
        showToast('success', 'Credential Created', 'Your credential has been securely stored.');
        closeAddCredentialForm();
        await loadResourcesData();
        renderCredentialsList();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

async function deleteCredential(id) {
    if (!confirm('Are you sure you want to delete this credential? This cannot be undone.')) return;
    
    try {
        await window.MissionControlAPI.deleteCredential(id);
        showToast('success', 'Credential Deleted', 'The credential has been removed.');
        await loadResourcesData();
        renderCredentialsList();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

// --- RESOURCES ---

function renderResourcesList() {
    const list = document.getElementById('resources-list');
    if (!resourcesData.resources.length) {
        list.innerHTML = '<p class="empty-state">No resources registered yet. Add servers, GPUs, or other shared resources.</p>';
        return;
    }
    
    const icons = { server: '🖥️', gpu: '⚡', service: '☁️', license: '📄', other: '📦' };
    
    list.innerHTML = resourcesData.resources.map(res => `
        <div class="resource-item">
            <div class="resource-icon">${icons[res.type] || '📦'}</div>
            <div class="resource-info">
                <div class="resource-name">${escapeHtml(res.name)}</div>
                <div class="resource-meta">
                    <span class="resource-type">${res.type}</span>
                    <span>$${res.cost_per_hour}/hr</span>
                    <span>Max ${res.max_booking_hours}h</span>
                    ${res.tags?.length ? `<span>${res.tags.join(', ')}</span>` : ''}
                </div>
            </div>
            <div class="resource-actions">
                <button class="btn btn-sm btn-secondary" onclick="quickBookResource('${res.id}')">Book</button>
            </div>
        </div>
    `).join('');
}

function openAddResourceForm() {
    document.getElementById('add-resource-modal').classList.add('active');
}

function closeAddResourceForm() {
    document.getElementById('add-resource-modal').classList.remove('active');
    document.getElementById('add-resource-form').reset();
}

async function saveResource() {
    const resource = {
        name: document.getElementById('res-name').value,
        type: document.getElementById('res-type').value,
        description: document.getElementById('res-description').value,
        cost_per_hour: parseFloat(document.getElementById('res-cost').value) || 0,
        max_booking_hours: parseInt(document.getElementById('res-max-hours').value) || 24,
        tags: document.getElementById('res-tags').value.split(',').map(t => t.trim()).filter(Boolean)
    };
    
    try {
        await window.MissionControlAPI.createResource(resource);
        showToast('success', 'Resource Created', `${resource.name} has been added.`);
        closeAddResourceForm();
        await loadResourcesData();
        renderResourcesList();
        populateResourceSelect();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

function quickBookResource(resourceId) {
    openAddBookingForm();
    document.getElementById('book-resource').value = resourceId;
}

// --- BOOKINGS ---

function renderBookingsList() {
    const list = document.getElementById('bookings-list');
    if (!resourcesData.bookings.length) {
        list.innerHTML = '<p class="empty-state">No bookings yet. Book a resource to reserve it for a specific time.</p>';
        return;
    }
    
    list.innerHTML = resourcesData.bookings.map(booking => {
        const start = new Date(booking.start_time);
        const end = new Date(booking.end_time);
        const statusClass = booking.status === 'confirmed' ? 'confirmed' : 
                           booking.status === 'cancelled' ? 'cancelled' : 'completed';
        
        return `
            <div class="booking-item">
                <div class="booking-icon">📅</div>
                <div class="booking-info">
                    <div class="booking-title">${escapeHtml(booking.resource_name)}</div>
                    <div class="booking-meta">
                        <span class="booking-status ${statusClass}">${booking.status}</span>
                        ${booking.agent_id ? `<span>Agent: ${booking.agent_id}</span>` : ''}
                        <span>Est. $${booking.estimated_cost?.toFixed(2) || '0.00'}</span>
                    </div>
                </div>
                <div class="booking-time">
                    <span class="booking-time-label">Start</span>
                    <span>${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div class="booking-time">
                    <span class="booking-time-label">End</span>
                    <span>${end.toLocaleDateString()} ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                ${booking.status === 'confirmed' ? `
                    <div class="booking-actions">
                        <button class="btn-delete" onclick="cancelBooking('${booking.id}')" title="Cancel">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function openAddBookingForm() {
    populateResourceSelect();
    
    // Set default times
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    document.getElementById('book-start').value = formatDateTimeLocal(now);
    document.getElementById('book-end').value = formatDateTimeLocal(later);
    
    document.getElementById('add-booking-modal').classList.add('active');
}

function closeAddBookingForm() {
    document.getElementById('add-booking-modal').classList.remove('active');
    document.getElementById('add-booking-form').reset();
}

function populateResourceSelect() {
    const select = document.getElementById('book-resource');
    select.innerHTML = '<option value="">Select a resource...</option>';
    
    resourcesData.resources.forEach(res => {
        const option = document.createElement('option');
        option.value = res.id;
        option.textContent = `${res.name} (${res.type}) - $${res.cost_per_hour}/hr`;
        select.appendChild(option);
    });
}

function formatDateTimeLocal(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function saveBooking() {
    const booking = {
        resource_id: document.getElementById('book-resource').value,
        agent_id: document.getElementById('book-agent').value || null,
        booked_by: 'dashboard',
        start_time: new Date(document.getElementById('book-start').value).toISOString(),
        end_time: new Date(document.getElementById('book-end').value).toISOString(),
        purpose: document.getElementById('book-purpose').value
    };
    
    if (!booking.resource_id) {
        showToast('error', 'Error', 'Please select a resource to book.');
        return;
    }
    
    try {
        await window.MissionControlAPI.createBooking(booking);
        showToast('success', 'Resource Booked', 'Your booking has been confirmed.');
        closeAddBookingForm();
        await loadResourcesData();
        renderBookingsList();
    } catch (error) {
        showToast('error', 'Booking Failed', error.message);
    }
}

async function cancelBooking(id) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
        await window.MissionControlAPI.cancelBooking(id);
        showToast('success', 'Booking Cancelled', 'The booking has been cancelled.');
        await loadResourcesData();
        renderBookingsList();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

// --- COSTS ---

function renderCostsList() {
    const costs = resourcesData.costs;
    
    // Render cost overview
    const overviewEl = document.getElementById('cost-overview');
    overviewEl.innerHTML = `
        <div class="cost-stat">
            <div class="cost-stat-value">$${costs.total.toFixed(2)}</div>
            <div class="cost-stat-label">Total Costs</div>
        </div>
        ${Object.entries(costs.by_type).map(([type, amount]) => `
            <div class="cost-stat">
                <div class="cost-stat-value">$${amount.toFixed(2)}</div>
                <div class="cost-stat-label">${type.replace('_', ' ')}</div>
            </div>
        `).join('')}
    `;
    
    // Render cost items
    const list = document.getElementById('costs-list');
    if (!costs.items.length) {
        list.innerHTML = '<p class="empty-state">No costs recorded yet. Track API usage, hosting, and other expenses.</p>';
        return;
    }
    
    list.innerHTML = costs.items.slice().reverse().slice(0, 20).map(cost => `
        <div class="cost-item">
            <div class="cost-info">
                <div class="credential-name">${escapeHtml(cost.description)}</div>
                <div class="credential-meta">
                    <span class="cost-type-badge">${cost.type}</span>
                    <span>${cost.category || 'General'}</span>
                    ${cost.agent_id ? `<span>Agent: ${cost.agent_id}</span>` : ''}
                    <span>${formatRelativeTime(cost.recorded_at)}</span>
                </div>
            </div>
            <div class="cost-amount">$${cost.amount.toFixed(2)}</div>
        </div>
    `).join('');
}

function openAddCostForm() {
    document.getElementById('add-cost-modal').classList.add('active');
}

function closeAddCostForm() {
    document.getElementById('add-cost-modal').classList.remove('active');
    document.getElementById('add-cost-form').reset();
}

async function saveCost() {
    const cost = {
        type: document.getElementById('cost-type').value,
        description: document.getElementById('cost-description').value,
        amount: parseFloat(document.getElementById('cost-amount').value) || 0,
        agent_id: document.getElementById('cost-agent').value || null,
        category: document.getElementById('cost-category').value || 'general'
    };
    
    try {
        await window.MissionControlAPI.recordCost(cost);
        showToast('success', 'Cost Recorded', `$${cost.amount.toFixed(2)} added to ${cost.type}.`);
        closeAddCostForm();
        await loadResourcesData();
        renderCostsList();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

// --- QUOTAS ---

function renderQuotasList() {
    const list = document.getElementById('quotas-list');
    if (!resourcesData.quotas.length) {
        list.innerHTML = '<p class="empty-state">No quotas set. Set usage limits to control costs and API usage.</p>';
        return;
    }
    
    list.innerHTML = resourcesData.quotas.map(quota => {
        const usagePercent = (quota.current_usage / quota.limit) * 100;
        const statusClass = usagePercent >= 100 ? 'exceeded' : usagePercent >= quota.warning_threshold * 100 ? 'warning' : '';
        
        return `
            <div class="quota-item">
                <div class="quota-header">
                    <span class="quota-type">${formatQuotaType(quota.type)}</span>
                    <span class="quota-agent">${quota.agent_id || 'Global'}</span>
                </div>
                <div class="quota-progress">
                    <div class="quota-progress-bar">
                        <div class="quota-progress-fill ${statusClass}" style="width: ${Math.min(usagePercent, 100)}%"></div>
                    </div>
                </div>
                <div class="quota-stats">
                    <span class="quota-usage ${statusClass}">${quota.current_usage} / ${quota.limit} (${usagePercent.toFixed(1)}%)</span>
                    <span>${quota.period} • ${quota.hard_stop ? 'Hard stop' : 'Warning only'}</span>
                </div>
            </div>
        `;
    }).join('');
}

function formatQuotaType(type) {
    const types = {
        'api_calls': '📊 API Calls',
        'cost': '💰 Cost',
        'tokens': '🔤 Tokens',
        'storage': '💾 Storage'
    };
    return types[type] || type;
}

function openAddQuotaForm() {
    document.getElementById('add-quota-modal').classList.add('active');
}

function closeAddQuotaForm() {
    document.getElementById('add-quota-modal').classList.remove('active');
    document.getElementById('add-quota-form').reset();
}

async function saveQuota() {
    const quota = {
        type: document.getElementById('quota-type').value,
        agent_id: document.getElementById('quota-agent').value || null,
        limit: parseInt(document.getElementById('quota-limit').value),
        period: document.getElementById('quota-period').value,
        warning_threshold: parseFloat(document.getElementById('quota-warning').value) / 100,
        hard_stop: document.getElementById('quota-hard-stop').checked
    };
    
    try {
        await window.MissionControlAPI.setQuota(quota);
        showToast('success', 'Quota Set', `${formatQuotaType(quota.type)} limit: ${quota.limit}`);
        closeAddQuotaForm();
        await loadResourcesData();
        renderQuotasList();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

// --- Initialize on page load ---
document.addEventListener('DOMContentLoaded', () => {
    // Load resources data initially
    loadResourcesData();
    
    // Listen for resource updates via WebSocket
    if (window.MissionControlAPI) {
        window.MissionControlAPI.on('credential.created', () => loadResourcesData());
        window.MissionControlAPI.on('credential.deleted', () => loadResourcesData());
        window.MissionControlAPI.on('resource.created', () => loadResourcesData());
        window.MissionControlAPI.on('booking.created', () => loadResourcesData());
        window.MissionControlAPI.on('booking.cancelled', () => loadResourcesData());
        window.MissionControlAPI.on('cost.recorded', () => loadResourcesData());
        window.MissionControlAPI.on('quota.updated', () => loadResourcesData());
        window.MissionControlAPI.on('quota.warning', (data) => {
            showToast('info', 'Quota Warning', data.warning);
        });
        window.MissionControlAPI.on('quota.exceeded', (data) => {
            showToast('error', 'Quota Exceeded', `${data.quota.type} quota exceeded!`);
        });
    }
});

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}

// ============================================
// MOBILE NAVIGATION & RESPONSIVE FUNCTIONS
// ============================================

/**
 * Toggle the mobile left sidebar (agents list)
 */
function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger-menu');
    const rightSidebar = document.querySelector('.sidebar-right');
    
    // Close right sidebar if open
    if (rightSidebar && rightSidebar.classList.contains('mobile-open')) {
        rightSidebar.classList.remove('mobile-open');
    }
    
    if (sidebar) {
        const isOpen = sidebar.classList.toggle('mobile-open');
        if (hamburger) hamburger.classList.toggle('active', isOpen);
        if (overlay) overlay.classList.toggle('active', isOpen);
        
        // Prevent body scroll when sidebar is open
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }
}

/**
 * Toggle the mobile right sidebar (reports, resources, settings)
 */
function toggleMobileRightSidebar() {
    const rightSidebar = document.querySelector('.sidebar-right');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    const hamburger = document.getElementById('hamburger-menu');
    
    // Close left sidebar if open
    if (sidebar && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        if (hamburger) hamburger.classList.remove('active');
    }
    
    if (rightSidebar) {
        const isOpen = rightSidebar.classList.toggle('mobile-open');
        if (overlay) overlay.classList.toggle('active', isOpen);
        
        // Prevent body scroll when sidebar is open
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }
}

/**
 * Close all mobile sidebars
 */
function closeMobileSidebars() {
    const sidebar = document.querySelector('.sidebar');
    const rightSidebar = document.querySelector('.sidebar-right');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger-menu');
    
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (rightSidebar) rightSidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
    if (hamburger) hamburger.classList.remove('active');
    
    // Restore body scroll
    document.body.style.overflow = '';
}

/**
 * Handle mobile bottom nav view switching
 */
function showMobileView(view) {
    // Update active state on nav items
    const navItems = document.querySelectorAll('.mobile-nav-item');
    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    
    // Close any open sidebars
    closeMobileSidebars();
    
    // Scroll kanban to beginning when board is selected
    if (view === 'board') {
        const kanbanBoard = document.getElementById('kanban-board');
        if (kanbanBoard) {
            kanbanBoard.scrollTo({ left: 0, behavior: 'smooth' });
        }
    }
}

/**
 * Handle window resize to clean up mobile states
 */
function handleResize() {
    const width = window.innerWidth;
    
    // Clean up mobile states when resizing to desktop
    if (width > 768) {
        closeMobileSidebars();
    }
}

// Listen for resize events
window.addEventListener('resize', handleResize);

// Handle escape key to close sidebars
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeMobileSidebars();
    }
});

// Handle swipe gestures for sidebar (basic implementation)
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipeGesture();
}, { passive: true });

function handleSwipeGesture() {
    const swipeThreshold = 100;
    const swipeDistance = touchEndX - touchStartX;
    
    // Swipe right to open left sidebar (only from edge)
    if (swipeDistance > swipeThreshold && touchStartX < 30) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !sidebar.classList.contains('mobile-open')) {
            toggleMobileSidebar();
        }
    }
    
    // Swipe left to close left sidebar
    if (swipeDistance < -swipeThreshold) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            closeMobileSidebars();
        }
    }
    
    // Swipe left from right edge to open right sidebar
    if (swipeDistance < -swipeThreshold && touchStartX > window.innerWidth - 30) {
        const rightSidebar = document.querySelector('.sidebar-right');
        if (rightSidebar && !rightSidebar.classList.contains('mobile-open')) {
            toggleMobileRightSidebar();
        }
    }
    
    // Swipe right to close right sidebar
    if (swipeDistance > swipeThreshold) {
        const rightSidebar = document.querySelector('.sidebar-right');
        if (rightSidebar && rightSidebar.classList.contains('mobile-open')) {
            closeMobileSidebars();
        }
    }
}
