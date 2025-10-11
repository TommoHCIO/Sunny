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

class DatabaseService {
    constructor() {
        this.isConnected = false;
    }

    /**
     * Check if MongoDB is connected
     */
    checkConnection() {
        this.isConnected = mongoose.connection.readyState === 1;
        return this.isConnected;
    }

    /**
     * Execute database operation with fallback
     * @param {Function} operation - Async database operation
     * @param {*} fallbackValue - Value to return if DB not connected
     * @returns {Promise<*>}
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
     */
    async getActiveWarnings(userId, guildId) {
        return this.withFallback(async () => {
            return await Warning.getActiveWarnings(userId, guildId);
        }, []);
    }

    /**
     * Count active warnings for a user
     */
    async countActiveWarnings(userId, guildId) {
        return this.withFallback(async () => {
            return await Warning.countActiveWarnings(userId, guildId);
        }, 0);
    }

    /**
     * Get warning history for a user
     */
    async getWarningHistory(userId, guildId, timeRange = null) {
        return this.withFallback(async () => {
            return await Warning.getHistory(userId, guildId, timeRange);
        }, []);
    }

    /**
     * Get moderation statistics for a guild
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
     */
    async addMessageToConversation(channelId, guildId, messageData) {
        return this.withFallback(async () => {
            return await Conversation.addMessage(channelId, guildId, messageData);
        }, null);
    }

    /**
     * Get recent messages from conversation
     */
    async getRecentMessages(channelId, limit = 10) {
        return this.withFallback(async () => {
            return await Conversation.getRecentMessages(channelId, limit);
        }, []);
    }

    /**
     * Get conversation context (messages + summary)
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
     */
    async updateContextSummary(channelId, summary) {
        return this.withFallback(async () => {
            return await Conversation.updateContextSummary(channelId, summary);
        }, null);
    }

    /**
     * Clean up inactive conversations
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
     */
    async getUserPreferences(userId, guildId, username = null) {
        return this.withFallback(async () => {
            return await UserPreference.getOrCreate(userId, guildId, username);
        }, null);
    }

    /**
     * Update user preferences
     */
    async updateUserPreferences(userId, guildId, updates) {
        return this.withFallback(async () => {
            return await UserPreference.updatePreferences(userId, guildId, updates);
        }, null);
    }

    /**
     * Record user interaction
     */
    async recordInteraction(userId, guildId, username = null) {
        return this.withFallback(async () => {
            return await UserPreference.recordInteraction(userId, guildId, username);
        }, null);
    }

    /**
     * Add self-assigned role
     */
    async addSelfAssignedRole(userId, guildId, roleId) {
        return this.withFallback(async () => {
            return await UserPreference.addSelfAssignedRole(userId, guildId, roleId);
        }, null);
    }

    /**
     * Remove self-assigned role
     */
    async removeSelfAssignedRole(userId, guildId, roleId) {
        return this.withFallback(async () => {
            return await UserPreference.removeSelfAssignedRole(userId, guildId, roleId);
        }, null);
    }

    /**
     * Get most active users
     */
    async getMostActiveUsers(guildId, limit = 10) {
        return this.withFallback(async () => {
            return await UserPreference.getMostActiveUsers(guildId, limit);
        }, []);
    }

    // ===== SERVER SETTINGS OPERATIONS =====

    /**
     * Get or create server settings
     */
    async getServerSettings(guildId, guildName = null) {
        return this.withFallback(async () => {
            return await ServerSettings.getOrCreate(guildId, guildName);
        }, null);
    }

    /**
     * Update moderation settings
     */
    async updateModerationSettings(guildId, updates) {
        return this.withFallback(async () => {
            return await ServerSettings.updateModerationSettings(guildId, updates);
        }, null);
    }

    /**
     * Add self-assignable role to server settings
     */
    async addSelfAssignableRole(guildId, roleId) {
        return this.withFallback(async () => {
            return await ServerSettings.addSelfAssignableRole(guildId, roleId);
        }, null);
    }

    /**
     * Update welcome message settings
     */
    async updateWelcomeMessage(guildId, settings) {
        return this.withFallback(async () => {
            return await ServerSettings.updateWelcomeMessage(guildId, settings);
        }, null);
    }

    /**
     * Add banned word
     */
    async addBannedWord(guildId, word) {
        return this.withFallback(async () => {
            return await ServerSettings.addBannedWord(guildId, word);
        }, null);
    }

    /**
     * Set log channel
     */
    async setLogChannel(guildId, logType, channelId) {
        return this.withFallback(async () => {
            return await ServerSettings.setLogChannel(guildId, logType, channelId);
        }, null);
    }

    // ===== REACTION ROLE OPERATIONS =====

    /**
     * Get all reaction roles for a guild
     */
    async getReactionRoles(guildId) {
        return this.withFallback(async () => {
            return await ReactionRole.findByGuild(guildId);
        }, []);
    }

    /**
     * Get all reaction roles (for loading on startup)
     */
    async getAllReactionRoles() {
        return this.withFallback(async () => {
            return await ReactionRole.find({});
        }, []);
    }

    /**
     * Save a reaction role binding
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
     */
    async countReactionRoles(guildId) {
        return this.withFallback(async () => {
            return await ReactionRole.countByGuild(guildId);
        }, 0);
    }

    // ===== MAINTENANCE OPERATIONS =====

    /**
     * Run all cleanup tasks
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
