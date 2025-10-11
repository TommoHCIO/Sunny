// src/services/database/databaseService.js
/**
 * Database Service - High-level interface for database operations
 * Provides graceful fallback when MongoDB is not connected
 */

const mongoose = require('mongoose');
const { Warning, Conversation, UserPreference, ServerSettings, ReactionRole } = require('../../models');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/database.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * Database Service class providing high-level interface for all database operations
 * 
 * Features:
 * - Automatic fallback to in-memory storage when MongoDB unavailable
 * - Graceful error handling with logging
 * - Singleton pattern for consistent state management
 * - Support for warnings, conversations, user preferences, server settings, reaction roles
 */
class DatabaseService {
    constructor() {
        this.isConnected = false;
    }

    /**
     * Check if MongoDB is connected
     * 
     * @returns {boolean} True if MongoDB connection is active, false otherwise
     */
    checkConnection() {
        this.isConnected = mongoose.connection.readyState === 1;
        return this.isConnected;
    }

    /**
     * Execute database operation with fallback
     * 
     * Wrapper method that executes a database operation if connected,
     * otherwise returns a fallback value. Handles errors gracefully with logging.
     * 
     * @param {Function} operation - Async database operation to execute
     * @param {*} fallbackValue - Value to return if DB not connected or operation fails
     * @returns {Promise<*>} Result of operation or fallback value
     * @private
     * 
     * @example
     * const user = await this.withFallback(
     *   async () => await UserModel.findOne({ id: '123' }),
     *   null
     * );
     */
    async withFallback(operation, fallbackValue = null) {
        if (!this.checkConnection()) {
            logger.warn('⚠️  MongoDB not connected - using fallback');
            return fallbackValue;
        }

        try {
            return await operation();
        } catch (error) {
            logger.error('❌ Database operation failed:', error);
            return fallbackValue;
        }
    }

    // ===== WARNING OPERATIONS =====

    /**
     * Add a warning to a user
     * 
     * Records a moderation action in the database. Warnings automatically
     * expire after 30 days unless otherwise specified.
     * 
     * @param {string} userId - Discord user ID to warn
     * @param {string} guildId - Discord guild ID where warning occurred
     * @param {string} reason - Reason for the warning
     * @param {string} [severity='medium'] - Severity: 'low', 'medium', or 'high'
     * @param {Object} [options={}] - Additional metadata
     * @param {string} [options.action] - Action taken (e.g., 'timeout', 'warning')
     * @param {number} [options.duration] - Timeout duration in milliseconds
     * @param {string} [options.moderator] - Moderator ID (default: 'autonomous')
     * @param {string} [options.messageContent] - Message content that triggered warning
     * @param {string} [options.channelId] - Channel ID where violation occurred
     * @returns {Promise<Object|null>} Warning document or null if DB unavailable
     */
    async addWarning(userId, guildId, reason, severity = 'medium', options = {}) {
        return this.withFallback(async () => {
            const warning = await Warning.create({
                userId,
                guildId,
                reason,
                severity,
                action: options.action || 'warning',
                duration: options.duration || null,
                moderator: options.moderator || 'autonomous',
                messageContent: options.messageContent || null,
                channelId: options.channelId || null,
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });

            logger.info(`✅ Warning added: ${userId} in guild ${guildId}`);
            return warning;
        }, null);
    }

    /**
     * Get active warnings for a user
     * 
     * Retrieves all non-expired warnings for a user in a specific guild.
     * 
     * @param {string} userId - Discord user ID to query
     * @param {string} guildId - Discord guild ID to query
     * @returns {Promise<Array<Object>>} Array of active warning documents, empty array if none or DB unavailable
     */
    async getActiveWarnings(userId, guildId) {
        return this.withFallback(async () => {
            return await Warning.getActiveWarnings(userId, guildId);
        }, []);
    }

    /**
     * Count active warnings for a user
     * 
     * @param {string} userId - Discord user ID to count warnings for
     * @param {string} guildId - Discord guild ID to count warnings in
     * @returns {Promise<number>} Count of active warnings, 0 if none or DB unavailable
     */
    async countActiveWarnings(userId, guildId) {
        return this.withFallback(async () => {
            return await Warning.countActiveWarnings(userId, guildId);
        }, 0);
    }

    /**
     * Get warning history for a user
     * 
     * Retrieves all warnings (active and expired) within an optional time range.
     * 
     * @param {string} userId - Discord user ID to query
     * @param {string} guildId - Discord guild ID to query
     * @param {string|null} [timeRange=null] - Time range filter: '24h', '7d', '30d', or null for all
     * @returns {Promise<Array<Object>>} Array of warning documents, empty array if none or DB unavailable
     */
    async getWarningHistory(userId, guildId, timeRange = null) {
        return this.withFallback(async () => {
            return await Warning.getHistory(userId, guildId, timeRange);
        }, []);
    }

    /**
     * Get moderation statistics for a guild
     * 
     * Returns aggregated statistics about moderation actions within a time range.
     * 
     * @param {string} guildId - Discord guild ID to query statistics for
     * @param {string} [timeRange='24h'] - Time range: '24h', '7d', '30d', or 'all'
     * @returns {Promise<Object>} Statistics object with counts and breakdowns
     * @returns {string} return.timeRange - Time range queried
     * @returns {number} return.totalActions - Total moderation actions
     * @returns {Array<Object>} return.actionBreakdown - Actions grouped by type
     * @returns {number} return.uniqueUsersWarned - Count of unique users warned
     * @returns {number} return.activeWarnings - Count of non-expired warnings
     */
    async getModerationStats(guildId, timeRange = '24h') {
        return this.withFallback(async () => {
            return await Warning.getModerationStats(guildId, timeRange);
        }, {
            timeRange,
            totalActions: 0,
            actionBreakdown: [],
            uniqueUsersWarned: 0,
            activeWarnings: 0
        });
    }

    /**
     * Clean up expired warnings
     * 
     * Removes warnings that have passed their expiration date from the database.
     * 
     * @returns {Promise<number>} Count of warnings deleted, 0 if DB unavailable
     */
    async cleanupExpiredWarnings() {
        return this.withFallback(async () => {
            const count = await Warning.cleanupExpired();
            if (count > 0) {
                logger.info(`🧹 Cleaned up ${count} expired warnings`);
            }
            return count;
        }, 0);
    }

    // ===== CONVERSATION OPERATIONS =====

    /**
     * Add message to conversation history
     * 
     * Stores a message in persistent conversation history for context building.
     * 
     * @param {string} channelId - Discord channel ID where message was sent
     * @param {string} guildId - Discord guild ID
     * @param {Object} messageData - Message data to store
     * @param {string} messageData.author - Username of message author
     * @param {string} messageData.authorId - User ID of message author
     * @param {string} messageData.content - Message content
     * @param {boolean} messageData.bot - Whether author is a bot
     * @returns {Promise<Object|null>} Conversation document or null if DB unavailable
     */
    async addMessageToConversation(channelId, guildId, messageData) {
        return this.withFallback(async () => {
            return await Conversation.addMessage(channelId, guildId, messageData);
        }, null);
    }

    /**
     * Get recent messages from conversation
     * 
     * Retrieves the most recent messages from a channel's conversation history.
     * 
     * @param {string} channelId - Discord channel ID to query
     * @param {number} [limit=10] - Maximum number of messages to retrieve
     * @returns {Promise<Array<Object>>} Array of message documents, empty array if none or DB unavailable
     */
    async getRecentMessages(channelId, limit = 10) {
        return this.withFallback(async () => {
            return await Conversation.getRecentMessages(channelId, limit);
        }, []);
    }

    /**
     * Get conversation context (messages + summary)
     * 
     * Retrieves full conversation context including messages and AI-generated summary.
     * 
     * @param {string} channelId - Discord channel ID to query
     * @returns {Promise<Object>} Context object
     * @returns {Array<Object>} return.messages - Recent messages
     * @returns {string|null} return.summary - AI-generated context summary
     * @returns {Date|null} return.lastActivity - Timestamp of last message
     */
    async getConversationContext(channelId) {
        return this.withFallback(async () => {
            return await Conversation.getContext(channelId);
        }, {
            messages: [],
            summary: null,
            lastActivity: null
        });
    }

    /**
     * Update context summary for a channel
     * 
     * Updates the AI-generated summary of conversation context.
     * 
     * @param {string} channelId - Discord channel ID to update
     * @param {string} summary - New summary text generated by AI
     * @returns {Promise<Object|null>} Updated conversation document or null if DB unavailable
     */
    async updateContextSummary(channelId, summary) {
        return this.withFallback(async () => {
            return await Conversation.updateContextSummary(channelId, summary);
        }, null);
    }

    /**
     * Clean up inactive conversations
     * 
     * Removes conversation history for channels with no recent activity.
     * 
     * @param {number} [daysInactive=30] - Number of days of inactivity before cleanup
     * @returns {Promise<number>} Count of conversations deleted, 0 if DB unavailable
     */
    async cleanupInactiveConversations(daysInactive = 30) {
        return this.withFallback(async () => {
            const count = await Conversation.cleanupInactive(daysInactive);
            if (count > 0) {
                logger.info(`🧹 Cleaned up ${count} inactive conversations`);
            }
            return count;
        }, 0);
    }

    // ===== USER PREFERENCE OPERATIONS =====

    /**
     * Get or create user preferences
     * 
     * Retrieves existing preferences or creates new document with defaults.
     * 
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {string|null} [username=null] - Discord username for display
     * @returns {Promise<Object|null>} User preferences document or null if DB unavailable
     */
    async getUserPreferences(userId, guildId, username = null) {
        return this.withFallback(async () => {
            return await UserPreference.getOrCreate(userId, guildId, username);
        }, null);
    }

    /**
     * Update user preferences
     * 
     * Updates user preferences with partial updates.
     * 
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {Object} updates - Partial updates to apply
     * @returns {Promise<Object|null>} Updated preferences document or null if DB unavailable
     */
    async updateUserPreferences(userId, guildId, updates) {
        return this.withFallback(async () => {
            return await UserPreference.updatePreferences(userId, guildId, updates);
        }, null);
    }

    /**
     * Record user interaction
     * 
     * Increments interaction counter and updates last seen timestamp.
     * 
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {string|null} [username=null] - Discord username for display
     * @returns {Promise<Object|null>} Updated preferences document or null if DB unavailable
     */
    async recordInteraction(userId, guildId, username = null) {
        return this.withFallback(async () => {
            return await UserPreference.recordInteraction(userId, guildId, username);
        }, null);
    }

    /**
     * Add self-assigned role
     * 
     * Records that a user has self-assigned a role.
     * 
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {string} roleId - Discord role ID that was assigned
     * @returns {Promise<Object|null>} Updated preferences document or null if DB unavailable
     */
    async addSelfAssignedRole(userId, guildId, roleId) {
        return this.withFallback(async () => {
            return await UserPreference.addSelfAssignedRole(userId, guildId, roleId);
        }, null);
    }

    /**
     * Remove self-assigned role
     * 
     * Removes a role from user's self-assigned roles list.
     * 
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {string} roleId - Discord role ID to remove
     * @returns {Promise<Object|null>} Updated preferences document or null if DB unavailable
     */
    async removeSelfAssignedRole(userId, guildId, roleId) {
        return this.withFallback(async () => {
            return await UserPreference.removeSelfAssignedRole(userId, guildId, roleId);
        }, null);
    }

    /**
     * Get most active users
     * 
     * Returns users ranked by interaction count.
     * 
     * @param {string} guildId - Discord guild ID to query
     * @param {number} [limit=10] - Maximum number of users to return
     * @returns {Promise<Array<Object>>} Array of user preference documents sorted by interactions, empty array if DB unavailable
     */
    async getMostActiveUsers(guildId, limit = 10) {
        return this.withFallback(async () => {
            return await UserPreference.getMostActiveUsers(guildId, limit);
        }, []);
    }

    // ===== SERVER SETTINGS OPERATIONS =====

    /**
     * Get or create server settings
     * 
     * Retrieves existing settings or creates new document with defaults.
     * 
     * @param {string} guildId - Discord guild ID
     * @param {string|null} [guildName=null] - Guild name for display
     * @returns {Promise<Object|null>} Server settings document or null if DB unavailable
     */
    async getServerSettings(guildId, guildName = null) {
        return this.withFallback(async () => {
            return await ServerSettings.getOrCreate(guildId, guildName);
        }, null);
    }

    /**
     * Update moderation settings
     * 
     * Updates moderation configuration for a guild.
     * 
     * @param {string} guildId - Discord guild ID
     * @param {Object} updates - Moderation settings to update
     * @param {boolean} [updates.enabled] - Whether moderation is enabled
     * @param {number} [updates.warnThreshold] - Warning threshold before action
     * @param {number} [updates.muteThreshold] - Mute threshold
     * @returns {Promise<Object|null>} Updated settings document or null if DB unavailable
     */
    async updateModerationSettings(guildId, updates) {
        return this.withFallback(async () => {
            return await ServerSettings.updateModerationSettings(guildId, updates);
        }, null);
    }

    /**
     * Add self-assignable role to server settings
     * 
     * Adds a role to the list of roles users can self-assign.
     * 
     * @param {string} guildId - Discord guild ID
     * @param {string} roleId - Discord role ID to add
     * @returns {Promise<Object|null>} Updated settings document or null if DB unavailable
     */
    async addSelfAssignableRole(guildId, roleId) {
        return this.withFallback(async () => {
            return await ServerSettings.addSelfAssignableRole(guildId, roleId);
        }, null);
    }

    /**
     * Update welcome message settings
     * 
     * Updates welcome message configuration.
     * 
     * @param {string} guildId - Discord guild ID
     * @param {Object} settings - Welcome message settings
     * @param {boolean} [settings.enabled] - Whether welcome messages are enabled
     * @param {string} [settings.channelId] - Channel ID for welcome messages
     * @param {string} [settings.message] - Welcome message template
     * @returns {Promise<Object|null>} Updated settings document or null if DB unavailable
     */
    async updateWelcomeMessage(guildId, settings) {
        return this.withFallback(async () => {
            return await ServerSettings.updateWelcomeMessage(guildId, settings);
        }, null);
    }

    /**
     * Add banned word
     * 
     * Adds a word to the guild's banned words list for automoderation.
     * 
     * @param {string} guildId - Discord guild ID
     * @param {string} word - Word to ban
     * @returns {Promise<Object|null>} Updated settings document or null if DB unavailable
     */
    async addBannedWord(guildId, word) {
        return this.withFallback(async () => {
            return await ServerSettings.addBannedWord(guildId, word);
        }, null);
    }

    /**
     * Set log channel
     * 
     * Configures a channel for specific type of log messages.
     * 
     * @param {string} guildId - Discord guild ID
     * @param {string} logType - Type of log: 'moderation', 'server', 'member', etc.
     * @param {string} channelId - Discord channel ID for logs
     * @returns {Promise<Object|null>} Updated settings document or null if DB unavailable
     */
    async setLogChannel(guildId, logType, channelId) {
        return this.withFallback(async () => {
            return await ServerSettings.setLogChannel(guildId, logType, channelId);
        }, null);
    }

    // ===== REACTION ROLE OPERATIONS =====

    /**
     * Get all reaction roles for a guild
     * 
     * @param {string} guildId - Discord guild ID to query
     * @returns {Promise<Array<Object>>} Array of reaction role documents, empty array if none or DB unavailable
     */
    async getReactionRoles(guildId) {
        return this.withFallback(async () => {
            return await ReactionRole.findByGuild(guildId);
        }, []);
    }

    /**
     * Get all reaction roles across all guilds
     * 
     * Used during bot startup to load all reaction role configurations into memory.
     * 
     * @returns {Promise<Array<Object>>} Array of all reaction role documents, empty array if none or DB unavailable
     */
    async getAllReactionRoles() {
        return this.withFallback(async () => {
            return await ReactionRole.find({});
        }, []);
    }

    /**
     * Save a reaction role binding
     * 
     * Creates or updates a reaction role mapping using upsert to prevent duplicates.
     * 
     * @param {string} messageId - Discord message ID
     * @param {string} channelId - Discord channel ID where message exists
     * @param {string} guildId - Discord guild ID
     * @param {string} emoji - Emoji for reaction
     * @param {string} roleName - Name of role to assign
     * @returns {Promise<Object|null>} Reaction role document or null if DB unavailable
     */
    async saveReactionRole(messageId, channelId, guildId, emoji, roleName) {
        return this.withFallback(async () => {
            // Use upsert to avoid duplicates
            const reactionRole = await ReactionRole.findOneAndUpdate(
                { messageId, emoji },
                { messageId, channelId, guildId, emoji, roleName },
                { upsert: true, new: true }
            );
            logger.info(`✅ Saved reaction role: ${emoji} → ${roleName} on message ${messageId}`);
            return reactionRole;
        }, null);
    }

    /**
     * Delete a reaction role binding
     * 
     * Removes a specific emoji-to-role mapping from a message.
     * 
     * @param {string} messageId - Discord message ID
     * @param {string} emoji - Emoji to remove
     * @returns {Promise<boolean>} True if deleted, false if not found or DB unavailable
     */
    async deleteReactionRole(messageId, emoji) {
        return this.withFallback(async () => {
            const deleted = await ReactionRole.deleteBinding(messageId, emoji);
            if (deleted) {
                logger.info(`✅ Deleted reaction role: ${emoji} from message ${messageId}`);
            }
            return deleted;
        }, false);
    }

    /**
     * Delete all reaction roles for a message
     * 
     * Removes all reaction role mappings from a specific message.
     * 
     * @param {string} messageId - Discord message ID
     * @returns {Promise<number>} Count of reaction roles deleted, 0 if none or DB unavailable
     */
    async deleteReactionRolesByMessage(messageId) {
        return this.withFallback(async () => {
            const count = await ReactionRole.deleteByMessage(messageId);
            if (count > 0) {
                logger.info(`✅ Deleted ${count} reaction role(s) for message ${messageId}`);
            }
            return count;
        }, 0);
    }

    /**
     * Count reaction roles by guild
     * 
     * @param {string} guildId - Discord guild ID to count
     * @returns {Promise<number>} Count of reaction roles in guild, 0 if none or DB unavailable
     */
    async countReactionRoles(guildId) {
        return this.withFallback(async () => {
            return await ReactionRole.countByGuild(guildId);
        }, 0);
    }

    // ===== MAINTENANCE OPERATIONS =====

    /**
     * Run all cleanup tasks
     * 
     * Performs database maintenance by removing expired data:
     * - Expired warnings
     * - Inactive conversations
     * 
     * Should be called periodically (e.g., daily) via scheduled task.
     * 
     * @returns {Promise<Object>} Cleanup statistics
     * @returns {number} return.warnings - Number of warnings deleted
     * @returns {number} return.conversations - Number of conversations deleted
     */
    async runCleanup() {
        if (!this.checkConnection()) {
            logger.warn('⚠️  Skipping cleanup - MongoDB not connected');
            return { warnings: 0, conversations: 0 };
        }

        logger.info('🧹 Running database cleanup...');
        
        const warningsDeleted = await this.cleanupExpiredWarnings();
        const conversationsDeleted = await this.cleanupInactiveConversations(30);

        logger.info(`✅ Cleanup complete - Warnings: ${warningsDeleted}, Conversations: ${conversationsDeleted}`);

        return {
            warnings: warningsDeleted,
            conversations: conversationsDeleted
        };
    }

    /**
     * Get database statistics
     * 
     * Returns document counts for all collections.
     * 
     * @returns {Promise<Object>} Statistics object
     * @returns {number} return.warnings - Warning document count
     * @returns {number} return.conversations - Conversation document count
     * @returns {number} return.users - User preference document count
     * @returns {number} return.servers - Server settings document count
     * @returns {boolean} return.connected - MongoDB connection status
     */
    async getDatabaseStats() {
        return this.withFallback(async () => {
            const [warningCount, conversationCount, userCount, serverCount] = await Promise.all([
                Warning.countDocuments(),
                Conversation.countDocuments(),
                UserPreference.countDocuments(),
                ServerSettings.countDocuments()
            ]);

            return {
                warnings: warningCount,
                conversations: conversationCount,
                users: userCount,
                servers: serverCount,
                connected: true
            };
        }, {
            warnings: 0,
            conversations: 0,
            users: 0,
            servers: 0,
            connected: false
        });
    }
}

// Export singleton instance
module.exports = new DatabaseService();
