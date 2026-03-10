/**
 * OpenClaw Sessions Scanner — JARVIS Mission Control v2.1.0
 * Discovers and tracks OpenClaw gateway sessions across all agents.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cache for sessions data
let cachedSessions = {
    sessions: [],
    agents: [],
    lastScan: null,
    openclawHome: process.env.OPENCLAW_HOME || '/root/.openclaw',
};

// Scan interval in ms
const SCAN_INTERVAL = 60_000; // 1 minute

/**
 * Parse the `openclaw sessions` CLI output into structured data.
 */
function parseSessionsOutput(output) {
    const lines = output.split('\n').filter(line => line.trim());
    const sessions = [];
    
    // Skip header lines
    let dataStarted = false;
    for (const line of lines) {
        // Detect header line
        if (line.includes('Kind') && line.includes('Key') && line.includes('Model')) {
            dataStarted = true;
            continue;
        }
        
        if (!dataStarted) continue;
        
        // Parse data line: Kind Key Age Model Tokens Flags
        // Example: group  agent:oracle:tel...opic:5  just now  claude-opus-4-5 90k/200k (45%)  system id:xxx
        const match = line.match(/^(\w+)\s+(\S+)\s+(.+?)\s+(claude-\S+|gpt-\S+|gemini-\S+|[\w-]+)\s+(\d+k?\/\d+k?)\s+\((\d+)%\)\s*(.*)$/);
        
        if (match) {
            const [, kind, key, age, model, tokens, contextPct, flags] = match;
            const [usedTokens, maxTokens] = tokens.split('/').map(t => {
                const num = parseInt(t.replace('k', ''));
                return t.includes('k') ? num * 1000 : num;
            });
            
            // Extract agent name from key
            const agentMatch = key.match(/^agent:(\w+):/);
            const agent = agentMatch ? agentMatch[1] : 'unknown';
            
            // Determine session type
            let sessionType = 'unknown';
            if (key.includes(':cron:')) sessionType = 'cron';
            else if (key.includes(':telegram:')) sessionType = 'telegram';
            else if (key.includes(':discord:')) sessionType = 'discord';
            else if (key.includes(':main')) sessionType = 'main';
            else if (key.includes(':direct')) sessionType = 'direct';
            
            // Extract session ID from flags
            const idMatch = flags.match(/id:([a-f0-9-]+)/);
            const sessionId = idMatch ? idMatch[1] : null;
            
            sessions.push({
                kind,
                key,
                agent,
                sessionType,
                age,
                model,
                usedTokens,
                maxTokens,
                contextPercent: parseInt(contextPct),
                sessionId,
                flags: flags.trim(),
                active: age.includes('now') || age.includes('1m') || age.includes('2m'),
            });
        }
    }
    
    return sessions;
}

/**
 * Scan sessions for a specific agent using the openclaw CLI.
 */
function scanAgentSessions(agentName) {
    try {
        const output = execSync(`openclaw sessions --agent ${agentName} 2>/dev/null`, {
            encoding: 'utf8',
            timeout: 10000,
            env: { ...process.env, NO_COLOR: '1' },
        });
        return parseSessionsOutput(output);
    } catch (err) {
        console.error(`[openclaw-sessions] Error scanning ${agentName}: ${err.message}`);
        return [];
    }
}

/**
 * Get list of configured agents from OpenClaw.
 */
function getAgentList() {
    const agentsDir = path.join(cachedSessions.openclawHome, 'agents');
    try {
        const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
        return entries
            .filter(e => e.isDirectory() && !e.name.startsWith('.'))
            .map(e => e.name);
    } catch (err) {
        console.error('[openclaw-sessions] Error reading agents directory:', err.message);
        return [];
    }
}

/**
 * Scan all OpenClaw sessions across all agents.
 */
async function scanSessions() {
    const agents = getAgentList();
    const allSessions = [];
    
    for (const agent of agents) {
        const sessions = scanAgentSessions(agent);
        allSessions.push(...sessions);
    }
    
    // Sort by age (most recent first)
    allSessions.sort((a, b) => {
        const ageToMs = (age) => {
            if (age.includes('now')) return 0;
            const match = age.match(/(\d+)([smhd])/);
            if (!match) return Infinity;
            const [, num, unit] = match;
            const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
            return parseInt(num) * (multipliers[unit] || 60000);
        };
        return ageToMs(a.age) - ageToMs(b.age);
    });
    
    cachedSessions = {
        sessions: allSessions,
        agents,
        lastScan: new Date().toISOString(),
        openclawHome: cachedSessions.openclawHome,
    };
    
    console.log(`[openclaw-sessions] Scanned ${agents.length} agents, found ${allSessions.length} sessions`);
    return allSessions;
}

/**
 * Get cached sessions data.
 */
function getCachedSessions() {
    return cachedSessions;
}

/**
 * Get summary stats.
 */
function getStats() {
    const { sessions, agents } = cachedSessions;
    const activeCount = sessions.filter(s => s.active).length;
    const byAgent = {};
    const byType = {};
    const byModel = {};
    
    for (const s of sessions) {
        byAgent[s.agent] = (byAgent[s.agent] || 0) + 1;
        byType[s.sessionType] = (byType[s.sessionType] || 0) + 1;
        byModel[s.model] = (byModel[s.model] || 0) + 1;
    }
    
    const totalTokens = sessions.reduce((sum, s) => sum + s.usedTokens, 0);
    const avgContext = sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + s.contextPercent, 0) / sessions.length)
        : 0;
    
    return {
        total: sessions.length,
        active: activeCount,
        agents: agents.length,
        totalTokens,
        avgContextPercent: avgContext,
        byAgent,
        byType,
        byModel,
    };
}

// Scanner interval handle
let scannerInterval = null;

/**
 * Start the background scanner.
 */
function startScanner() {
    if (scannerInterval) return;
    
    // Initial scan
    scanSessions();
    
    // Schedule periodic scans
    scannerInterval = setInterval(() => {
        scanSessions();
    }, SCAN_INTERVAL);
    
    console.log(`[openclaw-sessions] Scanner started — scanning every ${SCAN_INTERVAL / 1000}s`);
}

/**
 * Stop the background scanner.
 */
function stopScanner() {
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
        console.log('[openclaw-sessions] Scanner stopped');
    }
}

module.exports = {
    scanSessions,
    getCachedSessions,
    getStats,
    startScanner,
    stopScanner,
};
