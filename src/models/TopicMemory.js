// src/models/TopicMemory.js
/**
 * Topic Memory Model - Semantic memory for server knowledge base
 * Stores facts, decisions, and important information about topics
 */

const mongoose = require('mongoose');

const factSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    source: {
        userId: String,
        messageId: String,
        channelId: String,
        type: {
            type: String,
            enum: ['user', 'system', 'announcement', 'decision'],
            default: 'user'
        }
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5 // Importance/confidence score
    },
    verifiedBy: [{
        userId: String,
        timestamp: Date
    }],
    contradictedBy: [{
        factId: String,
        reason: String
    }],
    timestamp: {
        type: Date,
        default: Date.now
    },
    mentions: {
        type: Number,
        default: 1 // How often this fact is referenced
    },
    // For future vector search implementation
    vector: {
        type: [Number],
        select: false // Don't include in normal queries
    }
}, { _id: true });

const topicMemorySchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    topic: {
        type: String,
        required: true,
        index: true
    },
    category: {
        type: String,
        enum: [
            'server-rules',
            'server-info',
            'technical',
            'gaming',
            'events',
            'roles',
            'channels',
            'moderation',
            'general',
            'other'
        ],
        default: 'general'
    },

    // Collection of facts about this topic
    facts: [factSchema],

    // Summary of the topic (AI-generated)
    summary: {
        content: String,
        lastUpdated: Date,
        generatedBy: String // 'claude' or 'system'
    },

    // Related topics (for knowledge graph)
    relatedTopics: [{
        topic: String,
        relationship: String, // "is-part-of", "similar-to", "opposite-of", etc.
        strength: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        }
    }],

    // Usage statistics
    frequency: {
        type: Number,
        default: 1 // How often this topic is discussed
    },
    lastMentioned: {
        type: Date,
        default: Date.now,
        index: true
    },
    activeDiscussions: {
        type: Number,
        default: 0 // Currently active discussions about this topic
    },

    // Metadata
    keywords: [String], // Alternative names or keywords for this topic
    aliases: [String], // Other ways users refer to this topic

    // Server-specific importance
    importance: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5
    },

    // Permissions (who can see/modify this knowledge)
    visibility: {
        type: String,
        enum: ['public', 'members', 'staff', 'owner'],
        default: 'public'
    },
    editableBy: {
        type: String,
        enum: ['anyone', 'members', 'staff', 'owner'],
        default: 'staff'
    },

    // Versioning
    version: {
        type: Number,
        default: 1
    },
    changeHistory: [{
        timestamp: Date,
        userId: String,
        action: String, // "added-fact", "removed-fact", "updated-summary"
        details: String
    }],

    // TTL for automatic expiration
    expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 180 * 24 * 60 * 60 * 1000), // 180 days
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true
});

// Compound index for efficient guild+topic queries
topicMemorySchema.index({ guildId: 1, topic: 1 }, { unique: true });

// Index for finding active topics
topicMemorySchema.index({ lastMentioned: -1, guildId: 1 });

// Index for importance-based queries
topicMemorySchema.index({ importance: -1, guildId: 1 });

// Text index for search
topicMemorySchema.index({ topic: 'text', 'facts.content': 'text', keywords: 'text' });

// Static method to find or create a topic
topicMemorySchema.statics.findOrCreateTopic = async function(guildId, topic, category = 'general') {
    const normalizedTopic = topic.toLowerCase().trim();

    let memory = await this.findOne({
        guildId,
        topic: normalizedTopic
    });

    if (!memory) {
        memory = await this.create({
            guildId,
            topic: normalizedTopic,
            category
        });
    }

    return memory;
};

// Add a fact to the topic
topicMemorySchema.methods.addFact = async function(content, source, confidence = 0.5) {
    // Check if similar fact already exists
    const existingFact = this.facts.find(f =>
        f.content.toLowerCase() === content.toLowerCase()
    );

    if (existingFact) {
        // Increase confidence and mentions
        existingFact.mentions += 1;
        existingFact.confidence = Math.min(1, existingFact.confidence + 0.1);
        existingFact.timestamp = new Date();
    } else {
        // Add new fact
        this.facts.push({
            content,
            source,
            confidence,
            timestamp: new Date()
        });

        // Keep only top 50 most important facts
        if (this.facts.length > 50) {
            this.facts.sort((a, b) => {
                // Sort by confidence and recency
                if (Math.abs(a.confidence - b.confidence) > 0.1) {
                    return b.confidence - a.confidence;
                }
                return b.timestamp - a.timestamp;
            });
            this.facts = this.facts.slice(0, 50);
        }
    }

    // Update topic statistics
    this.frequency += 1;
    this.lastMentioned = new Date();

    return this.save();
};

// Search for facts about a topic
topicMemorySchema.statics.searchTopics = async function(guildId, query, limit = 10) {
    // First try exact match
    let results = await this.find({
        guildId,
        $or: [
            { topic: new RegExp(query, 'i') },
            { keywords: new RegExp(query, 'i') },
            { aliases: new RegExp(query, 'i') }
        ]
    })
        .sort({ importance: -1, frequency: -1 })
        .limit(limit);

    // If no exact matches, try text search
    if (results.length === 0) {
        results = await this.find(
            {
                guildId,
                $text: { $search: query }
            },
            {
                score: { $meta: 'textScore' }
            }
        )
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit);
    }

    return results;
};

// Get most important topics for a guild
topicMemorySchema.statics.getImportantTopics = async function(guildId, limit = 10) {
    return this.find({ guildId })
        .sort({ importance: -1, frequency: -1 })
        .limit(limit)
        .select('topic category summary importance frequency lastMentioned');
};

// Update topic summary (called periodically for important topics)
topicMemorySchema.methods.updateSummary = async function(summaryContent) {
    this.summary = {
        content: summaryContent,
        lastUpdated: new Date(),
        generatedBy: 'claude'
    };
    return this.save();
};

// Link related topics
topicMemorySchema.methods.addRelatedTopic = async function(relatedTopic, relationship = 'related-to', strength = 0.5) {
    const existing = this.relatedTopics.find(rt => rt.topic === relatedTopic);

    if (existing) {
        existing.strength = Math.min(1, existing.strength + 0.1);
    } else {
        this.relatedTopics.push({
            topic: relatedTopic,
            relationship,
            strength
        });
    }

    return this.save();
};

// Mark a fact as verified
topicMemorySchema.methods.verifyFact = async function(factId, userId) {
    const fact = this.facts.id(factId);
    if (fact) {
        if (!fact.verifiedBy) {
            fact.verifiedBy = [];
        }

        // Check if user already verified
        const alreadyVerified = fact.verifiedBy.find(v => v.userId === userId);
        if (!alreadyVerified) {
            fact.verifiedBy.push({
                userId,
                timestamp: new Date()
            });

            // Increase confidence based on verification
            fact.confidence = Math.min(1, fact.confidence + 0.15);
        }

        return this.save();
    }
    return null;
};

// Export topic data (for backup or analysis)
topicMemorySchema.methods.exportData = function() {
    const data = this.toObject();
    // Remove internal MongoDB fields
    delete data._id;
    delete data.__v;
    data.facts = data.facts.map(f => {
        const factObj = f.toObject ? f.toObject() : f;
        delete factObj._id;
        return factObj;
    });
    return data;
};

module.exports = mongoose.model('TopicMemory', topicMemorySchema);