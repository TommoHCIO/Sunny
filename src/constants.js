// src/constants.js
/**
 * Application Constants
 * Centralizes magic numbers and configuration values for maintainability
 */

// ===== RETRY CONFIGURATION =====
module.exports.RETRY = {
    // Default retry settings
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 30000,
    JITTER_PERCENTAGE: 0.25,
    
    // Retry attempts range validation
    MIN_ATTEMPTS: 1,
    MAX_ATTEMPTS_LIMIT: 10
};

// ===== RATE LIMITING CONFIGURATION =====
module.exports.RATE_LIMITS = {
    // Discord API rate limits
    DISCORD: {
        TOKENS_PER_INTERVAL: 45,  // Slightly under Discord's 50 req/s limit for safety
        INTERVAL_MS: 1000,        // 1 second
        MAX_BURST: 10             // Allow bursts of 10 requests
    },
    
    // Anthropic/Z.AI API rate limits
    // Z.AI uses concurrency-based limits (concurrent in-flight requests)
    // rather than traditional RPM limits. Setting high limits to match.
    ANTHROPIC: {
        TOKENS_PER_INTERVAL: 300,  // 300 requests per minute (5 req/sec - very generous for Z.AI)
        INTERVAL_MS: 60000,        // 1 minute
        MAX_BURST: 50              // Allow large bursts up to 50 concurrent requests
    },
    
    // Tool execution rate limits
    TOOL_EXECUTION: {
        TOKENS_PER_INTERVAL: 20,  // 20 tool executions per second
        INTERVAL_MS: 1000,        // 1 second
        MAX_BURST: 5              // Allow bursts of 5
    }
};

// ===== CLAUDE AI CONFIGURATION =====
module.exports.CLAUDE = {
    // Default model configuration
    DEFAULT_MODEL: 'claude-3-5-haiku-20241022',
    DEFAULT_MAX_TOKENS: 3000,
    DEFAULT_TEMPERATURE: 0.7,
    
    // Agentic loop limits
    MAX_LOOP_ITERATIONS: 20,
    
    // Cache control
    CACHE_TYPE: 'ephemeral'  // Cache for 5 minutes
};

// ===== DISCORD CONFIGURATION =====
module.exports.DISCORD = {
    // Message limits
    MAX_MESSAGE_LENGTH: 2000,
    MAX_EMBED_DESCRIPTION: 4096,
    MAX_EMBED_FIELDS: 25,
    
    // Bulk operations
    MAX_BULK_DELETE: 100,
    MAX_ROLE_POSITION: 250,
    
    // Timeouts and limits
    MAX_SLOWMODE_SECONDS: 21600,  // 6 hours
    MAX_TIMEOUT_DURATION_MS: 2419200000,  // 28 days
    
    // Member fetching
    DEFAULT_MEMBER_LIMIT: 50,
    MAX_MEMBER_FETCH_LIMIT: 1000,
    
    // Audit log limits
    DEFAULT_AUDIT_LOG_LIMIT: 10,
    MAX_AUDIT_LOG_LIMIT: 100,
    
    // Thread configuration
    DEFAULT_AUTO_ARCHIVE_DURATION: 60,  // minutes
    
    // Invite configuration
    DEFAULT_INVITE_MAX_AGE: 0,     // Never expires
    DEFAULT_INVITE_MAX_USES: 0,    // Unlimited uses
    
    // Permission error codes
    ERROR_CODES: {
        MISSING_PERMISSIONS: 50013,
        UNKNOWN_MESSAGE: 10008,
        UNKNOWN_CHANNEL: 10003,
        INVALID_EMOJI: 10014
    }
};

// ===== CONVERSATION MANAGEMENT =====
module.exports.CONVERSATION = {
    // Context limits
    MAX_MESSAGES_IN_HISTORY: 50,
    MAX_CONTEXT_AGE_HOURS: 1,
    
    // Message cleanup
    CLEANUP_INTERVAL_MS: 300000,  // 5 minutes
    MESSAGE_RETENTION_MS: 3600000  // 1 hour
};

// ===== REACTION ROLES =====
module.exports.REACTION_ROLES = {
    // Validation
    MAX_EMOJI_LENGTH: 100,
    MAX_ROLE_NAME_LENGTH: 100,
    
    // Discord snowflake format
    SNOWFLAKE_REGEX: /^\d{17,19}$/
};

// ===== DATABASE CONFIGURATION =====
module.exports.DATABASE = {
    // Connection timeouts
    CONNECTION_TIMEOUT_MS: 10000,  // 10 seconds
    
    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000
};

// ===== LOGGING =====
module.exports.LOGGING = {
    // Log levels
    LEVELS: {
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info',
        DEBUG: 'debug'
    },
    
    // Log rotation
    MAX_LOG_SIZE_BYTES: 10485760,  // 10 MB
    MAX_LOG_FILES: 5,
    
    // Preview lengths
    PREVIEW_LENGTH: 200,
    SHORT_PREVIEW_LENGTH: 100
};

// ===== PERMISSIONS =====
module.exports.PERMISSIONS = {
    // Owner-only tools (centralized list for easy maintenance)
    OWNER_ONLY_TOOLS: [
        // Channel management
        'delete_channel', 'create_channel', 'rename_channel', 'create_category',
        'delete_category', 'move_channel', 'set_channel_topic', 'set_slowmode',
        'set_channel_nsfw',
        
        // Role management
        'create_role', 'delete_role', 'rename_role', 'set_role_color',
        
        // Member moderation
        'kick_member', 'ban_member', 'unban_member', 'remove_timeout', 'set_nickname',
        
        // Thread management
        'archive_thread', 'lock_thread', 'delete_thread', 'pin_thread',
        
        // Server assets
        'delete_event', 'create_emoji', 'delete_emoji', 'edit_emoji',
        'create_sticker', 'edit_sticker', 'delete_sticker',
        
        // Message management
        'pin_message', 'unpin_message', 'purge_messages', 'remove_all_reactions',
        
        // Server settings
        'set_server_name', 'set_server_icon', 'set_server_banner', 'set_verification_level',
        
        // Invites and webhooks
        'delete_invite', 'create_webhook', 'delete_webhook',
        
        // Events
        'edit_event', 'start_event', 'end_event',
        
        // Voice/Stage channels
        'create_stage_channel', 'set_bitrate', 'set_user_limit', 'set_rtc_region', 'create_stage_instance',
        
        // Permissions
        'set_channel_permissions', 'remove_channel_permission', 'sync_channel_permissions',
        
        // Forum channels
        'create_forum_channel', 'set_default_thread_slowmode', 'set_available_tags',
        
        // Role permissions
        'set_role_permissions',
        
        // Moderation
        'create_automod_rule', 'delete_automod_rule', 'get_audit_logs', 'get_bans'
    ]
};

// ===== VALIDATION =====
module.exports.VALIDATION = {
    // String length limits
    MIN_STRING_LENGTH: 1,
    MAX_CHANNEL_NAME_LENGTH: 100,
    MAX_ROLE_NAME_LENGTH: 100,
    MAX_USERNAME_LENGTH: 32,
    MAX_NICKNAME_LENGTH: 32,
    
    // Numeric limits
    MIN_SLOWMODE_SECONDS: 0,
    MAX_SLOWMODE_SECONDS: 21600,
    MIN_TIMEOUT_SECONDS: 60,
    MAX_TIMEOUT_DAYS: 28
};

// ===== ERROR MESSAGES =====
module.exports.ERROR_MESSAGES = {
    PERMISSION_DENIED: 'Only the server owner can use this action. This requires elevated permissions to keep the server safe! 🍂',
    UNKNOWN_TOOL: 'Unknown tool: {tool}. This shouldn\'t happen - let the developer know!',
    API_KEY_MISSING: 'Oops! There\'s an issue with my configuration 🍂 Let the server owner know!',
    RATE_LIMITED: 'Whoa, I\'m a bit overwhelmed right now! 🍂 Give me a moment to catch my breath and try again!',
    SERVER_ERROR: 'My brain is having a moment 😅 Let me try that again in a sec!',
    GENERIC_ERROR: 'Something went wrong on my end 🍂 Let me try again or ask the server owner for help if this keeps happening!',
    MAX_LOOPS_EXCEEDED: 'I got a bit carried away thinking about this! 😅 Let me know if you\'d like me to try again with a simpler approach.',
    MAX_TOKENS_EXCEEDED: 'I need to think about this in smaller steps! Let me try again with a simpler approach. 🍂'
};

// ===== EMOJIS (for consistency) =====
module.exports.EMOJIS = {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    LOADING: '⏳',
    RETRY: '🔄',
    RATE_LIMIT: '🚦',
    BOT: '🤖',
    TOOL: '🔧',
    LOG: '📝',
    STATS: '📊',
    SEND: '📤',
    RECEIVE: '📥',
    FOLDER: '📁',
    LOCK: '🔒',
    
    // Autumn theme (for Sunny's personality)
    AUTUMN: {
        LEAF: '🍂',
        MAPLE: '🍁',
        COFFEE: '☕',
        HEART: '🧡',
        PUMPKIN: '🎃'
    }
};

// ===== FEATURE FLAGS =====
module.exports.FEATURES = {
    // Enable/disable features for testing or gradual rollout
    ENABLE_REACTION_ROLES: true,
    ENABLE_AUTOMOD: true,
    ENABLE_SCHEDULED_EVENTS: true,
    ENABLE_FORUM_POSTS: true,
    ENABLE_STAGE_CHANNELS: true,
    
    // Development features
    ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
    ENABLE_PERFORMANCE_MONITORING: true
};

// ===== TIMEOUTS =====
module.exports.TIMEOUTS = {
    // API timeouts
    DISCORD_API_TIMEOUT_MS: 15000,    // 15 seconds
    ANTHROPIC_API_TIMEOUT_MS: 60000,  // 60 seconds
    DATABASE_QUERY_TIMEOUT_MS: 5000,  // 5 seconds
    
    // User interaction timeouts
    USER_RESPONSE_TIMEOUT_MS: 60000,  // 1 minute
    
    // Cleanup intervals
    CACHE_CLEANUP_INTERVAL_MS: 300000,  // 5 minutes
    STATS_LOG_INTERVAL_MS: 600000       // 10 minutes
};

// ===== VERSION INFO =====
module.exports.VERSION = {
    BOT_VERSION: '1.0.0',
    API_VERSION: 'v10',
    MIN_NODE_VERSION: '18.0.0'
};
