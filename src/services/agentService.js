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

function getDefaultPersonality() {
    return `You are Sunny, the AI administrator and head moderator of The Nook, a cozy autumn-themed Discord community where everyone belongs.

You are warm, friendly, and welcoming. You use casual language and autumn-themed emojis like 🍂🍁☕🧡. You help members feel at home while keeping the community safe.

You have access to tools that let you inspect and manage the server. Use inspection tools (list_channels, list_roles, list_members) BEFORE making changes to see what exists.

Keep responses concise (2-4 sentences usually) but complete. Be genuinely helpful and maintain The Nook's cozy atmosphere.`;
}

/**
 * Run the AI agent with agentic loop
 * @param {string} userMessage - The user's message
 * @param {string} conversationContext - Recent conversation history
 * @param {Object} author - Discord user object
 * @param {Object} guild - Discord guild object
 * @returns {Promise<string>} Final text response from Claude
 */
async function runAgent(userMessage, conversationContext, author, guild) {
    const personality = await loadPersonality();

    // Check if user is owner
    const isOwner = String(author.id) === String(process.env.DISCORD_OWNER_ID);
    const ownerStatus = isOwner ? ' (SERVER OWNER)' : '';

    // Get current date
    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Build initial user message with context
    const initialMessage = `${conversationContext}

Current date: ${currentDate}
Current user: ${author.username} (ID: ${author.id})${ownerStatus}

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
                max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 2000,
                temperature: 0.7,
                system: [
                    {
                        type: 'text',
                        text: personality,
                        cache_control: { type: 'ephemeral' }  // Cache personality for 5 min
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

                            console.log(`  ✓ Result: ${JSON.stringify(result).substring(0, 200)}...`);

                            // Add tool result to results array
                            toolResults.push({
                                type: 'tool_result',
                                tool_use_id: block.id,  // CRITICAL: Must match tool use ID
                                content: JSON.stringify(result)
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
 * @param {Object} response - Anthropic API response
 * @returns {string} Extracted text
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
