/**
 * JARVIS Mission Control - Resource Manager
 * 
 * Comprehensive resource management including:
 * - Resources (APIs, compute, services, tools)
 * - Bookings (time-based resource allocation)
 * - Costs (spend tracking)
 * - Quotas (usage limits)
 * - Credentials (secure reference storage)
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ResourceManager {
    constructor(missionControlDir) {
        this.baseDir = missionControlDir;
        this.resourcesDir = path.join(missionControlDir, 'resources');
        this.bookingsDir = path.join(missionControlDir, 'bookings');
        this.costsDir = path.join(missionControlDir, 'costs');
        this.quotasDir = path.join(missionControlDir, 'quotas');
        this.credentialsDir = path.join(missionControlDir, 'credentials');
        
        this._ensureDirs();
    }

    async _ensureDirs() {
        const dirs = [
            this.resourcesDir,
            this.bookingsDir,
            this.costsDir,
            this.quotasDir,
            this.credentialsDir
        ];
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true }).catch(() => {});
        }
    }

    _generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }

    async _readDir(dir) {
        try {
            const files = await fs.readdir(dir);
            const items = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const content = await fs.readFile(path.join(dir, file), 'utf-8');
                        items.push(JSON.parse(content));
                    } catch (e) {
                        console.error(`Error reading ${file}:`, e.message);
                    }
                }
            }
            return items;
        } catch (error) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    }

    async _readFile(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }

    async _writeFile(filePath, data) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return data;
    }

    // ============================================
    // CREDENTIALS
    // ============================================

    async listCredentials() {
        const credentials = await this._readDir(this.credentialsDir);
        // Never return actual values in list
        return credentials.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            service: c.service,
            description: c.description,
            created_at: c.created_at,
            updated_at: c.updated_at,
            last_used: c.last_used,
            expires_at: c.expires_at,
            has_value: !!c.encrypted_value
        }));
    }

    async getCredential(id, includeValue = false) {
        const filePath = path.join(this.credentialsDir, `${id}.json`);
        try {
            const credential = await this._readFile(filePath);
            if (!includeValue) {
                const { encrypted_value, ...safe } = credential;
                return { ...safe, has_value: !!encrypted_value };
            }
            // For now, return plaintext (in production, would decrypt)
            return {
                ...credential,
                value: credential.encrypted_value,
                has_value: !!credential.encrypted_value
            };
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    }

    async storeCredential(data) {
        const credential = {
            id: data.id || this._generateId('cred'),
            name: data.name,
            type: data.type || 'api_key', // api_key, oauth_token, password, certificate
            service: data.service || null,
            description: data.description || '',
            encrypted_value: data.value, // In production, would encrypt
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            expires_at: data.expires_at || null,
            last_used: null,
            owner: data.owner || 'system',
            shared_with: data.shared_with || []
        };

        const filePath = path.join(this.credentialsDir, `${credential.id}.json`);
        await this._writeFile(filePath, credential);

        const { encrypted_value, ...safe } = credential;
        return { ...safe, has_value: true };
    }

    async deleteCredential(id) {
        const filePath = path.join(this.credentialsDir, `${id}.json`);
        await fs.unlink(filePath);
        return { success: true, id };
    }

    // ============================================
    // RESOURCES
    // ============================================

    async listResources(filters = {}) {
        const resources = await this._readDir(this.resourcesDir);
        return resources.filter(r => {
            if (filters.type && r.type !== filters.type) return false;
            if (filters.status && r.status !== filters.status) return false;
            if (filters.owner && r.owner !== filters.owner) return false;
            return true;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    async getResource(id) {
        const filePath = path.join(this.resourcesDir, `${id}.json`);
        try {
            return await this._readFile(filePath);
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    }

    async createResource(data) {
        const resource = {
            id: data.id || this._generateId('res'),
            name: data.name,
            type: data.type || 'other', // api, compute, service, tool, other
            status: data.status || 'active', // active, inactive, maintenance, deprecated
            description: data.description || '',
            
            // Configuration
            config: data.config || {},
            endpoint: data.endpoint || null,
            documentation_url: data.documentation_url || null,
            
            // Ownership
            owner: data.owner || null,
            shared_with: data.shared_with || [],
            
            // Capacity (for bookable resources)
            capacity: data.capacity || null, // e.g., { max_concurrent: 10, unit: 'requests' }
            bookable: data.bookable || false,
            
            // Cost tracking
            cost_per_unit: data.cost_per_unit || null,
            cost_unit: data.cost_unit || null, // token, request, hour, etc.
            monthly_budget: data.monthly_budget || null,
            
            // Metadata
            tags: data.tags || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: data.created_by || 'system'
        };

        const filePath = path.join(this.resourcesDir, `${resource.id}.json`);
        await this._writeFile(filePath, resource);
        return resource;
    }

    async updateResource(id, updates) {
        const resource = await this.getResource(id);
        if (!resource) throw new Error(`Resource not found: ${id}`);

        const allowedFields = [
            'name', 'type', 'status', 'description', 'config',
            'endpoint', 'documentation_url', 'owner', 'shared_with',
            'capacity', 'bookable', 'cost_per_unit', 'cost_unit',
            'monthly_budget', 'tags'
        ];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                resource[field] = updates[field];
            }
        }
        resource.updated_at = new Date().toISOString();

        const filePath = path.join(this.resourcesDir, `${id}.json`);
        await this._writeFile(filePath, resource);
        return resource;
    }

    async deleteResource(id) {
        const filePath = path.join(this.resourcesDir, `${id}.json`);
        await fs.unlink(filePath);
        return { success: true, id };
    }

    // ============================================
    // BOOKINGS
    // ============================================

    async listBookings(filters = {}) {
        const bookings = await this._readDir(this.bookingsDir);
        const now = new Date().toISOString();
        
        return bookings.filter(b => {
            if (filters.resource_id && b.resource_id !== filters.resource_id) return false;
            if (filters.agent_id && b.agent_id !== filters.agent_id) return false;
            if (filters.status && b.status !== filters.status) return false;
            if (filters.from_date && b.end_time < filters.from_date) return false;
            if (filters.to_date && b.start_time > filters.to_date) return false;
            return true;
        }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    }

    async bookResource(data) {
        const resource = await this.getResource(data.resource_id);
        if (!resource) throw new Error(`Resource not found: ${data.resource_id}`);
        if (!resource.bookable) throw new Error(`Resource is not bookable: ${resource.name}`);

        // Check for conflicts
        const existingBookings = await this.listBookings({
            resource_id: data.resource_id,
            status: 'active'
        });

        const startTime = new Date(data.start_time);
        const endTime = new Date(data.end_time);

        for (const existing of existingBookings) {
            const existingStart = new Date(existing.start_time);
            const existingEnd = new Date(existing.end_time);
            
            if (startTime < existingEnd && endTime > existingStart) {
                throw new Error(`Booking conflict with ${existing.id} (${existing.start_time} - ${existing.end_time})`);
            }
        }

        const booking = {
            id: data.id || this._generateId('book'),
            resource_id: data.resource_id,
            resource_name: resource.name,
            agent_id: data.agent_id,
            start_time: data.start_time,
            end_time: data.end_time,
            purpose: data.purpose || '',
            status: 'active', // active, completed, cancelled
            created_at: new Date().toISOString(),
            booked_by: data.booked_by || 'system'
        };

        const filePath = path.join(this.bookingsDir, `${booking.id}.json`);
        await this._writeFile(filePath, booking);
        return booking;
    }

    async cancelBooking(id) {
        const filePath = path.join(this.bookingsDir, `${id}.json`);
        const booking = await this._readFile(filePath);
        booking.status = 'cancelled';
        booking.cancelled_at = new Date().toISOString();
        await this._writeFile(filePath, booking);
        return booking;
    }

    // ============================================
    // COSTS
    // ============================================

    async recordCost(data) {
        const cost = {
            id: data.id || this._generateId('cost'),
            agent_id: data.agent_id,
            type: data.type, // api_call, compute, storage, etc.
            resource_id: data.resource_id || null,
            amount: parseFloat(data.amount) || 0,
            currency: data.currency || 'USD',
            description: data.description || '',
            metadata: data.metadata || {},
            timestamp: new Date().toISOString(),
            recorded_by: data.recorded_by || 'system'
        };

        const filePath = path.join(this.costsDir, `${cost.id}.json`);
        await this._writeFile(filePath, cost);
        return cost;
    }

    async getCostSummary(filters = {}) {
        const costs = await this._readDir(this.costsDir);
        
        let filtered = costs.filter(c => {
            if (filters.agent_id && c.agent_id !== filters.agent_id) return false;
            if (filters.type && c.type !== filters.type) return false;
            if (filters.from_date && c.timestamp < filters.from_date) return false;
            if (filters.to_date && c.timestamp > filters.to_date) return false;
            return true;
        });

        const summary = {
            total: 0,
            by_agent: {},
            by_type: {},
            by_resource: {},
            items: filtered
        };

        for (const cost of filtered) {
            summary.total += cost.amount;
            
            if (cost.agent_id) {
                summary.by_agent[cost.agent_id] = (summary.by_agent[cost.agent_id] || 0) + cost.amount;
            }
            
            summary.by_type[cost.type] = (summary.by_type[cost.type] || 0) + cost.amount;
            
            if (cost.resource_id) {
                summary.by_resource[cost.resource_id] = (summary.by_resource[cost.resource_id] || 0) + cost.amount;
            }
        }

        return summary;
    }

    // ============================================
    // QUOTAS
    // ============================================

    async getQuotas(agentId = null) {
        const quotas = await this._readDir(this.quotasDir);
        if (agentId) {
            return quotas.filter(q => q.agent_id === agentId || q.agent_id === 'global');
        }
        return quotas;
    }

    async setQuota(data) {
        const quota = {
            id: data.id || this._generateId('quota'),
            agent_id: data.agent_id || 'global',
            type: data.type, // tokens, api_calls, compute_hours, etc.
            limit: parseFloat(data.limit) || 0,
            period: data.period || 'monthly', // daily, weekly, monthly
            current_usage: data.current_usage || 0,
            warning_threshold: data.warning_threshold || 0.8, // 80% default
            last_reset: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const filePath = path.join(this.quotasDir, `${quota.id}.json`);
        await this._writeFile(filePath, quota);
        return quota;
    }

    async updateQuotaUsage(id, usage) {
        const filePath = path.join(this.quotasDir, `${id}.json`);
        const quota = await this._readFile(filePath);
        
        quota.current_usage = (quota.current_usage || 0) + parseFloat(usage);
        quota.updated_at = new Date().toISOString();
        
        await this._writeFile(filePath, quota);

        const percentage = quota.current_usage / quota.limit;
        const warning = percentage >= quota.warning_threshold;
        const exceeded = quota.current_usage >= quota.limit;

        return {
            ...quota,
            percentage: Math.round(percentage * 100),
            warning,
            exceeded
        };
    }

    async resetQuota(id) {
        const filePath = path.join(this.quotasDir, `${id}.json`);
        const quota = await this._readFile(filePath);
        
        quota.current_usage = 0;
        quota.last_reset = new Date().toISOString();
        quota.updated_at = new Date().toISOString();
        
        await this._writeFile(filePath, quota);
        return quota;
    }

    async checkQuota(agentId, type, amount = 1) {
        const quotas = await this.getQuotas(agentId);
        
        // Find matching quota (agent-specific first, then global)
        let quota = quotas.find(q => q.agent_id === agentId && q.type === type);
        if (!quota) {
            quota = quotas.find(q => q.agent_id === 'global' && q.type === type);
        }
        
        if (!quota) {
            return { allowed: true, reason: 'No quota defined' };
        }

        const projectedUsage = quota.current_usage + amount;
        const allowed = projectedUsage <= quota.limit;
        const remaining = quota.limit - quota.current_usage;
        
        return {
            allowed,
            quota_id: quota.id,
            limit: quota.limit,
            current_usage: quota.current_usage,
            remaining: Math.max(0, remaining),
            percentage: Math.round((quota.current_usage / quota.limit) * 100),
            reason: allowed ? 'Within quota' : 'Quota exceeded'
        };
    }

    // ============================================
    // METRICS
    // ============================================

    async getMetrics() {
        const [resources, bookings, costs, quotas] = await Promise.all([
            this._readDir(this.resourcesDir),
            this._readDir(this.bookingsDir),
            this._readDir(this.costsDir),
            this._readDir(this.quotasDir)
        ]);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Monthly costs
        const monthlyCosts = costs
            .filter(c => c.timestamp >= startOfMonth)
            .reduce((sum, c) => sum + c.amount, 0);

        // Active bookings
        const activeBookings = bookings.filter(b => 
            b.status === 'active' && 
            new Date(b.end_time) > now
        ).length;

        // Resources by status
        const resourcesByStatus = {};
        for (const r of resources) {
            resourcesByStatus[r.status] = (resourcesByStatus[r.status] || 0) + 1;
        }

        // Quotas near limit
        const quotasNearLimit = quotas.filter(q => 
            q.current_usage / q.limit >= q.warning_threshold
        );

        return {
            resources: {
                total: resources.length,
                by_status: resourcesByStatus,
                by_type: resources.reduce((acc, r) => {
                    acc[r.type] = (acc[r.type] || 0) + 1;
                    return acc;
                }, {})
            },
            bookings: {
                total: bookings.length,
                active: activeBookings
            },
            costs: {
                total_records: costs.length,
                monthly_spend: Math.round(monthlyCosts * 100) / 100
            },
            quotas: {
                total: quotas.length,
                near_limit: quotasNearLimit.length,
                warning_items: quotasNearLimit.map(q => ({
                    id: q.id,
                    type: q.type,
                    agent_id: q.agent_id,
                    percentage: Math.round((q.current_usage / q.limit) * 100)
                }))
            }
        };
    }
}

module.exports = ResourceManager;
