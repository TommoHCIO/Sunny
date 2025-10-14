// src/services/contextService.js
/**
 * Context Service - Manages conversation context
 * Uses MongoDB for persistent storage with in-memory fallback
 */

const databaseService = require('./database/databaseService');
const memoryService = require('./memoryService');

/**
 * Context Service for managing conversation history and context
 * 
 * Features:
 * - Persistent storage via MongoDB with in-memory caching
 * - Automatic context trimming to configured message limit
 * - Conversation pruning for inactive channels
 * - Context-aware prompt building for AI responses
 * 
 * Singleton instance exported for consistent state across application.
 */
class ContextService {
    /**
     * Create a new ContextService instance
     * 
     * @constructor
     */
    constructor() {
        // In-memory store (per-channel context)
        this.channelContexts = new Map();
        this.maxMessages = parseInt(process.env.CONTEXT_MAX_MESSAGES) || 20; // Increased from 10
        this.summarizeAfter = parseInt(process.env.CONTEXT_SUMMARIZE_AFTER) || 30;
    }
    
    /**
     * Get conversation context for a channel
     * 
     * Retrieves recent messages from MongoDB first, falling back to in-memory cache.
     * Returns formatted message objects suitable for AI context building.
     * 
     * @param {string} channelId - Discord channel ID to retrieve context for
     * @returns {Promise<Array<Object>>} Array of message objects
     * @returns {string} return[].author - Username of message author
     * @returns {string} return[].authorId - User ID of message author
     * @returns {string} return[].content - Message content
     * @returns {number} return[].timestamp - Message timestamp in milliseconds
     * @returns {boolean} return[].isSunny - Whether message is from Sunny bot
     * 
     * @example
     * const context = await contextService.getContext('123456789');
     * context.forEach(msg => {
     *   console.log(`${msg.author}: ${msg.content}`);
     * });
     */
    async getContext(channelId) {
        // Try MongoDB first
        const dbContext = await databaseService.getRecentMessages(channelId, this.maxMessages);

        if (dbContext && dbContext.length > 0) {
            return dbContext.map(msg => ({
                author: msg.authorName,
                authorId: msg.authorId,
                content: msg.content,
                timestamp: msg.timestamp.getTime(),
                isSunny: msg.isBot,
                attachments: msg.attachments || []
            }));
        }

        // Fallback to in-memory cache
        if (!this.channelContexts.has(channelId)) {
            this.channelContexts.set(channelId, []);
        }
        return this.channelContexts.get(channelId);
    }
    
    /**
     * Add a message to conversation context
     * 
     * Stores message in both MongoDB (persistent) and in-memory cache (fast access).
     * Automatically trims context to maxMessages limit, removing oldest messages.
     * 
     * @param {string} channelId - Discord channel ID where message was sent
     * @param {import('discord.js').Message} message - Discord.js Message object
     * @param {Object} message.author - Message author
     * @param {string} message.author.username - Author's username
     * @param {string} message.author.id - Author's user ID
     * @param {boolean} message.author.bot - Whether author is a bot
     * @param {string} message.content - Message content
     * @param {number} message.createdTimestamp - Message timestamp
     * @param {Object} message.guild - Guild where message was sent
     * @returns {Promise<void>}
     * 
     * @example
     * client.on('messageCreate', async (message) => {
     *   await contextService.addMessage(message.channel.id, message);
     * });
     */
    async addMessage(channelId, message) {
        // Store in MongoDB first
        await databaseService.addMessageToConversation(
            channelId,
            message.guild.id,
            message
        );
        
        // Also update in-memory cache for immediate access
        const context = await this.getContext(channelId);

        // Extract attachment information
        const attachments = [];
        if (message.attachments && message.attachments.size > 0) {
            message.attachments.forEach(att => {
                attachments.push({
                    name: att.name,
                    url: att.url,
                    contentType: att.contentType || 'unknown',
                    size: att.size
                });
            });
        }

        // Add new message
        context.push({
            author: message.author.username,
            authorId: message.author.id,
            content: message.content,
            timestamp: message.createdTimestamp,
            isSunny: message.author.bot,
            attachments: attachments
        });

        // Keep only last N messages
        if (context.length > this.maxMessages) {
            context.shift(); // Remove oldest
        }

        this.channelContexts.set(channelId, context);
    }
    
    /**
     * Build context-aware prompt for AI agent
     * 
     * Creates a formatted prompt including:
     * - Recent conversation history with user IDs
     * - Reply context if message is a reply
     * - Current message details
     * - Instructions for AI response
     * 
     * @param {string} channelId - Discord channel ID to build context from
     * @param {import('discord.js').Message} currentMessage - Current message being processed
     * @param {string|null} [replyContext=null] - Content of message being replied to, if any
     * @returns {Promise<string>} Formatted prompt string for AI agent
     * 
     * @example
     * const prompt = await contextService.buildContextPrompt(
     *   message.channel.id,
     *   message,
     *   message.reference ? referencedMessage.content : null
     * );
     * const response = await aiAgent.process(prompt);
     */
    async buildContextPrompt(channelId, currentMessage, replyContext = null) {
        const context = await this.getContext(channelId);

        let prompt = '';

        // Add memory context if enabled
        if (memoryService.enabled) {
            const memoryContext = await memoryService.buildMemoryContext(
                currentMessage.author.id,
                currentMessage.guild.id,
                channelId,
                currentMessage.content
            );

            if (memoryContext) {
                prompt += memoryContext + '\n\n';
            }
        }

        prompt += 'Recent conversation context:\n\n';

        // Check if we should summarize (too many messages)
        if (context.length > this.summarizeAfter && memoryService.enabled) {
            const summary = await memoryService.summarizeConversation(context.slice(0, -10));
            if (summary) {
                prompt += `[Previous conversation summary: ${summary}]\n\n`;
                // Show only last 10 messages after summary
                const recentContext = context.slice(-10);
                recentContext.forEach(msg => {
                    prompt += `${msg.author} (ID: ${msg.authorId}): ${msg.content}\n`;
                });
            }
        } else {
            // Add full conversation history with user IDs for moderation actions
            context.forEach(msg => {
                prompt += `${msg.author} (ID: ${msg.authorId}): ${msg.content}`;

                // Include attachment info in history
                if (msg.attachments && msg.attachments.length > 0) {
                    const attachmentInfo = msg.attachments.map(att =>
                        `${att.name} (${att.contentType})`
                    ).join(', ');
                    prompt += ` [Attached: ${attachmentInfo}]`;
                }
                prompt += '\n';
            });
        }

        // Add reply context if applicable
        if (replyContext) {
            prompt += `\n[User is replying to your message: "${replyContext}"]\n`;
        }

        // Add current message
        prompt += `\nCurrent message from ${currentMessage.author.username}:\n`;
        prompt += `"${currentMessage.content}"`;

        // Add current message attachments with full details
        if (currentMessage.attachments && currentMessage.attachments.size > 0) {
            prompt += '\n\nUser has attached the following files:\n';
            currentMessage.attachments.forEach(att => {
                prompt += `- File: ${att.name}\n`;
                prompt += `  Type: ${att.contentType || 'unknown'}\n`;
                prompt += `  Size: ${(att.size / 1024).toFixed(2)} KB\n`;
                prompt += `  URL: ${att.url}\n`;
            });
            prompt += '\nIMPORTANT: You can use these attachment URLs directly with create_sticker or create_emoji tools.\n';
            prompt += 'Just pass the URL as the stickerFile or emojiUrl parameter.\n';
        }

        prompt += `\nRespond to this message with full awareness of the conversation context.`;
        prompt += `\nWhen taking moderation actions, use the correct user ID from the conversation history.`;

        return prompt;
    }
    
    /**
     * Clear conversation context for a channel
     * 
     * Removes in-memory context. MongoDB history is preserved for future retrieval.
     * Useful for manual context resets or privacy compliance.
     * 
     * @param {string} channelId - Discord channel ID to clear context for
     * @returns {Promise<void>}
     * 
     * @example
     * await contextService.clearContext('123456789');
     */
    async clearContext(channelId) {
        this.channelContexts.delete(channelId);
    }
    
    /**
     * Start automatic pruning job for inactive contexts
     * 
     * Runs every 15 minutes to remove in-memory contexts for channels
     * with no activity in the last hour. Prevents memory leaks in busy bots.
     * 
     * Called automatically on service initialization.
     * 
     * @private
     * @returns {void}
     */
    startPruneJob() {
        setInterval(() => {
            const now = Date.now();
            const timeout = 60 * 60 * 1000; // 1 hour
            
            for (const [channelId, context] of this.channelContexts) {
                if (context.length === 0) continue;
                
                const lastMessageTime = context[context.length - 1].timestamp;
                if (now - lastMessageTime > timeout) {
                    this.channelContexts.delete(channelId);
                    console.log(`Pruned context for channel ${channelId}`);
                }
            }
        }, 15 * 60 * 1000); // Run every 15 minutes
    }
}

// Create singleton instance
const contextService = new ContextService();
contextService.startPruneJob();

module.exports = contextService;
