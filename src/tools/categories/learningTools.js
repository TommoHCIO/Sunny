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
        },
        {
            name: "propose_adjustments",
            description: "View pending adjustment proposals from approved patterns (owner only). Part of Phase 3 - Self-Adjustment. Shows proposed autonomous improvements with human-in-the-loop approval workflow.",
            input_schema: {
                type: "object",
                properties: {
                    adjustment_type: {
                        type: "string",
                        enum: ["all", "model_preference", "tool_usage", "complexity_threshold", "response_strategy"],
                        description: "Filter by adjustment type (default: all)"
                    }
                },
                required: []
            }
        },
        {
            name: "approve_adjustment",
            description: "Approve an adjustment to start canary rollout (owner only). Starts at 5% traffic and progressively scales to 100% if A/B testing shows improvement.",
            input_schema: {
                type: "object",
                properties: {
                    adjustment_id: {
                        type: "string",
                        description: "The adjustment ID to approve (get from propose_adjustments)"
                    }
                },
                required: ["adjustment_id"]
            }
        },
        {
            name: "reject_adjustment",
            description: "Reject a proposed adjustment (owner only). Prevents the adjustment from being applied and marks it as rejected.",
            input_schema: {
                type: "object",
                properties: {
                    adjustment_id: {
                        type: "string",
                        description: "The adjustment ID to reject (get from propose_adjustments)"
                    },
                    reason: {
                        type: "string",
                        description: "Optional reason for rejection"
                    }
                },
                required: ["adjustment_id"]
            }
        },
        {
            name: "monitor_adjustments",
            description: "View A/B testing metrics for active adjustments (owner only). Shows control vs treatment group performance with statistical significance.",
            input_schema: {
                type: "object",
                properties: {
                    rollout_stage: {
                        type: "string",
                        enum: ["all", "canary_5", "canary_25", "canary_50", "canary_75", "full_100"],
                        description: "Filter by rollout stage (default: all active stages)"
                    }
                },
                required: []
            }
        },
        {
            name: "rollback_adjustment",
            description: "Manually trigger rollback of an active adjustment (owner only). Automatic rollback occurs if performance drops >10%.",
            input_schema: {
                type: "object",
                properties: {
                    adjustment_id: {
                        type: "string",
                        description: "The adjustment ID to rollback (get from monitor_adjustments)"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for manual rollback"
                    }
                },
                required: ["adjustment_id", "reason"]
            }
        },
        {
            name: "adjustment_history",
            description: "View complete adjustment history (owner only). Shows all past adjustments with outcomes, rollbacks, and A/B test results.",
            input_schema: {
                type: "object",
                properties: {
                    days: {
                        type: "number",
                        description: "Number of days to look back (default: 30, max: 365)",
                        minimum: 1,
                        maximum: 365
                    },
                    status: {
                        type: "string",
                        enum: ["all", "completed", "rolled_back", "failed", "rejected"],
                        description: "Filter by status (default: all)"
                    }
                },
                required: []
            }
        }
    ];
}

module.exports = { getLearningTools };
