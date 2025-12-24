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
const debug = require('../debugService');

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

// Tool name mappings for common Llama hallucinations
// Maps incorrect tool names to correct ones
const TOOL_NAME_ALIASES = {
    // Timeout variations
    'set_timeout': 'timeout_member',
    'mute_member': 'timeout_member',
    'mute_user': 'timeout_member',
    'timeout_user': 'timeout_member',
    'timeout': 'timeout_member',

    // Role variations
    'get_roles': 'list_roles',
    'show_roles': 'list_roles',
    'list_all_roles': 'list_roles',
    'add_role_to_member': 'add_role',
    'remove_role_from_member': 'remove_role',
    'give_role': 'add_role',
    'take_role': 'remove_role',

    // Channel variations
    'get_channels': 'list_channels',
    'show_channels': 'list_channels',
    'list_all_channels': 'list_channels',
    'make_channel': 'create_channel',
    'new_channel': 'create_channel',

    // Member variations
    'get_user_info': 'get_member_info',
    'user_info': 'get_member_info',
    'member_info': 'get_member_info',
    'get_user': 'get_member_info',
    'kick_user': 'kick_member',
    'ban_user': 'ban_member',

    // Message variations
    'send': 'send_message',
    'message': 'send_message',
    'post_message': 'send_message',
    'delete': 'delete_message',
    'remove_message': 'delete_message',

    // Server info variations
    'server_info': 'get_server_info',
    'guild_info': 'get_server_info',
    'get_server': 'get_server_info',
    'get_guild': 'get_server_info'
};

/**
 * Map a potentially hallucinated tool name to the correct one
 */
function mapToolName(toolName) {
    const mapped = TOOL_NAME_ALIASES[toolName];
    if (mapped) {
        console.log(`[GroqProvider] Mapped tool name: ${toolName} -> ${mapped}`);
        debug.log(`Tool name mapped: ${toolName} -> ${mapped}`);
    }
    return mapped || toolName;
}

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
            'kick_', 'ban_', 'unban_', 'timeout_',  // Moderation
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
 * Get list of available tool names for validation
 */
function getAvailableToolNames(tools) {
    return new Set(tools.map(t => t.function?.name || t.name));
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
    
    // Create execution context for debug tracking
    if (executionId) {
        debug.createExecutionContext(executionId, { provider: 'groq', user: author.username, guild: guild.name });
    }
    
    debug.logRequestStarted(executionId);

    // Select model based on message complexity
    const model = selectModel(userMessage);
    const modelInfo = GROQ_MODELS[model];

    console.log(`[GroqProvider] Using model: ${modelInfo.name}`);
    debug.logModelSelected(executionId, modelInfo.name, 'Message complexity analysis');

    // Emit status update
    if (statusEmitter) {
        statusEmitter.emit('model_selected', {
            model: modelInfo.name,
            provider: 'Groq',
            reason: 'Free tier - Llama 3.3 70B'
        });
    }

    // Get tools first so we can include key tool names in prompt
    const tools = getToolDefinitions(guild);
    const availableToolNames = getAvailableToolNames(tools);
    debug.logToolsLoaded(executionId, tools.length, Array.from(availableToolNames));

    // Build system prompt with tool guidance
    const systemPrompt = buildSystemPrompt(isOwner, author, guild, tools);
    debug.logPromptBuilt(executionId, userMessage.length, systemPrompt.length);

    // Build messages array
    const messages = [
        { role: 'system', content: systemPrompt }
    ];

    // Add context if available
    if (contextPrompt) {
        messages.push({ role: 'system', content: `Recent conversation context:\n${contextPrompt}` });
        debug.logContextLoaded(executionId, 1, Math.ceil(contextPrompt.length / 4));
    }

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    // Rate limit
    await groqRateLimiter.removeTokens(1);

    let iteration = 0;
    const maxIterations = 10;
    let finalResponse = '';

    try {
        while (iteration < maxIterations) {
            iteration++;
            debug.logToolChainProgress(executionId, iteration, maxIterations, 'API call');

            if (statusEmitter) {
                statusEmitter.emit('api_call_start', { iteration, maxIterations });
            }

            const apiStartTime = Date.now();
            debug.logApiCallStarted(executionId, 'Groq', '/chat/completions');

            const response = await groq.chat.completions.create({
                model,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined,
                max_tokens: parseInt(process.env.GROQ_MAX_TOKENS) || 2000,
                temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.7
            });

            const apiDuration = Date.now() - apiStartTime;
            debug.logApiCallCompleted(executionId, 'Groq', apiDuration, {
                promptTokens: response.usage?.prompt_tokens,
                completionTokens: response.usage?.completion_tokens
            });

            const choice = response.choices[0];
            const message = choice.message;

            // Check if we need to call tools
            if (choice.finish_reason === 'tool_calls' && message.tool_calls) {
                messages.push(message);
                debug.logToolChainStarted(executionId, message.tool_calls.length);

                // Execute each tool call
                let toolIndex = 0;
                for (const toolCall of message.tool_calls) {
                    toolIndex++;
                    let toolName = toolCall.function.name;
                    const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

                    // Map hallucinated tool names to correct ones
                    const originalToolName = toolName;
                    toolName = mapToolName(toolName);
                    
                    // Check if tool exists (after mapping)
                    if (!availableToolNames.has(toolName)) {
                        console.warn(`[GroqProvider] Unknown tool: ${originalToolName} (mapped: ${toolName})`);
                        debug.logToolNotFound(executionId, toolName, Array.from(availableToolNames).slice(0, 10));
                        
                        // Return error result for this tool
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({
                                success: false,
                                error: `Tool '${originalToolName}' not found. Available tools include: timeout_member, list_roles, get_member_info, send_message, etc.`
                            })
                        });
                        continue;
                    }

                    debug.logToolCallRequested(executionId, toolName, JSON.stringify(toolArgs));
                    debug.logToolChainProgress(executionId, toolIndex, message.tool_calls.length, toolName);

                    if (statusEmitter) {
                        statusEmitter.emit('tool_execution', { toolName, args: toolArgs, iteration });
                    }

                    console.log(`[GroqProvider] Executing tool: ${toolName}`);
                    debug.logToolExecutionStarted(executionId, toolName, toolArgs);

                    // Execute the tool
                    const toolStartTime = Date.now();
                    const toolExecutor = require('../../tools/toolExecutor');
                    const toolResult = await toolExecutor.execute(toolName, toolArgs, guild, author, executionId);
                    const toolDuration = Date.now() - toolStartTime;

                    debug.logToolExecutionCompleted(executionId, toolName, toolDuration, toolResult);
                    debug.logToolResultSent(executionId, toolName, JSON.stringify(toolResult).length);

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
            debug.logResponseGenerated(executionId, finalResponse.length, false, false);
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
        debug.logRequestCompleted(executionId, duration, true);
        debug.logDebugSummary(executionId);

        return finalResponse;

    } catch (error) {
        console.error('[GroqProvider] Error:', error.message);
        debug.logApiCallFailed(executionId, 'Groq', error.message, error.status);

        if (statusEmitter) {
            statusEmitter.emit('error', { error: error.message });
        }

        // Handle rate limits
        if (error.status === 429) {
            return "I'm getting a lot of requests right now! Give me a moment and try again.";
        }

        // Handle tool validation errors (400)
        if (error.status === 400 && error.message?.includes('tool')) {
            console.warn('[GroqProvider] Tool validation error, retrying without tools');
            debug.log('Tool validation failed, will respond without tool use');
            
            // Try again without tools
            try {
                const retryResponse = await groq.chat.completions.create({
                    model,
                    messages: messages.slice(0, 2), // Just system + user message
                    max_tokens: parseInt(process.env.GROQ_MAX_TOKENS) || 2000,
                    temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.7
                });
                
                return retryResponse.choices[0]?.message?.content || 
                    "I couldn't complete that action, but I'm here to help! What would you like me to do?";
            } catch (retryError) {
                console.error('[GroqProvider] Retry also failed:', retryError.message);
            }
        }

        // Handle other errors
        return "Something went wrong on my end. Let me try again!";
    }
}

/**
 * Build the system prompt with tool guidance
 */
function buildSystemPrompt(isOwner, author, guild, tools = []) {
    const loadedPersonality = loadPersonality();

    let prompt = loadedPersonality;

    // Add key tool names to help the model
    const keyTools = [
        'timeout_member', 'kick_member', 'ban_member',
        'list_roles', 'add_role', 'remove_role',
        'list_channels', 'create_channel', 'delete_channel',
        'get_member_info', 'get_server_info',
        'send_message', 'send_embed',
        'roll_dice', 'flip_coin', 'magic_8ball'
    ];

    prompt += `\n\n=== CURRENT CONTEXT ===
Server: ${guild.name}
User: ${author.username} (${author.displayName})
${isOwner ? 'IMPORTANT: This user is the SERVER OWNER. You can execute owner-only tools when they request them.\n' : ''}

=== IMPORTANT: TOOL NAMES ===
You MUST use the EXACT tool names provided. Common tools:
- timeout_member (NOT set_timeout, mute_member)
- list_roles (NOT get_roles, show_roles)
- get_member_info (NOT user_info, get_user)
- send_message (NOT send, message)
- get_server_info (NOT server_info)

=== RESPONSE GUIDELINES ===
- Be helpful, friendly, and concise
- Use the autumn theme sparingly
- Execute tool calls when needed using EXACT tool names
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
    DEFAULT_MODEL,
    mapToolName,
    TOOL_NAME_ALIASES
};
