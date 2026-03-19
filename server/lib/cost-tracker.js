/**
 * Cost Tracker - OpenClaw usage aggregation for Mission Control v2
 * 
 * Provides:
 * - Per-agent cost tracking (today, month)
 * - Cached responses (5 min TTL)
 * - Projected monthly spend
 */

const logger = require('../logger');

class CostTracker {
  constructor(options = {}) {
    this.gatewayUrl = options.gatewayUrl || process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3377';
    this.gatewayToken = options.gatewayToken || process.env.MC_AGENT_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN;
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes
    this.cache = {
      data: null,
      timestamp: 0
    };
  }

  /**
   * Fetch usage data from OpenClaw gateway
   */
  async fetchFromGateway() {
    if (!this.gatewayToken) {
      logger.warn('No gateway token configured for cost tracking');
      return null;
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/api/usage`, {
        headers: {
          'Authorization': `Bearer ${this.gatewayToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to fetch usage from gateway');
      return null;
    }
  }

  /**
   * Get all agent costs with caching
   */
  async getCosts() {
    const now = Date.now();
    
    // Return cached data if fresh
    if (this.cache.data && (now - this.cache.timestamp) < this.cacheTTL) {
      return this.cache.data;
    }

    const usage = await this.fetchFromGateway();
    
    if (!usage) {
      // Return stale cache or empty data
      return this.cache.data || this.getEmptyResponse();
    }

    const result = this.aggregateUsage(usage);
    
    // Update cache
    this.cache.data = result;
    this.cache.timestamp = now;

    return result;
  }

  /**
   * Get costs for a specific agent
   */
  async getAgentCosts(agentId) {
    const allCosts = await this.getCosts();
    const agentCost = allCosts.agents.find(a => a.agent === agentId);
    
    if (!agentCost) {
      return {
        agent: agentId,
        todayCost: 0,
        monthCost: 0,
        projectedMonth: 0,
        lastUpdated: new Date().toISOString()
      };
    }

    return agentCost;
  }

  /**
   * Aggregate raw usage into per-agent costs
   */
  aggregateUsage(usage) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Handle different usage data formats from OpenClaw
    const sessions = usage.sessions || usage.data?.sessions || [];
    const agentMap = new Map();

    for (const session of sessions) {
      const agentId = session.agentId || session.agent || 'unknown';
      const sessionCost = session.cost || session.totalCost || 0;
      const sessionDate = session.date || session.timestamp || session.createdAt;
      
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, { todayCost: 0, monthCost: 0 });
      }

      const agent = agentMap.get(agentId);
      
      // Check if session is from today
      if (sessionDate && sessionDate.startsWith(today)) {
        agent.todayCost += sessionCost;
      }
      
      // Check if session is from this month
      const sessionDateObj = new Date(sessionDate);
      if (sessionDateObj >= monthStart) {
        agent.monthCost += sessionCost;
      }
    }

    // Calculate projections and build response
    const agents = [];
    let totalTodayCost = 0;
    let totalMonthCost = 0;

    for (const [agentId, costs] of agentMap) {
      const dailyAverage = costs.monthCost / dayOfMonth;
      const projectedMonth = dailyAverage * daysInMonth;

      agents.push({
        agent: agentId,
        todayCost: Math.round(costs.todayCost * 100) / 100,
        monthCost: Math.round(costs.monthCost * 100) / 100,
        projectedMonth: Math.round(projectedMonth * 100) / 100,
        lastUpdated: now.toISOString()
      });

      totalTodayCost += costs.todayCost;
      totalMonthCost += costs.monthCost;
    }

    // Sort by month cost descending
    agents.sort((a, b) => b.monthCost - a.monthCost);

    const totalDailyAverage = totalMonthCost / dayOfMonth;
    const totalProjected = totalDailyAverage * daysInMonth;

    return {
      totals: {
        todayCost: Math.round(totalTodayCost * 100) / 100,
        monthCost: Math.round(totalMonthCost * 100) / 100,
        projectedMonth: Math.round(totalProjected * 100) / 100,
        budget: usage.budget || 100, // Default $100/month
        budgetUsedPercent: Math.round((totalMonthCost / (usage.budget || 100)) * 100)
      },
      agents,
      lastUpdated: now.toISOString(),
      cacheHit: false
    };
  }

  /**
   * Empty response structure
   */
  getEmptyResponse() {
    return {
      totals: {
        todayCost: 0,
        monthCost: 0,
        projectedMonth: 0,
        budget: 100,
        budgetUsedPercent: 0
      },
      agents: [],
      lastUpdated: new Date().toISOString(),
      cacheHit: false,
      error: 'Unable to fetch usage data'
    };
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.cache.data = null;
    this.cache.timestamp = 0;
  }
}

// Singleton instance
let instance = null;

function getCostTracker(options) {
  if (!instance) {
    instance = new CostTracker(options);
  }
  return instance;
}

module.exports = { CostTracker, getCostTracker };
