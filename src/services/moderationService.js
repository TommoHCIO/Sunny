// src/services/moderationService.js
/**
 * Autonomous Moderation Service
 * Handles automatic timeout/warning system with escalating punishments
 * Uses MongoDB for persistent warning tracking with in-memory fallback
 */

const { canTimeout } = require('../utils/permissions');
const databaseService = require('./database/databaseService');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/moderation.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// In-memory warning storage (until MongoDB is implemented)
// Structure: { userId_guildId: { count: number, warnings: Array, lastWarning: Date } }
const warningCache = new Map();

/**
 * Timeout durations in milliseconds for escalating punishments
 * - FIRST: 5 minutes for first offense
 * - SECOND: 1 hour for second offense
 * - THIRD: 1 day for third+ offense or severe violations
 */
const TIMEOUT_DURATIONS = {
    FIRST: 5 * 60 * 1000,      // 5 minutes
    SECOND: 60 * 60 * 1000,    // 1 hour
    THIRD: 24 * 60 * 60 * 1000 // 1 day
};

/**
 * Regular expression patterns for detecting harmful behavior
 * Organized by severity level (high → low)
 */
const HARMFUL_PATTERNS = {
    SEVERE_THREATS: [
        /kill\s+yourself/i,
        /kys/i,
        /end\s+your\s+life/i,
        /die\s+please/i
    ],
    THREATS: [
        /gonna\s+kill\s+(you|u)/i,
        /will\s+kill\s+(you|u)/i,
        /gonna\s+hurt\s+(you|u)/i,
        /gonna\s+eat\s+(you|u)/i
    ],
    SEVERE_INSULTS: [
        /you\s+suck\s+balls/i,
        /fuck\s+(you|u|off)/i,
        /piece\s+of\s+shit/i
    ],
    HARASSMENT: [
        /crybaby/i,
        /loser/i,
        /pathetic/i
    ]
};

/**
 * Get warning cache key for in-memory storage
 * 
 * Creates a unique identifier for storing user warnings in the cache.
 * 
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {string} Cache key in format "userId_guildId"
 * @private
 */
function getCacheKey(userId, guildId) {
    return `${userId}_${guildId}`;
}

/**
 * Get user's warning history
 * 
 * Retrieves active warnings for a user, preferring MongoDB but falling back
 * to in-memory cache if database is unavailable. Only returns warnings that
 * haven't expired (default 30 day expiration).
 * 
 * @param {string} userId - Discord user ID to query
 * @param {string} guildId - Discord guild ID to query
 * @returns {Promise<Object>} Warning history object
 * @returns {number} return.count - Number of active warnings
 * @returns {Array<Object>} return.warnings - Array of warning details
 * @returns {string} return.warnings[].reason - Reason for warning
 * @returns {string} return.warnings[].severity - Severity level (low/medium/high)
 * @returns {Date} return.warnings[].timestamp - When warning was issued
 * @returns {Date} return.warnings[].expires - When warning expires
 * @returns {Date|null} return.lastWarning - Timestamp of most recent warning
 */
async function getWarnings(userId, guildId) {
    // Try MongoDB first
    const warnings = await databaseService.getActiveWarnings(userId, guildId);
    
    if (warnings && warnings.length > 0) {
        return {
            count: warnings.length,
            warnings: warnings.map(w => ({
                reason: w.reason,
                severity: w.severity,
                timestamp: w.createdAt,
                expires: w.expires
            })),
            lastWarning: warnings[0].createdAt
        };
    }
    
    // Fallback to in-memory cache
    const key = getCacheKey(userId, guildId);
    return warningCache.get(key) || { count: 0, warnings: [], lastWarning: null };
}

/**
 * Add warning to user's history
 * 
 * Records a new warning for a user in MongoDB (with in-memory fallback).
 * Warnings automatically expire after 30 days.
 * 
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} reason - Reason for the warning
 * @param {string} [severity='medium'] - Severity level: 'low', 'medium', or 'high'
 * @param {Object} [options={}] - Additional warning metadata
 * @param {string} [options.action] - Action taken (e.g., 'timeout', 'warning')
 * @param {number} [options.duration] - Duration of timeout if applicable
 * @param {string} [options.messageContent] - Content that triggered the warning
 * @param {string} [options.channelId] - Channel where violation occurred
 * @param {string} [options.moderator] - Moderator who issued warning (default: 'autonomous')
 * @returns {Promise<Object>} Updated warning history object
 * @private
 */
async function addWarning(userId, guildId, reason, severity = 'medium', options = {}) {
    // Try MongoDB first
    const dbWarning = await databaseService.addWarning(userId, guildId, reason, severity, options);
    
    if (dbWarning) {
        logger.info(`✅ Warning stored in MongoDB: ${userId} in guild ${guildId}`);
        return await getWarnings(userId, guildId);
    }
    
    // Fallback to in-memory cache
    const key = getCacheKey(userId, guildId);
    const history = await getWarnings(userId, guildId);
    
    const warning = {
        reason,
        severity,
        timestamp: new Date(),
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
    
    history.warnings.push(warning);
    history.count = history.warnings.length;
    history.lastWarning = new Date();
    
    warningCache.set(key, history);
    
    logger.info(`⚠️  Warning added to cache: ${userId} in guild ${guildId} - Reason: ${reason}`);
    
    return history;
}

/**
 * Clean expired warnings from in-memory cache
 * 
 * Runs periodically (every hour) to remove warnings past their expiration date.
 * MongoDB cleanup is handled by the database service.
 * 
 * @private
 */
function cleanExpiredWarnings() {
    const now = new Date();
    for (const [key, history] of warningCache.entries()) {
        const validWarnings = history.warnings.filter(w => w.expires > now);
        if (validWarnings.length !== history.warnings.length) {
            history.warnings = validWarnings;
            history.count = validWarnings.length;
            warningCache.set(key, history);
            logger.info(`🧹 Cleaned expired warnings for ${key}`);
        }
    }
}

// Clean expired warnings every hour
setInterval(cleanExpiredWarnings, 60 * 60 * 1000);

/**
 * Detect harmful behavior in message content
 * 
 * Scans message content against predefined patterns for harmful behavior,
 * checking in order of severity (high to low). Returns details of first match.
 * 
 * Severity levels:
 * - high: Severe threats, self-harm encouragement (immediate 1-day timeout)
 * - medium: Threats, severe insults (escalating timeouts)
 * - low: Harassment, disrespectful language (escalating timeouts)
 * 
 * @param {string} content - Message content to analyze
 * @returns {Object|null} Violation details if harmful behavior detected, null otherwise
 * @returns {string} return.severity - Severity level: 'low', 'medium', or 'high'
 * @returns {string} return.reason - Human-readable reason for detection
 * @returns {string} return.pattern - Regular expression pattern that matched
 * 
 * @example
 * const violation = detectHarmfulBehavior("You suck balls");
 * if (violation) {
 *   console.log(violation.severity); // "medium"
 *   console.log(violation.reason); // "Severe insult or profanity"
 * }
 */
function detectHarmfulBehavior(content) {
    // Check severe threats first (highest priority)
    for (const pattern of HARMFUL_PATTERNS.SEVERE_THREATS) {
        if (pattern.test(content)) {
            return {
                severity: 'high',
                reason: 'Severe threat or encouragement of self-harm',
                pattern: pattern.source
            };
        }
    }
    
    // Check threats
    for (const pattern of HARMFUL_PATTERNS.THREATS) {
        if (pattern.test(content)) {
            return {
                severity: 'medium',
                reason: 'Threatening language',
                pattern: pattern.source
            };
        }
    }
    
    // Check severe insults
    for (const pattern of HARMFUL_PATTERNS.SEVERE_INSULTS) {
        if (pattern.test(content)) {
            return {
                severity: 'medium',
                reason: 'Severe insult or profanity',
                pattern: pattern.source
            };
        }
    }
    
    // Check harassment
    for (const pattern of HARMFUL_PATTERNS.HARASSMENT) {
        if (pattern.test(content)) {
            return {
                severity: 'low',
                reason: 'Harassment or disrespectful language',
                pattern: pattern.source
            };
        }
    }
    
    return null;
}

/**
 * Calculate timeout duration based on warning history
 * 
 * Implements escalating punishment system:
 * - First offense: 5 minutes (unless severity is 'high')
 * - Second offense: 1 hour (unless severity is 'high')
 * - Third+ offense: 1 day
 * - High severity: Always 1 day regardless of history
 * 
 * @param {number} warningCount - Number of existing warnings (before this one)
 * @param {string} severity - Severity level: 'low', 'medium', or 'high'
 * @returns {number} Timeout duration in milliseconds
 * @private
 */
function calculateTimeoutDuration(warningCount, severity) {
    // Severe violations get longer timeouts immediately
    if (severity === 'high') {
        return TIMEOUT_DURATIONS.THIRD; // 1 day for severe threats
    }
    
    // Escalating durations based on warning count
    if (warningCount === 0) {
        return TIMEOUT_DURATIONS.FIRST; // 5 minutes
    } else if (warningCount === 1) {
        return TIMEOUT_DURATIONS.SECOND; // 1 hour
    } else {
        return TIMEOUT_DURATIONS.THIRD; // 1 day
    }
}

/**
 * Format duration for user-friendly display
 * 
 * Converts milliseconds to human-readable format (days, hours, or minutes).
 * 
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "5 minutes", "1 hour", "2 days")
 * @private
 */
function formatDuration(milliseconds) {
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

/**
 * Apply autonomous timeout to user
 * 
 * Automatically times out a user based on detected violation and warning history.
 * Implements escalating punishment system with educational messaging.
 * 
 * Process:
 * 1. Checks bot permissions
 * 2. Skips administrators and owners
 * 3. Retrieves warning history
 * 4. Adds new warning to record
 * 5. Calculates timeout duration based on history and severity
 * 6. Applies timeout to user
 * 7. Returns appropriate user-facing message
 * 
 * @param {import('discord.js').Message} message - Discord message that triggered violation
 * @param {Object} violation - Violation details from detectHarmfulBehavior
 * @param {string} violation.severity - Severity level: 'low', 'medium', or 'high'
 * @param {string} violation.reason - Reason for the violation
 * @param {string} violation.pattern - Regex pattern that matched
 * @returns {Promise<Object>} Result object with action details
 * @returns {boolean} return.success - Whether timeout was applied successfully
 * @returns {string} return.action - Action taken: 'timeout', 'none', or 'error'
 * @returns {string} [return.duration] - Formatted timeout duration (e.g., "5 minutes")
 * @returns {number} [return.warningCount] - Total warnings after this one
 * @returns {string} return.message - User-facing message explaining the action
 * 
 * @example
 * const violation = detectHarmfulBehavior(message.content);
 * if (violation) {
 *   const result = await applyAutonomousTimeout(message, violation);
 *   await message.channel.send(result.message);
 * }
 */
async function applyAutonomousTimeout(message, violation) {
    const { guild, author, content } = message;
    
    // Check if bot has permission
    if (!canTimeout(guild)) {
        logger.warn(`⚠️  Cannot timeout in ${guild.name} - missing ModerateMembers permission`);
        return {
            success: false,
            action: 'none',
            message: 'I don\'t have permission to timeout members. Please grant me the "Moderate Members" permission to enable autonomous moderation.'
        };
    }
    
    // Don't timeout bot owners or administrators
    const member = guild.members.cache.get(author.id);
    if (!member) {
        return { success: false, action: 'none', message: 'Could not find member in guild' };
    }
    
    if (member.permissions.has('Administrator')) {
        logger.info(`ℹ️  Skipping timeout for administrator: ${author.username}`);
        return {
            success: false,
            action: 'none',
            message: 'Cannot timeout administrators'
        };
    }
    
    // Get warning history
    const history = await getWarnings(author.id, guild.id);
    
    // Add new warning
    await addWarning(author.id, guild.id, violation.reason, violation.severity, {
        action: 'timeout',
        duration: null, // Will be set after calculation
        messageContent: content.substring(0, 200), // Store first 200 chars
        channelId: message.channel.id
    });
    
    // Calculate timeout duration
    const duration = calculateTimeoutDuration(history.count, violation.severity);
    const durationFormatted = formatDuration(duration);
    
    // Apply timeout
    try {
        const timeoutUntil = new Date(Date.now() + duration);
        await member.timeout(duration, `Autonomous moderation: ${violation.reason}`);
        
        logger.info(`🚫 Timeout applied: ${author.username} for ${durationFormatted} - ${violation.reason}`);
        
        // Generate response based on offense count
        let response;
        if (history.count === 0) {
            // First offense - educational
            response = `Hey ${author.username}, that language isn't acceptable in The Nook. I've given you a ${durationFormatted} timeout to cool off. Let's keep our community respectful. 🍂`;
        } else if (history.count === 1) {
            // Second offense - firmer
            response = `${author.username}, this is your second warning. ${durationFormatted} timeout. Please review our community guidelines.`;
        } else {
            // Third+ offense - brief
            response = `${author.username} has been timed out for ${durationFormatted}. Repeated violations will result in escalation to server moderators.`;
        }
        
        return {
            success: true,
            action: 'timeout',
            duration: durationFormatted,
            warningCount: history.count + 1,
            message: response
        };
        
    } catch (error) {
        logger.error(`❌ Failed to apply timeout: ${error.message}`);
        return {
            success: false,
            action: 'error',
            message: `Failed to apply timeout: ${error.message}`
        };
    }
}

/**
 * Check message for violations and take action if needed
 * 
 * Main entry point for autonomous moderation. Analyzes message content
 * and applies appropriate action if harmful behavior is detected.
 * 
 * Automatically called by message event handler. Ignores:
 * - Bot messages
 * - Direct messages (DMs)
 * 
 * @param {import('discord.js').Message} message - Discord message to check
 * @returns {Promise<Object|null>} Result object if action taken, null if no violation
 * @returns {boolean} return.success - Whether action succeeded
 * @returns {string} return.action - Action taken: 'timeout', 'none', or 'error'
 * @returns {string} return.message - User-facing message
 * 
 * @example
 * client.on('messageCreate', async (message) => {
 *   const result = await checkMessage(message);
 *   if (result && result.success) {
 *     await message.channel.send(result.message);
 *   }
 * });
 */
async function checkMessage(message) {
    // Don't moderate bots
    if (message.author.bot) return null;
    
    // Don't moderate in DMs
    if (!message.guild) return null;
    
    // Detect harmful behavior
    const violation = detectHarmfulBehavior(message.content);
    if (!violation) return null;
    
    logger.warn(`⚠️  Violation detected: ${message.author.username} - ${violation.reason}`);
    
    // Apply autonomous timeout
    const result = await applyAutonomousTimeout(message, violation);
    
    return result;
}

/**
 * Get moderation statistics for a guild
 * 
 * Returns statistics about moderation actions taken within a time range.
 * Prefers MongoDB but falls back to in-memory cache if database unavailable.
 * 
 * @param {string} guildId - Discord guild ID to query
 * @param {string} [timeRange='24h'] - Time range for statistics: '24h', '7d', '30d', or 'all'
 * @returns {Promise<Object>} Statistics object
 * @returns {number} return.total_warnings - Total warnings issued in time range
 * @returns {number} return.active_warnings - Currently active (non-expired) warnings
 * @returns {number} return.users_flagged - Unique users with warnings
 * @returns {Array<Object>} [return.action_breakdown] - Breakdown by action type (MongoDB only)
 * @returns {string} return.timeRange - Time range queried
 * @returns {string} return.source - Data source: 'mongodb' or 'cache'
 * 
 * @example
 * const stats = await getStats('1234567890', '7d');
 * console.log(`${stats.total_warnings} warnings in the last 7 days`);
 * console.log(`${stats.users_flagged} unique users flagged`);
 */
async function getStats(guildId, timeRange = '24h') {
    // Try MongoDB first
    const dbStats = await databaseService.getModerationStats(guildId, timeRange);
    
    if (dbStats && dbStats.totalActions > 0) {
        return {
            total_warnings: dbStats.totalActions,
            active_warnings: dbStats.activeWarnings,
            users_flagged: dbStats.uniqueUsersWarned,
            action_breakdown: dbStats.actionBreakdown,
            timeRange: dbStats.timeRange,
            source: 'mongodb'
        };
    }
    
    // Fallback to in-memory cache
    const stats = {
        total_warnings: 0,
        active_timeouts: 0,
        users_flagged: 0,
        timeRange,
        source: 'cache'
    };
    
    const now = new Date();
    let cutoffTime;
    
    switch (timeRange) {
        case '24h':
            cutoffTime = new Date(now - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            cutoffTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            cutoffTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            cutoffTime = new Date(0); // All time
    }
    
    for (const [key, history] of warningCache.entries()) {
        if (!key.endsWith(`_${guildId}`)) continue;
        
        const recentWarnings = history.warnings.filter(w => w.timestamp >= cutoffTime);
        if (recentWarnings.length > 0) {
            stats.total_warnings += recentWarnings.length;
            stats.users_flagged++;
        }
    }
    
    return stats;
}

module.exports = {
    checkMessage,
    detectHarmfulBehavior,
    applyAutonomousTimeout,
    getWarnings,
    getStats,
    HARMFUL_PATTERNS
};
