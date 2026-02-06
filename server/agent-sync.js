#!/usr/bin/env node
/**
 * Agent Auto-Sync Module for Mission Control
 * 
 * Automatically discovers agents from OpenClaw and creates/updates
 * Mission Control agent JSON files.
 * 
 * Configuration (environment variables):
 * - OPENCLAW_CONFIG_PATH: Path to openclaw.json (default: auto-detect)
 * - OPENCLAW_AGENTS_DIR: Path to OpenClaw agents directory (default: auto-detect)
 * - MISSION_CONTROL_DIR: Path to .mission-control directory
 * - AGENT_SYNC_INTERVAL: Sync interval in ms (default: 30000)
 * 
 * The module auto-detects OpenClaw installation by checking:
 * 1. OPENCLAW_CONFIG_PATH environment variable
 * 2. ~/.openclaw/openclaw.json
 * 3. /root/.openclaw/openclaw.json (for containers)
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

// Configuration with sensible defaults
const MISSION_CONTROL_DIR = process.env.MISSION_CONTROL_DIR || path.join(__dirname, '..', '.mission-control');
const SYNC_INTERVAL = parseInt(process.env.AGENT_SYNC_INTERVAL) || 30000; // 30 seconds

/**
 * Find OpenClaw configuration file
 * @returns {string|null} Path to openclaw.json or null if not found
 */
function findOpenClawConfig() {
    // Priority 1: Environment variable
    if (process.env.OPENCLAW_CONFIG_PATH) {
        if (fsSync.existsSync(process.env.OPENCLAW_CONFIG_PATH)) {
            return process.env.OPENCLAW_CONFIG_PATH;
        }
        console.warn('[AgentSync] OPENCLAW_CONFIG_PATH set but file not found:', process.env.OPENCLAW_CONFIG_PATH);
    }

    // Priority 2: Common locations
    const possiblePaths = [
        path.join(os.homedir(), '.openclaw', 'openclaw.json'),
        '/root/.openclaw/openclaw.json',
        path.join(process.cwd(), '.openclaw', 'openclaw.json'),
    ];

    for (const configPath of possiblePaths) {
        if (fsSync.existsSync(configPath)) {
            return configPath;
        }
    }

    return null;
}

/**
 * Find OpenClaw agents directory
 * @param {object} config - Parsed openclaw.json config
 * @returns {string|null} Path to agents directory
 */
function findAgentsDir(config) {
    // Priority 1: Environment variable
    if (process.env.OPENCLAW_AGENTS_DIR) {
        if (fsSync.existsSync(process.env.OPENCLAW_AGENTS_DIR)) {
            return process.env.OPENCLAW_AGENTS_DIR;
        }
    }

    // Priority 2: Derive from config file location
    const configPath = findOpenClawConfig();
    if (configPath) {
        const openclawDir = path.dirname(configPath);
        const agentsDir = path.join(openclawDir, 'agents');
        if (fsSync.existsSync(agentsDir)) {
            return agentsDir;
        }
    }

    return null;
}

/**
 * Read OpenClaw configuration
 * @returns {object|null} Parsed config or null
 */
async function readOpenClawConfig() {
    const configPath = findOpenClawConfig();
    
    if (!configPath) {
        console.log('[AgentSync] OpenClaw config not found - agent sync disabled');
        return null;
    }

    try {
        const content = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(content);
        console.log('[AgentSync] Found OpenClaw config at:', configPath);
        return config;
    } catch (error) {
        console.error('[AgentSync] Error reading OpenClaw config:', error.message);
        return null;
    }
}

/**
 * Read agent SOUL.md to extract personality info
 * @param {string} agentWorkspace - Path to agent workspace
 * @returns {object} Extracted personality data
 */
async function readAgentSoul(agentWorkspace) {
    const soulPaths = [
        path.join(agentWorkspace, 'SOUL.md'),
        path.join(agentWorkspace, 'agent', 'SOUL.md'),
    ];

    for (const soulPath of soulPaths) {
        try {
            const content = await fs.readFile(soulPath, 'utf-8');
            return parseSoulMd(content);
        } catch (e) {
            // Try next path
        }
    }

    return {};
}

/**
 * Parse SOUL.md to extract useful metadata
 * @param {string} content - SOUL.md content
 * @returns {object} Extracted metadata
 */
function parseSoulMd(content) {
    const result = {
        description: null,
        designation: null,
        skills: [],
    };

    // Extract first paragraph after title as description
    const lines = content.split('\n');
    let foundTitle = false;
    let descriptionLines = [];
    
    for (const line of lines) {
        if (line.startsWith('# ')) {
            foundTitle = true;
            // Try to extract designation from title like "# SOUL.md - Morpheus"
            const titleMatch = line.match(/# .*?[-–]\s*(.+)/);
            if (titleMatch) {
                result.designation = titleMatch[1].trim();
            }
            continue;
        }
        if (foundTitle && line.startsWith('_') && line.endsWith('_')) {
            // Italic line often contains core identity
            result.description = line.replace(/^_|_$/g, '').trim();
            break;
        }
        if (foundTitle && line.trim() && !line.startsWith('#') && !line.startsWith('-')) {
            descriptionLines.push(line.trim());
            if (descriptionLines.length >= 2) break;
        }
    }

    if (!result.description && descriptionLines.length > 0) {
        result.description = descriptionLines.join(' ');
    }

    // Extract skills from lists mentioning capabilities
    const skillPatterns = [
        /skills?:\s*\[([^\]]+)\]/gi,
        /capabilities?:\s*\[([^\]]+)\]/gi,
    ];
    
    for (const pattern of skillPatterns) {
        const match = content.match(pattern);
        if (match) {
            const skillsStr = match[1];
            result.skills = skillsStr.split(',').map(s => s.trim().replace(/['"]/g, ''));
        }
    }

    return result;
}

/**
 * Generate default agent data for Mission Control
 * @param {object} agentConfig - Agent config from OpenClaw
 * @param {object} soulData - Data extracted from SOUL.md
 * @returns {object} Mission Control agent data
 */
function generateAgentData(agentConfig, soulData) {
    const id = agentConfig.id;
    const name = capitalizeFirst(id);
    
    // Default emojis based on common agent roles
    const defaultEmojis = {
        'main': '🎯',
        'oracle': '🔮',
        'tank': '💻',
        'morpheus': '🎭',
        'shuri': '🔬',
        'keymaker': '🔑',
    };

    // Default designations
    const defaultDesignations = {
        'main': 'Primary Agent',
        'oracle': 'The Orchestrator',
        'tank': 'The Operator',
        'morpheus': 'The Reviewer',
        'shuri': 'The Innovator',
        'keymaker': 'The Specialist',
    };

    return {
        id: id,
        name: name,
        type: 'ai',
        emoji: defaultEmojis[id.toLowerCase()] || '🤖',
        designation: soulData.designation || defaultDesignations[id.toLowerCase()] || 'AI Agent',
        description: soulData.description || `OpenClaw agent: ${name}`,
        avatar: null,
        status: 'active',
        skills: soulData.skills.length > 0 ? soulData.skills : ['general'],
        model: extractModelName(agentConfig.model?.primary) || 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
            workspace: agentConfig.workspace || null,
            openclaw_agent: true,
            auto_synced: true,
        }
    };
}

/**
 * Extract readable model name from full model identifier
 * @param {string} modelId - Full model identifier
 * @returns {string} Readable model name
 */
function extractModelName(modelId) {
    if (!modelId) return null;
    
    // Extract just the model name part
    const parts = modelId.split('/');
    const modelName = parts[parts.length - 1];
    
    // Clean up common prefixes
    return modelName
        .replace('claude-', '')
        .replace('-20241022', '')
        .replace('-20240307', '');
}

/**
 * Capitalize first letter
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Sync a single agent to Mission Control
 * @param {object} agentConfig - Agent config from OpenClaw
 * @param {string} agentsOutputDir - Mission Control agents directory
 * @returns {object|null} Created/updated agent data or null
 */
async function syncAgent(agentConfig, agentsOutputDir) {
    const agentId = agentConfig.id;
    const agentFile = path.join(agentsOutputDir, `${agentId}.json`);
    
    // Check if agent file already exists
    let existingAgent = null;
    try {
        const content = await fs.readFile(agentFile, 'utf-8');
        existingAgent = JSON.parse(content);
    } catch (e) {
        // File doesn't exist or invalid - will create new
    }

    // Read SOUL.md for additional context
    const soulData = agentConfig.workspace 
        ? await readAgentSoul(agentConfig.workspace)
        : {};

    if (existingAgent) {
        // Update only certain fields, preserve user customizations
        const updated = {
            ...existingAgent,
            model: extractModelName(agentConfig.model?.primary) || existingAgent.model,
            updated_at: new Date().toISOString(),
            metadata: {
                ...existingAgent.metadata,
                workspace: agentConfig.workspace || existingAgent.metadata?.workspace,
                openclaw_agent: true,
                last_synced: new Date().toISOString(),
            }
        };

        await fs.writeFile(agentFile, JSON.stringify(updated, null, 2));
        return { action: 'updated', agent: updated };
    } else {
        // Create new agent file
        const newAgent = generateAgentData(agentConfig, soulData);
        
        await fs.mkdir(agentsOutputDir, { recursive: true });
        await fs.writeFile(agentFile, JSON.stringify(newAgent, null, 2));
        
        console.log(`[AgentSync] Created agent: ${agentId}`);
        return { action: 'created', agent: newAgent };
    }
}

/**
 * Get list of agents to sync from OpenClaw config
 * @param {object} config - OpenClaw configuration
 * @returns {Array} List of agent configs
 */
function getAgentList(config) {
    if (!config?.agents?.list) {
        return [];
    }
    
    return config.agents.list.filter(agent => {
        // Skip internal/system agents if any
        return agent.id && !agent.id.startsWith('_');
    });
}

/**
 * Perform full agent sync
 * @returns {object} Sync results
 */
async function syncAllAgents() {
    const results = {
        success: false,
        created: [],
        updated: [],
        errors: [],
        timestamp: new Date().toISOString(),
    };

    try {
        // Read OpenClaw config
        const config = await readOpenClawConfig();
        
        if (!config) {
            results.errors.push('OpenClaw configuration not found');
            return results;
        }

        // Get agent list
        const agents = getAgentList(config);
        
        if (agents.length === 0) {
            console.log('[AgentSync] No agents found in OpenClaw config');
            results.success = true;
            return results;
        }

        const agentsOutputDir = path.join(MISSION_CONTROL_DIR, 'agents');
        
        console.log(`[AgentSync] Syncing ${agents.length} agents...`);

        for (const agentConfig of agents) {
            try {
                const result = await syncAgent(agentConfig, agentsOutputDir);
                
                if (result) {
                    if (result.action === 'created') {
                        results.created.push(result.agent.id);
                    } else if (result.action === 'updated') {
                        results.updated.push(result.agent.id);
                    }
                }
            } catch (error) {
                console.error(`[AgentSync] Error syncing agent ${agentConfig.id}:`, error.message);
                results.errors.push(`${agentConfig.id}: ${error.message}`);
            }
        }

        results.success = true;
        
        if (results.created.length > 0) {
            console.log(`[AgentSync] Created agents: ${results.created.join(', ')}`);
        }
        if (results.updated.length > 0) {
            console.log(`[AgentSync] Updated agents: ${results.updated.join(', ')}`);
        }

    } catch (error) {
        console.error('[AgentSync] Sync failed:', error.message);
        results.errors.push(error.message);
    }

    return results;
}

/**
 * Get list of discovered agent IDs (for use by agent-bridge)
 * @returns {Array<string>} List of agent IDs
 */
async function getDiscoveredAgentIds() {
    const config = await readOpenClawConfig();
    
    if (!config) {
        // Fallback to scanning agents directory
        const agentsDir = findAgentsDir(config);
        if (agentsDir) {
            try {
                const entries = await fs.readdir(agentsDir, { withFileTypes: true });
                return entries
                    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
                    .map(e => e.name);
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    return getAgentList(config).map(a => a.id);
}

/**
 * Start periodic sync
 * @param {number} interval - Sync interval in ms
 * @returns {object} Interval handle
 */
function startPeriodicSync(interval = SYNC_INTERVAL) {
    console.log(`[AgentSync] Starting periodic sync (interval: ${interval}ms)`);
    
    // Initial sync
    syncAllAgents();
    
    // Periodic sync
    return setInterval(() => {
        syncAllAgents().catch(err => {
            console.error('[AgentSync] Periodic sync error:', err.message);
        });
    }, interval);
}

// Export functions for use by other modules
module.exports = {
    findOpenClawConfig,
    findAgentsDir,
    readOpenClawConfig,
    syncAllAgents,
    syncAgent,
    getDiscoveredAgentIds,
    startPeriodicSync,
    SYNC_INTERVAL,
};

// Run directly if executed as script
if (require.main === module) {
    console.log('[AgentSync] Running standalone sync...');
    syncAllAgents()
        .then(results => {
            console.log('[AgentSync] Sync complete:', JSON.stringify(results, null, 2));
            process.exit(results.success ? 0 : 1);
        })
        .catch(err => {
            console.error('[AgentSync] Fatal error:', err);
            process.exit(1);
        });
}
