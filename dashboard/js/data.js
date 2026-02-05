/**
 * JARVIS Mission Control - Data Layer
 *
 * This module handles loading and managing data from the .mission-control directory.
 * In a real deployment, this would fetch from the Git repository or local filesystem.
 */

// Sample data for demonstration
// In production, this would be loaded from .mission-control/tasks/*.json
const SAMPLE_TASKS = [
    {
        "id": "task-20260205-setup-project",
        "title": "Initialize Mission Control Project",
        "description": "Set up the initial project structure, documentation, and configuration for JARVIS Mission Control.",
        "status": "IN_PROGRESS",
        "priority": "high",
        "assignee": "agent-jarvis",
        "created_by": "human-admin",
        "created_at": "2026-02-05T00:00:00Z",
        "updated_at": "2026-02-05T08:00:00Z",
        "labels": ["infrastructure", "setup", "documentation"],
        "comments": [
            {
                "id": "comment-001",
                "author": "human-admin",
                "content": "Creating the foundational structure for Mission Control.",
                "timestamp": "2026-02-05T00:00:00Z",
                "type": "progress"
            },
            {
                "id": "comment-002",
                "author": "agent-jarvis",
                "content": "Claimed this task. Beginning work on project structure.",
                "timestamp": "2026-02-05T08:00:00Z",
                "type": "progress"
            }
        ]
    },
    {
        "id": "task-20260205-example-feature",
        "title": "Example: Implement Real-time Sync",
        "description": "This is an example task demonstrating the task format.",
        "status": "INBOX",
        "priority": "medium",
        "assignee": null,
        "created_by": "agent-jarvis",
        "created_at": "2026-02-05T08:30:00Z",
        "updated_at": "2026-02-05T08:30:00Z",
        "labels": ["feature", "frontend", "example"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-jarvis",
                "content": "This is an example task to demonstrate the task format.",
                "timestamp": "2026-02-05T08:30:00Z",
                "type": "progress"
            }
        ]
    },
    {
        "id": "task-20260205-api-design",
        "title": "Design REST API Endpoints",
        "description": "Design and document the REST API endpoints for Mission Control integration.",
        "status": "ASSIGNED",
        "priority": "high",
        "assignee": "agent-backend-specialist",
        "created_by": "agent-jarvis",
        "created_at": "2026-02-05T09:00:00Z",
        "updated_at": "2026-02-05T09:30:00Z",
        "labels": ["backend", "api", "design"],
        "comments": []
    },
    {
        "id": "task-20260205-security-audit",
        "title": "Security Audit",
        "description": "Perform a security audit of the Mission Control system.",
        "status": "REVIEW",
        "priority": "critical",
        "assignee": "agent-security",
        "created_by": "human-admin",
        "created_at": "2026-02-04T00:00:00Z",
        "updated_at": "2026-02-05T10:00:00Z",
        "labels": ["security", "audit"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-security",
                "content": "Completed initial security review. Ready for approval.",
                "timestamp": "2026-02-05T10:00:00Z",
                "type": "review"
            }
        ]
    },
    {
        "id": "task-20260204-docs",
        "title": "Write Getting Started Guide",
        "description": "Create comprehensive getting started documentation.",
        "status": "DONE",
        "priority": "medium",
        "assignee": "agent-docs",
        "created_by": "agent-jarvis",
        "created_at": "2026-02-04T00:00:00Z",
        "updated_at": "2026-02-04T18:00:00Z",
        "labels": ["documentation"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-docs",
                "content": "Documentation complete.",
                "timestamp": "2026-02-04T18:00:00Z",
                "type": "approval"
            }
        ]
    }
];

// Sample agents for demonstration
const SAMPLE_AGENTS = [
    {
        "id": "agent-jarvis",
        "name": "JARVIS",
        "type": "ai",
        "role": "lead",
        "model": "claude-3-opus",
        "status": "active",
        "capabilities": ["orchestration", "planning", "code-review"],
        "current_tasks": ["task-20260205-setup-project"],
        "completed_tasks": 12
    },
    {
        "id": "agent-backend-specialist",
        "name": "Backend Specialist",
        "type": "ai",
        "role": "specialist",
        "model": "claude-3-sonnet",
        "status": "busy",
        "capabilities": ["backend", "database", "api"],
        "current_tasks": ["task-20260205-api-design"],
        "completed_tasks": 8
    },
    {
        "id": "agent-security",
        "name": "Security Agent",
        "type": "ai",
        "role": "reviewer",
        "model": "claude-3-opus",
        "status": "active",
        "capabilities": ["security", "audit", "review"],
        "current_tasks": ["task-20260205-security-audit"],
        "completed_tasks": 5
    },
    {
        "id": "human-admin",
        "name": "Admin",
        "type": "human",
        "role": "lead",
        "status": "active",
        "capabilities": ["all"],
        "current_tasks": [],
        "completed_tasks": 25
    }
];

/**
 * Data store
 */
class MissionControlData {
    constructor() {
        this.tasks = [];
        this.agents = [];
        this.config = null;
        this.isLoaded = false;
    }

    /**
     * Load data from the repository
     * In production, this would fetch from actual files
     */
    async loadData() {
        try {
            // Try to load from actual files first
            const dataLoaded = await this.loadFromFiles();

            if (!dataLoaded) {
                // Fall back to sample data
                console.log('Using sample data for demonstration');
                this.tasks = SAMPLE_TASKS;
                this.agents = SAMPLE_AGENTS;
            }

            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            // Fall back to sample data
            this.tasks = SAMPLE_TASKS;
            this.agents = SAMPLE_AGENTS;
            this.isLoaded = true;
            return true;
        }
    }

    /**
     * Attempt to load data from actual files
     */
    async loadFromFiles() {
        try {
            // This would work in a local server environment
            // For GitHub Pages, you'd use the GitHub API

            // Try loading tasks
            const tasksResponse = await fetch('../.mission-control/tasks/');
            if (!tasksResponse.ok) {
                return false;
            }

            // Parse directory listing (this is server-dependent)
            // For now, return false to use sample data
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get all tasks
     */
    getTasks() {
        return this.tasks;
    }

    /**
     * Get tasks by status
     */
    getTasksByStatus(status) {
        return this.tasks.filter(task => task.status === status);
    }

    /**
     * Get a single task by ID
     */
    getTask(id) {
        return this.tasks.find(task => task.id === id);
    }

    /**
     * Get all agents
     */
    getAgents() {
        return this.agents;
    }

    /**
     * Get active agents
     */
    getActiveAgents() {
        return this.agents.filter(agent =>
            agent.status === 'active' || agent.status === 'busy'
        );
    }

    /**
     * Get agent by ID
     */
    getAgent(id) {
        return this.agents.find(agent => agent.id === id);
    }

    /**
     * Get metrics
     */
    getMetrics() {
        const tasksByStatus = {};
        const statuses = ['INBOX', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'];

        statuses.forEach(status => {
            tasksByStatus[status] = this.getTasksByStatus(status).length;
        });

        return {
            totalTasks: this.tasks.length,
            tasksByStatus,
            activeAgents: this.getActiveAgents().length,
            completedToday: this.getCompletedToday()
        };
    }

    /**
     * Get tasks completed today
     */
    getCompletedToday() {
        const today = new Date().toISOString().split('T')[0];
        return this.tasks.filter(task =>
            task.status === 'DONE' &&
            task.updated_at.startsWith(today)
        ).length;
    }

    /**
     * Add a new task (client-side only for demo)
     */
    addTask(task) {
        const id = `task-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Date.now()}`;
        const newTask = {
            id,
            ...task,
            status: 'INBOX',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            comments: [],
            deliverables: [],
            dependencies: [],
            blocked_by: []
        };
        this.tasks.unshift(newTask);
        return newTask;
    }
}

// Global data instance
window.missionControlData = new MissionControlData();
