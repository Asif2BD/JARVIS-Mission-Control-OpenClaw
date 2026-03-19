/**
 * Event Logger - SQLite-based event system for Mission Control v2
 * 
 * Provides:
 * - Persistent event storage in SQLite
 * - Real-time WebSocket broadcast
 * - Query API with filters
 */

const Database = require('better-sqlite3');
const path = require('path');
const EventEmitter = require('events');

class EventLogger extends EventEmitter {
  constructor(dbPath) {
    super();
    this.dbPath = dbPath || path.join(__dirname, '../../.mission-control/events.db');
    this.db = null;
    this.init();
  }

  init() {
    this.db = new Database(this.dbPath);
    
    // Create events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        agent TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        cost REAL DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    `);

    // Prepared statements for performance
    this.insertStmt = this.db.prepare(`
      INSERT INTO events (timestamp, agent, type, summary, cost, metadata)
      VALUES (datetime('now'), ?, ?, ?, ?, ?)
    `);

    // Note: dynamic query built in query() method for better NULL handling

    // Cleanup old events (keep 30 days)
    this.db.exec(`
      DELETE FROM events WHERE created_at < strftime('%s', 'now', '-30 days')
    `);
  }

  /**
   * Log an event
   * @param {Object} event - Event data
   * @param {string} event.agent - Agent name (e.g., 'oracle', 'tank')
   * @param {string} event.type - Event type: chat, tool, search, email, cron, error, approval
   * @param {string} event.summary - Brief description
   * @param {number} [event.cost=0] - Cost in USD
   * @param {Object} [event.metadata={}] - Additional data
   */
  log(event) {
    const { agent, type, summary, cost = 0, metadata = {} } = event;
    
    if (!agent || !type || !summary) {
      throw new Error('Event requires agent, type, and summary');
    }

    const validTypes = ['chat', 'tool', 'search', 'email', 'cron', 'error', 'approval', 'status'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid event type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }

    const result = this.insertStmt.run(
      agent,
      type,
      summary,
      cost,
      JSON.stringify(metadata)
    );

    const newEvent = {
      id: result.lastInsertRowid,
      timestamp: new Date().toISOString(),
      agent,
      type,
      summary,
      cost,
      metadata
    };

    // Emit for WebSocket broadcast
    this.emit('event', newEvent);

    return newEvent;
  }

  /**
   * Query events with filters
   * @param {Object} filters
   * @param {string} [filters.agent] - Filter by agent
   * @param {string} [filters.type] - Filter by type
   * @param {number} [filters.limit=50] - Max results
   */
  query({ agent = null, type = null, limit = 50 } = {}) {
    // Build dynamic query for better NULL handling
    const conditions = [];
    const params = [];
    
    if (agent) {
      conditions.push('agent = ?');
      params.push(agent);
    }
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM events ${whereClause} ORDER BY timestamp DESC LIMIT ?`;
    params.push(Math.min(limit, 500));
    
    const rows = this.db.prepare(sql).all(...params);
    
    return rows.map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  /**
   * Get today's stats
   */
  getTodayStats() {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as totalEvents,
        SUM(cost) as totalCost,
        COUNT(DISTINCT agent) as activeAgents
      FROM events
      WHERE date(timestamp) = date('now')
    `).get();

    const byAgent = this.db.prepare(`
      SELECT agent, COUNT(*) as count, SUM(cost) as cost
      FROM events
      WHERE date(timestamp) = date('now')
      GROUP BY agent
    `).all();

    const byType = this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM events
      WHERE date(timestamp) = date('now')
      GROUP BY type
    `).all();

    return {
      ...stats,
      totalCost: stats.totalCost || 0,
      byAgent,
      byType
    };
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton instance
let instance = null;

function getEventLogger(dbPath) {
  if (!instance) {
    instance = new EventLogger(dbPath);
  }
  return instance;
}

module.exports = { EventLogger, getEventLogger };
