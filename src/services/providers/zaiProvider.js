// src/services/providers/zaiProvider.js
/**
 * Z.AI GLM Provider
 * Implements the AI provider interface using Z.AI's GLM models via OpenAI-compatible API
 * 
 * Supports: GLM-4.5-Air, GLM-4.5, GLM-4.6
 * Features: 90.6% tool-calling success rate, hybrid thinking modes, 128K context
 */

const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const discordTools = require('../../tools/discordTools');
const toolExecutor = require('../../tools/toolExecutor');
const { retryWithBackoff } = require('../../utils/retry');
const { anthropicRateLimiter } = require('../../utils/rateLimiter');
const messageComplexity = require('../../utils/messageComplexity');
const modelSelector = require('../../utils/modelSelector');

// Initialize OpenAI client with Z.AI configuration
const client = new OpenAI({
    apiKey: process.env.ZAI_API_KEY,
    baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4/'
});

let personalityPrompt = null;

// ============================================================================
// OUTCOME TRACKER - Module-level metadata cache for AGI learning system
// ============================================================================
// Stores execution metadata keyed by executionId for outcome tracking.
// Auto-cleanup after 5 minutes prevents memory leaks.
// Pattern validated: https://nodejs.org/api/timers.html#timers_cleartimeout_timeout
const executionMetadata = new Map();
const METADATA_TTL = 300000; // 5 minutes

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
 * Run the AI agent with agentic loop (Z.AI GLM)
 * @param {EventEmitter} statusEmitter - Optional EventEmitter for real-time status updates
 * @param {string} executionId - Optional execution ID for outcome tracking (AGI learning system)
 */
async function runAgent(userMessage, conversationContext, author, guild, channel, statusEmitter = null, executionId = null) {
    const personality = await loadPersonality();

    // Check if user is owner
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

    // SMART MODEL SELECTION - Choose GLM-4.6 vs GLM-4.5-Air
    let modelSelection = modelSelector.selectModel(userMessage, conversationContext, isUserOwner);
    
    // Phase 3: Apply dynamic adjustments for A/B testing
    if (guild && executionId) {
        modelSelection = await modelSelector.applyDynamicAdjustments(modelSelection, guild.id, executionId);
    }
    
    // Log to console (visible in Render logs)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🤖 [MODEL_SELECTOR] User: ${author.username}`);
    console.log(`🤖 [MODEL_SELECTOR] Selected: ${modelSelection.model.toUpperCase()}`);
    console.log(`🤖 [MODEL_SELECTOR] Category: ${modelSelection.category}`);
    console.log(`🤖 [MODEL_SELECTOR] Reasoning: ${modelSelection.reasoning}`);
    console.log(`🤖 [MODEL_SELECTOR] Complexity: ${modelSelection.messageComplexity}`);
    console.log(`🤖 [MODEL_SELECTOR] Score: ${modelSelection.complexityScore}`);
    console.log(`💰 [MODEL_SELECTOR] Cost: ${modelSelection.costs.input}/${modelSelection.costs.output} per 1M tokens`);
    if (modelSelection.adjustmentId) {
        console.log(`🔧 [MODEL_SELECTOR] A/B Test: ${modelSelection.treatmentGroup ? 'TREATMENT' : 'CONTROL'} group (adjustment ${modelSelection.adjustmentId.substring(0, 8)})`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Get selected model
    const selectedModel = modelSelection.model;

    // Emit model selection event for real-time status updates
    if (statusEmitter) {
        statusEmitter.emit('model_selected', {
            model: selectedModel,
            category: modelSelection.category,
            reasoning: modelSelection.reasoning,
            complexity: modelSelection.messageComplexity,
            costs: modelSelection.costs
        });
    }

    // Analyze message complexity
    const complexitySummary = messageComplexity.getComplexitySummary(userMessage, false);
    console.log(`📊 Message complexity analysis:`, complexitySummary);

    const complexityHint = `
<message_analysis>
User message complexity: ${complexitySummary.complexity}
Response guideline: ${complexitySummary.guidelines}
Maximum sentences recommended: ${complexitySummary.maxSentences}
${complexitySummary.isListRequest ? 'Note: User is requesting a list - provide complete information but stay concise.' : ''}
</message_analysis>

IMPORTANT: Follow the response guideline above for appropriate length. Match the response depth to what the user needs.`;

    // Get current model info
    const modelInfo = `

## YOUR CURRENT AI MODEL
You are currently powered by **Z.AI ${selectedModel.toUpperCase()}** (via Z.AI's API platform). When users ask what model you're running, tell them you're using "Z.AI ${selectedModel.toUpperCase()}", NOT Claude or any other model. This is an intelligent deployment that automatically selects the best model (GLM-4.5-Air or GLM-4.6) based on task complexity for optimal cost-efficiency and performance.`;

    // Build system message (OpenAI format)
    const systemMessage = `${personality}
${modelInfo}

${complexityHint}

Current date: ${currentDate}
You have 100+ Discord management tools. CRITICAL: When using multi-step workflows (like reaction roles), always extract data from tool results (especially message_id) to use in subsequent tool calls.`;

    // Build initial messages array (OpenAI format)
    let messages = [
        {
            role: 'system',
            content: systemMessage
        },
        {
            role: 'user',
            content: `${conversationContext}

Current user: ${author.username} (ID: ${author.id})${ownerStatus}${channelInfo}

${isUserOwner ? 'IMPORTANT: This user is the SERVER OWNER. You can execute owner-only tools when they request them.\n\n' : ''}
User message: ${userMessage}`
        }
    ];

    // Get Discord tools and convert to OpenAI format
    const anthropicTools = discordTools.getDiscordTools(guild);
    const tools = convertToolsToOpenAIFormat(anthropicTools);

    console.log(`🤖 [Z.AI] Starting agentic loop for: ${author.username}`);
    console.log(`🔧 [Z.AI] Using model: ${selectedModel}`);

    let loopCount = 0;
    const startTime = Date.now();
    const maxLoops = 100; // Increased from 50 - no time limit, only iteration limit
    let lastProgressLog = Date.now();

    // Initialize metadata tracking for AGI learning system
    const metadata = executionId ? {
        modelUsed: selectedModel,
        modelReasoning: modelSelection.reasoning,
        complexityScore: modelSelection.complexityScore,
        predictedComplexity: modelSelection.messageComplexity,
        iterations: 0,
        toolsUsed: [],
        errors: [],
        finishReason: null,
        // Phase 3: Include adjustment metadata for A/B testing
        adjustmentId: modelSelection.adjustmentId || null,
        controlGroup: modelSelection.controlGroup || false,
        treatmentGroup: modelSelection.treatmentGroup || false
    } : null;

    try {
        // AGENTIC LOOP - OpenAI/Z.AI style
        // NO TIME LIMIT - only iteration limit to prevent infinite loops
        while (loopCount < maxLoops) {
            loopCount++;
            const elapsedTime = Date.now() - startTime;

            // Track iteration count for AGI learning
            if (metadata) {
                metadata.iterations = loopCount;
            }
            
            // Log progress every 10 seconds to detect hangs (Render visibility)
            if (Date.now() - lastProgressLog > 10000) {
                console.log(`🔄 [Z.AI] Agent loop iteration ${loopCount} (${(elapsedTime/1000).toFixed(1)}s elapsed)`);
                lastProgressLog = Date.now();
            }

            // Hang detection: warn if single iteration takes >60s
            const iterationStart = Date.now();

            // Emit API call start event for real-time status updates
            if (statusEmitter) {
                statusEmitter.emit('api_call_start', {
                    iteration: loopCount,
                    maxIterations: maxLoops,
                    elapsedTime: (Date.now() - startTime) / 1000
                });
            }

            // Apply rate limiting
            await anthropicRateLimiter.removeTokens(1);

            // Call Z.AI API (OpenAI-compatible) with dynamically selected model
            const response = await retryWithBackoff(
                () => client.chat.completions.create({
                    model: selectedModel,
                    messages: messages,
                    tools: tools,
                    tool_choice: 'auto',
                    temperature: parseFloat(process.env.ZAI_TEMPERATURE) || 0.7,
                    max_tokens: parseInt(process.env.ZAI_MAX_TOKENS) || 3000
                }),
                {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    operationName: 'Z.AI API Call',
                    onRetry: (attempt, error, delay) => {
                        console.log(`⚠️  Z.AI API retry ${attempt}/3 after ${delay}ms: ${error.message}`);
                    }
                }
            );

            const choice = response.choices[0];
            const finishReason = choice.finish_reason;

            // Emit API call complete event
            if (statusEmitter) {
                statusEmitter.emit('api_call_complete', {
                    iteration: loopCount,
                    finishReason: finishReason
                });
            }

            // Hang detection: warn if iteration took >60s
            const iterationTime = (Date.now() - iterationStart) / 1000;
            if (iterationTime > 60) {
                console.warn(`⚠️  [HANG_DETECTION] Iteration ${loopCount} took ${iterationTime.toFixed(1)}s (>60s threshold)`);
            }

            console.log(`📊 Finish reason: ${finishReason}`);

            // Add assistant message to history
            messages.push(choice.message);

            // Check finish reason
            if (finishReason === 'stop') {
                // Emit thinking event for final processing
                if (statusEmitter) {
                    statusEmitter.emit('thinking', {
                        message: 'Processing final response...'
                    });
                }
                // Agent is done - return final text
                const finalText = choice.message.content || "I don't have a response for that right now! 🍂";
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
                
                console.log(`✅ [Z.AI] Agent loop complete after ${loopCount} iterations`);
                console.log(`📊 [Z.AI] Total time: ${totalTime}s`);
                
                // Log model selection statistics
                const stats = modelSelector.getUsageStats();
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`📊 [USAGE_STATS] Total Requests: ${stats.total}`);
                console.log(`📊 [USAGE_STATS] GLM-4.5-Air: ${stats.breakdown['glm-4.5-air']} (${stats.percentages['glm-4.5-air']}%)`);
                console.log(`📊 [USAGE_STATS] GLM-4.6: ${stats.breakdown['glm-4.6']} (${stats.percentages['glm-4.6']}%)`);
                console.log(`📊 [USAGE_STATS] ${stats.recommendation}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

                // Emit completion event
                if (statusEmitter) {
                    statusEmitter.emit('complete', {
                        totalIterations: loopCount,
                        totalTime: totalTime,
                        success: true
                    });
                }

                // Save metadata to cache for outcome tracking (AGI learning)
                if (metadata && executionId) {
                    metadata.finishReason = finishReason;
                    executionMetadata.set(executionId, metadata);
                    // Auto-cleanup after TTL to prevent memory leaks
                    setTimeout(() => executionMetadata.delete(executionId), METADATA_TTL);
                    console.log(`📊 [OUTCOME_TRACKER] Metadata cached for execution ${executionId.substring(0, 8)}`);
                }

                return finalText;
            }

            if (finishReason === 'tool_calls') {
                // Agent wants to use tools
                console.log(`🔧 [Z.AI] Requesting tool use`);

                const toolCalls = choice.message.tool_calls || [];
                const toolResults = [];

                for (const toolCall of toolCalls) {
                    console.log(`  → Tool: ${toolCall.function.name}`);
                    console.log(`  → Arguments: ${toolCall.function.arguments}`);

                    try {
                        // Parse arguments (OpenAI returns JSON string)
                        const args = JSON.parse(toolCall.function.arguments);

                        // Emit tool execution event for real-time status updates
                        if (statusEmitter) {
                            statusEmitter.emit('tool_execution', {
                                toolName: toolCall.function.name,
                                args: args,
                                iteration: loopCount
                            });
                        }

                        // Track tool usage for AGI learning
                        if (metadata && !metadata.toolsUsed.includes(toolCall.function.name)) {
                            metadata.toolsUsed.push(toolCall.function.name);
                        }

                        // Execute tool
                        const result = await toolExecutor.execute(
                            toolCall.function.name,
                            args,
                            guild,
                            author
                        );

                        const resultStr = JSON.stringify(result || { success: false, error: 'No result' });
                        console.log(`  ✓ Result: ${resultStr.substring(0, 200)}...`);

                        // Format tool result for OpenAI/Z.AI
                        toolResults.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: toolCall.function.name,
                            content: resultStr
                        });
                    } catch (error) {
                        console.error(`  ✗ Tool execution error:`, error);

                        // Track errors for AGI learning
                        if (metadata) {
                            metadata.errors.push({
                                tool: toolCall.function.name,
                                error: error.message
                            });
                        }

                        toolResults.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: toolCall.function.name,
                            content: JSON.stringify({
                                success: false,
                                error: error.message
                            })
                        });
                    }
                }

                // Add all tool results to messages
                messages.push(...toolResults);
                continue; // Loop again
            }

            if (finishReason === 'length') {
                console.warn(`⚠️  Hit max tokens in iteration ${loopCount}`);
                return "I need to think about this in smaller steps! Let me try again with a simpler approach. 🍂";
            }

            // Handle unexpected finish reasons
            console.warn(`⚠️  Unexpected finish reason: ${finishReason}`);
            break;
        }

        // Hit max loops
        if (loopCount >= maxLoops) {
            console.error(`❌ Hit max loop limit (${maxLoops} iterations)`);
            return "I got a bit carried away thinking about this! 😅 This is more complex than I expected - let me know if you'd like me to try again with a simpler approach.";
        }

        return "Oops! Something unexpected happened on my end 🍂";

    } catch (error) {
        console.error('❌ Z.AI provider error:', error);

        // Handle specific error types
        if (error.status === 429) {
            return "Whoa, I'm a bit overwhelmed right now! 🍂 Give me a moment to catch my breath and try again!";
        } else if (error.status === 500) {
            return "My brain is having a moment 😅 Let me try that again in a sec!";
        } else if (error.message && (error.message.includes('API key') || error.message.includes('apiKey'))) {
            return "Oops! There's an issue with my Z.AI configuration 🍂 Let the server owner know!";
        } else {
            return "Something went wrong on my end 🍂 Let me try again or ask the server owner for help if this keeps happening!";
        }
    }
}

/**
 * Convert Anthropic tool format to OpenAI/Z.AI format
 * 
 * Anthropic format:
 * {
 *   name: "tool_name",
 *   description: "description",
 *   input_schema: { type: "object", properties: {...} }
 * }
 * 
 * OpenAI/Z.AI format:
 * {
 *   type: "function",
 *   function: {
 *     name: "tool_name",
 *     description: "description",
 *     parameters: { type: "object", properties: {...} }
 *   }
 * }
 */
function convertToolsToOpenAIFormat(anthropicTools) {
    return anthropicTools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema // Same structure, just different key name
        }
    }));
}

/**
 * Get execution metadata for outcome tracking (AGI learning system)
 * @param {string} executionId - Execution ID to retrieve metadata for
 * @returns {Object|null} Metadata object or null if not found
 */
function getExecutionMetadata(executionId) {
    return executionMetadata.get(executionId) || null;
}

module.exports = {
    runAgent,
    loadPersonality,
    getExecutionMetadata
};
