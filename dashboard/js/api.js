/**
 * JARVIS Mission Control - Local API Client
 *
 * Connects to the local backend server for all data operations.
 * Includes WebSocket support for real-time updates.
 */

const MissionControlAPI = {
    baseUrl: '', // Same origin - no need for full URL
    ws: null,
    wsReconnectAttempts: 0,
    maxReconnectAttempts: 5,
    eventHandlers: new Map(),

    /**
     * Initialize the API and WebSocket connection
     */
    init() {
        this.connectWebSocket();
        return this;
    },

    // ============================================
    // REST API Methods
    // ============================================

    /**
     * Make an API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/api${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `API error: ${response.status}`);
        }

        return response.json();
    },

    // --- Tasks ---

    async getTasks() {
        return this.request('/tasks');
    },

    async getTask(id) {
        return this.request(`/tasks/${id}`);
    },

    async createTask(task) {
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify(task)
        });
    },

    async updateTask(id, task) {
        return this.request(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(task)
        });
    },

    async deleteTask(id) {
        return this.request(`/tasks/${id}`, {
            method: 'DELETE'
        });
    },

    // --- Agents ---

    async getAgents() {
        return this.request('/agents');
    },

    async getAgent(id) {
        return this.request(`/agents/${id}`);
    },

    async updateAgent(id, agent) {
        return this.request(`/agents/${id}`, {
            method: 'PUT',
            body: JSON.stringify(agent)
        });
    },

    // --- Humans ---

    async getHumans() {
        return this.request('/humans');
    },

    // --- Queue ---

    async getQueue() {
        return this.request('/queue');
    },

    // --- Logs ---

    async getActivityLog() {
        return this.request('/logs/activity');
    },

    async logActivity(actor, action, description) {
        return this.request('/logs/activity', {
            method: 'POST',
            body: JSON.stringify({ actor, action, description })
        });
    },

    // --- State ---

    async getState() {
        return this.request('/state');
    },

    async updateState(content) {
        return this.request('/state', {
            method: 'PUT',
            body: JSON.stringify({ content })
        });
    },

    // --- Metrics ---

    async getMetrics() {
        return this.request('/metrics');
    },

    // --- Webhooks ---

    async getWebhooks() {
        return this.request('/webhooks');
    },

    async registerWebhook(id, url, events) {
        return this.request('/webhooks', {
            method: 'POST',
            body: JSON.stringify({ id, url, events })
        });
    },

    async deleteWebhook(id) {
        return this.request(`/webhooks/${id}`, {
            method: 'DELETE'
        });
    },

    // ============================================
    // WebSocket - Real-time Updates
    // ============================================

    /**
     * Connect to WebSocket for real-time updates
     */
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.wsReconnectAttempts = 0;
                this.emit('ws.connected');
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.emit('ws.disconnected');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.attemptReconnect();
        }
    },

    /**
     * Attempt to reconnect WebSocket
     */
    attemptReconnect() {
        if (this.wsReconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max WebSocket reconnect attempts reached');
            return;
        }

        this.wsReconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);

        console.log(`Attempting WebSocket reconnect in ${delay}ms...`);

        setTimeout(() => {
            this.connectWebSocket();
        }, delay);
    },

    /**
     * Handle incoming WebSocket message
     */
    handleWebSocketMessage(message) {
        const { type, data, timestamp } = message;
        console.log(`WebSocket event: ${type}`, data);

        // Emit the event
        this.emit(type, data, timestamp);

        // Also emit a general 'update' event for any data change
        if (type.includes('.created') || type.includes('.updated') || type.includes('.deleted')) {
            this.emit('data.changed', { type, data, timestamp });
        }
    },

    // ============================================
    // Event System
    // ============================================

    /**
     * Subscribe to an event
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
        return () => this.off(event, handler);
    },

    /**
     * Unsubscribe from an event
     */
    off(event, handler) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    },

    /**
     * Emit an event
     */
    emit(event, data, timestamp) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data, timestamp);
                } catch (e) {
                    console.error(`Error in event handler for ${event}:`, e);
                }
            });
        }

        // Also emit to wildcard handlers
        const wildcardHandlers = this.eventHandlers.get('*');
        if (wildcardHandlers) {
            wildcardHandlers.forEach(handler => {
                try {
                    handler(event, data, timestamp);
                } catch (e) {
                    console.error('Error in wildcard event handler:', e);
                }
            });
        }
    },

    /**
     * Check if connected to WebSocket
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
};

// Initialize and make globally available
window.MissionControlAPI = MissionControlAPI.init();
