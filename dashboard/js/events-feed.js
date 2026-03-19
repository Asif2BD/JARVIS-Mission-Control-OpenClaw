/**
 * Events Feed — JARVIS Mission Control v2.0.0
 *
 * Real-time event feed with WebSocket updates.
 * Displays agent activity, costs, and system events.
 */

// ── State ──────────────────────────────────────────────────────────────────

let eventFeedWs = null;
let eventFeedEvents = [];
let eventFeedPaused = false;
let eventFeedFilter = { agent: null, type: null };

// ── Event type icons ───────────────────────────────────────────────────────

const EVENT_ICONS = {
  chat: '💬',
  tool: '🔧',
  search: '🔍',
  email: '📧',
  cron: '⏰',
  error: '⚠️',
  approval: '✅',
  status: '📊'
};

// ── Time formatting ────────────────────────────────────────────────────────

function formatEventTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
}

function formatCost(cost) {
  if (!cost || cost === 0) return '';
  return `$${cost.toFixed(2)}`;
}

// ── Top Metrics Bar ────────────────────────────────────────────────────────

async function refreshTopMetrics() {
  try {
    const [statsRes, costsRes] = await Promise.all([
      fetch('/api/events/stats'),
      fetch('/api/costs')
    ]);
    
    const stats = statsRes.ok ? await statsRes.json() : {};
    const costs = costsRes.ok ? await costsRes.json() : {};
    
    // Update metrics bar elements
    const todayCostEl = document.getElementById('metric-today-cost');
    const monthCostEl = document.getElementById('metric-month-cost');
    const tasksEl = document.getElementById('metric-tasks-completed');
    const activeAgentsEl = document.getElementById('metric-active-agents');
    
    if (todayCostEl) {
      const todayCost = costs.totals?.todayCost || stats.totalCost || 0;
      todayCostEl.textContent = `$${todayCost.toFixed(2)}`;
    }
    
    if (monthCostEl) {
      const monthCost = costs.totals?.monthCost || 0;
      const budget = costs.totals?.budget || 100;
      const pct = Math.round((monthCost / budget) * 100);
      monthCostEl.innerHTML = `$${monthCost.toFixed(2)} <span class="metric-secondary">/ $${budget}</span>`;
      
      // Update progress bar if exists
      const progressEl = document.getElementById('budget-progress');
      if (progressEl) {
        progressEl.style.width = `${Math.min(pct, 100)}%`;
        progressEl.className = `budget-progress-bar ${pct > 80 ? 'warning' : pct > 95 ? 'danger' : ''}`;
      }
    }
    
    if (tasksEl) {
      tasksEl.textContent = stats.totalEvents || 0;
    }
    
    if (activeAgentsEl) {
      activeAgentsEl.textContent = stats.activeAgents || costs.agents?.length || 0;
    }
    
  } catch (err) {
    console.warn('Failed to refresh top metrics:', err);
  }
}

// ── Event Feed ─────────────────────────────────────────────────────────────

async function loadInitialEvents() {
  try {
    const params = new URLSearchParams();
    if (eventFeedFilter.agent) params.set('agent', eventFeedFilter.agent);
    if (eventFeedFilter.type) params.set('type', eventFeedFilter.type);
    params.set('limit', '50');
    
    const res = await fetch(`/api/events?${params}`);
    if (!res.ok) throw new Error('Failed to load events');
    
    const data = await res.json();
    eventFeedEvents = data.events || [];
    renderEventFeed();
  } catch (err) {
    console.error('Failed to load events:', err);
  }
}

function renderEventFeed() {
  const container = document.getElementById('event-feed-list');
  if (!container) return;
  
  if (eventFeedEvents.length === 0) {
    container.innerHTML = `
      <div class="event-feed-empty">
        <span class="event-feed-empty-icon">📭</span>
        <p>No events yet</p>
        <p class="text-muted">Events will appear here as agents work</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = eventFeedEvents.map(event => `
    <div class="event-item" data-type="${event.type}">
      <span class="event-time">${formatEventTime(event.timestamp)}</span>
      <span class="event-agent">${escapeHtml(event.agent)}</span>
      <span class="event-icon">${EVENT_ICONS[event.type] || '📌'}</span>
      <span class="event-summary">${escapeHtml(event.summary)}</span>
      ${event.cost ? `<span class="event-cost">${formatCost(event.cost)}</span>` : ''}
    </div>
  `).join('');
}

function addEventToFeed(event) {
  // Apply filters
  if (eventFeedFilter.agent && event.agent !== eventFeedFilter.agent) return;
  if (eventFeedFilter.type && event.type !== eventFeedFilter.type) return;
  
  // Add to beginning
  eventFeedEvents.unshift(event);
  
  // Keep max 100 events in memory
  if (eventFeedEvents.length > 100) {
    eventFeedEvents.pop();
  }
  
  // Re-render if not paused
  if (!eventFeedPaused) {
    renderEventFeed();
    
    // Auto-scroll to top
    const container = document.getElementById('event-feed-list');
    if (container) container.scrollTop = 0;
  }
}

// ── WebSocket Connection ───────────────────────────────────────────────────

function connectEventFeedWs() {
  if (eventFeedWs && eventFeedWs.readyState === WebSocket.OPEN) return;
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  eventFeedWs = new WebSocket(wsUrl);
  
  eventFeedWs.onopen = () => {
    console.log('[EventFeed] WebSocket connected');
    updateWsStatus(true);
  };
  
  eventFeedWs.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      if (data.type === 'event' && data.payload) {
        addEventToFeed(data.payload);
        // Also refresh metrics on new events
        refreshTopMetrics();
      }
    } catch (err) {
      console.warn('[EventFeed] Failed to parse message:', err);
    }
  };
  
  eventFeedWs.onclose = () => {
    console.log('[EventFeed] WebSocket closed, reconnecting in 5s...');
    updateWsStatus(false);
    setTimeout(connectEventFeedWs, 5000);
  };
  
  eventFeedWs.onerror = (err) => {
    console.error('[EventFeed] WebSocket error:', err);
    updateWsStatus(false);
  };
}

function updateWsStatus(connected) {
  const statusEl = document.getElementById('event-feed-ws-status');
  if (statusEl) {
    statusEl.className = `ws-status ${connected ? 'connected' : 'disconnected'}`;
    statusEl.title = connected ? 'Real-time updates active' : 'Reconnecting...';
  }
}

// ── Filter Controls ────────────────────────────────────────────────────────

function setEventFilter(type, value) {
  eventFeedFilter[type] = value || null;
  loadInitialEvents();
}

function toggleEventFeedPause() {
  eventFeedPaused = !eventFeedPaused;
  const btn = document.getElementById('event-feed-pause-btn');
  if (btn) {
    btn.textContent = eventFeedPaused ? '▶ Resume' : '⏸ Pause';
    btn.title = eventFeedPaused ? 'Resume auto-scroll' : 'Pause auto-scroll';
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Panel Controls ─────────────────────────────────────────────────────────

function openEventFeedPanel() {
  const panel = document.getElementById('event-feed-panel');
  if (panel) {
    panel.style.display = 'flex';
    loadInitialEvents();
    connectEventFeedWs();
    refreshTopMetrics();
  }
}

function closeEventFeedPanel() {
  const panel = document.getElementById('event-feed-panel');
  if (panel) panel.style.display = 'none';
}

// ── Initialize ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Initial metrics load
  refreshTopMetrics();
  
  // Refresh metrics every 60s
  setInterval(refreshTopMetrics, 60000);
  
  // Connect WebSocket for real-time updates
  connectEventFeedWs();
  
  // Load initial events if panel is visible
  const panel = document.getElementById('event-feed-panel');
  if (panel && panel.style.display !== 'none') {
    loadInitialEvents();
  }
});

// Expose functions globally
window.openEventFeedPanel = openEventFeedPanel;
window.closeEventFeedPanel = closeEventFeedPanel;
window.setEventFilter = setEventFilter;
window.toggleEventFeedPause = toggleEventFeedPause;
window.refreshTopMetrics = refreshTopMetrics;
