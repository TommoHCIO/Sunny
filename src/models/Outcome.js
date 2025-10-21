// src/models/Outcome.js
/**
 * Outcome Model - Tracks AI interaction outcomes for learning system
 *
 * This model stores detailed information about every AI interaction including:
 * - Message complexity and model selection decisions
 * - Execution metrics (iterations, tools used, errors)
 * - Success/failure outcomes
 * - User satisfaction feedback (RLHF-style)
 *
 * Used by the AGI learning system to analyze patterns and improve model selection.
 *
 * TTL: 30 days (automatic cleanup via MongoDB TTL index)
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const outcomeSchema = new Schema({
    // Timing
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },

    // Identifiers
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
    channelId: String,

    // Message data
    query: {
        type: String,
        required: true
    },
    queryLength: Number,
    hasAttachments: {
        type: Boolean,
        default: false
    },

    // Complexity & Model Selection
    predictedComplexity: {
        type: String,
        enum: ['GREETING', 'SIMPLE', 'MODERATE', 'COMPLEX', 'TECHNICAL']
    },
    complexityScore: Number,
    modelUsed: {
        type: String,
        enum: ['glm-4.5-air', 'glm-4.6', 'claude-3-haiku', 'claude-3-5-haiku']
    },
    modelReasoning: String,

    // Execution data
    iterations: {
        type: Number,
        required: true,
        default: 0
    },
    toolsUsed: [String],
    toolCount: {
        type: Number,
        default: 0
    },
    errors: [{
        tool: String,
        error: String,
        _id: false // Don't create _id for subdocuments
    }],
    duration: Number, // milliseconds

    // Outcome
    success: {
        type: Boolean,
        required: true
    },
    finishReason: String,
    responseLength: Number,

    // User feedback (RLHF-style thumbs up/down)
    userSatisfaction: {
        type: Number,
        enum: [-1, 0, 1],
        default: 0
    },
    userReacted: {
        type: Boolean,
        default: false
    },

    // Metadata
    instanceId: String,
    executionId: String
});

// Compound indexes (research-validated order: Equality > Range > Sort)
// Used for time-series queries filtered by guild
outcomeSchema.index({ guildId: 1, timestamp: -1 });

// Used for model performance analysis
outcomeSchema.index({ modelUsed: 1, success: 1 });

// Used for failure analysis
outcomeSchema.index({ success: 1, timestamp: -1 });

// TTL index - automatically delete documents after 30 days
// MongoDB background task runs every 60 seconds
outcomeSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days in seconds

module.exports = mongoose.model('Outcome', outcomeSchema);
