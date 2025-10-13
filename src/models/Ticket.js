// src/models/Ticket.js
/**
 * Ticket Model - Persistent storage for support tickets
 * Thread-based ticketing system following Discord.js v14 best practices
 */

const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    ticketNumber: {
        type: Number,
        required: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    threadId: {
        type: String,
        required: true,
        unique: true
    },
    channelId: {
        type: String,
        required: true
    },
    creatorId: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['open', 'in-progress', 'waiting', 'resolved', 'closed'],
        default: 'open',
        index: true
    },
    category: {
        type: String,
        enum: ['support', 'report', 'question', 'feedback', 'bug', 'event'],
        required: true,
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    assignedTo: {
        type: String,
        default: null,
        index: true
    },
    subject: {
        type: String,
        required: true,
        maxlength: 100
    },
    description: {
        type: String,
        maxlength: 2000
    },
    closedAt: {
        type: Date,
        default: null
    },
    closedBy: {
        type: String,
        default: null
    },
    closeReason: {
        type: String,
        maxlength: 500
    },
    transcriptUrl: {
        type: String,
        default: null
    },
    tags: [{
        type: String,
        lowercase: true,
        index: true
    }],
    metadata: {
        messageCount: {
            type: Number,
            default: 0
        },
        firstResponseTime: {
            type: Number, // milliseconds
            default: null
        },
        resolutionTime: {
            type: Number, // milliseconds
            default: null
        },
        lastActivity: {
            type: Date,
            default: Date.now
        }
    },
    participants: [{
        userId: String,
        joinedAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

// Indexes for efficient querying
ticketSchema.index({ guildId: 1, status: 1 });
ticketSchema.index({ guildId: 1, category: 1 });
ticketSchema.index({ guildId: 1, assignedTo: 1 });
ticketSchema.index({ guildId: 1, creatorId: 1 });

// Auto-increment ticket number per guild
ticketSchema.statics.getNextTicketNumber = async function(guildId) {
    const lastTicket = await this.findOne({ guildId })
        .sort({ ticketNumber: -1 })
        .select('ticketNumber');

    return (lastTicket?.ticketNumber || 0) + 1;
};

// Generate ticket ID
ticketSchema.statics.generateTicketId = function(guildId, ticketNumber) {
    return `ticket-${guildId.slice(-6)}-${String(ticketNumber).padStart(4, '0')}`;
};

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
