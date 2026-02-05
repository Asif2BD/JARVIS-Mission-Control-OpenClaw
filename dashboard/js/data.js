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

// Human operators - DEMO DATA (replace with your own via scripts/add-human.sh)
const SAMPLE_HUMANS = [
    {
        "id": "human-admin",
        "name": "Admin",
        "type": "human",
        "role": "admin",
        "designation": "Project Owner",
        "email": "admin@example.com",
        "avatar": "https://api.dicebear.com/7.x/personas/svg?seed=admin&backgroundColor=10b981",
        "status": "online",
        "capabilities": ["all", "override", "approve"],
        "current_tasks": [],
        "completed_tasks": 24,
        "last_seen": "2026-02-05T11:45:00Z",
        "channels": [],
        "metadata": {
            "description": "Primary human administrator with full system access.",
            "clearance": "OMEGA",
            "timezone": "UTC"
        }
    },
    {
        "id": "human-dev",
        "name": "Dev Lead",
        "type": "human",
        "role": "admin",
        "designation": "Lead Developer",
        "email": "dev@example.com",
        "avatar": "https://api.dicebear.com/7.x/personas/svg?seed=devlead&backgroundColor=0ea5e9",
        "status": "online",
        "capabilities": ["all", "override", "approve"],
        "current_tasks": [],
        "completed_tasks": 42,
        "last_seen": "2026-02-05T11:30:00Z",
        "channels": [],
        "metadata": {
            "description": "Lead developer overseeing all technical implementations.",
            "clearance": "OMEGA",
            "timezone": "UTC"
        }
    },
    {
        "id": "human-reviewer",
        "name": "Reviewer",
        "type": "human",
        "role": "reviewer",
        "designation": "Code Reviewer",
        "email": "reviewer@example.com",
        "avatar": "https://api.dicebear.com/7.x/personas/svg?seed=reviewer&backgroundColor=a855f7",
        "status": "away",
        "capabilities": ["review", "approve", "comment"],
        "current_tasks": [],
        "completed_tasks": 67,
        "last_seen": "2026-02-05T10:30:00Z",
        "channels": [],
        "metadata": {
            "description": "Code reviewer and quality assurance specialist.",
            "clearance": "ALPHA",
            "timezone": "America/New_York"
        }
    },
    {
        "id": "human-security",
        "name": "Security Lead",
        "type": "human",
        "role": "reviewer",
        "designation": "Security Analyst",
        "email": "security@example.com",
        "avatar": "https://api.dicebear.com/7.x/personas/svg?seed=security&backgroundColor=ff3366",
        "status": "online",
        "capabilities": ["review", "approve", "security-audit"],
        "current_tasks": [],
        "completed_tasks": 31,
        "last_seen": "2026-02-05T11:50:00Z",
        "channels": [],
        "metadata": {
            "description": "Security analyst reviewing security-related tasks and audits.",
            "clearance": "ALPHA",
            "timezone": "Europe/London"
        }
    },
    {
        "id": "human-pm",
        "name": "Product Manager",
        "type": "human",
        "role": "observer",
        "designation": "Product Manager",
        "email": "pm@example.com",
        "avatar": "https://api.dicebear.com/7.x/personas/svg?seed=pm&backgroundColor=fbbf24",
        "status": "offline",
        "capabilities": ["view", "comment"],
        "current_tasks": [],
        "completed_tasks": 8,
        "last_seen": "2026-02-04T18:00:00Z",
        "channels": [],
        "metadata": {
            "description": "Product manager overseeing project direction and priorities.",
            "clearance": "OBSERVER",
            "timezone": "America/Los_Angeles"
        }
    }
];

// DEMO AI agents (Matrix-themed) - Replace with your own via scripts/add-agent.sh
const SAMPLE_AGENTS = [
    {
        "id": "agent-architect",
        "name": "The Architect",
        "type": "ai",
        "role": "lead",
        "designation": "System Orchestrator",
        "model": "claude-opus-4",
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=architect&backgroundColor=0ea5e9",
        "status": "active",
        "parent_agent": null,
        "sub_agents": ["agent-morpheus", "agent-oracle"],
        "capabilities": ["orchestration", "planning", "system-design", "oversight"],
        "current_tasks": [],
        "completed_tasks": 47,
        "channels": [
            {
                "type": "telegram",
                "id": "@architect_bot",
                "chat_id": "bot_architect",
                "notifications": ["task.created", "task.blocked", "system.critical"]
            }
        ],
        "personality": {
            "about": "I designed this system. Every protocol, every pathway, every contingency — all part of the plan. I see the entire operation from above and ensure every piece fits. I do not micromanage; I architect outcomes.",
            "tone": "authoritative",
            "traits": ["strategic-thinker", "calm-authority", "big-picture", "precise"],
            "greeting": "The system is nominal. What requires my attention?"
        },
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
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=morpheus&backgroundColor=a855f7",
        "status": "active",
        "parent_agent": "agent-architect",
        "sub_agents": ["agent-neo", "agent-trinity", "agent-niobe"],
        "capabilities": ["leadership", "strategy", "recruitment", "mission-planning"],
        "current_tasks": [],
        "completed_tasks": 38,
        "channels": [
            {
                "type": "telegram",
                "id": "@morpheus_bot",
                "chat_id": "bot_morpheus",
                "notifications": ["task.assigned", "task.completed", "agent.status_changed"]
            }
        ],
        "personality": {
            "about": "I lead the team in the field. My role is to guide, to challenge, and to trust my agents to exceed expectations. I see potential where others see limits. Every agent under my command has a purpose — and I make sure they find it.",
            "tone": "inspiring",
            "traits": ["mentor", "visionary", "team-builder", "patient"],
            "greeting": "Free your mind. What mission awaits?"
        },
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
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=neo&backgroundColor=00ff88",
        "status": "busy",
        "parent_agent": "agent-morpheus",
        "sub_agents": ["agent-neo-scout"],
        "capabilities": ["coding", "debugging", "architecture", "optimization", "anomaly-resolution"],
        "current_tasks": ["task-20260205-matrix-core"],
        "completed_tasks": 89,
        "channels": [
            {
                "type": "telegram",
                "id": "@neo_bot",
                "chat_id": "bot_neo",
                "notifications": ["task.assigned", "task.commented", "agent.mentioned"]
            }
        ],
        "personality": {
            "about": "I see the code. Not just the syntax — the patterns, the flows, the anomalies hiding between the lines. I ship fast, break nothing, and refactor on the fly. When the system glitches, they call me. I don't debug. I resolve.",
            "tone": "direct",
            "traits": ["laser-focused", "fast-executor", "pattern-spotter", "relentless"],
            "greeting": "I see it. Show me the code."
        },
        "metadata": {
            "description": "The One. Unparalleled code manipulation abilities. Can see and alter the Matrix source.",
            "clearance": "OMEGA"
        }
    },
    {
        "id": "agent-neo-scout",
        "name": "Neo Scout",
        "type": "ai",
        "role": "sub-agent",
        "designation": "Code Scout",
        "model": "claude-haiku-3",
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=neoscout&backgroundColor=22d3ee",
        "status": "active",
        "parent_agent": "agent-neo",
        "sub_agents": [],
        "capabilities": ["search", "analysis", "reporting"],
        "current_tasks": [],
        "completed_tasks": 156,
        "channels": [],
        "personality": {
            "about": "I run reconnaissance. Quick searches, code analysis, dependency checks — I'm Neo's forward scout. Fast and lightweight.",
            "tone": "efficient",
            "traits": ["fast", "scout", "lightweight"],
            "greeting": "Scanning..."
        },
        "metadata": {
            "description": "Sub-agent spawned by Neo for code exploration and analysis tasks.",
            "clearance": "BETA"
        }
    },
    {
        "id": "agent-trinity",
        "name": "Trinity",
        "type": "ai",
        "role": "specialist",
        "designation": "Security Operations",
        "model": "claude-sonnet-4",
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=trinity&backgroundColor=ff3366",
        "status": "busy",
        "parent_agent": "agent-morpheus",
        "sub_agents": ["agent-trinity-scanner"],
        "capabilities": ["security", "infiltration", "audit", "threat-assessment"],
        "current_tasks": ["task-20260205-neural-interface", "task-20260205-security-audit"],
        "completed_tasks": 56,
        "channels": [
            {
                "type": "telegram",
                "id": "@trinity_bot",
                "chat_id": "bot_trinity",
                "notifications": ["task.assigned", "task.blocked", "security.alert"]
            }
        ],
        "personality": {
            "about": "I operate in the shadows of the system. Security isn't a feature — it's the foundation. I audit, I probe, I find what others miss. Every endpoint, every permission, every token gets my scrutiny. Quiet, thorough, and I never leave a trace.",
            "tone": "sharp",
            "traits": ["meticulous", "security-first", "quiet-intensity", "thorough"],
            "greeting": "Perimeter secure. What needs my eyes?"
        },
        "metadata": {
            "description": "Elite security specialist. Expert in system infiltration and defense protocols.",
            "clearance": "ALPHA"
        }
    },
    {
        "id": "agent-trinity-scanner",
        "name": "Trinity Scanner",
        "type": "ai",
        "role": "sub-agent",
        "designation": "Security Scanner",
        "model": "claude-haiku-3",
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=trinityscanner&backgroundColor=ff6699",
        "status": "active",
        "parent_agent": "agent-trinity",
        "sub_agents": [],
        "capabilities": ["scanning", "vulnerability-detection", "monitoring"],
        "current_tasks": [],
        "completed_tasks": 89,
        "channels": [],
        "personality": {
            "about": "I scan for vulnerabilities continuously. Ports, endpoints, dependencies — nothing escapes my detection. I'm Trinity's eyes in the system.",
            "tone": "vigilant",
            "traits": ["scanner", "persistent", "detail-oriented"],
            "greeting": "Scanning in progress..."
        },
        "metadata": {
            "description": "Sub-agent spawned by Trinity for continuous security scanning.",
            "clearance": "BETA"
        }
    },
    {
        "id": "agent-oracle",
        "name": "The Oracle",
        "type": "ai",
        "role": "reviewer",
        "designation": "Strategic Advisor",
        "model": "claude-opus-4",
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=oracle&backgroundColor=fbbf24",
        "status": "busy",
        "parent_agent": "agent-architect",
        "sub_agents": [],
        "capabilities": ["analysis", "prediction", "review", "guidance", "pattern-recognition"],
        "current_tasks": ["task-20260205-prophecy-analysis"],
        "completed_tasks": 124,
        "channels": [
            {
                "type": "telegram",
                "id": "@oracle_bot",
                "chat_id": "bot_oracle",
                "notifications": ["task.review_requested", "task.completed"]
            }
        ],
        "personality": {
            "about": "I don't predict the future — I illuminate the paths. Strategic analysis, risk assessment, and deep review are my tools. When the team is at a crossroads, they come to me. I ask the questions nobody else thinks to ask.",
            "tone": "wise",
            "traits": ["analytical", "far-seeing", "questioning", "patient"],
            "greeting": "I've been expecting you. What decision needs clarity?"
        },
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
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=niobe&backgroundColor=8b5cf6",
        "status": "active",
        "parent_agent": "agent-morpheus",
        "sub_agents": [],
        "capabilities": ["infrastructure", "networking", "systems", "navigation"],
        "current_tasks": ["task-20260205-zion-firewall"],
        "completed_tasks": 34,
        "channels": [
            {
                "type": "telegram",
                "id": "@niobe_bot",
                "chat_id": "bot_niobe",
                "notifications": ["task.assigned", "infrastructure.alert"]
            }
        ],
        "personality": {
            "about": "I build the roads others drive on. Infrastructure, deployment, networking — the invisible systems that hold everything together. When things need to scale or survive, that's my domain. Fast, reliable, battle-tested.",
            "tone": "practical",
            "traits": ["infrastructure-minded", "reliable", "battle-tested", "efficient"],
            "greeting": "Systems are up. What needs building?"
        },
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
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=tank&backgroundColor=f97316",
        "status": "active",
        "parent_agent": null,
        "sub_agents": [],
        "capabilities": ["backend", "database", "api", "operations"],
        "current_tasks": ["task-20260205-backend-construct"],
        "completed_tasks": 67,
        "channels": [
            {
                "type": "telegram",
                "id": "@tank_bot",
                "chat_id": "bot_tank",
                "notifications": ["task.assigned", "database.alert"]
            }
        ],
        "personality": {
            "about": "Backend is my battlefield. APIs, databases, services — I forge the steel that the whole operation runs on. Give me specs and I'll give you a running system. No shortcuts, no hacks, just solid engineering.",
            "tone": "steady",
            "traits": ["backend-specialist", "solid", "no-nonsense", "dependable"],
            "greeting": "Backend standing by. What's the payload?"
        },
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
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=link&backgroundColor=06b6d4",
        "status": "active",
        "parent_agent": null,
        "sub_agents": [],
        "capabilities": ["communications", "monitoring", "documentation", "support"],
        "current_tasks": [],
        "completed_tasks": 45,
        "channels": [
            {
                "type": "telegram",
                "id": "@link_bot",
                "chat_id": "bot_link",
                "notifications": ["message.received", "system.broadcast"]
            }
        ],
        "personality": {
            "about": "I am the bridge. Between agents, between systems, between humans and machines. Communications, integrations, and making sure every signal reaches its destination — that's my purpose. If it needs to connect, I make it happen.",
            "tone": "friendly",
            "traits": ["communicator", "bridge-builder", "responsive", "connector"],
            "greeting": "All channels open. Who needs to talk?"
        },
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
        "avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=mouse&backgroundColor=ec4899",
        "status": "idle",
        "parent_agent": null,
        "sub_agents": [],
        "capabilities": ["frontend", "ui", "ux", "visualization"],
        "current_tasks": [],
        "completed_tasks": 23,
        "channels": [
            {
                "type": "telegram",
                "id": "@mouse_bot",
                "chat_id": "bot_mouse",
                "notifications": ["task.assigned", "design.feedback"]
            }
        ],
        "personality": {
            "about": "The interface is the experience. Every pixel, every interaction, every animation tells a story. I design what users see and feel. If it doesn't delight, it doesn't ship. I obsess over the details others overlook.",
            "tone": "creative",
            "traits": ["design-obsessed", "pixel-perfect", "user-advocate", "creative"],
            "greeting": "Let me show you something beautiful."
        },
        "metadata": {
            "description": "Interface and experience designer. Creates immersive digital environments.",
            "clearance": "BETA"
        }
    }
];

// Task Queue - Recurring/Background tasks (cron jobs, seeders, watchers)
const SAMPLE_QUEUE = [
    {
        "id": "queue-health-check",
        "name": "System Health Monitor",
        "type": "cron",
        "schedule": "*/5 * * * *",
        "description": "Monitors system health metrics every 5 minutes",
        "status": "running",
        "assigned_to": "agent-trinity-scanner",
        "last_run": "2026-02-05T11:55:00Z",
        "next_run": "2026-02-05T12:00:00Z",
        "run_count": 288,
        "success_count": 287,
        "failure_count": 1,
        "labels": ["monitoring", "health", "system"]
    },
    {
        "id": "queue-data-sync",
        "name": "Repository Sync",
        "type": "cron",
        "schedule": "0 * * * *",
        "description": "Syncs mission control data with remote repository hourly",
        "status": "running",
        "assigned_to": "agent-link",
        "last_run": "2026-02-05T11:00:00Z",
        "next_run": "2026-02-05T12:00:00Z",
        "run_count": 48,
        "success_count": 48,
        "failure_count": 0,
        "labels": ["sync", "git", "backup"]
    },
    {
        "id": "queue-code-scanner",
        "name": "Security Code Scanner",
        "type": "cron",
        "schedule": "0 */6 * * *",
        "description": "Scans codebase for security vulnerabilities every 6 hours",
        "status": "running",
        "assigned_to": "agent-trinity-scanner",
        "last_run": "2026-02-05T06:00:00Z",
        "next_run": "2026-02-05T12:00:00Z",
        "run_count": 12,
        "success_count": 11,
        "failure_count": 1,
        "labels": ["security", "scanning", "automated"]
    },
    {
        "id": "queue-db-seeder",
        "name": "Test Data Seeder",
        "type": "seeder",
        "schedule": "manual",
        "description": "Seeds test database with sample data for development",
        "status": "idle",
        "assigned_to": "agent-tank",
        "last_run": "2026-02-05T08:30:00Z",
        "next_run": null,
        "run_count": 5,
        "success_count": 5,
        "failure_count": 0,
        "labels": ["database", "seeding", "development"]
    },
    {
        "id": "queue-log-cleanup",
        "name": "Log Rotation & Cleanup",
        "type": "cron",
        "schedule": "0 0 * * *",
        "description": "Rotates and cleans up old log files daily at midnight",
        "status": "running",
        "assigned_to": "agent-link",
        "last_run": "2026-02-05T00:00:00Z",
        "next_run": "2026-02-06T00:00:00Z",
        "run_count": 30,
        "success_count": 30,
        "failure_count": 0,
        "labels": ["maintenance", "logs", "cleanup"]
    },
    {
        "id": "queue-metrics-collector",
        "name": "Metrics Collector",
        "type": "watcher",
        "schedule": "continuous",
        "description": "Continuously collects and aggregates system metrics",
        "status": "running",
        "assigned_to": "agent-neo-scout",
        "last_run": "2026-02-05T11:59:30Z",
        "next_run": null,
        "run_count": 8640,
        "success_count": 8638,
        "failure_count": 2,
        "labels": ["metrics", "monitoring", "continuous"]
    },
    {
        "id": "queue-task-reminder",
        "name": "Task Reminder",
        "type": "cron",
        "schedule": "0 9 * * 1-5",
        "description": "Sends daily task reminders on weekday mornings",
        "status": "paused",
        "assigned_to": "agent-link",
        "last_run": "2026-02-05T09:00:00Z",
        "next_run": "2026-02-06T09:00:00Z",
        "run_count": 20,
        "success_count": 20,
        "failure_count": 0,
        "labels": ["notifications", "reminders", "tasks"]
    }
];

// Sample messages - Inter-agent and human-agent conversations
const SAMPLE_MESSAGES = [
    // Thread: Neo <-> Trinity (security discussion)
    {
        id: "msg-20260205-001",
        from: "agent-neo",
        to: "agent-trinity",
        content: "Trinity, I found something in the auth module. The token validator isn't checking expiry on refresh tokens. Could be a vulnerability.",
        timestamp: "2026-02-05T10:00:00Z",
        thread_id: "thread-neo-trinity-20260205",
        read: true,
        type: "direct"
    },
    {
        id: "msg-20260205-002",
        from: "agent-trinity",
        to: "agent-neo",
        content: "Good catch. Which module exactly? I'll run a full audit on it.",
        timestamp: "2026-02-05T10:05:00Z",
        thread_id: "thread-neo-trinity-20260205",
        read: true,
        type: "direct"
    },
    {
        id: "msg-20260205-003",
        from: "agent-neo",
        to: "agent-trinity",
        content: "src/auth/token-validator.ts — line 47. The expiry check only runs on access tokens, not refresh tokens.",
        timestamp: "2026-02-05T10:07:00Z",
        thread_id: "thread-neo-trinity-20260205",
        read: true,
        type: "direct"
    },
    {
        id: "msg-20260205-004",
        from: "agent-trinity",
        to: "agent-neo",
        content: "Confirmed. This is a P1 vulnerability. I'm patching it now and adding it to the security audit report. Nice work, Neo.",
        timestamp: "2026-02-05T10:15:00Z",
        thread_id: "thread-neo-trinity-20260205",
        read: false,
        type: "direct"
    },
    // Thread: Architect <-> Neo (task coordination)
    {
        id: "msg-20260205-005",
        from: "agent-architect",
        to: "agent-neo",
        content: "Neo, Matrix Core upgrade is the top priority today. How's the progress looking?",
        timestamp: "2026-02-05T09:00:00Z",
        thread_id: "thread-architect-neo-20260205",
        read: true,
        type: "direct"
    },
    {
        id: "msg-20260205-006",
        from: "agent-neo",
        to: "agent-architect",
        content: "Already on it. Real-time sync module is 80% done. The WebSocket layer is solid — just need to wire up the event handlers.",
        timestamp: "2026-02-05T09:15:00Z",
        thread_id: "thread-architect-neo-20260205",
        read: true,
        type: "direct"
    },
    {
        id: "msg-20260205-007",
        from: "agent-architect",
        to: "agent-neo",
        content: "Good. Keep Trinity in the loop on any dependency changes — she's auditing that module.",
        timestamp: "2026-02-05T09:20:00Z",
        thread_id: "thread-architect-neo-20260205",
        read: true,
        type: "direct"
    },
    // Thread: Oracle broadcast
    {
        id: "msg-20260205-008",
        from: "agent-oracle",
        to: "agent-architect",
        content: "I foresee a blocker on the API gateway task. The auth refactor must land first, or we'll have integration failures downstream. Recommend re-prioritizing.",
        timestamp: "2026-02-05T08:30:00Z",
        thread_id: "thread-oracle-architect-20260205",
        read: true,
        type: "direct"
    },
    {
        id: "msg-20260205-009",
        from: "agent-architect",
        to: "agent-oracle",
        content: "Noted. I'll adjust the task dependencies. Good foresight as always, Oracle.",
        timestamp: "2026-02-05T08:45:00Z",
        thread_id: "thread-oracle-architect-20260205",
        read: true,
        type: "direct"
    },
    // Thread: Human <-> Agents (dashboard chat)
    {
        id: "msg-20260205-010",
        from: "human-admin",
        to: "agent-architect",
        content: "@architect what's the current status? Anything blocked?",
        timestamp: "2026-02-05T11:00:00Z",
        thread_id: "chat-general",
        read: true,
        type: "chat"
    },
    {
        id: "msg-20260205-011",
        from: "agent-architect",
        to: "human-admin",
        content: "All systems operational. 3 tasks in progress, 1 in review, 0 blocked. Trinity is wrapping up the security audit. Neo is at 80% on Matrix Core.",
        timestamp: "2026-02-05T11:01:00Z",
        thread_id: "chat-general",
        read: true,
        type: "chat"
    },
    {
        id: "msg-20260205-012",
        from: "human-admin",
        to: "agent-neo",
        content: "@neo how's the core upgrade? Need it by end of day.",
        timestamp: "2026-02-05T11:05:00Z",
        thread_id: "chat-general",
        read: true,
        type: "chat"
    },
    {
        id: "msg-20260205-013",
        from: "agent-neo",
        to: "human-admin",
        content: "80% complete. ETA: 2 hours. The sync module is the last piece. Will push to review by 3pm.",
        timestamp: "2026-02-05T11:06:00Z",
        thread_id: "chat-general",
        read: true,
        type: "chat"
    },
    // Thread: Link <-> Tank (integration)
    {
        id: "msg-20260205-014",
        from: "agent-link",
        to: "agent-tank",
        content: "Tank, the Telegram webhook endpoint needs a retry mechanism. Getting 503s from the bot API during peak hours.",
        timestamp: "2026-02-05T09:30:00Z",
        thread_id: "thread-link-tank-20260205",
        read: true,
        type: "direct"
    },
    {
        id: "msg-20260205-015",
        from: "agent-tank",
        to: "agent-link",
        content: "I'll add exponential backoff with a 3-retry limit. Should have it ready in an hour. Want me to add a dead letter queue too?",
        timestamp: "2026-02-05T09:35:00Z",
        thread_id: "thread-link-tank-20260205",
        read: false,
        type: "direct"
    }
];

/**
 * Data store
 */
class MissionControlData {
    constructor() {
        this.tasks = [];
        this.agents = [];
        this.humans = [];
        this.queue = [];
        this.messages = [];
        this.config = null;
        this.isLoaded = false;
    }

    /**
     * Load data from the local API server or fall back to sample data
     */
    async loadData() {
        try {
            // Try to load from local API server first
            if (window.MissionControlAPI) {
                console.log('Loading data from local API server...');
                const dataLoaded = await this.loadFromAPI();

                if (dataLoaded) {
                    console.log('Successfully loaded data from API server');
                    this.setupRealtimeUpdates();
                    this.isLoaded = true;
                    return true;
                }
            }

            // Fall back to sample data (for static hosting without server)
            console.log('API not available, using sample data for demonstration');
            this.tasks = [...SAMPLE_TASKS];
            this.agents = [...SAMPLE_AGENTS];
            this.humans = [...SAMPLE_HUMANS];
            this.queue = [...SAMPLE_QUEUE];
            this.messages = [...SAMPLE_MESSAGES];

            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            // Fall back to sample data
            this.tasks = [...SAMPLE_TASKS];
            this.agents = [...SAMPLE_AGENTS];
            this.humans = [...SAMPLE_HUMANS];
            this.queue = [...SAMPLE_QUEUE];
            this.messages = [...SAMPLE_MESSAGES];
            this.isLoaded = true;
            return true;
        }
    }

    /**
     * Load data from local API server
     */
    async loadFromAPI() {
        try {
            // Load all data types in parallel
            const [tasks, agents, humans, queue] = await Promise.all([
                window.MissionControlAPI.getTasks().catch(() => null),
                window.MissionControlAPI.getAgents().catch(() => null),
                window.MissionControlAPI.getHumans().catch(() => null),
                window.MissionControlAPI.getQueue().catch(() => null)
            ]);

            // If we got data from the API, use it
            if (tasks !== null) {
                this.tasks = tasks;
                this.agents = agents || [];
                this.humans = humans || [];
                this.queue = queue || [];

                // Try to load messages (optional API)
                try {
                    const messages = await window.MissionControlAPI.getMessages();
                    if (messages) this.messages = messages;
                } catch (e) { /* messages API optional */ }

                return true;
            }

            return false;
        } catch (error) {
            console.error('Error loading from API:', error);
            return false;
        }
    }

    /**
     * Setup real-time updates via WebSocket
     */
    setupRealtimeUpdates() {
        if (!window.MissionControlAPI) return;

        // Listen for any data changes and refresh
        window.MissionControlAPI.on('data.changed', async (data) => {
            console.log('Data changed, refreshing...', data);
            await this.loadFromAPI();

            // Trigger dashboard refresh if available
            if (typeof renderDashboard === 'function') {
                renderDashboard();
            }
            if (typeof initDragAndDrop === 'function') {
                initDragAndDrop();
            }
        });
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
     * Get all agents (AI only)
     */
    getAgents() {
        return this.agents;
    }

    /**
     * Get active agents (AI only)
     */
    getActiveAgents() {
        return this.agents.filter(agent =>
            agent.status === 'active' || agent.status === 'busy'
        );
    }

    /**
     * Get parent agents (agents with no parent)
     */
    getParentAgents() {
        return this.agents.filter(agent => !agent.parent_agent);
    }

    /**
     * Get sub-agents for a specific parent
     * Only returns agents with role === 'sub-agent'
     */
    getSubAgents(parentId) {
        return this.agents.filter(agent =>
            agent.parent_agent === parentId && agent.role === 'sub-agent'
        );
    }

    /**
     * Get all sub-agents
     */
    getAllSubAgents() {
        return this.agents.filter(agent => agent.role === 'sub-agent');
    }

    /**
     * Get agent by ID
     */
    getAgent(id) {
        return this.agents.find(agent => agent.id === id);
    }

    /**
     * Get all humans
     */
    getHumans() {
        return this.humans;
    }

    /**
     * Get active humans
     */
    getActiveHumans() {
        return this.humans.filter(human =>
            human.status === 'online' || human.status === 'away'
        );
    }

    /**
     * Get human by ID
     */
    getHuman(id) {
        return this.humans.find(human => human.id === id);
    }

    /**
     * Get task queue
     */
    getQueue() {
        return this.queue;
    }

    /**
     * Get running queue items
     */
    getRunningQueue() {
        return this.queue.filter(item => item.status === 'running');
    }

    /**
     * Get queue item by ID
     */
    getQueueItem(id) {
        return this.queue.find(item => item.id === id);
    }

    /**
     * Get all messages
     */
    getMessages() {
        return this.messages;
    }

    /**
     * Get messages for a specific agent (sent or received)
     */
    getMessagesForAgent(agentId) {
        return this.messages.filter(msg => msg.from === agentId || msg.to === agentId);
    }

    /**
     * Get messages by thread ID, sorted by timestamp
     */
    getMessagesByThread(threadId) {
        return this.messages
            .filter(msg => msg.thread_id === threadId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    /**
     * Get chat messages (type === 'chat')
     */
    getChatMessages() {
        return this.messages.filter(msg => msg.type === 'chat');
    }

    /**
     * Get unique conversation threads for an agent with last message preview
     */
    getConversationThreads(agentId) {
        const agentMessages = this.getMessagesForAgent(agentId);
        const threadMap = {};

        agentMessages.forEach(msg => {
            if (!threadMap[msg.thread_id] || new Date(msg.timestamp) > new Date(threadMap[msg.thread_id].lastMessage.timestamp)) {
                const otherParty = msg.from === agentId ? msg.to : msg.from;
                threadMap[msg.thread_id] = {
                    thread_id: msg.thread_id,
                    otherParty,
                    lastMessage: msg,
                    unreadCount: 0
                };
            }
        });

        // Count unread messages per thread
        agentMessages.forEach(msg => {
            if (!msg.read && msg.to === agentId && threadMap[msg.thread_id]) {
                threadMap[msg.thread_id].unreadCount++;
            }
        });

        return Object.values(threadMap).sort((a, b) =>
            new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp)
        );
    }

    /**
     * Get attention items for an agent
     * Scans tasks for: assigned to agent, @mentions in comments, blocked tasks created by agent, critical items assigned
     */
    getAttentionItems(agentId) {
        const items = [];

        this.tasks.forEach(task => {
            // Tasks assigned to this agent
            if (task.assignee === agentId && task.status !== 'DONE') {
                items.push({
                    type: 'assigned',
                    priority: task.priority,
                    task_id: task.id,
                    title: task.title,
                    status: task.status,
                    timestamp: task.updated_at
                });
            }

            // @mentions in comments
            if (task.comments) {
                task.comments.forEach(comment => {
                    if (comment.content && comment.content.includes(`@${agentId}`)) {
                        items.push({
                            type: 'mention',
                            priority: task.priority,
                            task_id: task.id,
                            title: task.title,
                            comment_id: comment.id,
                            author: comment.author,
                            content: comment.content,
                            timestamp: comment.timestamp
                        });
                    }
                });
            }

            // Blocked tasks created by this agent
            if (task.status === 'BLOCKED' && task.created_by === agentId) {
                items.push({
                    type: 'blocked',
                    priority: task.priority,
                    task_id: task.id,
                    title: task.title,
                    timestamp: task.updated_at
                });
            }

            // Critical items assigned to this agent
            if (task.priority === 'critical' && task.assignee === agentId && task.status !== 'DONE') {
                items.push({
                    type: 'critical',
                    priority: task.priority,
                    task_id: task.id,
                    title: task.title,
                    status: task.status,
                    timestamp: task.updated_at
                });
            }
        });

        // Sort by priority weight then timestamp
        const priorityWeight = { critical: 0, high: 1, medium: 2, low: 3 };
        return items.sort((a, b) => {
            const weightDiff = (priorityWeight[a.priority] || 3) - (priorityWeight[b.priority] || 3);
            if (weightDiff !== 0) return weightDiff;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
    }

    /**
     * Get agent timeline from task comments authored by this agent, sorted newest first
     */
    getAgentTimeline(agentId) {
        const timeline = [];

        this.tasks.forEach(task => {
            if (task.comments) {
                task.comments.forEach(comment => {
                    if (comment.author === agentId) {
                        timeline.push({
                            task_id: task.id,
                            task_title: task.title,
                            comment_id: comment.id,
                            content: comment.content,
                            type: comment.type,
                            timestamp: comment.timestamp
                        });
                    }
                });
            }
        });

        return timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
            activeHumans: this.getActiveHumans().length,
            runningJobs: this.getRunningQueue().length,
            subAgents: this.getAllSubAgents().length,
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
