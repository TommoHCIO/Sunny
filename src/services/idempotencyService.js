// src/services/idempotencyService.js
/**
 * Idempotency Service
 * Prevents duplicate tool executions using in-memory cache
 * For production with multiple instances, replace with Redis
 */

const crypto = require('crypto');

class IdempotencyService {
    constructor() {
        // In-memory cache: Map<idempotencyKey, { result, timestamp, expiresAt }>
        this.cache = new Map();

        // Default TTL: 5 minutes
        this.defaultTTL = 5 * 60 * 1000;

        // Cleanup interval: 1 minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);

        // Prevent memory leaks
        this.maxCacheSize = 10000;
    }

    /**
     * Generate idempotency key from tool name and inputs
     * @param {string} toolName - Name of the tool
     * @param {Object} input - Tool input parameters
     * @param {string} userId - User ID making the request
     * @param {string} guildId - Guild ID
     * @returns {string} Idempotency key
     */
    generateKey(toolName, input, userId, guildId) {
        const payload = JSON.stringify({
            tool: toolName,
            input: this.normalizeInput(input),
            user: userId,
            guild: guildId
        });

        return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);
    }

    /**
     * Normalize input for consistent hashing
     * Sorts object keys to ensure same input produces same hash
     */
    normalizeInput(input) {
        if (input === null || input === undefined) return null;
        if (typeof input !== 'object') return input;
        if (Array.isArray(input)) return input.map(i => this.normalizeInput(i));

        const sorted = {};
        Object.keys(input).sort().forEach(key => {
            sorted[key] = this.normalizeInput(input[key]);
        });
        return sorted;
    }

    /**
     * Check if operation was already executed
     * @param {string} key - Idempotency key
     * @returns {{ exists: boolean, result?: any }}
     */
    check(key) {
        const cached = this.cache.get(key);

        if (!cached) {
            return { exists: false };
        }

        // Check if expired
        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key);
            return { exists: false };
        }

        return { exists: true, result: cached.result };
    }

    /**
     * Store operation result
     * @param {string} key - Idempotency key
     * @param {any} result - Operation result
     * @param {number} ttlMs - Time to live in milliseconds
     */
    store(key, result, ttlMs = this.defaultTTL) {
        // Enforce max cache size
        if (this.cache.size >= this.maxCacheSize) {
            this.evictOldest();
        }

        this.cache.set(key, {
            result,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttlMs
        });
    }

    /**
     * Execute with idempotency check
     * @param {string} toolName - Tool name
     * @param {Object} input - Tool input
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {Function} executor - Async function to execute
     * @param {Object} options - Options { ttlMs, force }
     * @returns {Promise<{ result: any, cached: boolean }>}
     */
    async executeWithIdempotency(toolName, input, userId, guildId, executor, options = {}) {
        const { ttlMs = this.defaultTTL, force = false } = options;

        // Generate key
        const key = this.generateKey(toolName, input, userId, guildId);

        // Skip cache if forced
        if (!force) {
            const cached = this.check(key);
            if (cached.exists) {
                console.log(`[Idempotency] Cache hit for ${toolName} (key: ${key.substring(0, 8)}...)`);
                return { result: cached.result, cached: true, key };
            }
        }

        // Execute the operation
        const result = await executor();

        // Only cache successful operations
        if (result && result.success !== false) {
            this.store(key, result, ttlMs);
        }

        return { result, cached: false, key };
    }

    /**
     * Invalidate a specific key
     * @param {string} key - Key to invalidate
     */
    invalidate(key) {
        this.cache.delete(key);
    }

    /**
     * Invalidate all keys for a specific tool
     * @param {string} toolName - Tool name
     */
    invalidateTool(toolName) {
        for (const [key, value] of this.cache.entries()) {
            // We can't easily determine the tool from the hash,
            // so this is a best-effort based on timing
            // In production, store metadata with the key
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, value] of this.cache.entries()) {
            if (now > value.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[Idempotency] Cleaned up ${cleaned} expired entries`);
        }
    }

    /**
     * Evict oldest entries when cache is full
     */
    evictOldest() {
        const entries = [...this.cache.entries()];
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest 10%
        const toRemove = Math.ceil(entries.length * 0.1);
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }

        console.log(`[Idempotency] Evicted ${toRemove} oldest entries`);
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getStats() {
        const now = Date.now();
        let activeCount = 0;
        let expiredCount = 0;

        for (const value of this.cache.values()) {
            if (now > value.expiresAt) {
                expiredCount++;
            } else {
                activeCount++;
            }
        }

        return {
            totalEntries: this.cache.size,
            activeEntries: activeCount,
            expiredEntries: expiredCount,
            maxSize: this.maxCacheSize,
            defaultTTL: this.defaultTTL
        };
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Shutdown cleanup
     */
    shutdown() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
    }
}

// Export singleton instance
module.exports = new IdempotencyService();
