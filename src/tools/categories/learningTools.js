// src/tools/categories/learningTools.js
/**
 * AGI Learning System Tools
 * 
 * Tools for monitoring and analyzing the AGI learning system's data collection
 * and performance. These tools provide insights into model selection accuracy,
 * tool reliability, and user satisfaction metrics.
 * 
 * Part of Phase 1 - Data Collection Infrastructure
 * 
 * @module learningTools
 */

/**
 * Get all learning system tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of learning tool definitions
 */
function getLearningTools(guild) {
    return [
        {
            name: "get_learning_stats",
            description: "Get quick learning system statistics (owner only). Shows data collection progress and system health. Use this to monitor AGI learning system performance.",
            input_schema: {
                type: "object",
                properties: {
                    metric: {
                        type: "string",
                        enum: ["summary", "models", "tools", "satisfaction"],
                        description: "Which metric to display: 'summary' (default) = overall stats, 'models' = model selection accuracy, 'tools' = tool usage/failures, 'satisfaction' = user feedback metrics"
                    }
                },
                required: []
            }
        }
    ];
}

module.exports = { getLearningTools };
