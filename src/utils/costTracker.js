// src/utils/costTracker.js
/**
 * Cost Tracking Utility
 * 
 * Tracks token usage and estimated costs across AI providers.
 * Useful for monitoring expenses and comparing provider costs.
 * 
 * Pricing (per 1M tokens):
 * - Claude 3 Haiku: $0.25 / $1.25 (input/output)
 * - Claude 3.5 Haiku: $0.80 / $4.00
 * - Z.AI GLM-4.5-Air: $0.20 / $1.10
 * - Z.AI GLM-4.5: $0.60 / $2.20
 */

let totalTokens = {
    input: 0,
    output: 0
};

let providerCounts = {
    anthropic: { input: 0, output: 0, calls: 0 },
    zai: { input: 0, output: 0, calls: 0 }
};

// Pricing per 1M tokens
const PRICING = {
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'glm-4.5-air': { input: 0.20, output: 1.10 },
    'glm-4.5': { input: 0.60, output: 2.20 },
    'glm-4.6': { input: 0.60, output: 2.20 }
};

/**
 * Track cost from an API response
 * @param {Object} response - API response with usage data
 * @param {string} provider - Provider name ('anthropic' or 'zai')
 * @param {string} model - Model name
 */
function trackCost(response, provider = 'unknown', model = 'unknown') {
    if (response.usage) {
        const inputTokens = response.usage.prompt_tokens || response.usage.input_tokens || 0;
        const outputTokens = response.usage.completion_tokens || response.usage.output_tokens || 0;

        // Update totals
        totalTokens.input += inputTokens;
        totalTokens.output += outputTokens;

        // Update provider-specific counts
        if (providerCounts[provider]) {
            providerCounts[provider].input += inputTokens;
            providerCounts[provider].output += outputTokens;
            providerCounts[provider].calls += 1;
        }

        console.log(`💰 [Cost Tracker] ${provider}/${model}: ${inputTokens} in / ${outputTokens} out`);
    }
}

/**
 * Calculate cost for given tokens and model
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {string} model - Model name
 * @returns {Object} Cost breakdown
 */
function calculateCost(inputTokens, outputTokens, model) {
    const pricing = PRICING[model] || { input: 0, output: 0 };
    
    const inputCost = (inputTokens / 1000000) * pricing.input;
    const outputCost = (outputTokens / 1000000) * pricing.output;
    const totalCost = inputCost + outputCost;

    return {
        inputCost,
        outputCost,
        totalCost,
        formatted: {
            input: `$${inputCost.toFixed(6)}`,
            output: `$${outputCost.toFixed(6)}`,
            total: `$${totalCost.toFixed(6)}`
        }
    };
}

/**
 * Get cost report for all tracked usage
 * @param {string} model - Model name for pricing calculation
 * @returns {Object} Cost report
 */
function getCostReport(model) {
    const cost = calculateCost(totalTokens.input, totalTokens.output, model);

    return {
        tokens: totalTokens,
        providers: providerCounts,
        cost: cost.formatted,
        breakdown: {
            inputCost: cost.inputCost,
            outputCost: cost.outputCost,
            totalCost: cost.totalCost
        }
    };
}

/**
 * Get monthly cost projection based on current usage
 * @param {string} model - Model name
 * @param {number} hoursSinceStart - Hours since tracking started
 * @returns {Object} Monthly projection
 */
function getMonthlyProjection(model, hoursSinceStart) {
    if (hoursSinceStart <= 0) return null;

    const cost = calculateCost(totalTokens.input, totalTokens.output, model);
    const costPerHour = cost.totalCost / hoursSinceStart;
    const hoursPerMonth = 24 * 30; // Approximate
    const monthlyProjection = costPerHour * hoursPerMonth;

    return {
        costPerHour: `$${costPerHour.toFixed(4)}`,
        monthlyProjection: `$${monthlyProjection.toFixed(2)}`,
        breakdown: {
            hourly: costPerHour,
            monthly: monthlyProjection
        }
    };
}

/**
 * Reset all tracked costs
 */
function reset() {
    totalTokens = { input: 0, output: 0 };
    providerCounts = {
        anthropic: { input: 0, output: 0, calls: 0 },
        zai: { input: 0, output: 0, calls: 0 }
    };
    console.log('💰 [Cost Tracker] Reset all tracking data');
}

/**
 * Get comparison between two models
 * @param {string} model1 - First model
 * @param {string} model2 - Second model
 * @returns {Object} Cost comparison
 */
function compareModels(model1, model2) {
    const cost1 = calculateCost(totalTokens.input, totalTokens.output, model1);
    const cost2 = calculateCost(totalTokens.input, totalTokens.output, model2);
    
    const savings = cost1.totalCost - cost2.totalCost;
    const savingsPercent = ((savings / cost1.totalCost) * 100).toFixed(1);

    return {
        model1: { name: model1, cost: cost1.formatted.total },
        model2: { name: model2, cost: cost2.formatted.total },
        savings: `$${savings.toFixed(6)}`,
        savingsPercent: `${savingsPercent}%`,
        cheaper: cost2.totalCost < cost1.totalCost ? model2 : model1
    };
}

module.exports = {
    trackCost,
    calculateCost,
    getCostReport,
    getMonthlyProjection,
    compareModels,
    reset
};
