/**
 * JARVIS Mission Control - Main Application
 */

// State
let selectedTask = null;

/**
 * Initialize the dashboard
 */
async function init() {
    console.log('Initializing JARVIS Mission Control...');

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
    const assigneeName = assignee ? assignee.name : 'Unassigned';

    card.innerHTML = `
        <div class="task-card-header">
            <span class="task-title">${escapeHtml(task.title)}</span>
        </div>
        <div class="task-id">${task.id}</div>
        ${task.assignee ? `
            <div class="task-assignee">${escapeHtml(assigneeName)}</div>
        ` : ''}
        ${task.labels && task.labels.length > 0 ? `
            <div class="task-labels">
                ${task.labels.map(label => `
                    <span class="label">${escapeHtml(label)}</span>
                `).join('')}
            </div>
        ` : ''}
    `;

    return card;
}

/**
 * Render the agents panel
 */
function renderAgents() {
    const agents = window.missionControlData.getActiveAgents();
    const container = document.getElementById('agents-list');

    container.innerHTML = agents.map(agent => `
        <div class="agent-card">
            <div class="agent-header">
                <div class="agent-avatar">${getInitials(agent.name)}</div>
                <div class="agent-info">
                    <div class="agent-name">${escapeHtml(agent.name)}</div>
                    <div class="agent-role">${capitalizeFirst(agent.role)}</div>
                </div>
                <div class="agent-status ${agent.status}"></div>
            </div>
            <div class="agent-tasks">
                ${agent.current_tasks.length} active task(s)
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
    labelsContainer.innerHTML = task.labels ?
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
