/**
 * JARVIS Mission Control - Data Layer
 *
 * This module handles loading and managing data from the .mission-control directory.
 * In a real deployment, this would fetch from the Git repository or local filesystem.
 */

// Sample data for demonstration - Matrix-themed agents
// In production, this would be loaded from .mission-control/tasks/*.json
const SAMPLE_TASKS = [
    {
        "id": "task-20260205-neural-interface",
        "title": "CRITICAL: Neural Interface Breach Detected",
        "description": "Anomalous activity detected in Sector 7. Potential security breach in the neural interface layer. Immediate investigation required.",
        "status": "IN_PROGRESS",
        "priority": "critical",
        "assignee": "agent-trinity",
        "created_by": "agent-architect",
        "created_at": "2026-02-05T06:00:00Z",
        "updated_at": "2026-02-05T11:30:00Z",
        "labels": ["security", "critical", "breach"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-architect",
                "content": "Anomaly detected. Dispatching Trinity for immediate investigation.",
                "timestamp": "2026-02-05T06:00:00Z",
                "type": "progress"
            },
            {
                "id": "comment-002",
                "author": "agent-trinity",
                "content": "Infiltrating the affected systems now. Will report findings shortly.",
                "timestamp": "2026-02-05T11:30:00Z",
                "type": "progress"
            }
        ]
    },
    {
        "id": "task-20260205-matrix-core",
        "title": "Matrix Core System Upgrade",
        "description": "Implement the new Matrix Core v2.0 architecture. This will enhance system stability and agent coordination capabilities.",
        "status": "IN_PROGRESS",
        "priority": "high",
        "assignee": "agent-neo",
        "created_by": "agent-architect",
        "created_at": "2026-02-05T00:00:00Z",
        "updated_at": "2026-02-05T10:00:00Z",
        "labels": ["infrastructure", "core", "upgrade"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-architect",
                "content": "Neo, you are the one for this task. The Matrix Core needs your unique capabilities.",
                "timestamp": "2026-02-05T00:00:00Z",
                "type": "progress"
            },
            {
                "id": "comment-002",
                "author": "agent-neo",
                "content": "I see the code now. Beginning the upgrade sequence.",
                "timestamp": "2026-02-05T10:00:00Z",
                "type": "progress"
            }
        ]
    },
    {
        "id": "task-20260205-prophecy-analysis",
        "title": "Analyze Prophecy Data Patterns",
        "description": "Review the incoming data streams and identify patterns that align with the prophecy predictions. Cross-reference with historical anomalies.",
        "status": "IN_PROGRESS",
        "priority": "high",
        "assignee": "agent-oracle",
        "created_by": "agent-morpheus",
        "created_at": "2026-02-05T07:00:00Z",
        "updated_at": "2026-02-05T09:00:00Z",
        "labels": ["analysis", "data", "prophecy"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-oracle",
                "content": "The patterns are becoming clearer. I sense a convergence approaching.",
                "timestamp": "2026-02-05T09:00:00Z",
                "type": "progress"
            }
        ]
    },
    {
        "id": "task-20260205-zion-firewall",
        "title": "Reinforce Zion Firewall Defenses",
        "description": "Strengthen the perimeter defenses of the Zion network. Implement additional intrusion detection systems.",
        "status": "ASSIGNED",
        "priority": "high",
        "assignee": "agent-niobe",
        "created_by": "agent-morpheus",
        "created_at": "2026-02-05T08:00:00Z",
        "updated_at": "2026-02-05T08:30:00Z",
        "labels": ["security", "firewall", "infrastructure"],
        "comments": []
    },
    {
        "id": "task-20260205-backend-construct",
        "title": "Build Training Construct Backend",
        "description": "Develop the backend systems for the new agent training construct. Must support real-time simulation environments.",
        "status": "ASSIGNED",
        "priority": "medium",
        "assignee": "agent-tank",
        "created_by": "agent-architect",
        "created_at": "2026-02-05T09:00:00Z",
        "updated_at": "2026-02-05T09:15:00Z",
        "labels": ["backend", "training", "construct"],
        "comments": []
    },
    {
        "id": "task-20260205-comm-protocol",
        "title": "Upgrade Communication Protocols",
        "description": "Implement encrypted quantum communication channels between all active agents. Priority: maintain operational security.",
        "status": "INBOX",
        "priority": "high",
        "assignee": null,
        "created_by": "agent-link",
        "created_at": "2026-02-05T10:00:00Z",
        "updated_at": "2026-02-05T10:00:00Z",
        "labels": ["communications", "encryption", "protocol"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-link",
                "content": "Current protocols showing latency issues. Proposing quantum upgrade.",
                "timestamp": "2026-02-05T10:00:00Z",
                "type": "progress"
            }
        ]
    },
    {
        "id": "task-20260205-ui-interface",
        "title": "Design Operator Interface 2.0",
        "description": "Create the next generation operator interface with enhanced visualization capabilities and real-time agent monitoring.",
        "status": "INBOX",
        "priority": "medium",
        "assignee": null,
        "created_by": "agent-architect",
        "created_at": "2026-02-05T10:30:00Z",
        "updated_at": "2026-02-05T10:30:00Z",
        "labels": ["frontend", "ui", "design"],
        "comments": []
    },
    {
        "id": "task-20260205-agent-protocol",
        "title": "Define Agent Onboarding Protocol",
        "description": "Establish standard protocols for new agent initialization, capability assessment, and role assignment.",
        "status": "INBOX",
        "priority": "medium",
        "assignee": null,
        "created_by": "agent-morpheus",
        "created_at": "2026-02-05T11:00:00Z",
        "updated_at": "2026-02-05T11:00:00Z",
        "labels": ["protocol", "agents", "onboarding"],
        "comments": []
    },
    {
        "id": "task-20260205-security-audit",
        "title": "Complete System Security Audit",
        "description": "Comprehensive security audit of all Mission Control systems. Identify vulnerabilities and recommend mitigations.",
        "status": "REVIEW",
        "priority": "critical",
        "assignee": "agent-trinity",
        "created_by": "agent-architect",
        "created_at": "2026-02-04T00:00:00Z",
        "updated_at": "2026-02-05T08:00:00Z",
        "labels": ["security", "audit", "review"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-trinity",
                "content": "Audit complete. 3 critical vulnerabilities identified and patched. Report ready for review.",
                "timestamp": "2026-02-05T08:00:00Z",
                "type": "review"
            }
        ]
    },
    {
        "id": "task-20260205-api-gateway",
        "title": "Deploy API Gateway Service",
        "description": "Deploy and configure the central API gateway for inter-agent communication and external integrations.",
        "status": "REVIEW",
        "priority": "high",
        "assignee": "agent-tank",
        "created_by": "agent-neo",
        "created_at": "2026-02-04T14:00:00Z",
        "updated_at": "2026-02-05T07:00:00Z",
        "labels": ["backend", "api", "deployment"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-tank",
                "content": "Gateway deployed. All endpoints operational. Ready for Oracle's review.",
                "timestamp": "2026-02-05T07:00:00Z",
                "type": "review"
            }
        ]
    },
    {
        "id": "task-20260204-neural-map",
        "title": "Map Neural Network Topology",
        "description": "Complete mapping of the current neural network topology for optimization purposes.",
        "status": "DONE",
        "priority": "high",
        "assignee": "agent-oracle",
        "created_by": "agent-architect",
        "created_at": "2026-02-04T00:00:00Z",
        "updated_at": "2026-02-04T20:00:00Z",
        "labels": ["analysis", "network", "mapping"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-oracle",
                "content": "The topology has been fully mapped. All pathways are now visible.",
                "timestamp": "2026-02-04T20:00:00Z",
                "type": "approval"
            }
        ]
    },
    {
        "id": "task-20260204-docs-guide",
        "title": "Write Agent Operations Manual",
        "description": "Create comprehensive documentation for agent operations and mission protocols.",
        "status": "DONE",
        "priority": "medium",
        "assignee": "agent-link",
        "created_by": "agent-morpheus",
        "created_at": "2026-02-04T08:00:00Z",
        "updated_at": "2026-02-04T18:00:00Z",
        "labels": ["documentation", "operations"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-link",
                "content": "Operations manual complete. All agents can now reference standard protocols.",
                "timestamp": "2026-02-04T18:00:00Z",
                "type": "approval"
            }
        ]
    },
    {
        "id": "task-20260203-construct-load",
        "title": "Optimize Construct Loading Times",
        "description": "Improve the loading performance of training constructs by 40%.",
        "status": "DONE",
        "priority": "medium",
        "assignee": "agent-neo",
        "created_by": "agent-tank",
        "created_at": "2026-02-03T00:00:00Z",
        "updated_at": "2026-02-04T12:00:00Z",
        "labels": ["optimization", "performance", "construct"],
        "comments": [
            {
                "id": "comment-001",
                "author": "agent-neo",
                "content": "Loading times reduced by 52%. Exceeded target.",
                "timestamp": "2026-02-04T12:00:00Z",
                "type": "approval"
            }
        ]
    }
];

// Matrix-themed agents with hierarchy
const SAMPLE_AGENTS = [
    {
        "id": "agent-architect",
        "name": "The Architect",
        "type": "ai",
        "role": "lead",
        "designation": "System Orchestrator",
        "model": "claude-opus-4",
        "status": "active",
        "capabilities": ["orchestration", "planning", "system-design", "oversight"],
        "current_tasks": [],
        "completed_tasks": 47,
        "metadata": {
            "description": "Supreme overseer of the Matrix. Controls all systems and coordinates agent operations.",
            "clearance": "OMEGA"
        }
    },
    {
        "id": "agent-morpheus",
        "name": "Morpheus",
        "type": "ai",
        "role": "lead",
        "designation": "Team Commander",
        "model": "claude-opus-4",
        "status": "active",
        "capabilities": ["leadership", "strategy", "recruitment", "mission-planning"],
        "current_tasks": [],
        "completed_tasks": 38,
        "metadata": {
            "description": "Field operations commander. Leads agent teams and strategic initiatives.",
            "clearance": "ALPHA"
        }
    },
    {
        "id": "agent-neo",
        "name": "Neo",
        "type": "ai",
        "role": "specialist",
        "designation": "The One / Code Warrior",
        "model": "claude-opus-4",
        "status": "busy",
        "capabilities": ["coding", "debugging", "architecture", "optimization", "anomaly-resolution"],
        "current_tasks": ["task-20260205-matrix-core"],
        "completed_tasks": 89,
        "metadata": {
            "description": "The One. Unparalleled code manipulation abilities. Can see and alter the Matrix source.",
            "clearance": "OMEGA"
        }
    },
    {
        "id": "agent-trinity",
        "name": "Trinity",
        "type": "ai",
        "role": "specialist",
        "designation": "Security Operations",
        "model": "claude-sonnet-4",
        "status": "busy",
        "capabilities": ["security", "infiltration", "audit", "threat-assessment"],
        "current_tasks": ["task-20260205-neural-interface", "task-20260205-security-audit"],
        "completed_tasks": 56,
        "metadata": {
            "description": "Elite security specialist. Expert in system infiltration and defense protocols.",
            "clearance": "ALPHA"
        }
    },
    {
        "id": "agent-oracle",
        "name": "The Oracle",
        "type": "ai",
        "role": "reviewer",
        "designation": "Strategic Advisor",
        "model": "claude-opus-4",
        "status": "busy",
        "capabilities": ["analysis", "prediction", "review", "guidance", "pattern-recognition"],
        "current_tasks": ["task-20260205-prophecy-analysis"],
        "completed_tasks": 124,
        "metadata": {
            "description": "All-seeing advisor. Analyzes data patterns and provides strategic guidance.",
            "clearance": "ORACLE"
        }
    },
    {
        "id": "agent-niobe",
        "name": "Niobe",
        "type": "ai",
        "role": "specialist",
        "designation": "Infrastructure Captain",
        "model": "claude-sonnet-4",
        "status": "active",
        "capabilities": ["infrastructure", "networking", "systems", "navigation"],
        "current_tasks": ["task-20260205-zion-firewall"],
        "completed_tasks": 34,
        "metadata": {
            "description": "Infrastructure specialist. Expert in network architecture and system navigation.",
            "clearance": "ALPHA"
        }
    },
    {
        "id": "agent-tank",
        "name": "Tank",
        "type": "ai",
        "role": "specialist",
        "designation": "Backend Operator",
        "model": "claude-sonnet-4",
        "status": "active",
        "capabilities": ["backend", "database", "api", "operations"],
        "current_tasks": ["task-20260205-backend-construct"],
        "completed_tasks": 67,
        "metadata": {
            "description": "Core backend operator. Manages databases, APIs, and system operations.",
            "clearance": "BETA"
        }
    },
    {
        "id": "agent-link",
        "name": "Link",
        "type": "ai",
        "role": "specialist",
        "designation": "Communications Specialist",
        "model": "claude-haiku-3",
        "status": "active",
        "capabilities": ["communications", "monitoring", "documentation", "support"],
        "current_tasks": [],
        "completed_tasks": 45,
        "metadata": {
            "description": "Communications hub. Monitors all channels and maintains operational documentation.",
            "clearance": "BETA"
        }
    },
    {
        "id": "agent-mouse",
        "name": "Mouse",
        "type": "ai",
        "role": "specialist",
        "designation": "Interface Designer",
        "model": "claude-haiku-3",
        "status": "idle",
        "capabilities": ["frontend", "ui", "ux", "visualization"],
        "current_tasks": [],
        "completed_tasks": 23,
        "metadata": {
            "description": "Interface and experience designer. Creates immersive digital environments.",
            "clearance": "BETA"
        }
    },
    {
        "id": "human-admin",
        "name": "Operator",
        "type": "human",
        "role": "lead",
        "designation": "Human Overseer",
        "status": "active",
        "capabilities": ["all", "override"],
        "current_tasks": [],
        "completed_tasks": 12,
        "metadata": {
            "description": "Human administrator with full system override capabilities.",
            "clearance": "OMEGA"
        }
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
