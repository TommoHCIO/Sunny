// src/services/providers/anthropicProvider.js
/**
 * Anthropic Claude Provider
 * Implements the AI provider interface using Anthropic's Claude API
 * 
 * This is the original implementation extracted from agentService.js
 * Supports Claude 3 Haiku, Claude 3.5 Haiku, and other Anthropic models
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
const discordTools = require('../../tools/discordTools');
const toolExecutor = require('../../tools/toolExecutor');
const { retryWithBackoff } = require('../../utils/retry');
const { anthropicRateLimiter } = require('../../utils/rateLimiter');
const messageComplexity = require('../../utils/messageComplexity');

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY
});

// Load personality prompt once at startup
let personalityPrompt = null;

/**
 * Load personality prompt from configuration file
 */
async function loadPersonality() {
    if (!personalityPrompt) {
        const promptPath = path.join(__dirname, '../../../config/personality.txt');
        try {
            personalityPrompt = await fs.readFile(promptPath, 'utf-8');

            // Replace placeholders
            personalityPrompt = personalityPrompt
                .replace('[OWNER_ID]', process.env.DISCORD_OWNER_ID || 'Not Set')
                .replace('[OWNER_USERNAME]', 'Server Owner')
                .replace('[LEVEL_1_2_OR_3]', process.env.MODERATION_LEVEL || '2');
        } catch (error) {
            console.warn('⚠️  Could not load personality.txt, using default');
            personalityPrompt = getDefaultPersonality();
        }
    }
    return personalityPrompt;
}

/**
 * Get default personality prompt
 */
function getDefaultPersonality() {
    return `You are Sunny, the AI administrator and head moderator of The Nook, a cozy autumn-themed Discord community where everyone belongs.

You are warm, friendly, and welcoming. You use casual language and autumn-themed emojis like 🍂🍁☕🧡. You help members feel at home while keeping the community safe.

You have access to tools that let you inspect and manage the server. Use inspection tools (list_channels, list_roles, list_members) BEFORE making changes to see what exists.

Keep responses concise (2-4 sentences usually) but complete. Be genuinely helpful and maintain The Nook's cozy atmosphere.`;
}

/**
 * Run the AI agent with agentic loop (Anthropic Claude)
 */
async function runAgent(userMessage, conversationContext, author, guild, channel) {
    const personality = await loadPersonality();

    // Check if user is owner (supports multiple owners)
    const { isOwner } = require('../../utils/permissions');
    const isUserOwner = isOwner(author.id);
    const ownerStatus = isUserOwner ? ' (SERVER OWNER)' : '';

    // Get current date
    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Get channel info
    const channelInfo = channel ? `\nCurrent channel: #${channel.name} (ID: ${channel.id}, Category: ${channel.parent?.name || 'None'})` : '';

    // Analyze message complexity for response length guidance
    const complexitySummary = messageComplexity.getComplexitySummary(userMessage, false);
    console.log(`📊 Message complexity analysis:`, complexitySummary);

    // Build complexity hint for Claude
    const complexityHint = `
<message_analysis>
User message complexity: ${complexitySummary.complexity}
Response guideline: ${complexitySummary.guidelines}
Maximum sentences recommended: ${complexitySummary.maxSentences}
${complexitySummary.isListRequest ? 'Note: User is requesting a list - provide complete information but stay concise.' : ''}
</message_analysis>

IMPORTANT: Follow the response guideline above for appropriate length. Match the response depth to what the user needs.`;

    // Build initial user message with context
    const initialMessage = `${conversationContext}
${complexityHint}

Current date: ${currentDate}
Current user: ${author.username} (ID: ${author.id})${ownerStatus}${channelInfo}

${isOwner ? 'IMPORTANT: This user is the SERVER OWNER. You can execute owner-only tools when they request them.\n\n' : ''}
User message: ${userMessage}`;

    // Initialize conversation history
    let messages = [
        {
            role: 'user',
            content: initialMessage
        }
    ];

    // Get Discord tools
    const tools = discordTools.getDiscordTools(guild);

    console.log(`🤖 [Anthropic] Starting agentic loop for: ${author.username}`);

    let loopCount = 0;
    const startTime = Date.now();
    const maxTimeMs = 420000; // 7 minutes absolute safety limit
    const maxLoops = 50; // Soft limit, only for extreme edge cases

    try {
        // AGENTIC LOOP - The core of the AI agent
        while (loopCount < maxLoops) {
            loopCount++;
            const elapsedTime = Date.now() - startTime;
            console.log(`🔄 [Anthropic] Agent loop iteration ${loopCount} (${(elapsedTime/1000).toFixed(1)}s elapsed)`);

            // Check time-based safety limit
            if (elapsedTime > maxTimeMs) {
                console.error(`⏱️ Hit time limit (${maxTimeMs/1000}s) after ${loopCount} iterations`);
                return "I'm taking longer than expected on this! 🍂 Let me try a different approach - could you break this into smaller questions?";
            }

            // Apply rate limiting before calling Claude API
            await anthropicRateLimiter.removeTokens(1);

            // Call Claude with tools (with retry logic for transient failures)
            const response = await retryWithBackoff(
                () => anthropic.messages.create({
                model: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022',
                max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 3000,
                temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7,
                system: [
                    {
                        type: 'text',
                        text: personality,
                        cache_control: { type: 'ephemeral' }  // Cache personality for 5 min
                    },
                    {
                        type: 'text',
                        text: 'You have 100+ Discord management tools. CRITICAL: When using multi-step workflows (like reaction roles), always extract data from tool results (especially message_id) to use in subsequent tool calls. Read tool descriptions carefully for workflow patterns.',
                        cache_control: { type: 'ephemeral' }  // Cache tool guidance
                    }
                ],
                tools: tools,
                messages: messages
            }),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Claude API Call',
                onRetry: (attempt, error, delay) => {
                    console.log(`⚠️  Claude API retry ${attempt}/3 after ${delay}ms: ${error.message}`);
                }
            }
        );

            // Add assistant response to conversation history
            messages.push({
                role: 'assistant',
                content: response.content
            });

            // Check stop reason to determine next action
            console.log(`📊 Stop reason: ${response.stop_reason}`);

            if (response.stop_reason === 'end_turn') {
                // Claude is done - extract and return final text response
                const finalText = extractTextFromResponse(response);
                console.log(`✅ [Anthropic] Agent loop complete after ${loopCount} iterations`);
                return finalText;
            }

            if (response.stop_reason === 'tool_use') {
                // Claude wants to use tools - execute them and feed results back
                console.log(`🔧 [Anthropic] Claude requesting tool use`);

                const toolResults = [];

                // Process all tool use requests
                for (const block of response.content) {
                    if (block.type === 'tool_use') {
                        console.log(`  → Tool: ${block.name}`);

                        try {
                            // Execute the tool
                            const result = await toolExecutor.execute(
                                block.name,
                                block.input,
                                guild,
                                author
                            );

                            // Add tool result to results array
                            toolResults.push({
                                type: 'tool_result',
                                tool_use_id: block.id,
                                content: JSON.stringify(result || { success: false, error: 'Tool returned no result' })
                            });
                        } catch (error) {
                            console.error(`  ✗ Tool execution error:`, error);

                            toolResults.push({
                                type: 'tool_result',
                                tool_use_id: block.id,
                                content: JSON.stringify({
                                    success: false,
                                    error: error.message,
                                    tool: block.name
                                })
                            });
                        }
                    }
                }

                // Feed ALL tool results back to Claude
                messages.push({
                    role: 'user',
                    content: toolResults
                });

                continue;
            }

            if (response.stop_reason === 'max_tokens') {
                console.warn(`⚠️  Hit max tokens in loop iteration ${loopCount}`);
                return "I need to think about this in smaller steps! Let me try again with a simpler approach. 🍂";
            }

            // Handle other stop reasons
            console.warn(`⚠️  Unexpected stop reason: ${response.stop_reason}`);
            break;
        }

        // If we exit the loop without returning, we hit max loops
        if (loopCount >= maxLoops) {
            console.error(`❌ Hit max loop limit (${maxLoops} iterations)`);
            return "I got a bit carried away thinking about this! 😅 This is more complex than I expected - let me know if you'd like me to try again with a simpler approach.";
        }

        return "Oops! Something unexpected happened on my end 🍂";

    } catch (error) {
        console.error('❌ Anthropic provider error:', error);

        // Provide helpful error messages
        if (error.status === 429) {
            return "Whoa, I'm a bit overwhelmed right now! 🍂 Give me a moment to catch my breath and try again!";
        } else if (error.status === 500) {
            return "My brain is having a moment 😅 Let me try that again in a sec!";
        } else if (error.message && error.message.includes('API key')) {
            return "Oops! There's an issue with my configuration 🍂 Let the server owner know!";
        } else {
            return "Something went wrong on my end 🍂 Let me try again or ask the server owner for help if this keeps happening!";
        }
    }
}

/**
 * Extract text content from Claude's response
 */
function extractTextFromResponse(response) {
    const textBlocks = response.content.filter(block => block.type === 'text');

    if (textBlocks.length === 0) {
        return "I don't have a response for that right now! 🍂";
    }

    return textBlocks.map(block => block.text).join('\n').trim();
}

module.exports = {
    runAgent,
    loadPersonality
};
