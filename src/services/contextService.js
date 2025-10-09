// src/services/contextService.js

class ContextService {
    constructor() {
        // In-memory store (per-channel context)
        this.channelContexts = new Map();
        this.maxMessages = parseInt(process.env.CONTEXT_MAX_MESSAGES) || 10;
    }
    
    async getContext(channelId) {
        if (!this.channelContexts.has(channelId)) {
            this.channelContexts.set(channelId, []);
        }
        return this.channelContexts.get(channelId);
    }
    
    async addMessage(channelId, message) {
        const context = await this.getContext(channelId);
        
        // Add new message
        context.push({
            author: message.author.username,
            authorId: message.author.id,
            content: message.content,
            timestamp: message.createdTimestamp,
            isSunny: message.author.bot
        });
        
        // Keep only last N messages
        if (context.length > this.maxMessages) {
            context.shift(); // Remove oldest
        }
        
        this.channelContexts.set(channelId, context);
    }
    
    async buildContextPrompt(channelId, currentMessage, replyContext = null) {
        const context = await this.getContext(channelId);
        
        let prompt = 'Recent conversation context:\n\n';
        
        // Add conversation history
        context.forEach(msg => {
            prompt += `${msg.author}: ${msg.content}\n`;
        });
        
        // Add reply context if applicable
        if (replyContext) {
            prompt += `\n[User is replying to your message: "${replyContext}"]\n`;
        }
        
        // Add current message
        prompt += `\nCurrent message from ${currentMessage.author.username}:\n`;
        prompt += `"${currentMessage.content}"\n\n`;
        prompt += `Respond to this message with full awareness of the conversation context.`;
        
        return prompt;
    }
    
    async clearContext(channelId) {
        this.channelContexts.delete(channelId);
    }
    
    // Prune old contexts (memory management)
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
