// src/services/agentService.js
/**
 * AI Agent Service - Agentic Loop Implementation
 * Replaces the old claudeService with true AI agent architecture
 * Uses Claude's native Tool Use API for intelligent, multi-step Discord management
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
const discordTools = require('../tools/discordTools');
const toolExecutor = require('../tools/toolExecutor');

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY
});

// Load personality prompt once at startup
let personalityPrompt = null;

/**
 * Load personality prompt from configuration file
 * 
 * Reads the personality.txt file and replaces placeholders with environment variables.
 * Caches the result for subsequent calls to avoid repeated file reads.
 * 
 * @returns {Promise<string>} The personality prompt text with placeholders replaced
 * @throws {Error} If file system operations fail (falls back to default personality)
 */
async function loadPersonality() {
    if (!personalityPrompt) {
        const promptPath = path.join(__dirname, '../../config/personality.txt');
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
 * 
 * Provides a fallback personality prompt when personality.txt cannot be loaded.
 * Used to ensure the bot always has a personality defined.
 * 
 * @returns {string} Default personality prompt for Sunny bot
 */
function getDefaultPersonality() {
    return `You are Sunny, the AI administrator and head moderator of The Nook, a cozy autumn-themed Discord community where everyone belongs.

You are warm, friendly, and welcoming. You use casual language and autumn-themed emojis like 🍂🍁☕🧡. You help members feel at home while keeping the community safe.

You have access to tools that let you inspect and manage the server. Use inspection tools (list_channels, list_roles, list_members) BEFORE making changes to see what exists.

Keep responses concise (2-4 sentences usually) but complete. Be genuinely helpful and maintain The Nook's cozy atmosphere.`;
}

/**
 * Run the AI agent with agentic loop
 * 
 * Implements a multi-turn agentic loop where Claude can:
 * 1. Analyze user input with conversation context
 * 2. Use Discord management tools (list, modify, moderate)
 * 3. Process tool results and decide next actions
 * 4. Continue until task is complete or max iterations reached
 * 
 * The loop allows Claude to make intelligent, multi-step decisions like:
 * - Inspecting server state before making changes
 * - Setting up complex features (reaction roles, moderation)
 * - Handling errors and retrying with different approaches
 * 
 * @param {string} userMessage - The user's message to process
 * @param {string} conversationContext - Recent conversation history formatted as string
 * @param {import('discord.js').User} author - Discord user who sent the message
 * @param {import('discord.js').Guild} guild - Discord guild where message was sent
 * @param {import('discord.js').TextChannel} channel - Discord channel where message was sent
 * @returns {Promise<string>} Final text response from Claude to send to user
 * @throws {Error} On API errors (handled gracefully with user-friendly messages)
 * 
 * @example
 * const response = await runAgent(
 *   "Set up a welcome role",
 *   "Previous messages...",
 *   message.author,
 *   message.guild,
 *   message.channel
 * );
 * await message.reply(response);
 */
async function runAgent(userMessage, conversationContext, author, guild, channel) {
    const personality = await loadPersonality();

    // Check if user is owner (supports multiple owners)
    const { isOwner } = require('../utils/permissions');
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

    // Build initial user message with context
    const initialMessage = `${conversationContext}

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

    console.log(`🤖 Starting agentic loop for: ${author.username}`);

    let loopCount = 0;
    const maxLoops = 20; // Prevent infinite loops

    try {
        // AGENTIC LOOP - The core of the AI agent
        while (loopCount < maxLoops) {
            loopCount++;
            console.log(`🔄 Agent loop iteration ${loopCount}`);

            // Call Claude with tools
            const response = await anthropic.messages.create({
                model: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022',
                max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 3000,  // Increased for better multi-step reasoning
                temperature: 0.7,
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
            });

            // Add assistant response to conversation history
            messages.push({
                role: 'assistant',
                content: response.content
            });

            // Check stop reason to determine next action
            console.log(`📊 Stop reason: ${response.stop_reason}`);

            if (response.stop_reason === 'end_turn') {
                // Claude is done - extract and return final text response
                console.log(`📝 Response content blocks: ${response.content.length}`);
                response.content.forEach((block, i) => {
                    console.log(`   Block ${i}: type=${block.type}, length=${block.text?.length || 0}`);
                });

                const finalText = extractTextFromResponse(response);
                console.log(`✅ Agent loop complete after ${loopCount} iterations`);
                console.log(`📤 Final response length: ${finalText.length} chars`);
                console.log(`📤 Final response preview: ${finalText.substring(0, 100)}...`);
                return finalText;
            }

            if (response.stop_reason === 'tool_use') {
                // Claude wants to use tools - execute them and feed results back
                console.log(`🔧 Claude requesting tool use`);

                const toolResults = [];

                // Process all tool use requests
                for (const block of response.content) {
                    if (block.type === 'tool_use') {
                        console.log(`  → Tool: ${block.name}`);
                        console.log(`  → Input: ${JSON.stringify(block.input)}`);

                        try {
                            // Execute the tool
                            const result = await toolExecutor.execute(
                                block.name,
                                block.input,
                                guild,
                                author
                            );

                            // Safe logging with null check
                            const resultStr = result ? JSON.stringify(result) : 'null';
                            const preview = resultStr.length > 200 ? resultStr.substring(0, 200) + '...' : resultStr;
                            console.log(`  ✓ Result: ${preview}`);

                            // Add tool result to results array with enhanced context
                            const enhancedResult = {
                                ...result,
                                _tool_context: {
                                    tool_name: block.name,
                                    success: result?.success || false,
                                    // Highlight important data for next steps
                                    extracted_data: {
                                        message_id: result?.message_id,
                                        channel_id: result?.channel_id,
                                        channel_name: result?.channel?.name || result?.channel_name,
                                        role_id: result?.role_id,
                                        role_name: result?.role?.name || result?.role_name
                                    }
                                }
                            };

                            toolResults.push({
                                type: 'tool_result',
                                tool_use_id: block.id,  // CRITICAL: Must match tool use ID
                                content: JSON.stringify(enhancedResult || { success: false, error: 'Tool returned no result' })
                            });
                        } catch (error) {
                            console.error(`  ✗ Tool execution error:`, error);

                            // Return error as tool result
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

                // Feed ALL tool results back to Claude in a single message
                // This is REQUIRED by the Anthropic API
                messages.push({
                    role: 'user',
                    content: toolResults
                });

                // Loop continues - Claude will process tool results and decide next action
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
            console.error(`❌ Hit max loop limit (${maxLoops})`);
            return "I got a bit carried away thinking about this! 😅 Let me know if you'd like me to try again with a simpler approach.";
        }

        // Fallback
        return "Oops! Something unexpected happened on my end 🍂";

    } catch (error) {
        console.error('❌ Agent service error:', error);

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
 * 
 * Filters the response content blocks to extract only text blocks,
 * ignoring tool_use blocks. Joins multiple text blocks with newlines.
 * 
 * @param {Object} response - Anthropic API response object
 * @param {Array} response.content - Array of content blocks (text or tool_use)
 * @returns {string} Extracted and joined text content, or default message if no text found
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
    loadPersonality  // Export for testing
};
