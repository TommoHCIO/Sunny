// src/services/statusService.js
const { EmbedBuilder } = require('discord.js');

/**
 * Status Service - Visual Real-Time Status Indicator
 *
 * Creates beautiful, autumn-themed embeds that update every 2.5 seconds
 * showing processing progress with rotating themes, colors, and progress bars.
 */

// Autumn-themed status progression with emoji, descriptions, colors
const STATUS_THEMES = [
    {
        title: "🍂 Gathering Thoughts",
        description: "Sunny is collecting autumn leaves of wisdom...",
        color: 0xe67e22  // Vibrant Orange
    },
    {
        title: "☕ Brewing Response",
        description: "Steeping your request like a warm cup of tea...",
        color: 0xc27c0e  // Dark Gold
    },
    {
        title: "🍁 Processing Request",
        description: "Rustling through the knowledge trees...",
        color: 0xa84300  // Dark Orange
    },
    {
        title: "🧡 Crafting Reply",
        description: "Weaving words with cozy autumn magic...",
        color: 0xf1c40f  // Bright Gold
    },
    {
        title: "🌻 Almost Ready",
        description: "Just a few more sunflower seeds of thought...",
        color: 0xfee75c  // Warm Yellow
    }
];

/**
 * StatusTracker - Manages visual status embed updates
 *
 * Features:
 * - Rotating autumn-themed messages
 * - Unicode progress bar animation
 * - Color cycling through autumn palette
 * - Real-time elapsed time display
 * - Asymptotic progress (approaches 100% but never reaches)
 * - Auto-cleanup on completion
 * - Enhanced with AI model information
 */
class StatusTracker {
    constructor(statusMessage, startTime, modelInfo) {
        this.statusMessage = statusMessage;  // Discord message object
        this.startTime = startTime;          // Timestamp when started
        this.intervalId = null;              // setInterval ID for cleanup
        this.updateCount = 0;                // Tracks rotation through themes
        this.stopped = false;                // Prevents updates after stop
        this.modelInfo = modelInfo || null;  // AI model being used
    }

    /**
     * Calculate progress percentage (asymptotic approach)
     *
     * Uses exponential formula: 100 * (1 - e^(-t/10))
     * This creates smooth progress that approaches 100% but caps at 95%
     *
     * @param {number} elapsedSeconds - Time elapsed since start
     * @returns {number} Progress percentage (0-95)
     */
    calculateProgress(elapsedSeconds) {
        const progress = Math.min(95, Math.floor(100 * (1 - Math.exp(-elapsedSeconds / 10))));
        return progress;
    }

    /**
     * Build Unicode progress bar
     *
     * Creates visual progress bar using block characters:
     * ▓ = filled, ░ = empty
     *
     * @param {number} percent - Progress percentage (0-100)
     * @param {number} length - Total bar length in characters (default 10)
     * @returns {string} Formatted progress bar string
     *
     * @example
     * buildProgressBar(60, 10) // "▓▓▓▓▓▓░░░░ 60%"
     */
    buildProgressBar(percent, length = 10) {
        const filled = Math.floor((percent / 100) * length);
        const empty = length - filled;
        return '▓'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
    }

    /**
     * Create rich embed with current status
     *
     * Builds Discord embed with:
     * - Rotating themed title and description
     * - Color cycling through autumn palette
     * - Unicode progress bar
     * - Elapsed time footer
     * - Timestamp
     *
     * @returns {EmbedBuilder} Configured embed ready to send
     */
    createEmbed() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const theme = STATUS_THEMES[this.updateCount % STATUS_THEMES.length];
        const progress = this.calculateProgress(elapsed);
        const progressBar = this.buildProgressBar(progress);

        // Build description with model info if available
        let description = `${theme.description}\n\n${progressBar}`;
        if (this.modelInfo) {
            description += `\n\n*Using ${this.modelInfo}*`;
        }

        return new EmbedBuilder()
            .setTitle(theme.title)
            .setDescription(description)
            .setColor(theme.color)
            .setFooter({ text: `⏱️ Elapsed: ${elapsed.toFixed(1)}s` })
            .setTimestamp();
    }

    /**
     * Update status embed with new theme and progress
     *
     * Called every 2.5 seconds by interval timer.
     * Rotates to next theme, recalculates progress, updates embed.
     * Handles errors gracefully (deleted message, permissions).
     */
    async updateStatus() {
        if (this.stopped) return;

        try {
            const embed = this.createEmbed();
            await this.statusMessage.edit({ embeds: [embed] });
            this.updateCount++;
        } catch (error) {
            // Message deleted or permission error - stop gracefully
            console.log(`⚠️  Status update failed: ${error.message}`);
            await this.stop();
        }
    }

    /**
     * Stop status tracking and delete message
     *
     * Idempotent - safe to call multiple times.
     * Clears interval timer and deletes status message.
     * Handles errors gracefully (already deleted, no permission).
     */
    async stop() {
        if (this.stopped) return; // Idempotent
        this.stopped = true;

        // Clear interval timer
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Delete status message
        if (this.statusMessage) {
            try {
                await this.statusMessage.delete();
            } catch (error) {
                // Already deleted or no permission - ignore
                console.log(`⚠️  Status message cleanup: ${error.message}`);
            }
        }
    }
}

/**
 * Start visual status tracking
 *
 * Creates initial status embed and starts interval timer
 * for updates every 1.5 seconds (optimized for better UX).
 *
 * @param {Message} message - Discord message to reply to
 * @param {string} modelInfo - Optional AI model information to display
 * @returns {Promise<StatusTracker>} Tracker instance with stop() method
 *
 * @example
 * const statusTracker = await statusService.start(message, 'Z.AI GLM-4.6');
 * // ... do work ...
 * await statusTracker.stop(); // Clean up
 */
async function start(message, modelInfo = null) {
    try {
        // Create initial embed with first theme
        let initialDescription = `${STATUS_THEMES[0].description}\n\n░░░░░░░░░░ 0%`;
        if (modelInfo) {
            initialDescription += `\n\n*Using ${modelInfo}*`;
        }
        
        const initialEmbed = new EmbedBuilder()
            .setTitle(STATUS_THEMES[0].title)
            .setDescription(initialDescription)
            .setColor(STATUS_THEMES[0].color)
            .setFooter({ text: '⏱️ Elapsed: 0.0s' })
            .setTimestamp();

        // Send status message
        const statusMessage = await message.channel.send({ embeds: [initialEmbed] });

        // Create tracker with model info
        const tracker = new StatusTracker(statusMessage, Date.now(), modelInfo);

        // Start interval updates every 1.5 seconds (faster updates = better UX)
        // Research shows 1-2 second updates are optimal for loading indicators
        tracker.intervalId = setInterval(() => {
            tracker.updateStatus();
        }, 1500);

        return tracker;
    } catch (error) {
        console.error("⚠️  Failed to start status tracking:", error);
        // Return no-op tracker that does nothing
        return {
            stop: async () => {},
            stopped: true
        };
    }
}

module.exports = { start };
