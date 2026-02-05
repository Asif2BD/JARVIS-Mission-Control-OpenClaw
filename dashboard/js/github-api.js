/**
 * GitHub API Integration for Mission Control
 * Enables real persistence of tasks, agents, and other data via GitHub API
 */

const GitHubAPI = {
    // Configuration (stored in localStorage)
    config: {
        token: null,
        owner: null,
        repo: null,
        branch: 'main',
        connected: false
    },

    /**
     * Initialize GitHub API from localStorage
     */
    init() {
        const saved = localStorage.getItem('mc-github-config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.config = { ...this.config, ...parsed };
            } catch (e) {
                console.warn('Failed to parse GitHub config:', e);
            }
        }
        this.updateConnectionStatus();
        return this.config.connected;
    },

    /**
     * Save configuration to localStorage
     */
    saveConfig() {
        localStorage.setItem('mc-github-config', JSON.stringify(this.config));
    },

    /**
     * Connect to GitHub with provided credentials
     */
    async connect(token, owner, repo, branch = 'main') {
        this.config.token = token;
        this.config.owner = owner;
        this.config.repo = repo;
        this.config.branch = branch;

        // Test connection by fetching repo info
        try {
            const response = await this.apiRequest(`/repos/${owner}/${repo}`);
            if (response.id) {
                this.config.connected = true;
                this.saveConfig();
                this.updateConnectionStatus();
                return { success: true, repo: response };
            }
        } catch (error) {
            console.error('GitHub connection failed:', error);
            this.config.connected = false;
            return { success: false, error: error.message };
        }

        return { success: false, error: 'Unknown error' };
    },

    /**
     * Disconnect from GitHub
     */
    disconnect() {
        this.config.token = null;
        this.config.connected = false;
        this.saveConfig();
        this.updateConnectionStatus();
    },

    /**
     * Make an authenticated API request to GitHub
     */
    async apiRequest(endpoint, options = {}) {
        const url = endpoint.startsWith('http')
            ? endpoint
            : `https://api.github.com${endpoint}`;

        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            ...options.headers
        };

        if (this.config.token) {
            headers['Authorization'] = `Bearer ${this.config.token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `GitHub API error: ${response.status}`);
        }

        return response.json();
    },

    /**
     * Get file content from repository
     */
    async getFile(path) {
        if (!this.config.connected) {
            throw new Error('Not connected to GitHub');
        }

        try {
            const response = await this.apiRequest(
                `/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`
            );

            // Decode base64 content
            const content = atob(response.content.replace(/\n/g, ''));
            return {
                content,
                sha: response.sha,
                path: response.path
            };
        } catch (error) {
            if (error.message.includes('404')) {
                return null; // File not found
            }
            throw error;
        }
    },

    /**
     * Create or update a file in the repository
     */
    async saveFile(path, content, message, existingSha = null) {
        if (!this.config.connected) {
            throw new Error('Not connected to GitHub');
        }

        // If we don't have the SHA, try to get it (for updates)
        let sha = existingSha;
        if (!sha) {
            const existing = await this.getFile(path);
            if (existing) {
                sha = existing.sha;
            }
        }

        const body = {
            message,
            content: btoa(unescape(encodeURIComponent(content))), // Base64 encode with UTF-8 support
            branch: this.config.branch
        };

        if (sha) {
            body.sha = sha;
        }

        const response = await this.apiRequest(
            `/repos/${this.config.owner}/${this.config.repo}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );

        return {
            success: true,
            commit: response.commit,
            content: response.content
        };
    },

    /**
     * List files in a directory
     */
    async listFiles(path) {
        if (!this.config.connected) {
            throw new Error('Not connected to GitHub');
        }

        try {
            const response = await this.apiRequest(
                `/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`
            );

            if (Array.isArray(response)) {
                return response.filter(f => f.type === 'file');
            }
            return [];
        } catch (error) {
            if (error.message.includes('404')) {
                return []; // Directory not found
            }
            throw error;
        }
    },

    /**
     * Load all tasks from repository
     */
    async loadTasks() {
        const files = await this.listFiles('.mission-control/tasks');
        const tasks = [];

        for (const file of files) {
            if (file.name.endsWith('.json')) {
                try {
                    const { content } = await this.getFile(file.path);
                    const task = JSON.parse(content);
                    tasks.push(task);
                } catch (e) {
                    console.warn(`Failed to load task ${file.name}:`, e);
                }
            }
        }

        return tasks;
    },

    /**
     * Load all agents from repository
     */
    async loadAgents() {
        const files = await this.listFiles('.mission-control/agents');
        const agents = [];

        for (const file of files) {
            if (file.name.endsWith('.json')) {
                try {
                    const { content } = await this.getFile(file.path);
                    const agent = JSON.parse(content);
                    agents.push(agent);
                } catch (e) {
                    console.warn(`Failed to load agent ${file.name}:`, e);
                }
            }
        }

        return agents;
    },

    /**
     * Load all humans from repository
     */
    async loadHumans() {
        const files = await this.listFiles('.mission-control/humans');
        const humans = [];

        for (const file of files) {
            if (file.name.endsWith('.json')) {
                try {
                    const { content } = await this.getFile(file.path);
                    const human = JSON.parse(content);
                    humans.push(human);
                } catch (e) {
                    console.warn(`Failed to load human ${file.name}:`, e);
                }
            }
        }

        return humans;
    },

    /**
     * Load queue items from repository
     */
    async loadQueue() {
        const files = await this.listFiles('.mission-control/queue');
        const queue = [];

        for (const file of files) {
            if (file.name.endsWith('.json')) {
                try {
                    const { content } = await this.getFile(file.path);
                    const item = JSON.parse(content);
                    queue.push(item);
                } catch (e) {
                    console.warn(`Failed to load queue item ${file.name}:`, e);
                }
            }
        }

        return queue;
    },

    /**
     * Save a task to the repository
     */
    async saveTask(task) {
        const path = `.mission-control/tasks/${task.id}.json`;
        const content = JSON.stringify(task, null, 2);
        const message = `[dashboard] ${task.id ? 'Update' : 'Create'} task: ${task.title}`;

        return this.saveFile(path, content, message);
    },

    /**
     * Append to activity log
     */
    async logActivity(actor, action, description) {
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} [${actor}] ${action}: ${description}\n`;

        // Get existing log
        const logPath = '.mission-control/logs/activity.log';
        let existingContent = '';
        let sha = null;

        try {
            const existing = await this.getFile(logPath);
            if (existing) {
                existingContent = existing.content;
                sha = existing.sha;
            }
        } catch (e) {
            // Log doesn't exist yet
        }

        const newContent = existingContent + logEntry;
        return this.saveFile(logPath, newContent, `[dashboard] Log: ${action}`, sha);
    },

    /**
     * Update connection status in the UI
     */
    updateConnectionStatus() {
        const statusEl = document.getElementById('github-status');
        const connectBtn = document.getElementById('github-connect-btn');
        const disconnectBtn = document.getElementById('github-disconnect-btn');
        const repoInfo = document.getElementById('github-repo-info');

        if (!statusEl) return;

        if (this.config.connected) {
            statusEl.innerHTML = '<span class="status-dot connected"></span> Connected';
            statusEl.className = 'github-status connected';
            if (connectBtn) connectBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
            if (repoInfo) repoInfo.textContent = `${this.config.owner}/${this.config.repo}`;
        } else {
            statusEl.innerHTML = '<span class="status-dot disconnected"></span> Not connected';
            statusEl.className = 'github-status disconnected';
            if (connectBtn) connectBtn.style.display = 'inline-block';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
            if (repoInfo) repoInfo.textContent = 'Using demo data';
        }
    },

    /**
     * Check if connected
     */
    isConnected() {
        return this.config.connected;
    }
};

// Initialize on load
GitHubAPI.init();

// Make available globally
window.GitHubAPI = GitHubAPI;
