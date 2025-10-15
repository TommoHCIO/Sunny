// src/services/statusService.js
const { EmbedBuilder } = require('discord.js');

/**
 * Status Service - Real-Time Event-Driven Status Indicator
 *
 * Creates beautiful, autumn-themed embeds that update every 1.5 seconds
 * showing REAL operations happening in the AI agent (model selection, API calls, tool execution).
 *
 * Uses EventEmitter to receive real-time updates from the AI provider and displays
 * truthful, detailed progress instead of fake rotating themes.
 */

/**
 * StatusTracker - Manages real-time event-driven status embed updates
 *
 * Features:
 * - Real-time event updates from AI provider
 * - Shows actual operations (model selection, API calls, tool execution)
 * - Unicode progress bar based on actual iterations
 * - Autumn color palette for different event types
 * - Real-time elapsed time display
 * - Auto-cleanup on completion
 */
class StatusTracker {
    constructor(statusMessage, startTime, eventEmitter) {
        this.statusMessage = statusMessage;  // Discord message object
        this.startTime = startTime;          // Timestamp when started
        this.intervalId = null;              // setInterval ID for cleanup
        this.updateCount = 0;                // Tracks number of updates
        this.stopped = false;                // Prevents updates after stop
        this.eventEmitter = eventEmitter;    // EventEmitter for real-time updates

        // Real-time status state - updated by events
        this.currentEvent = {
            type: 'initializing',
            title: '🎬 Initializing',
            description: 'Starting AI agent...',
            progress: 0,
            details: null
        };

        // Listen to real-time events if emitter provided
        if (this.eventEmitter) {
            this.setupEventListeners();
        }
    }

    /**
     * Setup event listeners for real-time status updates
     *
     * Listens to events from the AI provider and updates currentEvent state.
     * The next updateStatus() call (every 1.5s) will display the latest event.
     */
    setupEventListeners() {
        // Model selection event
        this.eventEmitter.on('model_selected', (data) => {
            const modelDisplay = data.model === 'glm-4.5-air'
                ? 'GLM-4.5-Air (Efficient)'
                : 'GLM-4.6 (Advanced)';

            this.currentEvent = {
                type: 'model_selected',
                title: '🤖 AI Model Selected',
                description: `Using ${modelDisplay}`,
                progress: 10,
                details: data.reasoning
            };
        });

        // API call start event
        this.eventEmitter.on('api_call_start', (data) => {
            const progressPct = Math.min(95, 20 + (data.iteration / data.maxIterations) * 70);
            this.currentEvent = {
                type: 'api_call',
                title: `📡 API Call #${data.iteration}`,
                description: 'Requesting Z.AI GLM response...',
                progress: Math.floor(progressPct),
                details: `Iteration ${data.iteration}/${data.maxIterations}`
            };
        });

        // Tool execution event
        this.eventEmitter.on('tool_execution', (data) => {
            const toolIcons = {
                'list_channels': '📋',
                'list_roles': '🎭',
                'create_channel': '➕',
                'delete_channel': '🗑️',
                'list_members': '👥',
                'get_channel_info': 'ℹ️',
                'send_message': '💬'
            };
            const icon = toolIcons[data.toolName] || '🔧';

            this.currentEvent = {
                type: 'tool_execution',
                title: `${icon} Executing Tool`,
                description: `Running: ${data.toolName}`,
                progress: Math.min(95, 30 + data.iteration * 5),
                details: `Args: ${JSON.stringify(data.args).substring(0, 60)}...`
            };
        });

        // Thinking/processing event
        this.eventEmitter.on('thinking', () => {
            this.currentEvent = {
                type: 'thinking',
                title: '💭 Processing Response',
                description: 'Analyzing results and crafting reply...',
                progress: 95,
                details: null
            };
        });

        // Completion event
        this.eventEmitter.on('complete', (data) => {
            this.currentEvent = {
                type: 'complete',
                title: '✅ Complete!',
                description: `Finished in ${data.totalTime}s`,
                progress: 100,
                details: `${data.totalIterations} iterations completed`
            };
        });
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
     * Get color for event type (autumn-themed palette)
     *
     * @param {string} eventType - Type of event
     * @returns {number} Discord color code
     */
    getColorForEvent(eventType) {
        const colors = {
            'initializing': 0xe67e22,    // Vibrant Orange
            'model_selected': 0x3498db,  // Blue
            'api_call': 0x9b59b6,        // Purple
            'tool_execution': 0xe74c3c,  // Red
            'thinking': 0x1abc9c,        // Teal
            'complete': 0x2ecc71         // Green
        };
        return colors[eventType] || 0xe67e22;
    }

    /**
     * Create rich embed with current real-time status
     *
     * Builds Discord embed with:
     * - Real event-driven title and description
     * - Color based on event type
     * - Unicode progress bar from actual operations
     * - Elapsed time display
     * - Timestamp
     *
     * @returns {EmbedBuilder} Configured embed ready to send
     */
    createEmbed() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const event = this.currentEvent;
        const progressBar = this.buildProgressBar(event.progress);

        // Build description with real event data
        let description = `${event.description}\n\n${progressBar}`;
        if (event.details) {
            description += `\n\n*${event.details}*`;
        }
        description += `\n⏱️ ${elapsed.toFixed(1)}s elapsed`;

        return new EmbedBuilder()
            .setTitle(event.title)
            .setDescription(description)
            .setColor(this.getColorForEvent(event.type))
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
     * Clears interval timer, removes event listeners, and deletes status message.
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

        // Remove event listeners
        if (this.eventEmitter) {
            this.eventEmitter.removeAllListeners();
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
 * Start real-time event-driven status tracking
 *
 * Creates initial status embed and starts interval timer
 * for updates every 1.5 seconds. Connects to EventEmitter for real-time updates.
 *
 * @param {Message} message - Discord message to reply to
 * @param {EventEmitter} eventEmitter - Optional EventEmitter for real-time status updates
 * @returns {Promise<StatusTracker>} Tracker instance with stop() method
 *
 * @example
 * const { EventEmitter } = require('events');
 * const statusEmitter = new EventEmitter();
 * const statusTracker = await statusService.start(message, statusEmitter);
 * // ... emit events as work happens ...
 * await statusTracker.stop(); // Clean up
 */
async function start(message, eventEmitter = null) {
    try {
        // Create initial embed
        const initialEmbed = new EmbedBuilder()
            .setTitle('🎬 Initializing')
            .setDescription('Starting AI agent...\n\n░░░░░░░░░░░░░░░░░░░░ 0%\n⏱️ 0.0s elapsed')
            .setColor(0xe67e22) // Vibrant Orange
            .setTimestamp();

        // Send status message
        const statusMessage = await message.channel.send({ embeds: [initialEmbed] });

        // Create tracker with event emitter
        const tracker = new StatusTracker(statusMessage, Date.now(), eventEmitter);

        // Start interval updates every 1.5 seconds
        // This provides live feedback - embed updates reflect latest events
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
