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
        },
        {
            name: "analyze_outcomes",
            description: "Analyze AI interaction outcomes for learning insights (owner only). Provides detailed analysis of recent interactions with filtering options.",
            input_schema: {
                type: "object",
                properties: {
                    days: {
                        type: "number",
                        description: "Number of days to analyze (default: 7, max: 30)",
                        minimum: 1,
                        maximum: 30
                    },
                    filter_by: {
                        type: "string",
                        enum: ["all", "successful", "failed", "positive_feedback", "negative_feedback"],
                        description: "Filter outcomes by type (default: all)"
                    }
                },
                required: []
            }
        },
        {
            name: "review_patterns",
            description: "Review and approve/reject detected patterns from pattern analysis (owner only). Part of Phase 2 - Pattern Analysis. Shows patterns with confidence scores and suggested adjustments.",
            input_schema: {
                type: "object",
                properties: {
                    pattern_type: {
                        type: "string",
                        enum: ["all", "model_accuracy", "tool_reliability", "complexity_correlation", "satisfaction_pattern"],
                        description: "Filter by pattern type (default: all)"
                    },
                    min_confidence: {
                        type: "string",
                        enum: ["low", "medium", "high"],
                        description: "Minimum confidence level (default: medium)"
                    }
                },
                required: []
            }
        },
        {
            name: "run_pattern_analysis",
            description: "Manually trigger pattern analysis (owner only). Normally runs weekly on Sundays at midnight UTC. Requires minimum 100 outcomes in last 7 days.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        }
    ];
}

module.exports = { getLearningTools };
