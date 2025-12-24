// src/services/aiProviderFactory.js
/**
 * AI Provider Factory
 *
 * Dynamically selects and returns the appropriate AI provider based on environment configuration.
 *
 * Supported Providers:
 * - groq: Groq (FREE TIER - Llama 3.3 70B) - RECOMMENDED FOR FREE USAGE
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
const groqProvider = require('./providers/groqProvider');

/**
 * Get the configured AI provider
 *
 * @returns {Object} Provider object with runAgent and loadPersonality methods
 * @throws {Error} If unknown provider is configured
 */
function getAIProvider() {
    const provider = process.env.AI_PROVIDER || 'groq'; // Default to Groq (free tier)

    console.log(`🤖 [AI_PROVIDER_FACTORY] Using AI Provider: ${provider}`);

    switch (provider.toLowerCase()) {
        case 'groq':
            console.log(`✅ [AI_PROVIDER_FACTORY] Returning Groq provider (FREE - Llama 3.3 70B)`);
            if (!process.env.GROQ_API_KEY) {
                console.warn(`⚠️  GROQ_API_KEY not set! Get free key at: https://console.groq.com`);
            }
            return groqProvider;
        case 'zai':
            console.log(`✅ [AI_PROVIDER_FACTORY] Returning Z.AI provider`);
            return zaiProvider;
        case 'anthropic':
            console.log(`✅ [AI_PROVIDER_FACTORY] Returning Anthropic provider`);
            return anthropicProvider;
        default:
            throw new Error(`Unknown AI provider: ${provider}. Valid options: 'groq' (free), 'anthropic', 'zai'`);
    }
}

module.exports = {
    getAIProvider
};
