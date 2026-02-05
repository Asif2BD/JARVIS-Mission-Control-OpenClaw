/**
 * JARVIS Mission Control - Main Application
 * Enhanced with theme switching and improved UI
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

    // Load data
    await window.missionControlData.loadData();

    // Render the dashboard
    renderDashboard();

    // Show instructions on first visit
    if (!localStorage.getItem('mc-instructions-seen')) {
        showInstructions();
    }

    console.log('Dashboard initialized');
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
    renderAgents();
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
 * Render the agents sidebar
 */
function renderAgents() {
    const agents = window.missionControlData.getActiveAgents();
    const container = document.getElementById('agents-list');
    const subtitle = document.getElementById('agents-subtitle');

    // Update subtitle
    const activeCount = agents.filter(a => a.status === 'active').length;
    subtitle.textContent = `${activeCount} agent${activeCount !== 1 ? 's' : ''} online`;

    container.innerHTML = agents.map(agent => `
        <div class="agent-card">
            <div class="agent-header">
                <div class="agent-avatar ${agent.role}">${getInitials(agent.name)}</div>
                <div class="agent-info">
                    <div class="agent-name">${escapeHtml(agent.name)}</div>
                    <div class="agent-role">${agent.role}</div>
                </div>
                <div class="agent-status-indicator ${agent.status}"></div>
            </div>
            <div class="agent-meta">
                <span class="agent-tasks-count">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    ${agent.current_tasks ? agent.current_tasks.length : 0} active task${agent.current_tasks && agent.current_tasks.length !== 1 ? 's' : ''}
                </span>
            </div>
        </div>
    `).join('');
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
function createTask() {
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const priority = document.getElementById('task-priority').value;
    const assignee = document.getElementById('task-assignee').value || null;
    const labelsStr = document.getElementById('task-labels').value.trim();

    if (!title || !description) {
        alert('Please fill in all required fields');
        return;
    }

    const labels = labelsStr ?
        labelsStr.split(',').map(l => l.trim()).filter(l => l) :
        [];

    // Create the task
    const newTask = window.missionControlData.addTask({
        title,
        description,
        priority,
        assignee,
        labels,
        created_by: 'human-user'
    });

    console.log('Created task:', newTask);

    // Close modal and refresh
    closeCreateTaskModal();
    renderDashboard();

    // Show task JSON for copying (in a real app, this would commit to Git)
    showTaskJson(newTask);
}

/**
 * Show task JSON for manual Git commit
 */
function showTaskJson(task) {
    const json = JSON.stringify(task, null, 2);
    const filename = `${task.id}.json`;

    alert(`Task created! In a real setup, save this to:\n.mission-control/tasks/${filename}\n\nTask JSON has been logged to console.`);
    console.log(`Save to .mission-control/tasks/${filename}:`);
    console.log(json);
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

function handleDrop(e) {
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
        console.log('Updated task JSON:', JSON.stringify(draggedTask, null, 2));

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
function assignTask(taskId, assigneeId) {
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
    renderDashboard();
    initDragAndDrop();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    init().then(() => {
        initDragAndDrop();
    });
});
