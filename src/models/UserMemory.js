// src/models/UserMemory.js
/**
 * User Memory Model - Persistent user profiles and interaction history
 * Stores user preferences, patterns, and cross-channel interactions
 */

const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
    date: {
        type: Date,
        default: Date.now
    },
    type: {
        type: String,
        enum: ['spam', 'harassment', 'inappropriate', 'timeout', 'warning'],
        required: true
    },
    reason: String,
    severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    resolved: {
        type: Boolean,
        default: false
    },
    moderatorId: String
}, { _id: false });

const interactionSchema = new mongoose.Schema({
    totalMessages: {
        type: Number,
        default: 0
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    channels: [{
        type: String // Channel IDs where user is active
    }],
    averageMessageLength: {
        type: Number,
        default: 0
    },
    messagesSentToday: {
        type: Number,
        default: 0
    },
    lastMessageDate: {
        type: Date,
        default: Date.now
    },
    favoriteChannels: [{
        channelId: String,
        messageCount: Number
    }]
}, { _id: false });

const preferenceSchema = new mongoose.Schema({
    responseStyle: {
        type: String,
        enum: ['detailed', 'brief', 'technical', 'casual', 'default'],
        default: 'default'
    },
    interests: [{
        type: String
    }],
    timezone: String,
    preferredName: String, // Nickname they prefer to be called
    language: {
        type: String,
        default: 'en'
    },
    optOut: {
        type: Boolean,
        default: false // User can opt-out of memory collection
    }
}, { _id: false });

const userMemorySchema = new mongoose.Schema({
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
    username: String,
    displayName: String,

    // User profile information
    profile: {
        pronouns: String,
        bio: String, // User-provided bio or extracted information
        roles: [String], // Current role IDs
        joinedAt: Date,
        preferences: preferenceSchema
    },

    // Interaction tracking
    interactions: interactionSchema,

    // Important notes about the user
    notes: [{
        content: String,
        addedAt: {
            type: Date,
            default: Date.now
        },
        source: String, // Message ID or "system"
        importance: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        }
    }],

    // Topics this user frequently discusses
    frequentTopics: [{
        topic: String,
        count: Number,
        lastMentioned: Date
    }],

    // Moderation history
    violations: [violationSchema],

    // Conversation patterns
    patterns: {
        typicalActiveHours: [Number], // Array of hours (0-23) when user is typically active
        averageResponseTime: Number, // Average time to respond in milliseconds
        conversationStyle: String, // "question-asker", "helper", "casual-chatter", etc.
    },

    // Memory metadata
    memoryVersion: {
        type: Number,
        default: 1
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
        index: true
    },

    // TTL for automatic expiration
    expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 90 * 24 * 60 * 60 * 1000), // 90 days
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true
});

// Compound index for efficient user+guild queries
userMemorySchema.index({ userId: 1, guildId: 1 }, { unique: true });

// Index for finding active users
userMemorySchema.index({ 'interactions.lastSeen': -1 });

// Index for moderation queries
userMemorySchema.index({ 'violations.resolved': 1, guildId: 1 });

// Static methods
userMemorySchema.statics.findOrCreateUser = async function(userId, guildId, userData = {}) {
    let memory = await this.findOne({ userId, guildId });

    if (!memory) {
        memory = await this.create({
            userId,
            guildId,
            username: userData.username,
            displayName: userData.displayName,
            'profile.joinedAt': userData.joinedAt || new Date()
        });
    }

    return memory;
};

// Update user interaction statistics
userMemorySchema.statics.recordInteraction = async function(userId, guildId, messageData) {
    const memory = await this.findOrCreateUser(userId, guildId, {
        username: messageData.author?.username,
        displayName: messageData.member?.displayName
    });

    // Update interaction stats
    memory.interactions.totalMessages += 1;
    memory.interactions.lastSeen = new Date();

    // Track channel activity
    if (messageData.channelId && !memory.interactions.channels.includes(messageData.channelId)) {
        memory.interactions.channels.push(messageData.channelId);
    }

    // Update average message length
    const currentAvg = memory.interactions.averageMessageLength || 0;
    const messageLength = messageData.content?.length || 0;
    memory.interactions.averageMessageLength =
        (currentAvg * (memory.interactions.totalMessages - 1) + messageLength) / memory.interactions.totalMessages;

    // Track daily messages
    const today = new Date().toDateString();
    const lastMessageDate = memory.interactions.lastMessageDate?.toDateString();
    if (today !== lastMessageDate) {
        memory.interactions.messagesSentToday = 1;
        memory.interactions.lastMessageDate = new Date();
    } else {
        memory.interactions.messagesSentToday += 1;
    }

    memory.lastUpdated = new Date();
    await memory.save();

    return memory;
};

// Get user memory with privacy check
userMemorySchema.statics.getUserMemory = async function(userId, guildId) {
    const memory = await this.findOne({
        userId,
        guildId,
        'profile.preferences.optOut': false
    });

    return memory;
};

// Add a note about the user
userMemorySchema.methods.addNote = async function(content, importance = 0.5, source = 'system') {
    // Keep only the 20 most important/recent notes
    this.notes.push({
        content,
        importance,
        source,
        addedAt: new Date()
    });

    // Sort by importance and recency, keep top 20
    this.notes.sort((a, b) => {
        // Prioritize importance, then recency
        if (Math.abs(a.importance - b.importance) > 0.1) {
            return b.importance - a.importance;
        }
        return b.addedAt - a.addedAt;
    });

    this.notes = this.notes.slice(0, 20);
    this.lastUpdated = new Date();

    return this.save();
};

// Export user's memory data (GDPR compliance)
userMemorySchema.methods.exportData = function() {
    const data = this.toObject();
    // Remove internal MongoDB fields
    delete data._id;
    delete data.__v;
    return data;
};

// Delete user memory (privacy compliance)
userMemorySchema.statics.deleteUserMemory = async function(userId, guildId = null) {
    if (guildId) {
        return this.deleteOne({ userId, guildId });
    }
    // Delete all memories for user across all guilds
    return this.deleteMany({ userId });
};

module.exports = mongoose.model('UserMemory', userMemorySchema);