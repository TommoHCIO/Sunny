// src/models/ToolExecution.js
/**
 * ToolExecution Model - AGI Learning System
 * 
 * Tracks individual tool executions for reliability analysis and failure pattern detection.
 * Part of Phase 1 data collection infrastructure.
 * 
 * Pattern Analysis Goals (Phase 2):
 * - Identify tools with high failure rates
 * - Detect specific error patterns (permissions, rate limits, etc.)
 * - Correlate tool reliability with context (guild settings, user permissions)
 * - Inform tool selection and error handling improvements
 * 
 * Data Retention: 30 days via TTL index
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const toolExecutionSchema = new Schema({
    // Timestamp
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },

    // Tool identification
    toolName: {
        type: String,
        required: true,
        index: true
    },

    // Execution outcome
    success: {
        type: Boolean,
        required: true,
        index: true
    },

    errorMessage: {
        type: String,
        default: null
    },

    errorType: {
        type: String,
        enum: ['permission', 'rate_limit', 'invalid_args', 'api_error', 'timeout', 'unknown', null],
        default: null
    },

    // Performance metrics
    duration: {
        type: Number, // milliseconds
        required: true
    },

    // Context
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

    executionId: {
        type: String, // Links to Outcome via executionId
        index: true
    },

    // Tool arguments (for pattern analysis)
    argsHash: {
        type: String, // Hash of arguments to detect patterns without storing sensitive data
        default: null
    }
});

// ============================================================================
// COMPOUND INDEXES - Research-validated order (Equality > Range > Sort)
// ============================================================================

// Query: Find all executions of a specific tool sorted by time
toolExecutionSchema.index({ toolName: 1, timestamp: -1 });

// Query: Find failed executions by tool
toolExecutionSchema.index({ toolName: 1, success: 1, timestamp: -1 });

// Query: Find tool usage in a specific guild
toolExecutionSchema.index({ guildId: 1, timestamp: -1 });

// Query: Find failures by error type
toolExecutionSchema.index({ success: 1, errorType: 1, timestamp: -1 });

// ============================================================================
// TTL INDEX - Automatic 30-day data expiration
// ============================================================================
// Background task runs every 60 seconds
// Complies with data retention best practices
toolExecutionSchema.index(
    { timestamp: 1 },
    { expireAfterSeconds: 2592000 } // 30 days = 60 * 60 * 24 * 30
);

// ============================================================================
// MODEL
// ============================================================================

const ToolExecution = mongoose.model('ToolExecution', toolExecutionSchema);

module.exports = ToolExecution;
