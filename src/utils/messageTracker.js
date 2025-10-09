/**
 * Message Tracker - TTL-based deduplication system
 * Prevents duplicate message processing with automatic cleanup
 */

class MessageTracker {
    constructor(ttlMs = 5 * 60 * 1000) { // Default 5 minutes
        this.messages = new Map(); // messageId -> { timestamp, executionId, count }
        this.ttlMs = ttlMs;
        this.cleanupInterval = null;
        
        // Start automatic cleanup
        this.startCleanup();
    }

    /**
     * Check if a message has been processed recently
     * @param {string} messageId - Discord message ID
     * @returns {Object} { isProcessed: boolean, executionId: string|null, count: number }
     */
    checkMessage(messageId) {
        const entry = this.messages.get(messageId);
        
        if (!entry) {
            return { isProcessed: false, executionId: null, count: 0 };
        }

        // Check if entry has expired
        const now = Date.now();
        if (now - entry.timestamp > this.ttlMs) {
            this.messages.delete(messageId);
            return { isProcessed: false, executionId: null, count: 0 };
        }

        return { 
            isProcessed: true, 
            executionId: entry.executionId,
            count: entry.count 
        };
    }

    /**
     * Mark a message as processed
     * @param {string} messageId - Discord message ID
     * @param {string} executionId - Unique execution identifier
     * @returns {number} Number of times this message has been processed
     */
    markProcessed(messageId, executionId) {
        const existing = this.messages.get(messageId);
        
        if (existing) {
            // Increment count for duplicate detection
            existing.count++;
            existing.lastExecutionId = executionId;
            existing.lastTimestamp = Date.now();
            return existing.count;
        } else {
            // First time processing this message
            this.messages.set(messageId, {
                timestamp: Date.now(),
                executionId: executionId,
                lastExecutionId: executionId,
                lastTimestamp: Date.now(),
                count: 1
            });
            return 1;
        }
    }

    /**
     * Get processing information for a message
     * @param {string} messageId - Discord message ID
     * @returns {Object|null} Processing info or null if not found
     */
    getInfo(messageId) {
        return this.messages.get(messageId) || null;
    }

    /**
     * Start automatic cleanup of expired entries
     */
    startCleanup() {
        if (this.cleanupInterval) return;

        // Run cleanup every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60 * 1000);
    }

    /**
     * Stop automatic cleanup
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Remove expired entries
     * @returns {number} Number of entries removed
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;

        for (const [messageId, entry] of this.messages.entries()) {
            if (now - entry.timestamp > this.ttlMs) {
                this.messages.delete(messageId);
                removed++;
            }
        }

        if (removed > 0) {
            console.log(`🧹 Cleaned up ${removed} expired message tracker entries`);
        }

        return removed;
    }

    /**
     * Get statistics about tracked messages
     * @returns {Object} Statistics
     */
    getStats() {
        const now = Date.now();
        let active = 0;
        let expired = 0;
        let duplicates = 0;

        for (const [messageId, entry] of this.messages.entries()) {
            if (now - entry.timestamp > this.ttlMs) {
                expired++;
            } else {
                active++;
                if (entry.count > 1) {
                    duplicates++;
                }
            }
        }

        return {
            total: this.messages.size,
            active,
            expired,
            duplicates,
            ttlMs: this.ttlMs
        };
    }

    /**
     * Clear all tracked messages (use with caution)
     */
    clear() {
        const size = this.messages.size;
        this.messages.clear();
        console.log(`🗑️  Cleared ${size} tracked messages`);
    }
}

// Singleton instance
const messageTracker = new MessageTracker();

module.exports = messageTracker;
