#!/usr/bin/env node
/**
 * JARVIS Mission Control - Unified Startup
 * 
 * Starts both the main server and the agent bridge.
 */

const { spawn } = require('child_process');
const path = require('path');

const serverDir = __dirname;

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              JARVIS MISSION CONTROL                           ║
║           Unified Startup Orchestrator                        ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Start main server
const server = spawn('node', [path.join(serverDir, 'index.js')], {
    stdio: 'inherit',
    env: { ...process.env }
});

server.on('error', (err) => {
    console.error('[Server] Failed to start:', err);
});

// Give server a moment to start, then launch bridge
setTimeout(() => {
    const bridge = spawn('node', [path.join(serverDir, 'agent-bridge.js')], {
        stdio: 'inherit',
        env: { ...process.env }
    });
    
    bridge.on('error', (err) => {
        console.error('[Bridge] Failed to start:', err);
    });
    
    bridge.on('exit', (code) => {
        console.log(`[Bridge] Exited with code ${code}`);
    });
}, 2000);

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down Mission Control...');
    server.kill();
    process.exit(0);
});

process.on('SIGTERM', () => {
    server.kill();
    process.exit(0);
});
