// src/services/memoryService.js
/**
 * Memory Service - Central service for managing bot memory
 * Handles user profiles, topic extraction, and memory retrieval
 */

const UserMemory = require('../models/UserMemory');
const TopicMemory = require('../models/TopicMemory');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY
});

class MemoryService {
    constructor() {
        this.enabled = process.env.MEMORY_ENABLED === 'true';
        this.userProfilesEnabled = process.env.MEMORY_USER_PROFILES === 'true';
        this.semanticEnabled = process.env.MEMORY_SEMANTIC_ENABLED === 'true';
        this.crossChannelEnabled = process.env.CONTEXT_CROSS_CHANNEL === 'true';

        // Cache for frequently accessed user memories
        this.userCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

        console.log('🧠 Memory Service initialized:', {
            enabled: this.enabled,
            userProfiles: this.userProfilesEnabled,
            semantic: this.semanticEnabled,
            crossChannel: this.crossChannelEnabled
        });
    }

    // ===== USER MEMORY OPERATIONS =====

    /**
     * Get or create user memory profile
     */
    async getUserMemory(userId, guildId, userData = {}) {
        if (!this.enabled || !this.userProfilesEnabled) return null;

        const cacheKey = `${userId}-${guildId}`;

        // Check cache first
        if (this.userCache.has(cacheKey)) {
            const cached = this.userCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const memory = await UserMemory.findOrCreateUser(userId, guildId, userData);

            // Update cache
            this.userCache.set(cacheKey, {
                data: memory,
                timestamp: Date.now()
            });

            // Clean cache if too large
            if (this.userCache.size > 100) {
                const oldestKey = this.userCache.keys().next().value;
                this.userCache.delete(oldestKey);
            }

            return memory;
        } catch (error) {
            console.error('Error getting user memory:', error);
            return null;
        }
    }

    /**
     * Record user interaction
     */
    async recordInteraction(message) {
        if (!this.enabled || !this.userProfilesEnabled) return;

        try {
            const memory = await UserMemory.recordInteraction(
                message.author.id,
                message.guild.id,
                {
                    author: message.author,
                    member: message.member,
                    channelId: message.channel.id,
                    content: message.content
                }
            );

            // Extract topics if semantic memory is enabled
            if (this.semanticEnabled && message.content.length > 20) {
                await this.extractAndStoreTopics(message);
            }

            return memory;
        } catch (error) {
            console.error('Error recording interaction:', error);
        }
    }

    /**
     * Add note about a user
     */
    async addUserNote(userId, guildId, note, importance = 0.5) {
        if (!this.enabled || !this.userProfilesEnabled) return;

        try {
            const memory = await this.getUserMemory(userId, guildId);
            if (memory) {
                await memory.addNote(note, importance);
                this.invalidateCache(userId, guildId);
            }
        } catch (error) {
            console.error('Error adding user note:', error);
        }
    }

    /**
     * Update user preferences
     */
    async updateUserPreferences(userId, guildId, preferences) {
        if (!this.enabled || !this.userProfilesEnabled) return;

        try {
            const memory = await this.getUserMemory(userId, guildId);
            if (memory) {
                Object.assign(memory.profile.preferences, preferences);
                await memory.save();
                this.invalidateCache(userId, guildId);
            }
        } catch (error) {
            console.error('Error updating user preferences:', error);
        }
    }

    // ===== TOPIC MEMORY OPERATIONS =====

    /**
     * Extract topics from message and store them
     */
    async extractAndStoreTopics(message) {
        if (!this.enabled || !this.semanticEnabled) return;

        try {
            // Simple topic extraction (can be enhanced with NLP)
            const topics = this.extractTopics(message.content);

            for (const topic of topics) {
                const topicMemory = await TopicMemory.findOrCreateTopic(
                    message.guild.id,
                    topic.name,
                    topic.category
                );

                // Add fact if message contains important information
                if (this.isImportantMessage(message.content)) {
                    await topicMemory.addFact(
                        message.content,
                        {
                            userId: message.author.id,
                            messageId: message.id,
                            channelId: message.channel.id,
                            type: 'user'
                        },
                        0.5 // Default confidence
                    );
                }
            }
        } catch (error) {
            console.error('Error extracting topics:', error);
        }
    }

    /**
     * Simple topic extraction (can be enhanced with NLP)
     */
    extractTopics(content) {
        const topics = [];
        const lowerContent = content.toLowerCase();

        // Keywords for different categories
        const categoryKeywords = {
            'server-rules': ['rule', 'guideline', 'policy', 'allowed', 'prohibited'],
            'technical': ['error', 'bug', 'fix', 'code', 'api', 'database'],
            'gaming': ['game', 'play', 'steam', 'xbox', 'playstation', 'nintendo'],
            'events': ['event', 'meeting', 'stream', 'party', 'celebration'],
            'roles': ['role', 'permission', 'assign', 'remove', 'admin', 'moderator'],
            'channels': ['channel', 'category', 'voice', 'text', 'forum'],
            'moderation': ['ban', 'kick', 'timeout', 'mute', 'warn', 'violation']
        };

        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            for (const keyword of keywords) {
                if (lowerContent.includes(keyword)) {
                    // Extract context around keyword
                    const words = content.split(/\s+/);
                    const keywordIndex = words.findIndex(w =>
                        w.toLowerCase().includes(keyword)
                    );

                    if (keywordIndex !== -1) {
                        // Get 2-3 words around the keyword as topic
                        const start = Math.max(0, keywordIndex - 1);
                        const end = Math.min(words.length, keywordIndex + 2);
                        const topicName = words.slice(start, end).join(' ').toLowerCase();

                        topics.push({
                            name: topicName,
                            category
                        });
                        break; // Only one topic per category
                    }
                }
            }
        }

        // If no specific topics found, extract potential topic from message
        if (topics.length === 0 && content.length > 30) {
            // Extract potential topic from question words
            const questionMatch = content.match(/(?:what|how|why|when|where|who|can|should|does|is)\s+(.+?)[\?\.\!]/i);
            if (questionMatch) {
                topics.push({
                    name: questionMatch[1].toLowerCase().slice(0, 50),
                    category: 'general'
                });
            }
        }

        return topics;
    }

    /**
     * Check if message contains important information
     */
    isImportantMessage(content) {
        // Messages that likely contain facts or important info
        const importantPatterns = [
            /\b(?:is|are|was|were|will be|has been|have been)\b/i,
            /\b(?:rule|policy|guideline|requirement|must|should|need to)\b/i,
            /\b(?:always|never|every|none|all|only)\b/i,
            /\b(?:announcement|update|change|new|important)\b/i,
            /\b(?:remember|note|keep in mind|don't forget)\b/i
        ];

        return importantPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Search for relevant topics
     */
    async searchTopics(guildId, query, limit = 5) {
        if (!this.enabled || !this.semanticEnabled) return [];

        try {
            return await TopicMemory.searchTopics(guildId, query, limit);
        } catch (error) {
            console.error('Error searching topics:', error);
            return [];
        }
    }

    // ===== MEMORY CONTEXT BUILDING =====

    /**
     * Build memory context for AI response
     */
    async buildMemoryContext(userId, guildId, channelId, currentMessage = '') {
        if (!this.enabled) return '';

        let context = [];

        // Get user memory
        if (this.userProfilesEnabled) {
            const userMemory = await this.getUserMemory(userId, guildId);
            if (userMemory && !userMemory.profile.preferences.optOut) {
                context.push(this.formatUserMemory(userMemory));
            }
        }

        // Get relevant topic memories
        if (this.semanticEnabled && currentMessage) {
            const relevantTopics = await this.searchTopics(guildId, currentMessage, 3);
            if (relevantTopics.length > 0) {
                context.push(this.formatTopicMemories(relevantTopics));
            }
        }

        // Get cross-channel context if enabled
        if (this.crossChannelEnabled && this.userProfilesEnabled) {
            const crossChannelContext = await this.getCrossChannelContext(userId, guildId, channelId);
            if (crossChannelContext) {
                context.push(crossChannelContext);
            }
        }

        return context.filter(Boolean).join('\n\n');
    }

    /**
     * Format user memory for AI context
     */
    formatUserMemory(memory) {
        const parts = [];

        parts.push(`[User Memory for ${memory.displayName || memory.username}]`);

        if (memory.profile.pronouns) {
            parts.push(`Pronouns: ${memory.profile.pronouns}`);
        }

        if (memory.profile.preferences.preferredName) {
            parts.push(`Prefers to be called: ${memory.profile.preferences.preferredName}`);
        }

        if (memory.profile.preferences.responseStyle !== 'default') {
            parts.push(`Response preference: ${memory.profile.preferences.responseStyle}`);
        }

        if (memory.notes.length > 0) {
            const importantNotes = memory.notes
                .filter(n => n.importance > 0.6)
                .slice(0, 3)
                .map(n => `- ${n.content}`);

            if (importantNotes.length > 0) {
                parts.push('Important notes:');
                parts.push(...importantNotes);
            }
        }

        if (memory.interactions.totalMessages > 0) {
            parts.push(`Total interactions: ${memory.interactions.totalMessages}`);
            parts.push(`Last seen: ${this.formatTimeAgo(memory.interactions.lastSeen)}`);
        }

        if (memory.frequentTopics.length > 0) {
            const topics = memory.frequentTopics
                .slice(0, 3)
                .map(t => t.topic)
                .join(', ');
            parts.push(`Frequently discusses: ${topics}`);
        }

        return parts.join('\n');
    }

    /**
     * Format topic memories for AI context
     */
    formatTopicMemories(topics) {
        const parts = ['[Relevant Knowledge]'];

        for (const topic of topics) {
            if (topic.facts.length > 0) {
                parts.push(`\nTopic: ${topic.topic}`);

                // Get most confident facts
                const importantFacts = topic.facts
                    .sort((a, b) => b.confidence - a.confidence)
                    .slice(0, 3)
                    .map(f => `- ${f.content}`);

                parts.push(...importantFacts);
            }

            if (topic.summary?.content) {
                parts.push(`Summary: ${topic.summary.content}`);
            }
        }

        return parts.join('\n');
    }

    /**
     * Get cross-channel context for user
     */
    async getCrossChannelContext(userId, guildId, currentChannelId) {
        // This would fetch recent messages from the user in other channels
        // For now, return null (to be implemented with message history)
        return null;
    }

    // ===== UTILITY METHODS =====

    /**
     * Invalidate cache for a user
     */
    invalidateCache(userId, guildId) {
        const cacheKey = `${userId}-${guildId}`;
        this.userCache.delete(cacheKey);
    }

    /**
     * Format time ago string
     */
    formatTimeAgo(date) {
        const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

        return new Date(date).toLocaleDateString();
    }

    /**
     * Summarize conversation using Claude
     */
    async summarizeConversation(messages) {
        if (!this.enabled || messages.length < 10) return null;

        try {
            const prompt = messages.map(m => `${m.author}: ${m.content}`).join('\n');

            const response = await anthropic.messages.create({
                model: 'claude-3-haiku-20240307', // Use cheaper model for summaries
                max_tokens: 200,
                temperature: 0.3,
                system: 'You are a helpful assistant that creates concise summaries. Summarize the key points of this conversation in 2-3 sentences.',
                messages: [{
                    role: 'user',
                    content: `Summarize this conversation:\n\n${prompt}`
                }]
            });

            return response.content[0].text;
        } catch (error) {
            console.error('Error summarizing conversation:', error);
            return null;
        }
    }

    /**
     * Export user data (GDPR compliance)
     */
    async exportUserData(userId, guildId = null) {
        if (!this.enabled) return null;

        try {
            if (guildId) {
                const memory = await UserMemory.findOne({ userId, guildId });
                return memory ? memory.exportData() : null;
            }

            // Export all memories for user
            const memories = await UserMemory.find({ userId });
            return memories.map(m => m.exportData());
        } catch (error) {
            console.error('Error exporting user data:', error);
            return null;
        }
    }

    /**
     * Delete user data (privacy compliance)
     */
    async deleteUserData(userId, guildId = null) {
        if (!this.enabled) return false;

        try {
            await UserMemory.deleteUserMemory(userId, guildId);
            this.invalidateCache(userId, guildId);
            return true;
        } catch (error) {
            console.error('Error deleting user data:', error);
            return false;
        }
    }

    /**
     * Prune old memories
     */
    async pruneOldMemories() {
        if (!this.enabled) return;

        try {
            // MongoDB TTL indexes handle automatic expiration
            // This method can be used for additional cleanup if needed
            console.log('🧹 Memory pruning completed (TTL indexes handle expiration)');
        } catch (error) {
            console.error('Error pruning memories:', error);
        }
    }
}

// Create singleton instance
const memoryService = new MemoryService();

// Start periodic maintenance
if (memoryService.enabled) {
    // Prune old memories every 24 hours
    setInterval(() => {
        memoryService.pruneOldMemories();
    }, 24 * 60 * 60 * 1000);
}

module.exports = memoryService;