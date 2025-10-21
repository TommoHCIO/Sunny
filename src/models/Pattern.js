const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Pattern Model - Stores detected patterns from AI interaction analysis
 * Used in AGI Learning System Phase 2 (Pattern Analysis)
 */

const patternSchema = new Schema({
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
    
    // Pattern identification
    patternType: { 
        type: String, 
        enum: [
            'model_accuracy',           // Model selection accuracy patterns
            'tool_reliability',         // Tool success rate patterns
            'complexity_correlation',   // Message complexity vs iterations/tools
            'satisfaction_pattern'      // User satisfaction correlations
        ],
        required: true,
        index: true
    },
    
    // Statistical metrics (research-validated)
    confidence: { 
        type: String, 
        enum: ['high', 'medium', 'low'],
        required: true 
    },
    sampleCount: { 
        type: Number, 
        required: true,
        min: 1
    },
    statisticalSignificance: { 
        type: Number,  // p-value (threshold: p < 0.05)
        min: 0,
        max: 1
    },
    effectSize: { 
        type: Number   // Correlation coefficient (r), chi-square (χ²), etc.
    },
    
    // Pattern details
    description: { 
        type: String, 
        required: true,
        maxlength: 1000
    },
    data: { 
        type: Schema.Types.Mixed  // Flexible storage for pattern-specific metrics
    },
    
    // Actionable insights
    suggestedAdjustment: { 
        type: String, 
        required: true,
        maxlength: 500
    },
    estimatedImpact: { 
        type: String,  // e.g., "+15% satisfaction", "-2 avg iterations"
        maxlength: 200
    },
    
    // Approval workflow (human-in-the-loop)
    approved: { 
        type: Boolean, 
        default: false, 
        index: true 
    },
    reviewedBy: { 
        type: String  // Discord user ID
    },
    reviewedAt: { 
        type: Date 
    },
    
}, { 
    timestamps: true  // Adds createdAt, updatedAt
});

// Compound indexes for optimized queries
patternSchema.index({ guildId: 1, timestamp: -1 });
patternSchema.index({ guildId: 1, approved: 1, patternType: 1 });
patternSchema.index({ guildId: 1, confidence: 1 });

// TTL index: Auto-delete unapproved patterns after 90 days
// Approved patterns are kept indefinitely for Phase 3
patternSchema.index(
    { timestamp: 1 }, 
    { 
        expireAfterSeconds: 7776000,  // 90 days
        partialFilterExpression: { approved: false }
    }
);

// Virtual: Age of pattern in days
patternSchema.virtual('ageInDays').get(function() {
    return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60 * 60 * 24));
});

// Static method: Get pending review patterns
patternSchema.statics.getPendingReview = function(guildId, minConfidence = 'medium', patternType = null) {
    const confidenceLevels = {
        low: ['low', 'medium', 'high'],
        medium: ['medium', 'high'],
        high: ['high']
    };
    
    const query = {
        guildId,
        approved: false,
        confidence: { $in: confidenceLevels[minConfidence] }
    };
    
    if (patternType && patternType !== 'all') {
        query.patternType = patternType;
    }
    
    return this.find(query)
        .sort({ confidence: -1, timestamp: -1 })
        .limit(5);
};

// Instance method: Approve pattern
patternSchema.methods.approvePattern = function(userId) {
    this.approved = true;
    this.reviewedBy = userId;
    this.reviewedAt = new Date();
    return this.save();
};

module.exports = mongoose.model('Pattern', patternSchema);
