// src/models/AutoMessage.js
/**
 * AutoMessage Model - Persistent storage for automatic messages
 * Supports welcome, goodbye, milestone, scheduled, and trigger-based messages
 */

const mongoose = require('mongoose');

const autoMessageSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    messageType: {
        type: String,
        enum: ['welcome', 'goodbye', 'milestone', 'scheduled', 'trigger'],
        required: true
    },
    enabled: {
        type: Boolean,
        default: true
    },
    channelId: {
        type: String,
        required: true
    },
    content: {
        type: String,
        maxlength: 2000
    },
    embedConfig: {
        enabled: { type: Boolean, default: false },
        title: { type: String, maxlength: 256 },
        description: { type: String, maxlength: 4096 },
        color: { type: String, default: '#F1C40F' },
        footer: { type: String, maxlength: 2048 },
        thumbnail: { type: String }, // URL
        image: { type: String }, // URL
        fields: [{
            name: { type: String, maxlength: 256 },
            value: { type: String, maxlength: 1024 },
            inline: { type: Boolean, default: false }
        }]
    },
    triggers: {
        // For milestone messages
        memberCount: { type: Number },

        // For trigger-based messages
        keywords: [{ type: String, lowercase: true }],

        // For scheduled messages (cron format)
        schedule: { type: String }, // e.g., "0 9 * * MON" (9am every Monday)
        timezone: { type: String, default: 'UTC' }
    },
    variables: {
        type: [String],
        default: ['user', 'server', 'memberCount', 'date', 'time']
    },
    dmUser: {
        type: Boolean,
        default: false // For welcome messages, optionally DM the user
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
autoMessageSchema.index({ guildId: 1, messageType: 1 });
autoMessageSchema.index({ guildId: 1, enabled: 1 });

// Helper method to replace variables
autoMessageSchema.methods.replaceVariables = function(guild, member = null, customVars = {}) {
    let text = this.content;
    const replacements = {
        '{user}': member ? `<@${member.id}>` : '{user}',
        '{username}': member ? member.user.username : '{username}',
        '{server}': guild.name,
        '{memberCount}': guild.memberCount,
        '{date}': new Date().toLocaleDateString(),
        '{time}': new Date().toLocaleTimeString(),
        ...customVars
    };

    for (const [key, value] of Object.entries(replacements)) {
        text = text.replace(new RegExp(key, 'g'), value);
    }

    return text;
};

const AutoMessage = mongoose.model('AutoMessage', autoMessageSchema);

module.exports = AutoMessage;
