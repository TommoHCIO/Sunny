// src/services/agentService.js
/**
 * AI Agent Service - Multi-Provider Support
 * 
 * This service acts as a facade for multiple AI providers.
 * Supports:
 * - Anthropic Claude (3 Haiku, 3.5 Haiku, etc.)
 * - Z.AI GLM (4.5-Air, 4.5, 4.6)
 * 
 * The actual implementation is delegated to provider-specific modules
 * in the providers/ directory. Switch providers by changing the AI_PROVIDER
 * environment variable.
 * 
 * Usage:
 * AI_PROVIDER=anthropic  # Use Claude
 * AI_PROVIDER=zai        # Use Z.AI GLM
 */

const { getAIProvider } = require('./aiProviderFactory');

/**
 * Run the AI agent with agentic loop
 * 
 * Delegates to the configured provider (Anthropic or Z.AI).
 * The provider handles the agentic loop, tool execution, and response generation.
 * 
 * @param {string} userMessage - The user's message to process
 * @param {string} conversationContext - Recent conversation history formatted as string
 * @param {import('discord.js').User} author - Discord user who sent the message
 * @param {import('discord.js').Guild} guild - Discord guild where message was sent
 * @param {import('discord.js').TextChannel} channel - Discord channel where message was sent
 * @returns {Promise<string>} Final text response to send to user
 * @throws {Error} On configuration or API errors
 */
async function runAgent(userMessage, conversationContext, author, guild, channel) {
    const provider = getAIProvider();
    return await provider.runAgent(userMessage, conversationContext, author, guild, channel);
}

/**
 * Load personality prompt from configuration
 * 
 * Delegates to the configured provider.
 * 
 * @returns {Promise<string>} The personality prompt text
 */
async function loadPersonality() {
    const provider = getAIProvider();
    return await provider.loadPersonality();
}

module.exports = {
    runAgent,
    loadPersonality
};
