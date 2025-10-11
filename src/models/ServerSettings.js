// src/models/ServerSettings.js
/**
 * ServerSettings Model - Persistent storage for server-specific settings
 * Stores configuration and custom settings for each guild
 */

const mongoose = require('mongoose');

const serverSettingsSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    guildName: {
        type: String,
        default: null
    },
    moderation: {
        enabled: {
            type: Boolean,
            default: true
        },
        autonomousTimeouts: {
            type: Boolean,
            default: true
        },
        warningExpireDays: {
            type: Number,
            default: 30
        },
        timeoutDurations: {
            first: {
                type: Number,
                default: 5 * 60 * 1000 // 5 minutes
            },
            second: {
                type: Number,
                default: 60 * 60 * 1000 // 1 hour
            },
            third: {
                type: Number,
                default: 24 * 60 * 60 * 1000 // 1 day
            }
        },
        exemptRoles: {
            type: [String], // Role IDs exempt from autonomous moderation
            default: []
        }
    },
    selfAssignableRoles: {
        type: [String], // Role IDs that members can self-assign
        default: []
    },
    welcomeMessage: {
        enabled: {
            type: Boolean,
            default: false
        },
        channelId: {
            type: String,
            default: null
        },
        message: {
            type: String,
            default: 'Welcome to {server}, {user}! 🍂'
        },
        useEmbed: {
            type: Boolean,
            default: false
        }
    },
    features: {
        reactionRoles: {
            type: Boolean,
            default: true
        },
        autoModeration: {
            type: Boolean,
            default: true
        },
        conversationMemory: {
            type: Boolean,
            default: true
        }
    },
    customCommands: {
        type: Map,
        of: String,
        default: new Map()
    },
    bannedWords: {
        type: [String],
        default: []
    },
    allowedLinks: {
        type: [String],
        default: []
    },
    logChannels: {
        moderation: {
            type: String,
            default: null
        },
        joins: {
            type: String,
            default: null
        },
        messages: {
            type: String,
            default: null
        }
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    language: {
        type: String,
        default: 'en'
    }
}, {
    timestamps: true
});

// Static method: Get or create server settings
serverSettingsSchema.statics.getOrCreate = async function(guildId, guildName = null) {
    let settings = await this.findOne({ guildId });
    
    if (!settings) {
        settings = await this.create({
            guildId,
            guildName
        });
    }
    
    return settings;
};

// Static method: Update moderation settings
serverSettingsSchema.statics.updateModerationSettings = async function(guildId, updates) {
    return this.findOneAndUpdate(
        { guildId },
        {
            $set: {
                'moderation': { ...updates }
            }
        },
        { new: true, upsert: true }
    );
};

// Static method: Add self-assignable role
serverSettingsSchema.statics.addSelfAssignableRole = async function(guildId, roleId) {
    return this.findOneAndUpdate(
        { guildId },
        {
            $addToSet: { selfAssignableRoles: roleId }
        },
        { new: true, upsert: true }
    );
};

// Static method: Remove self-assignable role
serverSettingsSchema.statics.removeSelfAssignableRole = async function(guildId, roleId) {
    return this.findOneAndUpdate(
        { guildId },
        {
            $pull: { selfAssignableRoles: roleId }
        },
        { new: true }
    );
};

// Static method: Update welcome message settings
serverSettingsSchema.statics.updateWelcomeMessage = async function(guildId, settings) {
    return this.findOneAndUpdate(
        { guildId },
        {
            $set: {
                'welcomeMessage': { ...settings }
            }
        },
        { new: true, upsert: true }
    );
};

// Static method: Add banned word
serverSettingsSchema.statics.addBannedWord = async function(guildId, word) {
    return this.findOneAndUpdate(
        { guildId },
        {
            $addToSet: { bannedWords: word.toLowerCase() }
        },
        { new: true, upsert: true }
    );
};

// Static method: Remove banned word
serverSettingsSchema.statics.removeBannedWord = async function(guildId, word) {
    return this.findOneAndUpdate(
        { guildId },
        {
            $pull: { bannedWords: word.toLowerCase() }
        },
        { new: true }
    );
};

// Static method: Set log channel
serverSettingsSchema.statics.setLogChannel = async function(guildId, logType, channelId) {
    return this.findOneAndUpdate(
        { guildId },
        {
            $set: {
                [`logChannels.${logType}`]: channelId
            }
        },
        { new: true, upsert: true }
    );
};

const ServerSettings = mongoose.model('ServerSettings', serverSettingsSchema);

module.exports = ServerSettings;
