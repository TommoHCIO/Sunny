// src/services/outcomeTracker.js
/**
 * Outcome Tracker Service - Records and analyzes AI interaction outcomes
 *
 * This service provides:
 * - Fire-and-forget outcome recording (non-blocking)
 * - Recent outcome retrieval with filtering
 * - Statistical aggregation using MongoDB pipelines
 *
 * Used by the AGI learning system to track performance metrics and
 * enable pattern analysis for model selection optimization.
 *
 * Follows singleton pattern (like other services in src/services/)
 */

const Outcome = require('../models/Outcome');

class OutcomeTracker {
    /**
     * Record the outcome of an AI interaction
     *
     * Uses fire-and-forget pattern - never throws errors, only logs them.
     * Missing required fields result in null return (graceful degradation).
     *
     * @param {Object} interaction - Interaction data
     * @param {string} interaction.userId - User ID (required)
     * @param {string} interaction.guildId - Guild ID (required)
     * @param {string} interaction.query - User message (required)
     * @param {boolean} interaction.success - Whether interaction succeeded (required)
     * @param {number} interaction.iterations - Number of agentic loop iterations
     * @param {Array<string>} interaction.toolsUsed - Tools executed
     * @param {Array<Object>} interaction.errors - Errors encountered
     * @param {number} interaction.duration - Total duration in milliseconds
     * @param {number} interaction.userSatisfaction - User feedback (-1, 0, 1)
     * @param {boolean} interaction.userReacted - Whether user provided feedback
     * @returns {Promise<Object|null>} Saved outcome or null on error
     */
    async recordOutcome(interaction) {
        try {
            // Validate required fields
            if (!interaction || !interaction.userId || !interaction.guildId || !interaction.query) {
                console.error('[OutcomeTracker] Missing required fields:', {
                    hasInteraction: !!interaction,
                    hasUserId: !!interaction?.userId,
                    hasGuildId: !!interaction?.guildId,
                    hasQuery: !!interaction?.query
                });
                return null;
            }

            // Build outcome document
            const outcomeData = {
                timestamp: new Date(),
                userId: interaction.userId,
                guildId: interaction.guildId,
                channelId: interaction.channelId,

                // Message data
                query: interaction.query,
                queryLength: interaction.query.length,
                hasAttachments: interaction.hasAttachments || false,

                // Complexity & Model Selection
                predictedComplexity: interaction.predictedComplexity,
                complexityScore: interaction.complexityScore,
                modelUsed: interaction.modelUsed,
                modelReasoning: interaction.modelReasoning,

                // Execution data
                iterations: interaction.iterations || 0,
                toolsUsed: interaction.toolsUsed || [],
                toolCount: (interaction.toolsUsed || []).length,
                errors: interaction.errors || [],
                duration: interaction.duration,

                // Outcome
                success: interaction.success !== undefined ? interaction.success : false,
                finishReason: interaction.finishReason,
                responseLength: interaction.responseLength,

                // User feedback
                userSatisfaction: interaction.userSatisfaction || 0,
                userReacted: interaction.userReacted || false,

                // Metadata
                instanceId: interaction.instanceId,
                executionId: interaction.executionId
            };

            // Create outcome document
            const outcome = await Outcome.create(outcomeData);

            console.log(`[OutcomeTracker] Recorded outcome: ${outcome._id} (success: ${outcome.success}, model: ${outcome.modelUsed}, iterations: ${outcome.iterations})`);

            return outcome;
        } catch (error) {
            console.error('[OutcomeTracker] Failed to record outcome:', error.message);
            console.error('[OutcomeTracker] Stack:', error.stack);
            return null; // Graceful failure - never break main execution
        }
    }

    /**
     * Get recent outcomes with optional filtering
     *
     * Returns lean documents (POJOs) for better performance.
     *
     * @param {Object} filters - MongoDB query filters
     * @param {number} limit - Maximum number of results (default: 1000)
     * @returns {Promise<Array>} Array of outcome documents
     */
    async getRecentOutcomes(filters = {}, limit = 1000) {
        try {
            const query = { ...filters };

            const outcomes = await Outcome.find(query)
                .sort({ timestamp: -1 }) // Most recent first
                .limit(limit)
                .lean(); // Returns POJOs (faster than Mongoose documents)

            return outcomes;
        } catch (error) {
            console.error('[OutcomeTracker] Failed to get recent outcomes:', error.message);
            return [];
        }
    }

    /**
     * Get statistics for a time period using MongoDB aggregation
     *
     * Calculates:
     * - Total interactions
     * - Success rate
     * - Average iterations
     * - Average duration
     * - User satisfaction breakdown
     * - Model usage distribution
     *
     * @param {number} days - Number of days to look back (default: 7)
     * @returns {Promise<Object|null>} Statistics object or null on error
     */
    async getStats(days = 7) {
        try {
            const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            // Aggregation pipeline for overall statistics
            const totalsResult = await Outcome.aggregate([
                { $match: { timestamp: { $gte: since } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        successful: {
                            $sum: { $cond: ['$success', 1, 0] }
                        },
                        avgIterations: { $avg: '$iterations' },
                        avgDuration: { $avg: '$duration' },
                        positive: {
                            $sum: { $cond: [{ $eq: ['$userSatisfaction', 1] }, 1, 0] }
                        },
                        negative: {
                            $sum: { $cond: [{ $eq: ['$userSatisfaction', -1] }, 1, 0] }
                        }
                    }
                }
            ]);

            const totals = totalsResult[0] || {
                total: 0,
                successful: 0,
                avgIterations: 0,
                avgDuration: 0,
                positive: 0,
                negative: 0
            };

            // Model usage breakdown
            const modelUsage = await Outcome.aggregate([
                { $match: { timestamp: { $gte: since } } },
                {
                    $group: {
                        _id: '$modelUsed',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            // Build model usage object
            const modelUsageObj = {};
            for (const item of modelUsage) {
                if (item._id) {
                    modelUsageObj[item._id] = item.count;
                }
            }

            return {
                period: days,
                total: totals.total,
                successRate: totals.total > 0 ? totals.successful / totals.total : 0,
                avgIterations: totals.avgIterations || 0,
                avgDuration: totals.avgDuration || 0,
                satisfaction: {
                    positive: totals.positive,
                    negative: totals.negative,
                    noReaction: totals.total - totals.positive - totals.negative
                },
                modelUsage: modelUsageObj
            };
        } catch (error) {
            console.error('[OutcomeTracker] Failed to get stats:', error.message);
            return null;
        }
    }
}

// Export singleton instance (follows pattern in codebase)
module.exports = new OutcomeTracker();
