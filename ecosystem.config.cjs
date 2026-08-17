module.exports = {
  apps: [
    {
      name: 'mission-control-server',
      script: 'server/index.js',
      cwd: '/root/.openclaw/workspace/agents/tank/mission-control',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        MC_AUTH_USER: process.env.MC_AUTH_USER || 'architect',
        MC_AUTH_PASS: process.env.MC_AUTH_PASS,
        MC_AGENT_TOKEN: process.env.MC_AGENT_TOKEN,
        OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN
      }
    }
  ]
};
