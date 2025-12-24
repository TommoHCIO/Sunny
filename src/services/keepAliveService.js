// src/services/keepAliveService.js
/**
 * Keep Alive Service for Render.com Free Tier
 * Prevents the service from spinning down due to inactivity
 *
 * Render.com free tier spins down after 15 minutes of inactivity.
 * This service pings the health endpoint every 14 minutes to keep it alive.
 */

const https = require('https');
const http = require('http');

class KeepAliveService {
    constructor() {
        this.interval = null;
        this.pingInterval = 14 * 60 * 1000; // 14 minutes (just under 15 min timeout)
        this.url = null;
        this.stats = {
            pings: 0,
            successes: 0,
            failures: 0,
            lastPing: null,
            lastStatus: null
        };
    }

    /**
     * Start the keep-alive service
     * @param {string} url - URL to ping (e.g., https://your-app.onrender.com/health)
     */
    start(url) {
        if (this.interval) {
            console.log('[KeepAlive] Already running');
            return;
        }

        this.url = url;

        // Only start if we have a valid URL
        if (!url || url.includes('localhost')) {
            console.log('[KeepAlive] Skipping - localhost or no URL provided');
            return;
        }

        console.log(`[KeepAlive] Starting with URL: ${url}`);
        console.log(`[KeepAlive] Ping interval: ${this.pingInterval / 1000 / 60} minutes`);

        // Initial ping
        this.ping();

        // Schedule recurring pings
        this.interval = setInterval(() => this.ping(), this.pingInterval);
    }

    /**
     * Ping the health endpoint
     */
    ping() {
        if (!this.url) return;

        const startTime = Date.now();
        const protocol = this.url.startsWith('https') ? https : http;

        const req = protocol.get(this.url, { timeout: 30000 }, (res) => {
            const duration = Date.now() - startTime;
            this.stats.pings++;
            this.stats.lastPing = new Date().toISOString();
            this.stats.lastStatus = res.statusCode;

            if (res.statusCode === 200) {
                this.stats.successes++;
                console.log(`[KeepAlive] Ping successful (${res.statusCode}) - ${duration}ms`);
            } else {
                this.stats.failures++;
                console.warn(`[KeepAlive] Ping returned ${res.statusCode} - ${duration}ms`);
            }

            // Consume response data to free up memory
            res.resume();
        });

        req.on('error', (error) => {
            this.stats.pings++;
            this.stats.failures++;
            this.stats.lastPing = new Date().toISOString();
            this.stats.lastStatus = 'error';
            console.error(`[KeepAlive] Ping failed: ${error.message}`);
        });

        req.on('timeout', () => {
            this.stats.pings++;
            this.stats.failures++;
            this.stats.lastPing = new Date().toISOString();
            this.stats.lastStatus = 'timeout';
            console.error('[KeepAlive] Ping timed out');
            req.destroy();
        });
    }

    /**
     * Stop the keep-alive service
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log('[KeepAlive] Stopped');
        }
    }

    /**
     * Get service statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            running: this.interval !== null,
            url: this.url,
            pingIntervalMinutes: this.pingInterval / 1000 / 60,
            successRate: this.stats.pings > 0
                ? `${((this.stats.successes / this.stats.pings) * 100).toFixed(2)}%`
                : 'N/A'
        };
    }

    /**
     * Update ping interval
     * @param {number} minutes - Interval in minutes
     */
    setInterval(minutes) {
        this.pingInterval = minutes * 60 * 1000;

        // Restart if already running
        if (this.interval) {
            this.stop();
            this.start(this.url);
        }
    }
}

// Export singleton
module.exports = new KeepAliveService();
