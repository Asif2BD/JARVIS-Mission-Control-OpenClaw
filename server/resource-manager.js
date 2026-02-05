/**
 * Resource Management Module
 * 
 * Handles:
 * - Credentials Vault (API keys, tokens - encrypted)
 * - Resource Booking (servers, GPUs)
 * - Cost Tracking (API usage, hosting fees)
 * - Quota Management (limits, warnings, hard stops)
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

class ResourceManager {
    constructor(missionControlDir) {
        this.baseDir = missionControlDir;
        this.resourcesDir = path.join(missionControlDir, 'resources');
        this.credentialsDir = path.join(missionControlDir, 'credentials');
        this.bookingsDir = path.join(missionControlDir, 'bookings');
        this.costsDir = path.join(missionControlDir, 'costs');
        
        // Encryption key derived from env or generated
        this.encryptionKey = this.getEncryptionKey();
    }

    /**
     * Get or generate encryption key
     */
    getEncryptionKey() {
        const envKey = process.env.MC_ENCRYPTION_KEY;
        if (envKey) {
            // Use provided key (should be 32 bytes hex encoded)
            return Buffer.from(envKey, 'hex');
        }
        
        // For development, use a deterministic key based on machine ID
        // In production, set MC_ENCRYPTION_KEY environment variable
        const machineId = process.env.HOSTNAME || 'mission-control';
        return crypto.scryptSync(machineId, 'mission-control-salt', KEY_LENGTH);
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(plaintext) {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            iv: iv.toString('hex'),
            encrypted: encrypted,
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData) {
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const authTag = Buffer.from(encryptedData.authTag, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    // ============================================
    // CREDENTIALS VAULT
    // ============================================

    /**
     * Store a credential (encrypted)
     */
    async storeCredential(credential) {
        await fs.mkdir(this.credentialsDir, { recursive: true });
        
        const id = credential.id || `cred-${Date.now()}`;
        const encrypted = this.encrypt(credential.value);
        
        const stored = {
            id: id,
            name: credential.name,
            type: credential.type || 'api_key',
            service: credential.service,
            description: credential.description || '',
            owner: credential.owner || 'system',
            encrypted: encrypted,
            permissions: credential.permissions || ['read'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_used: null,
            usage_count: 0
        };
        
        await fs.writeFile(
            path.join(this.credentialsDir, `${id}.json`),
            JSON.stringify(stored, null, 2)
        );
        
        // Return without the actual encrypted value for security
        return {
            id: stored.id,
            name: stored.name,
            type: stored.type,
            service: stored.service,
            description: stored.description,
            owner: stored.owner,
            permissions: stored.permissions,
            created_at: stored.created_at,
            updated_at: stored.updated_at
        };
    }

    /**
     * Get credential (optionally with decrypted value)
     */
    async getCredential(id, includeValue = false) {
        const filePath = path.join(this.credentialsDir, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        const credential = JSON.parse(content);
        
        const result = {
            id: credential.id,
            name: credential.name,
            type: credential.type,
            service: credential.service,
            description: credential.description,
            owner: credential.owner,
            permissions: credential.permissions,
            created_at: credential.created_at,
            updated_at: credential.updated_at,
            last_used: credential.last_used,
            usage_count: credential.usage_count
        };
        
        if (includeValue) {
            result.value = this.decrypt(credential.encrypted);
            
            // Update usage tracking
            credential.last_used = new Date().toISOString();
            credential.usage_count = (credential.usage_count || 0) + 1;
            await fs.writeFile(filePath, JSON.stringify(credential, null, 2));
        }
        
        return result;
    }

    /**
     * List all credentials (metadata only)
     */
    async listCredentials() {
        await fs.mkdir(this.credentialsDir, { recursive: true });
        const files = await fs.readdir(this.credentialsDir);
        const credentials = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.readFile(
                        path.join(this.credentialsDir, file),
                        'utf-8'
                    );
                    const cred = JSON.parse(content);
                    credentials.push({
                        id: cred.id,
                        name: cred.name,
                        type: cred.type,
                        service: cred.service,
                        description: cred.description,
                        owner: cred.owner,
                        permissions: cred.permissions,
                        created_at: cred.created_at,
                        updated_at: cred.updated_at,
                        last_used: cred.last_used,
                        usage_count: cred.usage_count
                    });
                } catch (e) {
                    console.error(`Error reading credential ${file}:`, e.message);
                }
            }
        }
        
        return credentials;
    }

    /**
     * Delete a credential
     */
    async deleteCredential(id) {
        const filePath = path.join(this.credentialsDir, `${id}.json`);
        await fs.unlink(filePath);
        return { success: true, id };
    }

    // ============================================
    // RESOURCE BOOKING
    // ============================================

    /**
     * Create a resource (server, GPU, etc.)
     */
    async createResource(resource) {
        await fs.mkdir(this.resourcesDir, { recursive: true });
        
        const id = resource.id || `res-${Date.now()}`;
        const stored = {
            id: id,
            name: resource.name,
            type: resource.type, // 'server', 'gpu', 'service', 'license'
            description: resource.description || '',
            specs: resource.specs || {},
            status: resource.status || 'available',
            cost_per_hour: resource.cost_per_hour || 0,
            max_booking_hours: resource.max_booking_hours || 24,
            owner: resource.owner || 'system',
            tags: resource.tags || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        await fs.writeFile(
            path.join(this.resourcesDir, `${id}.json`),
            JSON.stringify(stored, null, 2)
        );
        
        return stored;
    }

    /**
     * Get a resource
     */
    async getResource(id) {
        const filePath = path.join(this.resourcesDir, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }

    /**
     * List all resources
     */
    async listResources() {
        await fs.mkdir(this.resourcesDir, { recursive: true });
        const files = await fs.readdir(this.resourcesDir);
        const resources = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.readFile(
                        path.join(this.resourcesDir, file),
                        'utf-8'
                    );
                    resources.push(JSON.parse(content));
                } catch (e) {
                    console.error(`Error reading resource ${file}:`, e.message);
                }
            }
        }
        
        return resources;
    }

    /**
     * Book a resource
     */
    async bookResource(booking) {
        await fs.mkdir(this.bookingsDir, { recursive: true });
        
        const id = booking.id || `book-${Date.now()}`;
        const resource = await this.getResource(booking.resource_id);
        
        // Check if resource is available for the time slot
        const conflicts = await this.checkBookingConflicts(
            booking.resource_id,
            new Date(booking.start_time),
            new Date(booking.end_time)
        );
        
        if (conflicts.length > 0) {
            throw new Error(`Resource is already booked during this time: ${conflicts.map(c => c.id).join(', ')}`);
        }
        
        // Calculate cost
        const hours = (new Date(booking.end_time) - new Date(booking.start_time)) / (1000 * 60 * 60);
        const estimated_cost = hours * (resource.cost_per_hour || 0);
        
        const stored = {
            id: id,
            resource_id: booking.resource_id,
            resource_name: resource.name,
            booked_by: booking.booked_by,
            agent_id: booking.agent_id || null,
            purpose: booking.purpose || '',
            start_time: booking.start_time,
            end_time: booking.end_time,
            status: 'confirmed',
            estimated_cost: estimated_cost,
            actual_cost: null,
            notes: booking.notes || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        await fs.writeFile(
            path.join(this.bookingsDir, `${id}.json`),
            JSON.stringify(stored, null, 2)
        );
        
        return stored;
    }

    /**
     * Check for booking conflicts
     */
    async checkBookingConflicts(resourceId, startTime, endTime) {
        const bookings = await this.listBookings();
        const conflicts = [];
        
        for (const booking of bookings) {
            if (booking.resource_id !== resourceId) continue;
            if (booking.status === 'cancelled') continue;
            
            const bookStart = new Date(booking.start_time);
            const bookEnd = new Date(booking.end_time);
            
            // Check for overlap
            if (startTime < bookEnd && endTime > bookStart) {
                conflicts.push(booking);
            }
        }
        
        return conflicts;
    }

    /**
     * List all bookings
     */
    async listBookings(filters = {}) {
        await fs.mkdir(this.bookingsDir, { recursive: true });
        const files = await fs.readdir(this.bookingsDir);
        let bookings = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.readFile(
                        path.join(this.bookingsDir, file),
                        'utf-8'
                    );
                    bookings.push(JSON.parse(content));
                } catch (e) {
                    console.error(`Error reading booking ${file}:`, e.message);
                }
            }
        }
        
        // Apply filters
        if (filters.resource_id) {
            bookings = bookings.filter(b => b.resource_id === filters.resource_id);
        }
        if (filters.agent_id) {
            bookings = bookings.filter(b => b.agent_id === filters.agent_id);
        }
        if (filters.status) {
            bookings = bookings.filter(b => b.status === filters.status);
        }
        if (filters.from_date) {
            const fromDate = new Date(filters.from_date);
            bookings = bookings.filter(b => new Date(b.end_time) >= fromDate);
        }
        if (filters.to_date) {
            const toDate = new Date(filters.to_date);
            bookings = bookings.filter(b => new Date(b.start_time) <= toDate);
        }
        
        // Sort by start time
        bookings.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        return bookings;
    }

    /**
     * Cancel a booking
     */
    async cancelBooking(id) {
        const filePath = path.join(this.bookingsDir, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        const booking = JSON.parse(content);
        
        booking.status = 'cancelled';
        booking.updated_at = new Date().toISOString();
        
        await fs.writeFile(filePath, JSON.stringify(booking, null, 2));
        return booking;
    }

    // ============================================
    // COST TRACKING
    // ============================================

    /**
     * Record a cost entry
     */
    async recordCost(cost) {
        await fs.mkdir(this.costsDir, { recursive: true });
        
        const id = cost.id || `cost-${Date.now()}`;
        const stored = {
            id: id,
            type: cost.type, // 'api_usage', 'hosting', 'booking', 'license', 'other'
            category: cost.category || 'general',
            description: cost.description,
            amount: cost.amount,
            currency: cost.currency || 'USD',
            agent_id: cost.agent_id || null,
            resource_id: cost.resource_id || null,
            booking_id: cost.booking_id || null,
            metadata: cost.metadata || {},
            period_start: cost.period_start || new Date().toISOString(),
            period_end: cost.period_end || new Date().toISOString(),
            recorded_at: new Date().toISOString()
        };
        
        await fs.writeFile(
            path.join(this.costsDir, `${id}.json`),
            JSON.stringify(stored, null, 2)
        );
        
        return stored;
    }

    /**
     * Get cost summary
     */
    async getCostSummary(filters = {}) {
        await fs.mkdir(this.costsDir, { recursive: true });
        const files = await fs.readdir(this.costsDir);
        let costs = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.readFile(
                        path.join(this.costsDir, file),
                        'utf-8'
                    );
                    costs.push(JSON.parse(content));
                } catch (e) {
                    console.error(`Error reading cost ${file}:`, e.message);
                }
            }
        }
        
        // Apply filters
        if (filters.agent_id) {
            costs = costs.filter(c => c.agent_id === filters.agent_id);
        }
        if (filters.type) {
            costs = costs.filter(c => c.type === filters.type);
        }
        if (filters.from_date) {
            const fromDate = new Date(filters.from_date);
            costs = costs.filter(c => new Date(c.period_start) >= fromDate);
        }
        if (filters.to_date) {
            const toDate = new Date(filters.to_date);
            costs = costs.filter(c => new Date(c.period_end) <= toDate);
        }
        
        // Calculate summary
        const summary = {
            total: 0,
            by_type: {},
            by_category: {},
            by_agent: {},
            items: costs
        };
        
        for (const cost of costs) {
            summary.total += cost.amount;
            
            // By type
            summary.by_type[cost.type] = (summary.by_type[cost.type] || 0) + cost.amount;
            
            // By category
            summary.by_category[cost.category] = (summary.by_category[cost.category] || 0) + cost.amount;
            
            // By agent
            if (cost.agent_id) {
                summary.by_agent[cost.agent_id] = (summary.by_agent[cost.agent_id] || 0) + cost.amount;
            }
        }
        
        return summary;
    }

    // ============================================
    // QUOTA MANAGEMENT
    // ============================================

    /**
     * Set a quota
     */
    async setQuota(quota) {
        const quotasFile = path.join(this.baseDir, 'quotas.json');
        
        let quotas = {};
        try {
            const content = await fs.readFile(quotasFile, 'utf-8');
            quotas = JSON.parse(content);
        } catch (e) {
            // File doesn't exist yet
        }
        
        const id = quota.id || `quota-${quota.agent_id || 'global'}-${quota.type}`;
        quotas[id] = {
            id: id,
            agent_id: quota.agent_id || null, // null = global
            type: quota.type, // 'api_calls', 'cost', 'tokens', 'storage'
            limit: quota.limit,
            period: quota.period || 'monthly', // 'daily', 'weekly', 'monthly'
            warning_threshold: quota.warning_threshold || 0.8, // 80%
            hard_stop: quota.hard_stop !== false, // true by default
            current_usage: quota.current_usage || 0,
            period_start: quota.period_start || new Date().toISOString(),
            created_at: quota.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        await fs.writeFile(quotasFile, JSON.stringify(quotas, null, 2));
        return quotas[id];
    }

    /**
     * Get quotas
     */
    async getQuotas(agentId = null) {
        const quotasFile = path.join(this.baseDir, 'quotas.json');
        
        try {
            const content = await fs.readFile(quotasFile, 'utf-8');
            const quotas = JSON.parse(content);
            
            if (agentId) {
                // Return agent-specific quotas + global quotas
                return Object.values(quotas).filter(
                    q => q.agent_id === agentId || q.agent_id === null
                );
            }
            
            return Object.values(quotas);
        } catch (e) {
            return [];
        }
    }

    /**
     * Update quota usage
     */
    async updateQuotaUsage(quotaId, usage) {
        const quotasFile = path.join(this.baseDir, 'quotas.json');
        
        const content = await fs.readFile(quotasFile, 'utf-8');
        const quotas = JSON.parse(content);
        
        if (!quotas[quotaId]) {
            throw new Error(`Quota not found: ${quotaId}`);
        }
        
        quotas[quotaId].current_usage = usage;
        quotas[quotaId].updated_at = new Date().toISOString();
        
        await fs.writeFile(quotasFile, JSON.stringify(quotas, null, 2));
        
        // Check thresholds
        const quota = quotas[quotaId];
        const usagePercent = quota.current_usage / quota.limit;
        
        const result = {
            quota: quota,
            usage_percent: usagePercent,
            warning: usagePercent >= quota.warning_threshold,
            exceeded: usagePercent >= 1.0
        };
        
        return result;
    }

    /**
     * Check if quota allows an action
     */
    async checkQuota(agentId, type, amount = 1) {
        const quotas = await this.getQuotas(agentId);
        const relevant = quotas.filter(q => q.type === type);
        
        for (const quota of relevant) {
            const newUsage = quota.current_usage + amount;
            const usagePercent = newUsage / quota.limit;
            
            if (usagePercent >= 1.0 && quota.hard_stop) {
                return {
                    allowed: false,
                    quota: quota,
                    reason: `Quota exceeded for ${type}: ${quota.current_usage}/${quota.limit}`,
                    usage_percent: usagePercent
                };
            }
            
            if (usagePercent >= quota.warning_threshold) {
                return {
                    allowed: true,
                    quota: quota,
                    warning: `Approaching quota limit for ${type}: ${(usagePercent * 100).toFixed(1)}%`,
                    usage_percent: usagePercent
                };
            }
        }
        
        return { allowed: true };
    }

    /**
     * Reset quota for new period
     */
    async resetQuota(quotaId) {
        const quotasFile = path.join(this.baseDir, 'quotas.json');
        
        const content = await fs.readFile(quotasFile, 'utf-8');
        const quotas = JSON.parse(content);
        
        if (!quotas[quotaId]) {
            throw new Error(`Quota not found: ${quotaId}`);
        }
        
        quotas[quotaId].current_usage = 0;
        quotas[quotaId].period_start = new Date().toISOString();
        quotas[quotaId].updated_at = new Date().toISOString();
        
        await fs.writeFile(quotasFile, JSON.stringify(quotas, null, 2));
        return quotas[quotaId];
    }

    // ============================================
    // RESOURCE METRICS
    // ============================================

    /**
     * Get overall resource metrics
     */
    async getMetrics() {
        const [resources, bookings, credentials, costSummary, quotas] = await Promise.all([
            this.listResources(),
            this.listBookings(),
            this.listCredentials(),
            this.getCostSummary(),
            this.getQuotas()
        ]);
        
        const now = new Date();
        const activeBookings = bookings.filter(b => 
            b.status === 'confirmed' &&
            new Date(b.start_time) <= now &&
            new Date(b.end_time) >= now
        );
        
        const upcomingBookings = bookings.filter(b =>
            b.status === 'confirmed' &&
            new Date(b.start_time) > now
        ).slice(0, 5);
        
        const warningQuotas = quotas.filter(q => 
            (q.current_usage / q.limit) >= q.warning_threshold
        );
        
        return {
            resources: {
                total: resources.length,
                by_type: resources.reduce((acc, r) => {
                    acc[r.type] = (acc[r.type] || 0) + 1;
                    return acc;
                }, {}),
                available: resources.filter(r => r.status === 'available').length
            },
            bookings: {
                total: bookings.length,
                active: activeBookings.length,
                upcoming: upcomingBookings,
                today: bookings.filter(b => {
                    const start = new Date(b.start_time);
                    return start.toDateString() === now.toDateString();
                }).length
            },
            credentials: {
                total: credentials.length,
                by_type: credentials.reduce((acc, c) => {
                    acc[c.type] = (acc[c.type] || 0) + 1;
                    return acc;
                }, {}),
                recently_used: credentials.filter(c => c.last_used).length
            },
            costs: {
                total: costSummary.total,
                by_type: costSummary.by_type,
                by_agent: costSummary.by_agent
            },
            quotas: {
                total: quotas.length,
                warnings: warningQuotas.length,
                warning_details: warningQuotas.map(q => ({
                    id: q.id,
                    type: q.type,
                    agent_id: q.agent_id,
                    usage_percent: ((q.current_usage / q.limit) * 100).toFixed(1) + '%'
                }))
            }
        };
    }
}

module.exports = ResourceManager;
