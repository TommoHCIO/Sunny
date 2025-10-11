// src/models/ReactionRole.js
/**
 * ReactionRole Model - Persistent storage for reaction role bindings
 * Ensures reaction roles survive bot restarts
 */

const mongoose = require('mongoose');

const reactionRoleSchema = new mongoose.Schema({
    messageId: {
        type: String,
        required: true,
        index: true
    },
    channelId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    emoji: {
        type: String,
        required: true
    },
    roleName: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient message+emoji queries
reactionRoleSchema.index({ messageId: 1, emoji: 1 }, { unique: true });

// Compound index for guild queries
reactionRoleSchema.index({ guildId: 1, createdAt: -1 });

// Static method: Find all reaction roles for a specific message
reactionRoleSchema.statics.findByMessage = async function(messageId) {
    return this.find({ messageId }).sort({ createdAt: 1 });
};

// Static method: Find all reaction roles for a guild
reactionRoleSchema.statics.findByGuild = async function(guildId) {
    return this.find({ guildId }).sort({ createdAt: -1 });
};

// Static method: Find a specific reaction role binding
reactionRoleSchema.statics.findBinding = async function(messageId, emoji) {
    return this.findOne({ messageId, emoji });
};

// Static method: Delete all reaction roles for a specific message
reactionRoleSchema.statics.deleteByMessage = async function(messageId) {
    const result = await this.deleteMany({ messageId });
    return result.deletedCount;
};

// Static method: Delete a specific reaction role binding
reactionRoleSchema.statics.deleteBinding = async function(messageId, emoji) {
    const result = await this.deleteOne({ messageId, emoji });
    return result.deletedCount > 0;
};

// Static method: Get count of reaction roles by guild
reactionRoleSchema.statics.countByGuild = async function(guildId) {
    return this.countDocuments({ guildId });
};

const ReactionRole = mongoose.model('ReactionRole', reactionRoleSchema);

module.exports = ReactionRole;
