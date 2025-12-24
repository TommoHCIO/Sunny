// src/tools/toolWrapper.js
/**
 * Tool Wrapper
 * Provides validation, idempotency, and caching for tool execution
 * Wraps the existing toolExecutor with enhanced functionality
 */

const { validateToolInput, hasSchema } = require('./schemas');
const idempotencyService = require('../services/idempotencyService');
const cacheService = require('../services/cacheService');
const { ValidationError, ToolExecutionError, IdempotencyError, ErrorHandler } = require('../errors');
const { sanitizeObject, sanitizeString } = require('../utils/sanitizer');

// Tools that should use idempotency (mutating operations)
const IDEMPOTENT_TOOLS = new Set([
    'create_channel', 'delete_channel', 'rename_channel',
    'create_category', 'delete_category', 'move_channel',
    'create_role', 'delete_role', 'rename_role',
    'assign_role', 'remove_role',
    'kick_member', 'ban_member', 'unban_member',
    'timeout_member', 'remove_timeout',
    'create_thread', 'delete_thread', 'archive_thread',
    'create_event', 'delete_event', 'edit_event',
    'create_emoji', 'delete_emoji',
    'create_sticker', 'delete_sticker',
    'pin_message', 'unpin_message', 'purge_messages',
    'setup_reaction_role', 'remove_reaction_role',
    'create_ticket', 'close_ticket',
    'create_auto_message', 'delete_auto_message'
]);

// Tools that can be cached (read-only operations)
const CACHEABLE_TOOLS = new Set([
    'list_channels', 'list_roles', 'list_members',
    'get_channel_info', 'get_role_info', 'get_member_info',
    'get_server_info', 'list_emojis', 'list_stickers',
    'get_channel_messages', 'list_tickets', 'get_ticket_stats'
]);

// Cache TTL by tool type (ms)
const CACHE_TTLS = {
    'list_channels': 30000,      // 30 seconds
    'list_roles': 60000,         // 1 minute
    'list_members': 30000,       // 30 seconds
    'get_channel_info': 60000,   // 1 minute
    'get_role_info': 60000,      // 1 minute
    'get_member_info': 30000,    // 30 seconds
    'get_server_info': 120000,   // 2 minutes
    'list_emojis': 300000,       // 5 minutes
    'list_stickers': 300000,     // 5 minutes
    'get_channel_messages': 10000, // 10 seconds
    'list_tickets': 30000,       // 30 seconds
    'get_ticket_stats': 60000    // 1 minute
};

/**
 * Wrap tool execution with validation, idempotency, and caching
 * @param {string} toolName - Name of the tool
 * @param {Object} input - Tool input
 * @param {Object} guild - Discord guild
 * @param {Object} author - Discord user
 * @param {Function} executor - Original tool executor function
 * @param {Object} options - Options
 * @returns {Promise<Object>}
 */
async function wrapToolExecution(toolName, input, guild, author, executor, options = {}) {
    const {
        skipValidation = false,
        skipIdempotency = false,
        skipCache = false,
        executionId = null
    } = options;

    const startTime = Date.now();

    try {
        // Step 1: Validate input
        if (!skipValidation && hasSchema(toolName)) {
            const validation = validateToolInput(toolName, input);
            if (!validation.success) {
                console.log(`[ToolWrapper] Validation failed for ${toolName}: ${validation.error}`);
                return {
                    success: false,
                    error: `Invalid input: ${validation.error}`,
                    validation_error: true
                };
            }
            // Use validated/transformed input
            input = validation.data;
        }

        // Step 2: Check cache for read-only operations
        if (!skipCache && CACHEABLE_TOOLS.has(toolName)) {
            const cacheKey = `${toolName}:${guild.id}:${JSON.stringify(input)}`;
            const cached = cacheService.get('general', cacheKey);
            if (cached) {
                console.log(`[ToolWrapper] Cache hit for ${toolName}`);
                return { ...cached, cached: true };
            }
        }

        // Step 3: Check/use idempotency for mutating operations
        if (!skipIdempotency && IDEMPOTENT_TOOLS.has(toolName)) {
            const result = await idempotencyService.executeWithIdempotency(
                toolName,
                input,
                author.id,
                guild.id,
                async () => await executor(toolName, input, guild, author, executionId),
                { ttlMs: 5 * 60 * 1000 } // 5 minute idempotency window
            );

            if (result.cached) {
                console.log(`[ToolWrapper] Idempotency hit for ${toolName}`);
                return { ...result.result, idempotent: true };
            }

            return result.result;
        }

        // Step 4: Execute the tool
        const result = await executor(toolName, input, guild, author, executionId);

        // Step 5: Cache successful read-only results
        if (!skipCache && CACHEABLE_TOOLS.has(toolName) && result?.success !== false) {
            const cacheKey = `${toolName}:${guild.id}:${JSON.stringify(input)}`;
            const ttl = CACHE_TTLS[toolName] || 30000;
            cacheService.set('general', cacheKey, result, ttl);
        }

        return result;

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[ToolWrapper] Error in ${toolName} after ${duration}ms:`, error.message);

        // Wrap and return error
        const wrappedError = ErrorHandler.wrap(error, { action: toolName });
        return {
            success: false,
            error: ErrorHandler.getUserMessage(wrappedError),
            internal_error: sanitizeString(error.message)
        };
    }
}

/**
 * Invalidate cache for a tool
 * @param {string} toolName - Tool name
 * @param {string} guildId - Guild ID
 */
function invalidateToolCache(toolName, guildId) {
    cacheService.invalidatePattern('general', `${toolName}:${guildId}`);
}

/**
 * Invalidate all caches for a guild
 * @param {string} guildId - Guild ID
 */
function invalidateGuildCache(guildId) {
    cacheService.invalidateGuild(guildId);
}

/**
 * Get wrapper statistics
 * @returns {Object}
 */
function getStats() {
    return {
        cache: cacheService.getStats(),
        idempotency: idempotencyService.getStats()
    };
}

module.exports = {
    wrapToolExecution,
    invalidateToolCache,
    invalidateGuildCache,
    getStats,
    IDEMPOTENT_TOOLS,
    CACHEABLE_TOOLS
};
