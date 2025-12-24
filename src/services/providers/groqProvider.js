// src/services/providers/groqProvider.js
/**
 * Groq Provider - Free Tier AI Integration
 * Uses Groq's blazing-fast inference for Llama models
 *
 * Free Tier Limits:
 * - 14,400 requests/day
 * - 6,000 tokens/minute (Llama 3.3 70B)
 * - 300+ tokens/second inference speed
 *
 * Get your free API key: https://console.groq.com
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { RateLimiter } = require('../../utils/rateLimiter');

// Rate limiter: 30 requests per minute to stay well under limits
const groqRateLimiter = new RateLimiter({
    tokensPerInterval: 30,
    interval: 60000, // 1 minute in ms
    name: 'Groq API'
});

// Load personality from config
let personality = '';
try {
    personality = fs.readFileSync(path.join(__dirname, '../../config/personality.txt'), 'utf-8');
} catch (error) {
    console.warn('[GroqProvider] Could not load personality.txt, using default');
    personality = 'You are Sunny, a friendly and helpful Discord bot assistant.';
}

// Initialize Groq client (OpenAI-compatible)
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
});

// Available models on Groq free tier
const GROQ_MODELS = {
    // Best quality - recommended
    'llama-3.3-70b-versatile': {
        name: 'Llama 3.3 70B',
        contextWindow: 128000,
        tokensPerMinute: 6000,
        requestsPerDay: 14400,
        description: 'Best quality, great for complex tasks'
    },
    // Faster, good for simple tasks
    'llama-3.1-8b-instant': {
        name: 'Llama 3.1 8B',
        contextWindow: 128000,
        tokensPerMinute: 20000,
        requestsPerDay: 14400,
        description: 'Fast, good for simple responses'
    },
    // Good balance
    'mixtral-8x7b-32768': {
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        tokensPerMinute: 5000,
        requestsPerDay: 14400,
        description: 'Good balance of speed and quality'
    },
    // Newest Llama
    'llama-3.2-90b-vision-preview': {
        name: 'Llama 3.2 90B Vision',
        contextWindow: 128000,
        tokensPerMinute: 6000,
        requestsPerDay: 14400,
        description: 'Multimodal, can see images'
    }
};

// Default model
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * Load personality with owner ID replacement
 */
function loadPersonality() {
    let loadedPersonality = personality;
    if (process.env.DISCORD_OWNER_ID) {
        loadedPersonality = loadedPersonality.replace(/\[OWNER_ID\]/g, process.env.DISCORD_OWNER_ID);
    }
    return loadedPersonality;
}

/**
 * Get tool definitions for Groq (converted to OpenAI format)
 * Groq has a limit of 128 tools, so we prioritize the most essential ones
 * @param {Guild} guild - Discord guild object for context
 */
function getToolDefinitions(guild) {
    // Import tool definitions
    try {
        const { getDiscordTools } = require('../../tools/discordTools');
        const claudeTools = getDiscordTools(guild);

        console.log(`[GroqProvider] Loaded ${claudeTools.length} total tools`);

        // Groq limit is 128 tools - prioritize essential tools
        // Priority order: inspection, channels, roles, members, messages, games, then others
        const priorityPrefixes = [
            'list_', 'get_', 'create_', 'delete_', 'rename_', 'update_',  // Core CRUD
            'send_', 'edit_', 'pin_', 'unpin_',  // Messages
            'add_', 'remove_', 'set_', 'clear_',  // Modifications
            'kick_', 'ban_', 'unban_', 'mute_', 'unmute_', 'warn_',  // Moderation
            'roll_', 'flip_', 'magic_', 'start_', 'end_',  // Games
        ];

        // Sort tools by priority (essential ones first)
        const sortedTools = claudeTools.sort((a, b) => {
            const aHasPriority = priorityPrefixes.some(p => a.name.startsWith(p));
            const bHasPriority = priorityPrefixes.some(p => b.name.startsWith(p));
            if (aHasPriority && !bHasPriority) return -1;
            if (!aHasPriority && bHasPriority) return 1;
            return 0;
        });

        // Limit to 128 tools (Groq API limit)
        const limitedTools = sortedTools.slice(0, 128);
        console.log(`[GroqProvider] Using ${limitedTools.length} tools (Groq limit: 128)`);

        // Convert from Claude format (input_schema) to OpenAI/Groq format (parameters)
        return limitedTools.map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema || { type: "object", properties: {} }
            }
        }));
    } catch (error) {
        console.warn('[GroqProvider] Could not load tool definitions:', error.message);
        return [];
    }
}

/**
 * Analyze message complexity to select model
 */
function selectModel(message) {
    const lowerMessage = message.toLowerCase();

    // Simple greetings/questions -> fast model
    const simplePatterns = [
        /^(hi|hello|hey|sup|yo)[\s!.,]*$/i,
        /^how are you/i,
        /^what('s| is) up/i,
        /^thanks/i,
        /^good (morning|afternoon|evening|night)/i
    ];

    for (const pattern of simplePatterns) {
        if (pattern.test(lowerMessage)) {
            return 'llama-3.1-8b-instant';
        }
    }

    // Complex tasks -> best model
    const complexPatterns = [
        /create.*channel/i,
        /set.*permission/i,
        /multiple.*step/i,
        /analyze|explain|compare/i,
        /code|script|function/i
    ];

    for (const pattern of complexPatterns) {
        if (pattern.test(lowerMessage)) {
            return 'llama-3.3-70b-versatile';
        }
    }

    // Default to best model
    return DEFAULT_MODEL;
}

/**
 * Run the Groq agent with tool support
 */
async function runAgent(userMessage, contextPrompt, author, guild, channel, statusEmitter = null, executionId = null) {
    const startTime = Date.now();
    const isOwner = author.id === process.env.DISCORD_OWNER_ID;

    // Select model based on message complexity
    const model = selectModel(userMessage);
    const modelInfo = GROQ_MODELS[model];

    console.log(`[GroqProvider] Using model: ${modelInfo.name}`);

    // Emit status update
    if (statusEmitter) {
        statusEmitter.emit('model_selected', {
            model: modelInfo.name,
            provider: 'Groq',
            reason: 'Free tier - Llama 3.3 70B'
        });
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(isOwner, author, guild);

    // Build messages array
    const messages = [
        { role: 'system', content: systemPrompt }
    ];

    // Add context if available
    if (contextPrompt) {
        messages.push({ role: 'system', content: `Recent conversation context:\n${contextPrompt}` });
    }

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    // Get tools (pass guild for context)
    const tools = getToolDefinitions(guild);

    // Rate limit
    await groqRateLimiter.removeTokens(1);

    let iteration = 0;
    const maxIterations = 10;
    let finalResponse = '';

    try {
        while (iteration < maxIterations) {
            iteration++;

            if (statusEmitter) {
                statusEmitter.emit('api_call_start', { iteration, maxIterations });
            }

            const response = await groq.chat.completions.create({
                model,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined,
                max_tokens: parseInt(process.env.GROQ_MAX_TOKENS) || 2000,
                temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.7
            });

            const choice = response.choices[0];
            const message = choice.message;

            // Check if we need to call tools
            if (choice.finish_reason === 'tool_calls' && message.tool_calls) {
                messages.push(message);

                // Execute each tool call
                for (const toolCall of message.tool_calls) {
                    const toolName = toolCall.function.name;
                    const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

                    if (statusEmitter) {
                        statusEmitter.emit('tool_execution', { toolName, args: toolArgs, iteration });
                    }

                    console.log(`[GroqProvider] Executing tool: ${toolName}`);

                    // Execute the tool
                    const toolExecutor = require('../../tools/toolExecutor');
                    const toolResult = await toolExecutor.execute(toolName, toolArgs, guild, author, executionId);

                    // Add tool result to messages
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult)
                    });
                }

                continue; // Continue the loop to get final response
            }

            // We have the final response
            finalResponse = message.content || '';
            break;
        }

        const duration = Date.now() - startTime;

        if (statusEmitter) {
            statusEmitter.emit('complete', {
                success: true,
                duration,
                iterations: iteration,
                model: modelInfo.name
            });
        }

        console.log(`[GroqProvider] Completed in ${duration}ms with ${iteration} iteration(s)`);

        return finalResponse;

    } catch (error) {
        console.error('[GroqProvider] Error:', error.message);

        if (statusEmitter) {
            statusEmitter.emit('error', { error: error.message });
        }

        // Handle rate limits
        if (error.status === 429) {
            return "I'm getting a lot of requests right now! Give me a moment and try again.";
        }

        // Handle other errors
        return "Something went wrong on my end. Let me try again!";
    }
}

/**
 * Build the system prompt
 */
function buildSystemPrompt(isOwner, author, guild) {
    const loadedPersonality = loadPersonality();

    let prompt = loadedPersonality;

    prompt += `\n\n=== CURRENT CONTEXT ===
Server: ${guild.name}
User: ${author.username} (${author.displayName})
${isOwner ? 'IMPORTANT: This user is the SERVER OWNER. You can execute owner-only tools when they request them.\n' : ''}

=== RESPONSE GUIDELINES ===
- Be helpful, friendly, and concise
- Use the autumn theme sparingly
- Execute tool calls when needed
- Keep responses under 2000 characters for Discord`;

    return prompt;
}

/**
 * Get available models info
 */
function getModels() {
    return GROQ_MODELS;
}

/**
 * Check if provider is configured
 */
function isConfigured() {
    return !!process.env.GROQ_API_KEY;
}

module.exports = {
    runAgent,
    loadPersonality,
    getModels,
    isConfigured,
    DEFAULT_MODEL
};
