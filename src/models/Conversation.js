// src/models/Conversation.js
/**
 * Conversation Model - Persistent storage for conversation context
 * Stores message history for each channel to maintain context across restarts
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    messageId: String,
    authorId: String,
    authorName: String,
    content: String,
    timestamp: Date,
    isBot: Boolean,
    replyToMessageId: String
}, { _id: false });

const conversationSchema = new mongoose.Schema({
    channelId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    channelName: {
        type: String,
        default: null
    },
    messages: {
        type: [messageSchema],
        default: [],
        validate: {
            validator: function(messages) {
                return messages.length <= 50; // Max 50 messages per channel
            },
            message: 'Messages array cannot exceed 50 items'
        }
    },
    lastActivity: {
        type: Date,
        default: Date.now,
        index: true
    },
    contextSummary: {
        type: String, // AI-generated summary of conversation context
        default: null
    },
    lastSummaryUpdate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Static method: Add message to conversation
conversationSchema.statics.addMessage = async function(channelId, guildId, messageData) {
    const conversation = await this.findOne({ channelId });
    
    const newMessage = {
        messageId: messageData.id,
        authorId: messageData.author.id,
        authorName: messageData.author.username,
        content: messageData.content,
        timestamp: messageData.createdAt,
        isBot: messageData.author.bot,
        replyToMessageId: messageData.reference?.messageId || null
    };
    
    if (conversation) {
        // Add to messages array and keep only last 50
        conversation.messages.push(newMessage);
        if (conversation.messages.length > 50) {
            conversation.messages = conversation.messages.slice(-50);
        }
        conversation.lastActivity = new Date();
        await conversation.save();
        return conversation;
    } else {
        // Create new conversation
        return this.create({
            channelId,
            guildId,
            channelName: messageData.channel.name,
            messages: [newMessage],
            lastActivity: new Date()
        });
    }
};

// Static method: Get recent messages from conversation
conversationSchema.statics.getRecentMessages = async function(channelId, limit = 10) {
    const conversation = await this.findOne({ channelId });
    
    if (!conversation) {
        return [];
    }
    
    return conversation.messages.slice(-limit);
};

// Static method: Clear old conversations (inactive for > 30 days)
conversationSchema.statics.cleanupInactive = async function(daysInactive = 30) {
    const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);
    
    const result = await this.deleteMany({
        lastActivity: { $lt: cutoffDate }
    });
    
    return result.deletedCount;
};

// Static method: Update context summary for a channel
conversationSchema.statics.updateContextSummary = async function(channelId, summary) {
    return this.findOneAndUpdate(
        { channelId },
        {
            contextSummary: summary,
            lastSummaryUpdate: new Date()
        },
        { new: true }
    );
};

// Static method: Get conversation context (messages + summary)
conversationSchema.statics.getContext = async function(channelId) {
    const conversation = await this.findOne({ channelId });
    
    if (!conversation) {
        return {
            messages: [],
            summary: null,
            lastActivity: null
        };
    }
    
    return {
        messages: conversation.messages.slice(-10), // Last 10 messages
        summary: conversation.contextSummary,
        lastActivity: conversation.lastActivity
    };
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
