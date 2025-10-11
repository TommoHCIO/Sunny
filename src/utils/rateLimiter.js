// src/utils/rateLimiter.js
/**
 * Rate Limiter Utility - Token Bucket Algorithm
 * Prevents hitting Discord and Anthropic API rate limits by throttling requests
 * Uses token bucket algorithm for smooth rate limiting with burst support
 */

const winston = require('winston');
const { RATE_LIMITS } = require('../constants');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * Token Bucket Rate Limiter
 * 
 * Implements a token bucket algorithm for rate limiting:
 * - Tokens represent request capacity
 * - Tokens refill at a constant rate
 * - Requests consume tokens
 * - Requests wait if no tokens available
 * 
 * @example
 * const limiter = new RateLimiter({
 *   tokensPerInterval: 50,  // 50 requests
 *   interval: 1000,         // per second
 *   maxBurst: 10            // allow bursts of 10
 * });
 * 
 * await limiter.removeTokens(1); // Wait for capacity
 */
class RateLimiter {
    /**
     * Create a rate limiter
     * @param {Object} options - Rate limiter configuration
     * @param {number} options.tokensPerInterval - Tokens to add per interval (requests/interval)
     * @param {number} options.interval - Refill interval in milliseconds (default: 1000ms)
     * @param {number} [options.maxBurst] - Maximum burst capacity (default: tokensPerInterval)
     * @param {string} [options.name] - Name for logging (default: 'RateLimiter')
     */
    constructor(options) {
        const {
            tokensPerInterval,
            interval = 1000,
            maxBurst = null,
            name = 'RateLimiter'
        } = options;

        if (!tokensPerInterval || tokensPerInterval <= 0) {
            throw new Error('tokensPerInterval must be a positive number');
        }

        if (!interval || interval <= 0) {
            throw new Error('interval must be a positive number');
        }

        this.tokensPerInterval = tokensPerInterval;
        this.interval = interval;
        this.maxBurst = maxBurst || tokensPerInterval;
        this.name = name;

        // Token bucket state
        this.tokens = this.maxBurst;  // Start with full bucket
        this.lastRefill = Date.now();

        // Statistics
        this.stats = {
            totalRequests: 0,
            totalWaits: 0,
            totalWaitTime: 0,
            maxWaitTime: 0
        };

        logger.info(`🚦 Rate limiter "${this.name}" initialized: ${tokensPerInterval} tokens/${interval}ms, max burst: ${this.maxBurst}`);
    }

    /**
     * Refill tokens based on time elapsed
     * @private
     */
    _refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;

        if (timePassed >= this.interval) {
            // Calculate how many intervals have passed
            const intervalsPassed = Math.floor(timePassed / this.interval);
            
            // Add tokens (capped at maxBurst)
            const tokensToAdd = intervalsPassed * this.tokensPerInterval;
            this.tokens = Math.min(this.maxBurst, this.tokens + tokensToAdd);

            // Update last refill time (only for complete intervals)
            this.lastRefill += intervalsPassed * this.interval;
        }
    }

    /**
     * Get current available tokens
     * @returns {number} Current token count
     */
    getAvailableTokens() {
        this._refillTokens();
        return Math.floor(this.tokens);
    }

    /**
     * Remove tokens from bucket (wait if necessary)
     * 
     * This is the main method to call before making rate-limited requests.
     * It will block until enough tokens are available.
     * 
     * @param {number} count - Number of tokens to remove (default: 1)
     * @returns {Promise<void>} Resolves when tokens are available
     * @throws {Error} If count is invalid or exceeds max burst
     * 
     * @example
     * await limiter.removeTokens(1);  // Wait for 1 token
     * await makeAPICall();  // Now safe to call
     */
    async removeTokens(count = 1) {
        if (count <= 0) {
            throw new Error('Token count must be positive');
        }

        if (count > this.maxBurst) {
            throw new Error(`Requested ${count} tokens exceeds max burst of ${this.maxBurst}`);
        }

        this.stats.totalRequests++;

        const startTime = Date.now();
        let waitTime = 0;

        // Wait until we have enough tokens
        while (true) {
            this._refillTokens();

            if (this.tokens >= count) {
                // We have enough tokens - consume them and proceed
                this.tokens -= count;

                if (waitTime > 0) {
                    this.stats.totalWaits++;
                    this.stats.totalWaitTime += waitTime;
                    this.stats.maxWaitTime = Math.max(this.stats.maxWaitTime, waitTime);
                    
                    logger.warn(`⏳ Rate limiter "${this.name}" waited ${waitTime}ms for ${count} token(s)`);
                }

                return;
            }

            // Not enough tokens - calculate wait time
            const tokensNeeded = count - this.tokens;
            const intervalsNeeded = Math.ceil(tokensNeeded / this.tokensPerInterval);
            const timeToWait = intervalsNeeded * this.interval;

            // Wait for next refill
            await this._sleep(Math.min(timeToWait, this.interval));
            waitTime = Date.now() - startTime;
        }
    }

    /**
     * Try to remove tokens without waiting
     * @param {number} count - Number of tokens to remove
     * @returns {boolean} True if tokens were removed, false if insufficient tokens
     */
    tryRemoveTokens(count = 1) {
        if (count <= 0) {
            throw new Error('Token count must be positive');
        }

        if (count > this.maxBurst) {
            return false;
        }

        this._refillTokens();

        if (this.tokens >= count) {
            this.tokens -= count;
            this.stats.totalRequests++;
            return true;
        }

        return false;
    }

    /**
     * Get rate limiter statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            name: this.name,
            current_tokens: this.getAvailableTokens(),
            max_burst: this.maxBurst,
            tokens_per_interval: this.tokensPerInterval,
            interval_ms: this.interval,
            total_requests: this.stats.totalRequests,
            total_waits: this.stats.totalWaits,
            total_wait_time_ms: this.stats.totalWaitTime,
            max_wait_time_ms: this.stats.maxWaitTime,
            avg_wait_time_ms: this.stats.totalWaits > 0 
                ? Math.round(this.stats.totalWaitTime / this.stats.totalWaits) 
                : 0
        };
    }

    /**
     * Reset rate limiter (refill to max burst)
     */
    reset() {
        this.tokens = this.maxBurst;
        this.lastRefill = Date.now();
        logger.info(`🔄 Rate limiter "${this.name}" reset`);
    }

    /**
     * Helper method to sleep
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Pre-configured rate limiters for common APIs
 */

/**
 * Discord API Rate Limiter
 * Discord allows ~50 requests per second globally
 * With burst support for occasional spikes
 */
const discordRateLimiter = new RateLimiter({
    tokensPerInterval: RATE_LIMITS.DISCORD.TOKENS_PER_INTERVAL,
    interval: RATE_LIMITS.DISCORD.INTERVAL_MS,
    maxBurst: RATE_LIMITS.DISCORD.MAX_BURST,
    name: 'Discord API'
});

/**
 * Anthropic API Rate Limiter
 * Conservative rate limiting for Claude API
 * Adjust based on your tier and usage
 */
const anthropicRateLimiter = new RateLimiter({
    tokensPerInterval: RATE_LIMITS.ANTHROPIC.TOKENS_PER_INTERVAL,
    interval: RATE_LIMITS.ANTHROPIC.INTERVAL_MS,
    maxBurst: RATE_LIMITS.ANTHROPIC.MAX_BURST,
    name: 'Anthropic API'
});

/**
 * Tool Execution Rate Limiter
 * Limits how fast Claude can execute Discord tools
 * Prevents hammering the server with rapid tool calls
 */
const toolExecutionRateLimiter = new RateLimiter({
    tokensPerInterval: RATE_LIMITS.TOOL_EXECUTION.TOKENS_PER_INTERVAL,
    interval: RATE_LIMITS.TOOL_EXECUTION.INTERVAL_MS,
    maxBurst: RATE_LIMITS.TOOL_EXECUTION.MAX_BURST,
    name: 'Tool Execution'
});

module.exports = {
    RateLimiter,
    discordRateLimiter,
    anthropicRateLimiter,
    toolExecutionRateLimiter
};
