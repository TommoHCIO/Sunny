// src/services/debugService.js
/**
 * Comprehensive Debug & Feedback Service
 * Provides 100 different debug/log/feedback points for testing and verification
 * 
 * Outputs to: console, #sunny-debug channel, embeds, and structured logs
 */

const { EmbedBuilder } = require('discord.js');

// Debug channel ID (sunny-debug)
const DEBUG_CHANNEL_ID = process.env.DEBUG_CHANNEL_ID || '1453385451351179394';

// Log levels
const LogLevel = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    FATAL: 5
};

// Current log level (configurable via env)
const currentLogLevel = LogLevel[process.env.LOG_LEVEL?.toUpperCase()] || LogLevel.DEBUG;

// Execution context storage
const executionContexts = new Map();

// Performance metrics
const performanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalToolCalls: 0,
    toolCallsByName: {},
    avgResponseTime: 0,
    responseTimes: []
};

/**
 * Create a new execution context for tracking a request
 */
function createExecutionContext(executionId, metadata = {}) {
    const context = {
        id: executionId,
        startTime: Date.now(),
        logs: [],
        toolCalls: [],
        apiCalls: [],
        errors: [],
        warnings: [],
        metrics: {},
        metadata,
        phases: []
    };
    executionContexts.set(executionId, context);
    log(1, 'CONTEXT_CREATED', `Execution context created: ${executionId}`, { metadata });
    return context;
}

/**
 * Get execution context
 */
function getContext(executionId) {
    return executionContexts.get(executionId);
}

/**
 * Log with level and category
 * @param {number} level - Log level (0-5)
 * @param {string} category - Log category (e.g., 'TOOL_EXEC', 'API_CALL')
 * @param {string} message - Log message
 * @param {object} data - Additional data
 * @param {string} executionId - Optional execution ID
 */
function log(level, category, message, data = {}, executionId = null) {
    if (level < currentLogLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LogLevel).find(k => LogLevel[k] === level) || 'UNKNOWN';
    
    const logEntry = {
        timestamp,
        level: levelName,
        category,
        message,
        data,
        executionId
    };

    // Console output with colors
    const colors = {
        TRACE: '\x1b[90m',   // Gray
        DEBUG: '\x1b[36m',   // Cyan
        INFO: '\x1b[32m',    // Green
        WARN: '\x1b[33m',    // Yellow
        ERROR: '\x1b[31m',   // Red
        FATAL: '\x1b[35m'    // Magenta
    };
    const reset = '\x1b[0m';
    const color = colors[levelName] || reset;

    console.log(`${color}[${timestamp}] [${levelName}] [${category}]${reset} ${message}`, 
        Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');

    // Add to execution context if provided
    if (executionId) {
        const context = getContext(executionId);
        if (context) {
            context.logs.push(logEntry);
            if (level >= LogLevel.ERROR) context.errors.push(logEntry);
            if (level === LogLevel.WARN) context.warnings.push(logEntry);
        }
    }

    return logEntry;
}

// ============================================================================
// 100 DEBUG/FEEDBACK FUNCTIONS
// ============================================================================

// 1-10: Request Lifecycle
function logRequestReceived(executionId, message, author, guild) {
    log(2, 'REQUEST_RECEIVED', `New request from ${author.username} in ${guild.name}`, {
        messageId: message.id,
        channelId: message.channel.id,
        content: message.content.substring(0, 100),
        authorId: author.id,
        guildId: guild.id
    }, executionId);
}

function logRequestParsed(executionId, parsedContent) {
    log(1, 'REQUEST_PARSED', 'Message content parsed', { parsedContent }, executionId);
}

function logRequestValidated(executionId, isValid, validationErrors = []) {
    log(isValid ? 2 : 3, 'REQUEST_VALIDATED', `Request validation: ${isValid ? 'PASSED' : 'FAILED'}`, 
        { isValid, validationErrors }, executionId);
}

function logRequestQueued(executionId, queuePosition) {
    log(1, 'REQUEST_QUEUED', `Request queued at position ${queuePosition}`, { queuePosition }, executionId);
}

function logRequestStarted(executionId) {
    log(2, 'REQUEST_STARTED', 'Request processing started', {}, executionId);
}

function logRequestCompleted(executionId, duration, success) {
    log(2, 'REQUEST_COMPLETED', `Request completed in ${duration}ms - ${success ? 'SUCCESS' : 'FAILED'}`, 
        { duration, success }, executionId);
    performanceMetrics.totalRequests++;
    if (success) performanceMetrics.successfulRequests++;
    else performanceMetrics.failedRequests++;
    performanceMetrics.responseTimes.push(duration);
}

function logRequestTimeout(executionId, timeoutMs) {
    log(4, 'REQUEST_TIMEOUT', `Request timed out after ${timeoutMs}ms`, { timeoutMs }, executionId);
}

function logRequestRetry(executionId, attemptNumber, maxAttempts) {
    log(3, 'REQUEST_RETRY', `Retrying request (attempt ${attemptNumber}/${maxAttempts})`, 
        { attemptNumber, maxAttempts }, executionId);
}

function logRequestCancelled(executionId, reason) {
    log(3, 'REQUEST_CANCELLED', `Request cancelled: ${reason}`, { reason }, executionId);
}

function logRequestRateLimited(executionId, waitTime) {
    log(3, 'REQUEST_RATE_LIMITED', `Rate limited, waiting ${waitTime}ms`, { waitTime }, executionId);
}

// 11-20: AI/LLM Processing
function logModelSelected(executionId, model, reason) {
    log(2, 'MODEL_SELECTED', `Selected model: ${model}`, { model, reason }, executionId);
}

function logPromptBuilt(executionId, promptLength, systemPromptLength) {
    log(1, 'PROMPT_BUILT', `Prompt built: ${promptLength} chars, system: ${systemPromptLength} chars`, 
        { promptLength, systemPromptLength }, executionId);
}

function logContextLoaded(executionId, contextMessages, contextTokens) {
    log(1, 'CONTEXT_LOADED', `Loaded ${contextMessages} context messages (~${contextTokens} tokens)`, 
        { contextMessages, contextTokens }, executionId);
}

function logToolsLoaded(executionId, toolCount, toolNames) {
    log(2, 'TOOLS_LOADED', `Loaded ${toolCount} tools for AI`, { toolCount, toolNames: toolNames.slice(0, 20) }, executionId);
}

function logApiCallStarted(executionId, provider, endpoint) {
    log(1, 'API_CALL_STARTED', `API call to ${provider}: ${endpoint}`, { provider, endpoint }, executionId);
}

function logApiCallCompleted(executionId, provider, duration, tokenUsage) {
    log(2, 'API_CALL_COMPLETED', `${provider} API responded in ${duration}ms`, 
        { provider, duration, tokenUsage }, executionId);
}

function logApiCallFailed(executionId, provider, error, statusCode) {
    log(4, 'API_CALL_FAILED', `${provider} API failed: ${error}`, { provider, error, statusCode }, executionId);
}

function logStreamStarted(executionId, provider) {
    log(1, 'STREAM_STARTED', `Started streaming from ${provider}`, { provider }, executionId);
}

function logStreamChunk(executionId, chunkSize, totalReceived) {
    log(0, 'STREAM_CHUNK', `Received chunk: ${chunkSize} bytes (total: ${totalReceived})`, 
        { chunkSize, totalReceived }, executionId);
}

function logStreamCompleted(executionId, totalTokens, duration) {
    log(2, 'STREAM_COMPLETED', `Stream completed: ${totalTokens} tokens in ${duration}ms`, 
        { totalTokens, duration }, executionId);
}

// 21-40: Tool Execution
function logToolCallRequested(executionId, toolName, rawArgs) {
    log(2, 'TOOL_CALL_REQUESTED', `AI requested tool: ${toolName}`, { toolName, rawArgs }, executionId);
    performanceMetrics.totalToolCalls++;
    performanceMetrics.toolCallsByName[toolName] = (performanceMetrics.toolCallsByName[toolName] || 0) + 1;
}

function logToolArgsReceived(executionId, toolName, args) {
    log(1, 'TOOL_ARGS_RECEIVED', `Tool ${toolName} args received`, { toolName, args }, executionId);
}

function logToolArgsNormalized(executionId, toolName, originalArgs, normalizedArgs) {
    log(1, 'TOOL_ARGS_NORMALIZED', `Tool ${toolName} args normalized`, 
        { toolName, originalArgs, normalizedArgs, changes: getArgChanges(originalArgs, normalizedArgs) }, executionId);
}

function logToolArgsValidated(executionId, toolName, isValid, errors) {
    log(isValid ? 1 : 3, 'TOOL_ARGS_VALIDATED', `Tool ${toolName} args ${isValid ? 'valid' : 'invalid'}`, 
        { toolName, isValid, errors }, executionId);
}

function logToolPermissionCheck(executionId, toolName, userId, hasPermission, requiredPermission) {
    log(1, 'TOOL_PERMISSION_CHECK', `Permission check for ${toolName}: ${hasPermission ? 'GRANTED' : 'DENIED'}`, 
        { toolName, userId, hasPermission, requiredPermission }, executionId);
}

function logToolExecutionStarted(executionId, toolName, args) {
    log(2, 'TOOL_EXEC_STARTED', `Executing tool: ${toolName}`, { toolName, args }, executionId);
}

function logToolExecutionProgress(executionId, toolName, step, details) {
    log(1, 'TOOL_EXEC_PROGRESS', `Tool ${toolName} progress: ${step}`, { toolName, step, details }, executionId);
}

function logToolExecutionCompleted(executionId, toolName, duration, result) {
    const success = result?.success !== false;
    log(success ? 2 : 3, 'TOOL_EXEC_COMPLETED', `Tool ${toolName} completed in ${duration}ms`, 
        { toolName, duration, success, resultPreview: JSON.stringify(result).substring(0, 200) }, executionId);
}

function logToolExecutionFailed(executionId, toolName, error, stack) {
    log(4, 'TOOL_EXEC_FAILED', `Tool ${toolName} failed: ${error}`, { toolName, error, stack }, executionId);
}

function logToolResultSent(executionId, toolName, resultSize) {
    log(1, 'TOOL_RESULT_SENT', `Tool ${toolName} result sent to AI (${resultSize} chars)`, 
        { toolName, resultSize }, executionId);
}

function logToolChainStarted(executionId, toolCount) {
    log(2, 'TOOL_CHAIN_STARTED', `Starting tool chain with ${toolCount} tools`, { toolCount }, executionId);
}

function logToolChainProgress(executionId, current, total, currentTool) {
    log(1, 'TOOL_CHAIN_PROGRESS', `Tool chain progress: ${current}/${total} (${currentTool})`, 
        { current, total, currentTool }, executionId);
}

function logToolChainCompleted(executionId, totalDuration, successCount, failCount) {
    log(2, 'TOOL_CHAIN_COMPLETED', `Tool chain completed: ${successCount} success, ${failCount} failed`, 
        { totalDuration, successCount, failCount }, executionId);
}

function logToolNotFound(executionId, toolName, similarTools) {
    log(3, 'TOOL_NOT_FOUND', `Tool not found: ${toolName}`, { toolName, similarTools }, executionId);
}

function logToolDeprecated(executionId, toolName, replacementTool) {
    log(3, 'TOOL_DEPRECATED', `Tool ${toolName} is deprecated, use ${replacementTool}`, 
        { toolName, replacementTool }, executionId);
}

function logToolRateLimited(executionId, toolName, waitTime) {
    log(3, 'TOOL_RATE_LIMITED', `Tool ${toolName} rate limited, waiting ${waitTime}ms`, 
        { toolName, waitTime }, executionId);
}

function logToolCached(executionId, toolName, cacheHit) {
    log(1, 'TOOL_CACHED', `Tool ${toolName} cache ${cacheHit ? 'HIT' : 'MISS'}`, { toolName, cacheHit }, executionId);
}

function logToolRetry(executionId, toolName, attempt, maxAttempts, error) {
    log(3, 'TOOL_RETRY', `Retrying tool ${toolName} (${attempt}/${maxAttempts})`, 
        { toolName, attempt, maxAttempts, error }, executionId);
}

function logToolTimeout(executionId, toolName, timeoutMs) {
    log(4, 'TOOL_TIMEOUT', `Tool ${toolName} timed out after ${timeoutMs}ms`, { toolName, timeoutMs }, executionId);
}

function logToolQueuePosition(executionId, toolName, position) {
    log(1, 'TOOL_QUEUE_POSITION', `Tool ${toolName} queued at position ${position}`, 
        { toolName, position }, executionId);
}

// 41-55: Discord API Operations
function logDiscordApiCall(executionId, method, endpoint, params) {
    log(1, 'DISCORD_API_CALL', `Discord API: ${method} ${endpoint}`, { method, endpoint, params }, executionId);
}

function logDiscordApiResponse(executionId, method, endpoint, statusCode, duration) {
    log(statusCode < 400 ? 1 : 3, 'DISCORD_API_RESPONSE', `Discord API ${method} ${endpoint}: ${statusCode} (${duration}ms)`, 
        { method, endpoint, statusCode, duration }, executionId);
}

function logDiscordApiError(executionId, method, endpoint, error, code) {
    log(4, 'DISCORD_API_ERROR', `Discord API error: ${error}`, { method, endpoint, error, code }, executionId);
}

function logDiscordRateLimit(executionId, endpoint, retryAfter) {
    log(3, 'DISCORD_RATE_LIMIT', `Discord rate limit on ${endpoint}, retry after ${retryAfter}ms`, 
        { endpoint, retryAfter }, executionId);
}

function logChannelFetched(executionId, channelId, channelName, channelType) {
    log(1, 'CHANNEL_FETCHED', `Fetched channel: ${channelName} (${channelType})`, 
        { channelId, channelName, channelType }, executionId);
}

function logMemberFetched(executionId, memberId, memberName, roles) {
    log(1, 'MEMBER_FETCHED', `Fetched member: ${memberName}`, { memberId, memberName, roleCount: roles.length }, executionId);
}

function logMemberSearched(executionId, query, resultsCount, matchedMember) {
    log(1, 'MEMBER_SEARCHED', `Searched for member "${query}": ${resultsCount} results`, 
        { query, resultsCount, matchedMember }, executionId);
}

function logRoleFetched(executionId, roleId, roleName, permissions) {
    log(1, 'ROLE_FETCHED', `Fetched role: ${roleName}`, { roleId, roleName, permissions }, executionId);
}

function logMessageSent(executionId, channelId, messageId, contentLength) {
    log(2, 'MESSAGE_SENT', `Sent message to channel`, { channelId, messageId, contentLength }, executionId);
}

function logMessageEdited(executionId, channelId, messageId) {
    log(2, 'MESSAGE_EDITED', `Edited message`, { channelId, messageId }, executionId);
}

function logMessageDeleted(executionId, channelId, messageId) {
    log(2, 'MESSAGE_DELETED', `Deleted message`, { channelId, messageId }, executionId);
}

function logEmbedSent(executionId, channelId, embedTitle, fieldCount) {
    log(2, 'EMBED_SENT', `Sent embed: ${embedTitle}`, { channelId, embedTitle, fieldCount }, executionId);
}

function logReactionAdded(executionId, messageId, emoji) {
    log(1, 'REACTION_ADDED', `Added reaction ${emoji}`, { messageId, emoji }, executionId);
}

function logThreadCreated(executionId, threadId, threadName, parentId) {
    log(2, 'THREAD_CREATED', `Created thread: ${threadName}`, { threadId, threadName, parentId }, executionId);
}

function logChannelCreated(executionId, channelId, channelName, channelType) {
    log(2, 'CHANNEL_CREATED', `Created channel: ${channelName}`, { channelId, channelName, channelType }, executionId);
}

// 56-70: Moderation Actions
function logModerationAction(executionId, action, targetId, targetName, reason) {
    log(2, 'MODERATION_ACTION', `${action}: ${targetName}`, { action, targetId, targetName, reason }, executionId);
}

function logTimeoutApplied(executionId, memberId, memberName, duration, reason) {
    log(2, 'TIMEOUT_APPLIED', `Timeout applied to ${memberName} for ${duration}min`, 
        { memberId, memberName, duration, reason }, executionId);
}

function logTimeoutRemoved(executionId, memberId, memberName) {
    log(2, 'TIMEOUT_REMOVED', `Timeout removed from ${memberName}`, { memberId, memberName }, executionId);
}

function logKickExecuted(executionId, memberId, memberName, reason) {
    log(2, 'KICK_EXECUTED', `Kicked ${memberName}`, { memberId, memberName, reason }, executionId);
}

function logBanExecuted(executionId, memberId, memberName, reason, deleteDays) {
    log(2, 'BAN_EXECUTED', `Banned ${memberName}`, { memberId, memberName, reason, deleteDays }, executionId);
}

function logUnbanExecuted(executionId, userId, reason) {
    log(2, 'UNBAN_EXECUTED', `Unbanned user ${userId}`, { userId, reason }, executionId);
}

function logWarnIssued(executionId, memberId, memberName, reason, warnCount) {
    log(2, 'WARN_ISSUED', `Warned ${memberName} (${warnCount} total)`, { memberId, memberName, reason, warnCount }, executionId);
}

function logRoleAssigned(executionId, memberId, memberName, roleId, roleName) {
    log(2, 'ROLE_ASSIGNED', `Assigned role ${roleName} to ${memberName}`, 
        { memberId, memberName, roleId, roleName }, executionId);
}

function logRoleRemoved(executionId, memberId, memberName, roleId, roleName) {
    log(2, 'ROLE_REMOVED', `Removed role ${roleName} from ${memberName}`, 
        { memberId, memberName, roleId, roleName }, executionId);
}

function logNicknameChanged(executionId, memberId, memberName, oldNick, newNick) {
    log(2, 'NICKNAME_CHANGED', `Changed nickname for ${memberName}`, 
        { memberId, memberName, oldNick, newNick }, executionId);
}

function logPurgeExecuted(executionId, channelId, count, criteria) {
    log(2, 'PURGE_EXECUTED', `Purged ${count} messages`, { channelId, count, criteria }, executionId);
}

function logSlowmodeSet(executionId, channelId, seconds) {
    log(2, 'SLOWMODE_SET', `Set slowmode to ${seconds}s`, { channelId, seconds }, executionId);
}

function logChannelLocked(executionId, channelId, channelName) {
    log(2, 'CHANNEL_LOCKED', `Locked channel ${channelName}`, { channelId, channelName }, executionId);
}

function logChannelUnlocked(executionId, channelId, channelName) {
    log(2, 'CHANNEL_UNLOCKED', `Unlocked channel ${channelName}`, { channelId, channelName }, executionId);
}

function logAutomodTriggered(executionId, trigger, content, action) {
    log(2, 'AUTOMOD_TRIGGERED', `Automod triggered: ${trigger}`, { trigger, content: content.substring(0, 50), action }, executionId);
}

// 71-85: Response Generation
function logResponseGenerated(executionId, responseLength, hasEmbed, hasButtons) {
    log(2, 'RESPONSE_GENERATED', `Generated response: ${responseLength} chars`, 
        { responseLength, hasEmbed, hasButtons }, executionId);
}

function logResponseTruncated(executionId, originalLength, truncatedLength, reason) {
    log(3, 'RESPONSE_TRUNCATED', `Response truncated from ${originalLength} to ${truncatedLength}`, 
        { originalLength, truncatedLength, reason }, executionId);
}

function logResponseSplit(executionId, partCount, totalLength) {
    log(2, 'RESPONSE_SPLIT', `Response split into ${partCount} parts`, { partCount, totalLength }, executionId);
}

function logEmbedBuilt(executionId, title, fieldCount, hasImage, hasFooter) {
    log(1, 'EMBED_BUILT', `Built embed: ${title}`, { title, fieldCount, hasImage, hasFooter }, executionId);
}

function logButtonsAdded(executionId, buttonCount, buttonLabels) {
    log(1, 'BUTTONS_ADDED', `Added ${buttonCount} buttons`, { buttonCount, buttonLabels }, executionId);
}

function logSelectMenuAdded(executionId, optionCount) {
    log(1, 'SELECT_MENU_ADDED', `Added select menu with ${optionCount} options`, { optionCount }, executionId);
}

function logModalCreated(executionId, title, fieldCount) {
    log(1, 'MODAL_CREATED', `Created modal: ${title}`, { title, fieldCount }, executionId);
}

function logAttachmentAdded(executionId, filename, size, type) {
    log(1, 'ATTACHMENT_ADDED', `Added attachment: ${filename}`, { filename, size, type }, executionId);
}

function logMentionAdded(executionId, mentionType, targetId) {
    log(1, 'MENTION_ADDED', `Added ${mentionType} mention`, { mentionType, targetId }, executionId);
}

function logFormattingApplied(executionId, formatType, textLength) {
    log(0, 'FORMATTING_APPLIED', `Applied ${formatType} formatting`, { formatType, textLength }, executionId);
}

function logCodeBlockAdded(executionId, language, codeLength) {
    log(1, 'CODE_BLOCK_ADDED', `Added ${language} code block`, { language, codeLength }, executionId);
}

function logReplyQueued(executionId, targetMessageId) {
    log(1, 'REPLY_QUEUED', `Queued reply to message`, { targetMessageId }, executionId);
}

function logReplySent(executionId, messageId, duration) {
    log(2, 'REPLY_SENT', `Reply sent in ${duration}ms`, { messageId, duration }, executionId);
}

function logReplyFailed(executionId, error, retrying) {
    log(4, 'REPLY_FAILED', `Reply failed: ${error}`, { error, retrying }, executionId);
}

function logTypingIndicatorSent(executionId, channelId) {
    log(0, 'TYPING_INDICATOR', `Sent typing indicator`, { channelId }, executionId);
}

// 86-100: System & Performance
function logMemoryUsage(executionId) {
    const usage = process.memoryUsage();
    log(1, 'MEMORY_USAGE', `Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB / ${Math.round(usage.heapTotal / 1024 / 1024)}MB`, 
        { heapUsed: usage.heapUsed, heapTotal: usage.heapTotal, rss: usage.rss }, executionId);
}

function logCpuUsage(executionId, cpuPercent) {
    log(1, 'CPU_USAGE', `CPU: ${cpuPercent}%`, { cpuPercent }, executionId);
}

function logEventLoopLag(executionId, lagMs) {
    log(lagMs > 100 ? 3 : 1, 'EVENT_LOOP_LAG', `Event loop lag: ${lagMs}ms`, { lagMs }, executionId);
}

function logCacheStats(executionId, cacheType, size, hitRate) {
    log(1, 'CACHE_STATS', `${cacheType} cache: ${size} items, ${hitRate}% hit rate`, 
        { cacheType, size, hitRate }, executionId);
}

function logConnectionStatus(executionId, service, status, latency) {
    log(status === 'connected' ? 2 : 3, 'CONNECTION_STATUS', `${service}: ${status}`, 
        { service, status, latency }, executionId);
}

function logShardStatus(executionId, shardId, status, guilds) {
    log(2, 'SHARD_STATUS', `Shard ${shardId}: ${status}`, { shardId, status, guilds }, executionId);
}

function logHeartbeat(executionId, latency) {
    log(0, 'HEARTBEAT', `Heartbeat: ${latency}ms`, { latency }, executionId);
}

function logGatewayEvent(executionId, eventType, data) {
    log(0, 'GATEWAY_EVENT', `Gateway event: ${eventType}`, { eventType, data }, executionId);
}

function logConfigLoaded(executionId, configName, values) {
    log(2, 'CONFIG_LOADED', `Loaded config: ${configName}`, { configName, valueCount: Object.keys(values).length }, executionId);
}

function logServiceStarted(executionId, serviceName, port) {
    log(2, 'SERVICE_STARTED', `${serviceName} started${port ? ` on port ${port}` : ''}`, { serviceName, port }, executionId);
}

function logServiceStopped(executionId, serviceName, reason) {
    log(2, 'SERVICE_STOPPED', `${serviceName} stopped: ${reason}`, { serviceName, reason }, executionId);
}

function logErrorRecovered(executionId, errorType, recoveryAction) {
    log(3, 'ERROR_RECOVERED', `Recovered from ${errorType}`, { errorType, recoveryAction }, executionId);
}

function logUnhandledError(executionId, error, stack) {
    log(5, 'UNHANDLED_ERROR', `Unhandled error: ${error}`, { error, stack }, executionId);
}

function logPerformanceMetrics(executionId) {
    const avgTime = performanceMetrics.responseTimes.length > 0 
        ? performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length 
        : 0;
    log(2, 'PERFORMANCE_METRICS', `Metrics: ${performanceMetrics.totalRequests} requests, ${avgTime.toFixed(0)}ms avg`, 
        performanceMetrics, executionId);
}

function logDebugSummary(executionId) {
    const context = getContext(executionId);
    if (!context) return;
    
    const duration = Date.now() - context.startTime;
    log(2, 'DEBUG_SUMMARY', `Execution summary for ${executionId}`, {
        duration,
        logCount: context.logs.length,
        toolCallCount: context.toolCalls.length,
        errorCount: context.errors.length,
        warningCount: context.warnings.length
    }, executionId);
}

// Helper function
function getArgChanges(original, normalized) {
    const changes = [];
    for (const key of Object.keys(normalized)) {
        if (!original.hasOwnProperty(key) && normalized[key] !== undefined) {
            changes.push(`added: ${key}`);
        }
    }
    for (const key of Object.keys(original)) {
        if (!normalized.hasOwnProperty(key)) {
            changes.push(`removed: ${key}`);
        }
    }
    return changes;
}

/**
 * Send debug embed to the debug channel
 */
async function sendDebugEmbed(client, executionId, title, description, fields = [], color = 0x00FF00) {
    try {
        const channel = await client.channels.fetch(DEBUG_CHANNEL_ID);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(`[DEBUG] ${title}`)
            .setDescription(description || 'No description')
            .setColor(color)
            .setTimestamp()
            .setFooter({ text: `Execution: ${executionId?.substring(0, 8) || 'N/A'}` });

        for (const field of fields.slice(0, 25)) {
            embed.addFields({ 
                name: field.name?.substring(0, 256) || 'Field', 
                value: (field.value?.substring(0, 1024) || 'N/A'),
                inline: field.inline || false
            });
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[DebugService] Failed to send debug embed:', error.message);
    }
}

/**
 * Send a full execution report to debug channel
 */
async function sendExecutionReport(client, executionId) {
    const context = getContext(executionId);
    if (!context) return;

    const duration = Date.now() - context.startTime;
    const fields = [
        { name: 'Duration', value: `${duration}ms`, inline: true },
        { name: 'Tool Calls', value: `${context.toolCalls.length}`, inline: true },
        { name: 'Errors', value: `${context.errors.length}`, inline: true },
        { name: 'Warnings', value: `${context.warnings.length}`, inline: true },
        { name: 'Log Entries', value: `${context.logs.length}`, inline: true }
    ];

    if (context.errors.length > 0) {
        fields.push({
            name: 'Error Details',
            value: context.errors.map(e => `\`${e.category}\`: ${e.message}`).join('\n').substring(0, 1024)
        });
    }

    if (context.toolCalls.length > 0) {
        fields.push({
            name: 'Tools Called',
            value: context.toolCalls.map(t => `\`${t.name}\`: ${t.success ? 'OK' : 'FAIL'} (${t.duration}ms)`).join('\n').substring(0, 1024)
        });
    }

    const color = context.errors.length > 0 ? 0xFF0000 : context.warnings.length > 0 ? 0xFFFF00 : 0x00FF00;
    await sendDebugEmbed(client, executionId, 'Execution Report', 
        `Request completed in ${duration}ms`, fields, color);
}

// Export everything
module.exports = {
    LogLevel,
    log,
    createExecutionContext,
    getContext,
    sendDebugEmbed,
    sendExecutionReport,
    performanceMetrics,
    
    // 1-10: Request Lifecycle
    logRequestReceived,
    logRequestParsed,
    logRequestValidated,
    logRequestQueued,
    logRequestStarted,
    logRequestCompleted,
    logRequestTimeout,
    logRequestRetry,
    logRequestCancelled,
    logRequestRateLimited,
    
    // 11-20: AI/LLM Processing
    logModelSelected,
    logPromptBuilt,
    logContextLoaded,
    logToolsLoaded,
    logApiCallStarted,
    logApiCallCompleted,
    logApiCallFailed,
    logStreamStarted,
    logStreamChunk,
    logStreamCompleted,
    
    // 21-40: Tool Execution
    logToolCallRequested,
    logToolArgsReceived,
    logToolArgsNormalized,
    logToolArgsValidated,
    logToolPermissionCheck,
    logToolExecutionStarted,
    logToolExecutionProgress,
    logToolExecutionCompleted,
    logToolExecutionFailed,
    logToolResultSent,
    logToolChainStarted,
    logToolChainProgress,
    logToolChainCompleted,
    logToolNotFound,
    logToolDeprecated,
    logToolRateLimited,
    logToolCached,
    logToolRetry,
    logToolTimeout,
    logToolQueuePosition,
    
    // 41-55: Discord API Operations
    logDiscordApiCall,
    logDiscordApiResponse,
    logDiscordApiError,
    logDiscordRateLimit,
    logChannelFetched,
    logMemberFetched,
    logMemberSearched,
    logRoleFetched,
    logMessageSent,
    logMessageEdited,
    logMessageDeleted,
    logEmbedSent,
    logReactionAdded,
    logThreadCreated,
    logChannelCreated,
    
    // 56-70: Moderation Actions
    logModerationAction,
    logTimeoutApplied,
    logTimeoutRemoved,
    logKickExecuted,
    logBanExecuted,
    logUnbanExecuted,
    logWarnIssued,
    logRoleAssigned,
    logRoleRemoved,
    logNicknameChanged,
    logPurgeExecuted,
    logSlowmodeSet,
    logChannelLocked,
    logChannelUnlocked,
    logAutomodTriggered,
    
    // 71-85: Response Generation
    logResponseGenerated,
    logResponseTruncated,
    logResponseSplit,
    logEmbedBuilt,
    logButtonsAdded,
    logSelectMenuAdded,
    logModalCreated,
    logAttachmentAdded,
    logMentionAdded,
    logFormattingApplied,
    logCodeBlockAdded,
    logReplyQueued,
    logReplySent,
    logReplyFailed,
    logTypingIndicatorSent,
    
    // 86-100: System & Performance
    logMemoryUsage,
    logCpuUsage,
    logEventLoopLag,
    logCacheStats,
    logConnectionStatus,
    logShardStatus,
    logHeartbeat,
    logGatewayEvent,
    logConfigLoaded,
    logServiceStarted,
    logServiceStopped,
    logErrorRecovered,
    logUnhandledError,
    logPerformanceMetrics,
    logDebugSummary
};
