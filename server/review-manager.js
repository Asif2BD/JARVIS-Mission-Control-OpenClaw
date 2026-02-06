/**
 * Quality Control & Review System
 * 
 * Handles:
 * - Review Stages (DRAFT → REVIEW → APPROVED → DEPLOYED)
 * - Approval Workflows with multi-level approvals
 * - Quality Checklists for pre-deployment checks
 * - Feedback Loop (comments, revisions, re-submission)
 * - Quality Metrics (approval rates, review cycles, rejection analysis)
 */

const fs = require('fs').promises;
const path = require('path');

// Review stages
const REVIEW_STAGES = ['DRAFT', 'REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'DEPLOYED', 'REJECTED'];

class ReviewManager {
    constructor(missionControlDir) {
        this.baseDir = missionControlDir;
        this.reviewsDir = path.join(missionControlDir, 'reviews');
        this.checklistsDir = path.join(missionControlDir, 'checklists');
        this.workflowsDir = path.join(missionControlDir, 'workflows');
    }

    // ============================================
    // REVIEW SUBMISSIONS
    // ============================================

    /**
     * Create a review submission
     */
    async createReview(review) {
        await fs.mkdir(this.reviewsDir, { recursive: true });
        
        const id = review.id || `review-${Date.now()}`;
        const stored = {
            id: id,
            title: review.title,
            description: review.description || '',
            type: review.type || 'task',  // task, feature, document, deployment
            related_id: review.related_id || null,  // task_id, feature_id, etc.
            stage: 'DRAFT',
            submitter: review.submitter,
            submitter_agent: review.submitter_agent || null,
            assignees: review.assignees || [],
            priority: review.priority || 'normal',  // low, normal, high, critical
            
            // Workflow
            workflow_id: review.workflow_id || 'default',
            current_level: 0,
            required_approvals: review.required_approvals || 1,
            approvals: [],
            rejections: [],
            
            // Checklist
            checklist_id: review.checklist_id || null,
            checklist_items: [],
            checklist_completed: false,
            
            // Feedback
            comments: [],
            revision_count: 0,
            
            // Metadata
            attachments: review.attachments || [],
            tags: review.tags || [],
            
            // Timestamps
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            submitted_at: null,
            approved_at: null,
            deployed_at: null,
            
            // Metrics
            review_cycles: 0,
            total_review_time: 0
        };
        
        // Load checklist if specified
        if (stored.checklist_id) {
            try {
                const checklist = await this.getChecklist(stored.checklist_id);
                stored.checklist_items = checklist.items.map(item => ({
                    ...item,
                    checked: false,
                    checked_by: null,
                    checked_at: null
                }));
            } catch (e) {
                // Checklist not found, continue without
            }
        }
        
        await fs.writeFile(
            path.join(this.reviewsDir, `${id}.json`),
            JSON.stringify(stored, null, 2)
        );
        
        return stored;
    }

    /**
     * Get a review
     */
    async getReview(id) {
        const filePath = path.join(this.reviewsDir, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }

    /**
     * List all reviews
     */
    async listReviews(filters = {}) {
        await fs.mkdir(this.reviewsDir, { recursive: true });
        const files = await fs.readdir(this.reviewsDir);
        let reviews = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.readFile(
                        path.join(this.reviewsDir, file),
                        'utf-8'
                    );
                    reviews.push(JSON.parse(content));
                } catch (e) {
                    console.error(`Error reading review ${file}:`, e.message);
                }
            }
        }
        
        // Apply filters
        if (filters.stage) {
            reviews = reviews.filter(r => r.stage === filters.stage);
        }
        if (filters.submitter) {
            reviews = reviews.filter(r => r.submitter === filters.submitter);
        }
        if (filters.submitter_agent) {
            reviews = reviews.filter(r => r.submitter_agent === filters.submitter_agent);
        }
        if (filters.assignee) {
            reviews = reviews.filter(r => r.assignees.includes(filters.assignee));
        }
        if (filters.type) {
            reviews = reviews.filter(r => r.type === filters.type);
        }
        if (filters.priority) {
            reviews = reviews.filter(r => r.priority === filters.priority);
        }
        
        // Sort by updated_at, newest first
        reviews.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        return reviews;
    }

    /**
     * Save a review
     */
    async saveReview(review) {
        review.updated_at = new Date().toISOString();
        await fs.writeFile(
            path.join(this.reviewsDir, `${review.id}.json`),
            JSON.stringify(review, null, 2)
        );
        return review;
    }

    // ============================================
    // REVIEW WORKFLOW ACTIONS
    // ============================================

    /**
     * Submit review for approval
     */
    async submitForReview(reviewId, submitter) {
        const review = await this.getReview(reviewId);
        
        if (review.stage !== 'DRAFT' && review.stage !== 'CHANGES_REQUESTED') {
            throw new Error(`Cannot submit review in ${review.stage} stage`);
        }
        
        // Check if checklist is complete (if required)
        if (review.checklist_items.length > 0) {
            const requiredItems = review.checklist_items.filter(i => i.required);
            const incomplete = requiredItems.filter(i => !i.checked);
            if (incomplete.length > 0) {
                throw new Error(`Complete required checklist items before submitting: ${incomplete.map(i => i.name).join(', ')}`);
            }
        }
        
        review.stage = 'REVIEW';
        review.submitted_at = new Date().toISOString();
        review.review_cycles++;
        
        // Add submission comment
        review.comments.push({
            id: `comment-${Date.now()}`,
            type: 'system',
            author: submitter,
            content: review.revision_count > 0 
                ? `Resubmitted for review (revision ${review.revision_count})`
                : 'Submitted for review',
            timestamp: new Date().toISOString()
        });
        
        return this.saveReview(review);
    }

    /**
     * Approve a review
     */
    async approveReview(reviewId, approver, comment = '') {
        const review = await this.getReview(reviewId);
        
        if (review.stage !== 'REVIEW') {
            throw new Error(`Cannot approve review in ${review.stage} stage`);
        }
        
        // Prevent self-approval - submitters cannot approve their own reviews
        if (review.submitter === approver || review.submitter_agent === approver) {
            throw new Error('Cannot approve your own submission');
        }
        
        // Check if already approved by this user
        if (review.approvals.some(a => a.approver === approver)) {
            throw new Error(`Already approved by ${approver}`);
        }
        
        // Add approval
        review.approvals.push({
            approver: approver,
            comment: comment,
            timestamp: new Date().toISOString()
        });
        
        // Add approval comment
        review.comments.push({
            id: `comment-${Date.now()}`,
            type: 'approval',
            author: approver,
            content: comment || 'Approved',
            timestamp: new Date().toISOString()
        });
        
        // Check if we have enough approvals
        if (review.approvals.length >= review.required_approvals) {
            review.stage = 'APPROVED';
            review.approved_at = new Date().toISOString();
            
            // Calculate review time
            if (review.submitted_at) {
                review.total_review_time += 
                    new Date(review.approved_at) - new Date(review.submitted_at);
            }
        }
        
        return this.saveReview(review);
    }

    /**
     * Request changes
     */
    async requestChanges(reviewId, reviewer, feedback) {
        const review = await this.getReview(reviewId);
        
        if (review.stage !== 'REVIEW') {
            throw new Error(`Cannot request changes for review in ${review.stage} stage`);
        }
        
        review.stage = 'CHANGES_REQUESTED';
        review.revision_count++;
        
        // Add rejection entry
        review.rejections.push({
            reviewer: reviewer,
            feedback: feedback,
            timestamp: new Date().toISOString()
        });
        
        // Add feedback comment
        review.comments.push({
            id: `comment-${Date.now()}`,
            type: 'changes_requested',
            author: reviewer,
            content: feedback,
            timestamp: new Date().toISOString()
        });
        
        return this.saveReview(review);
    }

    /**
     * Reject a review
     */
    async rejectReview(reviewId, reviewer, reason) {
        const review = await this.getReview(reviewId);
        
        if (review.stage !== 'REVIEW') {
            throw new Error(`Cannot reject review in ${review.stage} stage`);
        }
        
        review.stage = 'REJECTED';
        
        // Add rejection entry
        review.rejections.push({
            reviewer: reviewer,
            feedback: reason,
            final: true,
            timestamp: new Date().toISOString()
        });
        
        // Add rejection comment
        review.comments.push({
            id: `comment-${Date.now()}`,
            type: 'rejection',
            author: reviewer,
            content: reason,
            timestamp: new Date().toISOString()
        });
        
        return this.saveReview(review);
    }

    /**
     * Mark as deployed
     */
    async markDeployed(reviewId, deployer, notes = '') {
        const review = await this.getReview(reviewId);
        
        if (review.stage !== 'APPROVED') {
            throw new Error(`Cannot deploy review in ${review.stage} stage. Must be APPROVED first.`);
        }
        
        review.stage = 'DEPLOYED';
        review.deployed_at = new Date().toISOString();
        
        // Add deployment comment
        review.comments.push({
            id: `comment-${Date.now()}`,
            type: 'deployment',
            author: deployer,
            content: notes || 'Deployed successfully',
            timestamp: new Date().toISOString()
        });
        
        return this.saveReview(review);
    }

    /**
     * Add comment to review
     */
    async addComment(reviewId, author, content, type = 'comment') {
        const review = await this.getReview(reviewId);
        
        review.comments.push({
            id: `comment-${Date.now()}`,
            type: type,
            author: author,
            content: content,
            timestamp: new Date().toISOString()
        });
        
        return this.saveReview(review);
    }

    // ============================================
    // CHECKLIST MANAGEMENT
    // ============================================

    /**
     * Create a checklist template
     */
    async createChecklist(checklist) {
        await fs.mkdir(this.checklistsDir, { recursive: true });
        
        const id = checklist.id || `checklist-${Date.now()}`;
        const stored = {
            id: id,
            name: checklist.name,
            description: checklist.description || '',
            type: checklist.type || 'general',  // general, deployment, code_review, documentation
            items: checklist.items.map((item, idx) => ({
                id: item.id || `item-${idx}`,
                name: item.name,
                description: item.description || '',
                required: item.required !== false,
                order: idx
            })),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        await fs.writeFile(
            path.join(this.checklistsDir, `${id}.json`),
            JSON.stringify(stored, null, 2)
        );
        
        return stored;
    }

    /**
     * Get a checklist
     */
    async getChecklist(id) {
        const filePath = path.join(this.checklistsDir, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }

    /**
     * List all checklists
     */
    async listChecklists() {
        await fs.mkdir(this.checklistsDir, { recursive: true });
        const files = await fs.readdir(this.checklistsDir);
        const checklists = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.readFile(
                        path.join(this.checklistsDir, file),
                        'utf-8'
                    );
                    checklists.push(JSON.parse(content));
                } catch (e) {
                    console.error(`Error reading checklist ${file}:`, e.message);
                }
            }
        }
        
        return checklists;
    }

    /**
     * Update checklist item on a review
     */
    async updateChecklistItem(reviewId, itemId, checked, checkedBy) {
        const review = await this.getReview(reviewId);
        
        const item = review.checklist_items.find(i => i.id === itemId);
        if (!item) {
            throw new Error(`Checklist item not found: ${itemId}`);
        }
        
        item.checked = checked;
        item.checked_by = checked ? checkedBy : null;
        item.checked_at = checked ? new Date().toISOString() : null;
        
        // Update checklist_completed flag
        const requiredItems = review.checklist_items.filter(i => i.required);
        review.checklist_completed = requiredItems.every(i => i.checked);
        
        return this.saveReview(review);
    }

    // ============================================
    // WORKFLOW TEMPLATES
    // ============================================

    /**
     * Create a workflow template
     */
    async createWorkflow(workflow) {
        await fs.mkdir(this.workflowsDir, { recursive: true });
        
        const id = workflow.id || `workflow-${Date.now()}`;
        const stored = {
            id: id,
            name: workflow.name,
            description: workflow.description || '',
            levels: workflow.levels || [
                { name: 'Review', required_approvals: 1, approvers: [] }
            ],
            auto_assign: workflow.auto_assign || false,
            default_checklist: workflow.default_checklist || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        await fs.writeFile(
            path.join(this.workflowsDir, `${id}.json`),
            JSON.stringify(stored, null, 2)
        );
        
        return stored;
    }

    /**
     * Get a workflow
     */
    async getWorkflow(id) {
        const filePath = path.join(this.workflowsDir, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }

    /**
     * List all workflows
     */
    async listWorkflows() {
        await fs.mkdir(this.workflowsDir, { recursive: true });
        const files = await fs.readdir(this.workflowsDir);
        const workflows = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await fs.readFile(
                        path.join(this.workflowsDir, file),
                        'utf-8'
                    );
                    workflows.push(JSON.parse(content));
                } catch (e) {
                    console.error(`Error reading workflow ${file}:`, e.message);
                }
            }
        }
        
        return workflows;
    }

    // ============================================
    // QUALITY METRICS
    // ============================================

    /**
     * Get quality metrics
     */
    async getMetrics(filters = {}) {
        const reviews = await this.listReviews(filters);
        
        const metrics = {
            total_reviews: reviews.length,
            by_stage: {},
            by_type: {},
            by_priority: {},
            
            // Approval metrics
            approval_rate: 0,
            avg_approvals_needed: 0,
            avg_review_cycles: 0,
            avg_review_time_hours: 0,
            
            // Rejection metrics
            rejection_rate: 0,
            changes_requested_rate: 0,
            
            // Recent activity
            submitted_this_week: 0,
            approved_this_week: 0,
            deployed_this_week: 0,
            
            // Top reviewers
            reviewers: {},
            submitters: {}
        };
        
        if (reviews.length === 0) return metrics;
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        let totalApprovals = 0;
        let totalReviewCycles = 0;
        let totalReviewTime = 0;
        let completedReviews = 0;
        
        for (const review of reviews) {
            // By stage
            metrics.by_stage[review.stage] = (metrics.by_stage[review.stage] || 0) + 1;
            
            // By type
            metrics.by_type[review.type] = (metrics.by_type[review.type] || 0) + 1;
            
            // By priority
            metrics.by_priority[review.priority] = (metrics.by_priority[review.priority] || 0) + 1;
            
            // Track reviewers
            for (const approval of review.approvals) {
                metrics.reviewers[approval.approver] = (metrics.reviewers[approval.approver] || 0) + 1;
            }
            
            // Track submitters
            const submitter = review.submitter_agent || review.submitter;
            metrics.submitters[submitter] = (metrics.submitters[submitter] || 0) + 1;
            
            // Calculate averages for completed reviews
            if (review.stage === 'APPROVED' || review.stage === 'DEPLOYED') {
                completedReviews++;
                totalApprovals += review.approvals.length;
                totalReviewCycles += review.review_cycles;
                totalReviewTime += review.total_review_time;
            }
            
            // Weekly activity
            if (review.submitted_at && new Date(review.submitted_at) > oneWeekAgo) {
                metrics.submitted_this_week++;
            }
            if (review.approved_at && new Date(review.approved_at) > oneWeekAgo) {
                metrics.approved_this_week++;
            }
            if (review.deployed_at && new Date(review.deployed_at) > oneWeekAgo) {
                metrics.deployed_this_week++;
            }
        }
        
        // Calculate rates
        const approvedOrDeployed = (metrics.by_stage['APPROVED'] || 0) + (metrics.by_stage['DEPLOYED'] || 0);
        const rejected = metrics.by_stage['REJECTED'] || 0;
        const changesRequested = metrics.by_stage['CHANGES_REQUESTED'] || 0;
        const totalDecided = approvedOrDeployed + rejected;
        
        if (totalDecided > 0) {
            metrics.approval_rate = ((approvedOrDeployed / totalDecided) * 100).toFixed(1);
            metrics.rejection_rate = ((rejected / totalDecided) * 100).toFixed(1);
        }
        
        if (reviews.length > 0) {
            metrics.changes_requested_rate = ((changesRequested / reviews.length) * 100).toFixed(1);
        }
        
        if (completedReviews > 0) {
            metrics.avg_approvals_needed = (totalApprovals / completedReviews).toFixed(1);
            metrics.avg_review_cycles = (totalReviewCycles / completedReviews).toFixed(1);
            metrics.avg_review_time_hours = ((totalReviewTime / completedReviews) / (1000 * 60 * 60)).toFixed(1);
        }
        
        return metrics;
    }

    /**
     * Get review summary for dashboard
     */
    async getSummary() {
        const reviews = await this.listReviews();
        
        return {
            total: reviews.length,
            pending_review: reviews.filter(r => r.stage === 'REVIEW').length,
            changes_requested: reviews.filter(r => r.stage === 'CHANGES_REQUESTED').length,
            approved: reviews.filter(r => r.stage === 'APPROVED').length,
            deployed: reviews.filter(r => r.stage === 'DEPLOYED').length,
            
            recent: reviews.slice(0, 5).map(r => ({
                id: r.id,
                title: r.title,
                stage: r.stage,
                submitter: r.submitter_agent || r.submitter,
                updated_at: r.updated_at
            }))
        };
    }
}

module.exports = ReviewManager;
