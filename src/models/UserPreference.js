// src/models/UserPreference.js
/**
 * UserPreference Model - Persistent storage for user preferences
 * Stores individual user preferences and settings
 */

const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        default: null
    },
    preferences: {
        notifyOnMention: {
            type: Boolean,
            default: true
        },
        dmNotifications: {
            type: Boolean,
            default: false
        },
        preferredName: {
            type: String,
            default: null
        },
        timezone: {
            type: String,
            default: null
        },
        language: {
            type: String,
            default: 'en'
        },
        pronouns: {
            type: String,
            default: null
        }
    },
    selfAssignedRoles: {
        type: [String], // Array of role IDs
        default: []
    },
    interactionCount: {
        type: Number,
        default: 0
    },
    lastInteraction: {
        type: Date,
        default: null
    },
    joinedAt: {
        type: Date,
        default: null
    },
    customFields: {
        type: Map,
        of: String,
        default: new Map()
    }
}, {
    timestamps: true
});

// Compound index for efficient user+guild queries
userPreferenceSchema.index({ userId: 1, guildId: 1 }, { unique: true });

// Static method: Get or create user preferences
userPreferenceSchema.statics.getOrCreate = async function(userId, guildId, username = null) {
    let prefs = await this.findOne({ userId, guildId });
    
    if (!prefs) {
        prefs = await this.create({
            userId,
            guildId,
            username,
            joinedAt: new Date()
        });
    }
    
    return prefs;
};

// Static method: Update preferences
userPreferenceSchema.statics.updatePreferences = async function(userId, guildId, updates) {
    return this.findOneAndUpdate(
        { userId, guildId },
        {
            $set: {
                'preferences': { ...updates }
            },
            $inc: { interactionCount: 1 },
            lastInteraction: new Date()
        },
        { new: true, upsert: true }
    );
};

// Static method: Add self-assigned role
userPreferenceSchema.statics.addSelfAssignedRole = async function(userId, guildId, roleId) {
    return this.findOneAndUpdate(
        { userId, guildId },
        {
            $addToSet: { selfAssignedRoles: roleId },
            $inc: { interactionCount: 1 },
            lastInteraction: new Date()
        },
        { new: true, upsert: true }
    );
};

// Static method: Remove self-assigned role
userPreferenceSchema.statics.removeSelfAssignedRole = async function(userId, guildId, roleId) {
    return this.findOneAndUpdate(
        { userId, guildId },
        {
            $pull: { selfAssignedRoles: roleId },
            $inc: { interactionCount: 1 },
            lastInteraction: new Date()
        },
        { new: true }
    );
};

// Static method: Record interaction
userPreferenceSchema.statics.recordInteraction = async function(userId, guildId, username = null) {
    return this.findOneAndUpdate(
        { userId, guildId },
        {
            $inc: { interactionCount: 1 },
            lastInteraction: new Date(),
            ...(username && { username })
        },
        { new: true, upsert: true }
    );
};

// Static method: Get most active users in a guild
userPreferenceSchema.statics.getMostActiveUsers = async function(guildId, limit = 10) {
    return this.find({ guildId })
        .sort({ interactionCount: -1 })
        .limit(limit)
        .select('userId username interactionCount lastInteraction');
};

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

module.exports = UserPreference;
