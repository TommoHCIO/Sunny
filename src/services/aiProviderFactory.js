// src/services/aiProviderFactory.js
/**
 * AI Provider Factory
 * 
 * Dynamically selects and returns the appropriate AI provider based on environment configuration.
 * Allows easy switching between Anthropic Claude and Z.AI GLM models.
 * 
 * Supported Providers:
 * - anthropic: Anthropic Claude (3 Haiku, 3.5 Haiku, etc.)
 * - zai: Z.AI GLM models (4.5-Air, 4.5, 4.6)
 * 
 * Usage:
 * const { getAIProvider } = require('./aiProviderFactory');
 * const provider = getAIProvider();
 * const response = await provider.runAgent(...);
 */

const anthropicProvider = require('./providers/anthropicProvider');
const zaiProvider = require('./providers/zaiProvider');

/**
 * Get the configured AI provider
 * 
 * @returns {Object} Provider object with runAgent and loadPersonality methods
 * @throws {Error} If unknown provider is configured
 */
function getAIProvider() {
    const provider = process.env.AI_PROVIDER || 'anthropic';

    // Force logging to ensure it appears
    console.error(`🤖 [AI_PROVIDER_FACTORY] Using AI Provider: ${provider}`);
    console.error(`🔍 [AI_PROVIDER_FACTORY] ZAI_API_KEY set: ${!!process.env.ZAI_API_KEY}`);
    console.error(`🔍 [AI_PROVIDER_FACTORY] ZAI_BASE_URL: ${process.env.ZAI_BASE_URL}`);
    console.error(`🔍 [AI_PROVIDER_FACTORY] CLAUDE_API_KEY set: ${!!process.env.CLAUDE_API_KEY}`);

    switch (provider.toLowerCase()) {
        case 'zai':
            console.error(`✅ [AI_PROVIDER_FACTORY] Returning Z.AI provider`);
            return zaiProvider;
        case 'anthropic':
            console.error(`✅ [AI_PROVIDER_FACTORY] Returning Anthropic provider`);
            return anthropicProvider;
        default:
            throw new Error(`Unknown AI provider: ${provider}. Valid options: 'anthropic', 'zai'`);
    }
}

module.exports = {
    getAIProvider
};
