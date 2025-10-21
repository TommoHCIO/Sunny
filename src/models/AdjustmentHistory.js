const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * AdjustmentHistory Model - AGI Learning System Phase 3 (Self-Adjustment)
 * Tracks all autonomous adjustments made by the learning system
 * 
 * Features:
 * - Canary rollout tracking (5% → 25% → 50% → 75% → 100%)
 * - A/B testing metrics (control vs treatment groups)
 * - Automatic rollback on performance degradation
 * - Complete adjustment lifecycle tracking
 * - Statistical significance validation
 */

const adjustmentHistorySchema = new Schema({
    timestamp: { 
        type: Date, 
        default: Date.now, 
        required: true, 
        index: true 
    },
    guildId: { 
        type: String, 
        required: true, 
        index: true 
    },
    
    // Pattern that triggered this adjustment
    patternId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Pattern', 
        required: true,
        index: true
    },
    patternType: { 
        type: String, 
        required: true 
    },
    
    // Adjustment details
    adjustmentType: {
        type: String,
        enum: ['model_preference', 'tool_usage', 'complexity_threshold', 'response_strategy'],
        required: true,
        index: true
    },
    description: { 
        type: String, 
        required: true,
        maxlength: 1000
    },
    
    // Configuration versioning
    previousConfiguration: { 
        type: Schema.Types.Mixed, 
        required: true 
    }, // Old config (for rollback)
    newConfiguration: { 
        type: Schema.Types.Mixed, 
        required: true 
    }, // New config
    
    // Canary rollout status
    rolloutStage: {
        type: String,
        enum: ['pending_approval', 'canary_5', 'canary_25', 'canary_50', 'canary_75', 'full_100', 'rolled_back', 'failed'],
        default: 'pending_approval',
        index: true
    },
    rolloutProgress: { 
        type: Number, 
        default: 0, 
        min: 0, 
        max: 100 
    },
    
    // A/B testing metrics - Control group (no adjustment)
    controlGroup: {
        samples: { type: Number, default: 0 },
        successCount: { type: Number, default: 0 },
        successRate: { type: Number, default: 0 },
        avgIterations: { type: Number, default: 0 },
        avgSatisfaction: { type: Number, default: 0 },
        errorCount: { type: Number, default: 0 }
    },
    
    // A/B testing metrics - Treatment group (with adjustment)
    treatmentGroup: {
        samples: { type: Number, default: 0 },
        successCount: { type: Number, default: 0 },
        successRate: { type: Number, default: 0 },
        avgIterations: { type: Number, default: 0 },
        avgSatisfaction: { type: Number, default: 0 },
        errorCount: { type: Number, default: 0 }
    },
    
    // Statistical significance (research-validated thresholds)
    pValue: { type: Number }, // < 0.05 for significance
    effectSize: { type: Number }, // Improvement percentage
    confidenceLevel: { type: Number, default: 0.95 },
    isSignificant: { type: Boolean, default: false },
    
    // Approval & rollback workflow
    approvedBy: { type: String }, // Discord user ID
    approvedAt: { type: Date },
    rejectedBy: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    
    rolledBackAt: { type: Date },
    rollbackReason: { type: String },
    autoRollbackTriggered: { type: Boolean, default: false },
    
    // Safety metrics
    performanceDrop: { type: Number, default: 0 }, // % drop from baseline
    successRateDrop: { type: Number, default: 0 },
    satisfactionDrop: { type: Number, default: 0 },
    errorRateIncrease: { type: Number, default: 0 },
    
    // Rollout stage progression timestamps
    stageTimestamps: {
        canary_5: { type: Date },
        canary_25: { type: Date },
        canary_50: { type: Date },
        canary_75: { type: Date },
        full_100: { type: Date }
    },
    
    // Status
    status: {
        type: String,
        enum: ['pending_approval', 'active', 'completed', 'rolled_back', 'rejected', 'failed'],
        default: 'pending_approval',
        index: true
    },
    
    // Completion
    completedAt: { type: Date },
    
}, { 
    timestamps: true  // Adds createdAt, updatedAt
});

// Compound indexes for optimized queries
adjustmentHistorySchema.index({ guildId: 1, status: 1, timestamp: -1 });
adjustmentHistorySchema.index({ guildId: 1, rolloutStage: 1 });
adjustmentHistorySchema.index({ guildId: 1, adjustmentType: 1, status: 1 });
adjustmentHistorySchema.index({ status: 1, rolloutStage: 1 });

// TTL indexes: Auto-delete based on status
// Failed/rolled-back: 30 days
adjustmentHistorySchema.index(
    { timestamp: 1 }, 
    { 
        expireAfterSeconds: 2592000,  // 30 days
        partialFilterExpression: { 
            status: { $in: ['failed', 'rolled_back', 'rejected'] } 
        }
    }
);

// Completed: Keep for 1 year (365 days)
adjustmentHistorySchema.index(
    { completedAt: 1 },
    {
        expireAfterSeconds: 31536000,  // 365 days
        partialFilterExpression: { status: 'completed' }
    }
);

// Virtual: Age of adjustment in days
adjustmentHistorySchema.virtual('ageInDays').get(function() {
    return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual: Treatment improvement percentage
adjustmentHistorySchema.virtual('improvementPercentage').get(function() {
    if (this.controlGroup.successRate === 0) return 0;
    return ((this.treatmentGroup.successRate - this.controlGroup.successRate) / this.controlGroup.successRate * 100).toFixed(2);
});

// Static method: Get active adjustments for a guild
adjustmentHistorySchema.statics.getActiveAdjustments = function(guildId, adjustmentType = null) {
    const query = {
        guildId,
        status: 'active',
        rolloutStage: { $in: ['canary_5', 'canary_25', 'canary_50', 'canary_75', 'full_100'] }
    };
    
    if (adjustmentType) {
        query.adjustmentType = adjustmentType;
    }
    
    return this.find(query).sort({ rolloutProgress: -1 });
};

// Static method: Get pending approval adjustments
adjustmentHistorySchema.statics.getPendingApproval = function(guildId) {
    return this.find({
        guildId,
        status: 'pending_approval',
        rolloutStage: 'pending_approval'
    }).sort({ timestamp: -1 });
};

// Instance method: Approve adjustment
adjustmentHistorySchema.methods.approve = function(userId) {
    this.status = 'active';
    this.rolloutStage = 'canary_5';
    this.rolloutProgress = 5;
    this.approvedBy = userId;
    this.approvedAt = new Date();
    this.stageTimestamps.canary_5 = new Date();
    return this.save();
};

// Instance method: Reject adjustment
adjustmentHistorySchema.methods.reject = function(userId, reason) {
    this.status = 'rejected';
    this.rejectedBy = userId;
    this.rejectedAt = new Date();
    this.rejectionReason = reason;
    return this.save();
};

// Instance method: Progress to next canary stage
adjustmentHistorySchema.methods.progressCanary = function() {
    const stages = {
        'canary_5': { next: 'canary_25', progress: 25 },
        'canary_25': { next: 'canary_50', progress: 50 },
        'canary_50': { next: 'canary_75', progress: 75 },
        'canary_75': { next: 'full_100', progress: 100 }
    };
    
    const current = stages[this.rolloutStage];
    if (current) {
        this.rolloutStage = current.next;
        this.rolloutProgress = current.progress;
        this.stageTimestamps[current.next] = new Date();
        
        // Mark as completed when reaching full rollout
        if (current.next === 'full_100') {
            this.status = 'completed';
            this.completedAt = new Date();
        }
    }
    
    return this.save();
};

// Instance method: Rollback adjustment
adjustmentHistorySchema.methods.rollback = function(reason, isAutomatic = false) {
    this.status = 'rolled_back';
    this.rolloutStage = 'rolled_back';
    this.rolledBackAt = new Date();
    this.rollbackReason = reason;
    this.autoRollbackTriggered = isAutomatic;
    return this.save();
};

// Instance method: Update A/B metrics
adjustmentHistorySchema.methods.updateMetrics = function(group, outcome) {
    const groupData = group === 'control' ? this.controlGroup : this.treatmentGroup;
    
    groupData.samples++;
    if (outcome.success) groupData.successCount++;
    if (outcome.error) groupData.errorCount++;
    
    // Recalculate averages
    groupData.successRate = groupData.successCount / groupData.samples;
    groupData.avgIterations = ((groupData.avgIterations * (groupData.samples - 1)) + outcome.iterations) / groupData.samples;
    
    if (outcome.userSatisfaction !== undefined && outcome.userSatisfaction !== 0) {
        const prevAvg = groupData.avgSatisfaction || 0;
        groupData.avgSatisfaction = ((prevAvg * (groupData.samples - 1)) + outcome.userSatisfaction) / groupData.samples;
    }
    
    return this.save();
};

module.exports = mongoose.model('AdjustmentHistory', adjustmentHistorySchema);
