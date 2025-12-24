// src/services/cacheService.js
/**
 * Cache Service
 * Provides in-memory caching for frequently accessed data
 * Reduces database queries and improves response times
 */

class CacheService {
    constructor() {
        // Separate caches for different data types
        this.caches = {
            context: new Map(),      // Channel context cache
            members: new Map(),      // Member info cache
            roles: new Map(),        // Role info cache
            channels: new Map(),     // Channel info cache
            settings: new Map(),     // Server settings cache
            general: new Map()       // General purpose cache
        };

        // TTL configurations (in milliseconds)
        this.ttls = {
            context: 60 * 1000,      // 1 minute
            members: 5 * 60 * 1000,  // 5 minutes
            roles: 10 * 60 * 1000,   // 10 minutes
            channels: 10 * 60 * 1000, // 10 minutes
            settings: 15 * 60 * 1000, // 15 minutes
            general: 5 * 60 * 1000    // 5 minutes
        };

        // Max sizes per cache
        this.maxSizes = {
            context: 1000,
            members: 5000,
            roles: 500,
            channels: 500,
            settings: 100,
            general: 2000
        };

        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0
        };

        // Cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }

    /**
     * Get item from cache
     * @param {string} type - Cache type
     * @param {string} key - Cache key
     * @returns {any|null} Cached value or null
     */
    get(type, key) {
        const cache = this.caches[type];
        if (!cache) return null;

        const entry = cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check expiration
        if (Date.now() > entry.expiresAt) {
            cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return entry.value;
    }

    /**
     * Set item in cache
     * @param {string} type - Cache type
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttlMs - Optional custom TTL
     */
    set(type, key, value, ttlMs = null) {
        const cache = this.caches[type];
        if (!cache) return;

        const ttl = ttlMs || this.ttls[type] || 60000;
        const maxSize = this.maxSizes[type] || 1000;

        // Enforce max size
        if (cache.size >= maxSize && !cache.has(key)) {
            this.evictOldest(type);
        }

        cache.set(key, {
            value,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttl
        });

        this.stats.sets++;
    }

    /**
     * Delete item from cache
     * @param {string} type - Cache type
     * @param {string} key - Cache key
     */
    delete(type, key) {
        const cache = this.caches[type];
        if (cache) {
            cache.delete(key);
        }
    }

    /**
     * Check if key exists and is valid
     * @param {string} type - Cache type
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(type, key) {
        const cache = this.caches[type];
        if (!cache) return false;

        const entry = cache.get(key);
        if (!entry) return false;

        if (Date.now() > entry.expiresAt) {
            cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Get or set with factory function
     * @param {string} type - Cache type
     * @param {string} key - Cache key
     * @param {Function} factory - Async function to create value if not cached
     * @param {number} ttlMs - Optional TTL
     * @returns {Promise<any>}
     */
    async getOrSet(type, key, factory, ttlMs = null) {
        const cached = this.get(type, key);
        if (cached !== null) {
            return cached;
        }

        const value = await factory();
        if (value !== null && value !== undefined) {
            this.set(type, key, value, ttlMs);
        }

        return value;
    }

    /**
     * Clear all entries for a type
     * @param {string} type - Cache type
     */
    clear(type) {
        const cache = this.caches[type];
        if (cache) {
            cache.clear();
        }
    }

    /**
     * Clear all caches
     */
    clearAll() {
        for (const cache of Object.values(this.caches)) {
            cache.clear();
        }
        this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
    }

    /**
     * Evict oldest entries from a cache
     * @param {string} type - Cache type
     */
    evictOldest(type) {
        const cache = this.caches[type];
        if (!cache || cache.size === 0) return;

        const entries = [...cache.entries()];
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest 10%
        const toRemove = Math.max(1, Math.ceil(entries.length * 0.1));
        for (let i = 0; i < toRemove; i++) {
            cache.delete(entries[i][0]);
            this.stats.evictions++;
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        let totalCleaned = 0;

        for (const [type, cache] of Object.entries(this.caches)) {
            for (const [key, entry] of cache.entries()) {
                if (now > entry.expiresAt) {
                    cache.delete(key);
                    totalCleaned++;
                }
            }
        }

        if (totalCleaned > 0) {
            console.log(`[Cache] Cleaned up ${totalCleaned} expired entries`);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object}
     */
    getStats() {
        const cacheStats = {};
        for (const [type, cache] of Object.entries(this.caches)) {
            cacheStats[type] = {
                size: cache.size,
                maxSize: this.maxSizes[type],
                ttl: this.ttls[type]
            };
        }

        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            caches: cacheStats
        };
    }

    /**
     * Invalidate cache entries matching a pattern
     * @param {string} type - Cache type
     * @param {string|RegExp} pattern - Key pattern to match
     */
    invalidatePattern(type, pattern) {
        const cache = this.caches[type];
        if (!cache) return;

        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
        for (const key of cache.keys()) {
            if (regex.test(key)) {
                cache.delete(key);
            }
        }
    }

    /**
     * Invalidate all caches for a guild
     * @param {string} guildId - Guild ID
     */
    invalidateGuild(guildId) {
        for (const cache of Object.values(this.caches)) {
            for (const key of cache.keys()) {
                if (key.includes(guildId)) {
                    cache.delete(key);
                }
            }
        }
    }

    /**
     * Shutdown cleanup
     */
    shutdown() {
        clearInterval(this.cleanupInterval);
        this.clearAll();
    }

    // ===== CONVENIENCE METHODS =====

    /**
     * Cache context for a channel
     */
    setContext(channelId, context) {
        this.set('context', channelId, context);
    }

    getContext(channelId) {
        return this.get('context', channelId);
    }

    /**
     * Cache member info
     */
    setMember(guildId, memberId, memberData) {
        this.set('members', `${guildId}:${memberId}`, memberData);
    }

    getMember(guildId, memberId) {
        return this.get('members', `${guildId}:${memberId}`);
    }

    /**
     * Cache role info
     */
    setRole(guildId, roleId, roleData) {
        this.set('roles', `${guildId}:${roleId}`, roleData);
    }

    getRole(guildId, roleId) {
        return this.get('roles', `${guildId}:${roleId}`);
    }

    /**
     * Cache channel info
     */
    setChannel(guildId, channelId, channelData) {
        this.set('channels', `${guildId}:${channelId}`, channelData);
    }

    getChannel(guildId, channelId) {
        return this.get('channels', `${guildId}:${channelId}`);
    }

    /**
     * Cache server settings
     */
    setSettings(guildId, settings) {
        this.set('settings', guildId, settings);
    }

    getSettings(guildId) {
        return this.get('settings', guildId);
    }
}

// Export singleton instance
module.exports = new CacheService();
