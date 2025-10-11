// src/models/Warning.js
/**
 * Warning Model - Persistent storage for moderation warnings
 * Replaces in-memory warning cache with MongoDB
 */

const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    reason: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'severe'],
        default: 'medium'
    },
    action: {
        type: String,
        enum: ['warning', 'timeout', 'kick', 'ban'],
        default: 'warning'
    },
    duration: {
        type: Number, // Timeout duration in milliseconds
        default: null
    },
    moderator: {
        type: String, // 'autonomous' or moderator user ID
        default: 'autonomous'
    },
    messageContent: {
        type: String, // The violating message content
        default: null
    },
    channelId: {
        type: String,
        default: null
    },
    expires: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Compound index for efficient user+guild queries
warningSchema.index({ userId: 1, guildId: 1, createdAt: -1 });

// Index for cleanup of expired warnings
warningSchema.index({ expires: 1 });

// Static method: Get active warnings for a user in a guild
warningSchema.statics.getActiveWarnings = async function(userId, guildId) {
    return this.find({
        userId,
        guildId,
        expires: { $gt: new Date() }
    }).sort({ createdAt: -1 });
};

// Static method: Count active warnings for a user
warningSchema.statics.countActiveWarnings = async function(userId, guildId) {
    return this.countDocuments({
        userId,
        guildId,
        expires: { $gt: new Date() }
    });
};

// Static method: Get warning history with optional time range
warningSchema.statics.getHistory = async function(userId, guildId, timeRange = null) {
    const query = { userId, guildId };
    
    if (timeRange) {
        const now = new Date();
        let startDate;
        
        switch(timeRange) {
            case '24h':
                startDate = new Date(now - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = null;
        }
        
        if (startDate) {
            query.createdAt = { $gte: startDate };
        }
    }
    
    return this.find(query).sort({ createdAt: -1 });
};

// Static method: Clean up expired warnings
warningSchema.statics.cleanupExpired = async function() {
    const result = await this.deleteMany({
        expires: { $lt: new Date() }
    });
    
    return result.deletedCount;
};

// Static method: Get moderation statistics for a guild
warningSchema.statics.getModerationStats = async function(guildId, timeRange = '24h') {
    const now = new Date();
    let startDate;
    
    switch(timeRange) {
        case '24h':
            startDate = new Date(now - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'all':
            startDate = new Date(0);
            break;
        default:
            startDate = new Date(now - 24 * 60 * 60 * 1000);
    }
    
    const pipeline = [
        {
            $match: {
                guildId,
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: '$action',
                count: { $sum: 1 }
            }
        }
    ];
    
    const actionCounts = await this.aggregate(pipeline);
    
    // Get unique users warned
    const uniqueUsers = await this.distinct('userId', {
        guildId,
        createdAt: { $gte: startDate }
    });
    
    // Get active warnings
    const activeWarnings = await this.countDocuments({
        guildId,
        expires: { $gt: now }
    });
    
    return {
        timeRange,
        totalActions: actionCounts.reduce((sum, item) => sum + item.count, 0),
        actionBreakdown: actionCounts,
        uniqueUsersWarned: uniqueUsers.length,
        activeWarnings
    };
};

const Warning = mongoose.model('Warning', warningSchema);

module.exports = Warning;
