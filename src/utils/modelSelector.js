// src/utils/modelSelector.js
/**
 * Smart Model Selection for Z.AI
 * 
 * Intelligently chooses between GLM-4.6 (complex) and GLM-4.5-Air (simple)
 * based on message complexity and task requirements.
 * 
 * With Z.AI Lite subscription ($3/month with 50% off):
 * - GLM-4.5-Air: $0.10 input / $0.55 output per 1M tokens (VERY CHEAP)
 * - GLM-4.6: $0.25 input / $0.875 output per 1M tokens (BEST QUALITY)
 * 
 * Strategy:
 * - Use 4.5-Air for 80% of requests (simple tasks, greetings, single operations)
 * - Use 4.6 for 20% of requests (complex reasoning, multi-step workflows, creative tasks)
 * 
 * Expected monthly cost: $5-10 (down from $30-50 with Claude!)
 */

const messageComplexity = require('./messageComplexity');

class ModelSelector {
    constructor() {
        // Model definitions
        this.models = {
            SIMPLE: 'glm-4.5-air',   // Fast, cheap, good for 80% of tasks
            COMPLEX: 'glm-4.6'        // Best quality, for complex reasoning
        };

        // Track usage for logging
        this.usageStats = {
            'glm-4.5-air': 0,
            'glm-4.6': 0
        };

        // Complex task indicators (triggers GLM-4.6)
        this.complexTaskPatterns = {
            multiStep: /\b(and then|after that|also|plus|set up|configure|create a system|build)\b/i,
            deepReasoning: /\b(why|explain|how does|analyze|investigate|determine|figure out|understand)\b/i,
            creative: /\b(generate|create|write|compose|design|come up with|think of)\b/i,
            longConversation: false, // Set dynamically based on context length
            multiTool: false // Set dynamically if multiple tools likely needed
        };

        // Patterns that FORCE simple model (overrides complexity)
        this.forceSimplePatterns = {
            greetings: /^(hi|hello|hey|sup|yo|morning|evening|night|bye|thanks|ty|ok)\b/i,
            singleAction: /^(list|show|get|delete|rename|kick|ban|timeout|remove)\s+/i,
            statusCheck: /^(what|who|when|is)\s+.*\?$/i
        };
    }

    /**
     * Select the best model for a given message
     * 
     * @param {string} userMessage - The user's message
     * @param {string} conversationContext - Recent conversation history
     * @param {boolean} isOwner - Whether user is server owner
     * @returns {Object} Selected model info with reasoning
     */
    selectModel(userMessage, conversationContext = '', isOwner = false) {
        const cleanMessage = userMessage.toLowerCase().trim();
        
        // Get base complexity analysis
        const complexityAnalysis = messageComplexity.getComplexitySummary(userMessage, false);
        const { complexity, wordCount } = complexityAnalysis;

        // Check for patterns that FORCE simple model
        for (const [pattern, regex] of Object.entries(this.forceSimplePatterns)) {
            if (regex.test(cleanMessage)) {
                return this._buildResult(
                    this.models.SIMPLE,
                    'FORCED_SIMPLE',
                    `Matched force-simple pattern: ${pattern}`,
                    complexity
                );
            }
        }

        // Analyze conversation length (long conversations need better reasoning)
        const conversationWordCount = conversationContext.split(/\s+/).length;
        const isLongConversation = conversationWordCount > 500; // ~8+ message exchanges

        // Check for complex task patterns
        let complexityScore = 0;
        let reasonFlags = [];

        if (this.complexTaskPatterns.multiStep.test(cleanMessage)) {
            complexityScore += 2;
            reasonFlags.push('multi-step workflow');
        }

        if (this.complexTaskPatterns.deepReasoning.test(cleanMessage)) {
            complexityScore += 2;
            reasonFlags.push('deep reasoning required');
        }

        if (this.complexTaskPatterns.creative.test(cleanMessage)) {
            complexityScore += 1;
            reasonFlags.push('creative task');
        }

        if (isLongConversation) {
            complexityScore += 1;
            reasonFlags.push('long conversation context');
        }

        // Check if message likely needs multiple tools
        const potentialToolCount = (cleanMessage.match(/\b(create|delete|add|remove|set|configure|assign|give|take)\b/gi) || []).length;
        if (potentialToolCount >= 3) {
            complexityScore += 2;
            reasonFlags.push(`${potentialToolCount} potential tool operations`);
        }

        // Base complexity scoring
        if (complexity === 'TECHNICAL') {
            complexityScore += 3;
            reasonFlags.push('technical complexity');
        } else if (complexity === 'COMPLEX') {
            complexityScore += 2;
            reasonFlags.push('complex message');
        } else if (complexity === 'MODERATE') {
            complexityScore += 1;
            reasonFlags.push('moderate complexity');
        }

        // Message length scoring
        if (wordCount > 30) {
            complexityScore += 1;
            reasonFlags.push(`long message (${wordCount} words)`);
        }

        // Decision: Use GLM-4.6 if complexity score >= 3
        const shouldUseComplexModel = complexityScore >= 3;

        if (shouldUseComplexModel) {
            return this._buildResult(
                this.models.COMPLEX,
                'COMPLEX_REASONING',
                reasonFlags.join(', '),
                complexity,
                complexityScore
            );
        } else {
            return this._buildResult(
                this.models.SIMPLE,
                'SIMPLE_TASK',
                reasonFlags.length > 0 ? reasonFlags.join(', ') : 'simple task, single operation',
                complexity,
                complexityScore
            );
        }
    }

    /**
     * Build model selection result object
     * @private
     */
    _buildResult(modelName, category, reasoning, messageComplexity, score = 0) {
        // Track usage
        this.usageStats[modelName]++;

        return {
            model: modelName,
            category,
            reasoning,
            messageComplexity,
            complexityScore: score,
            costs: this._getModelCosts(modelName),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get cost information for a model
     * @private
     */
    _getModelCosts(modelName) {
        const costs = {
            'glm-4.5-air': {
                input: 0.10,  // $ per 1M tokens
                output: 0.55,
                description: 'Extremely cheap, fast responses'
            },
            'glm-4.6': {
                input: 0.25,
                output: 0.875,
                description: 'Best quality, complex reasoning'
            }
        };

        return costs[modelName] || costs['glm-4.5-air'];
    }

    /**
     * Get usage statistics
     * @returns {Object} Usage stats and cost estimates
     */
    getUsageStats() {
        const total = this.usageStats['glm-4.5-air'] + this.usageStats['glm-4.6'];
        
        if (total === 0) {
            return {
                total: 0,
                breakdown: this.usageStats,
                percentages: {
                    'glm-4.5-air': 0,
                    'glm-4.6': 0
                },
                recommendation: 'No usage data yet'
            };
        }

        const percentages = {
            'glm-4.5-air': ((this.usageStats['glm-4.5-air'] / total) * 100).toFixed(1),
            'glm-4.6': ((this.usageStats['glm-4.6'] / total) * 100).toFixed(1)
        };

        return {
            total,
            breakdown: this.usageStats,
            percentages,
            recommendation: percentages['glm-4.5-air'] >= 70 
                ? '✅ Good balance - mostly using cheap model'
                : '⚠️  Using expensive model too often - check complexity detection'
        };
    }

    /**
     * Reset usage statistics
     */
    resetStats() {
        this.usageStats['glm-4.5-air'] = 0;
        this.usageStats['glm-4.6'] = 0;
    }

    /**
     * Log model selection decision
     * @param {Object} selection - Model selection result
     * @param {string} username - User who triggered the selection
     */
    logSelection(selection, username = 'unknown') {
        const emoji = selection.model === 'glm-4.6' ? '🧠' : '⚡';
        console.log(`${emoji} [MODEL_SELECTOR] Selected ${selection.model.toUpperCase()} for ${username}`);
        console.log(`   Category: ${selection.category}`);
        console.log(`   Reasoning: ${selection.reasoning}`);
        console.log(`   Complexity Score: ${selection.complexityScore}`);
        console.log(`   Cost: $${selection.costs.input}/$${selection.costs.output} per 1M tokens`);
    }
}

// Export singleton instance
module.exports = new ModelSelector();
