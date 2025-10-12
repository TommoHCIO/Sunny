const crypto = require('crypto');

class DebugService {
    constructor() {
        this.debugChannel = null;
        this.guild = null;
        this.instanceId = crypto.randomBytes(4).toString('hex');
        this.startTime = new Date();
        this.eventCounts = new Map();
        this.messageBuffer = [];
        this.bufferTimeout = null;
    }

    /**
     * Initialize debug channel - finds existing or creates new
     * Priority: 1) DEBUG_CHANNEL_ID env var, 2) Find by name, 3) Create new
     */
    async initialize(client) {
        try {
            const guilds = client.guilds.cache;
            if (guilds.size === 0) {
                console.warn('⚠️  No guilds available for debug channel');
                return;
            }

            this.guild = guilds.first();

            // Priority 1: Use DEBUG_CHANNEL_ID from environment if set
            if (process.env.DEBUG_CHANNEL_ID) {
                this.debugChannel = await this.guild.channels.fetch(process.env.DEBUG_CHANNEL_ID).catch(err => {
                    console.warn(`⚠️  Could not fetch DEBUG_CHANNEL_ID ${process.env.DEBUG_CHANNEL_ID}: ${err.message}`);
                    return null;
                });

                if (this.debugChannel) {
                    console.log(`✅ Using existing debug channel from env: #${this.debugChannel.name} (${this.debugChannel.id})`);
                    await this.logStartup();
                    return;
                }
            }

            // Priority 2: Look for existing debug channel by name
            this.debugChannel = this.guild.channels.cache.find(
                ch => ch.name === 'sunny-debug' && ch.isTextBased()
            );

            if (this.debugChannel) {
                console.log(`✅ Found existing sunny-debug channel: ${this.debugChannel.id}`);
                console.log(`   💡 Add to .env: DEBUG_CHANNEL_ID=${this.debugChannel.id}`);
                await this.logStartup();
                return;
            }

            // Priority 3: Create new channel only if nothing found
            console.log('📝 Creating new sunny-debug channel...');
            this.debugChannel = await this.guild.channels.create({
                name: 'sunny-debug',
                topic: `🔍 Debug logs for Sunny | Instance: ${this.instanceId} | PID: ${process.pid}`,
            });
            console.log(`✅ Debug channel created: ${this.debugChannel.id}`);
            console.log(`   💡 Add to .env: DEBUG_CHANNEL_ID=${this.debugChannel.id}`);

            // Send startup message
            await this.logStartup();

        } catch (error) {
            console.error('❌ Failed to initialize debug channel:', error);
        }
    }

    /**
     * Log bot startup with instance information
     */
    async logStartup() {
        if (!this.debugChannel) return;

        const timestamp = new Date().toISOString();
        const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        
        const message = `🟢 **SUNNY INSTANCE STARTED**
` +
            `📅 **Time:** ${timestamp}
` +
            `🆔 **Instance ID:** \`${this.instanceId}\`
` +
            `⚙️ **Process ID:** \`${process.pid}\`
` +
            `📦 **Node Version:** \`${process.version}\`
` +
            `💾 **Memory:** \`${memoryMB}MB\`
` +
            `✅ **Status:** Debug monitoring active`;

        try {
            await this.debugChannel.send(message);
        } catch (error) {
            console.error('Failed to send startup message:', error);
        }
    }

    /**
     * Log a Discord event with full context
     */
    async logEvent(eventType, data, executionId = null) {
        if (!this.debugChannel) return;

        // Track event counts
        this.eventCounts.set(eventType, (this.eventCounts.get(eventType) || 0) + 1);

        const timestamp = new Date().toISOString();
        const count = this.eventCounts.get(eventType);
        
        let message = `📡 **EVENT: ${eventType}**\n` +
            `📅 **Time:** ${timestamp}\n` +
            `🆔 **Instance:** \`${this.instanceId}\`\n` +
            `🔢 **Count:** \`${count}\``;

        if (executionId) {
            message += `\n🎯 **Execution ID:** \`${executionId}\``;
        }

        // Add event-specific data
        if (data) {
            const dataText = this.formatEventDataAsText(eventType, data);
            if (dataText) {
                message += `\n\n${dataText}`;
            }
        }

        try {
            await this.debugChannel.send(message);
        } catch (error) {
            console.error('Failed to log event:', error);
        }
    }

    /**
     * Log message handling flow
     */
    async logMessageFlow(stage, messageId, data, executionId) {
        if (!this.debugChannel) return;

        const stageEmojis = {
            'received': '📥',
            'filtered': '🔍',
            'processing': '⚙️',
            'agent_start': '🤖',
            'agent_loop': '🔄',
            'agent_complete': '✅',
            'sending': '📤',
            'sent': '✉️',
            'error': '❌'
        };

        const emoji = stageEmojis[stage] || '•';
        const timestamp = new Date().toISOString();
        const stageTitle = stage.toUpperCase().replace('_', ' ');

        let message = `${emoji} **${stageTitle}**\n` +
            `📅 **Time:** ${timestamp}\n` +
            `💬 **Message ID:** \`${messageId}\`\n` +
            `🎯 **Execution ID:** \`${executionId}\`\n` +
            `🆔 **Instance:** \`${this.instanceId}\``;

        // Add stage-specific data
        if (data) {
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                    const displayValue = stringValue.length > 500 ? stringValue.substring(0, 497) + '...' : stringValue;
                    message += `\n**${key}:** \`${displayValue}\``;
                }
            }
        }

        try {
            // Split message if too long (Discord limit 2000 chars)
            if (message.length > 1900) {
                const parts = this.splitMessage(message, 1900);
                for (const part of parts) {
                    await this.debugChannel.send(part);
                }
            } else {
                await this.debugChannel.send(message);
            }
        } catch (error) {
            console.error('Failed to log message flow:', error);
        }
    }

    /**
     * Log errors with stack traces
     */
    async logError(error, context = {}, executionId = null) {
        if (!this.debugChannel) return;

        const timestamp = new Date().toISOString();
        
        let message = `❌ **ERROR**\n` +
            `📅 **Time:** ${timestamp}\n` +
            `💥 **Message:** \`${error.message}\`\n` +
            `🆔 **Instance:** \`${this.instanceId}\`\n` +
            `⚙️ **Process ID:** \`${process.pid}\``;

        if (executionId) {
            message += `\n🎯 **Execution ID:** \`${executionId}\``;
        }

        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(0, 5).join('\n');
            const truncatedStack = stackLines.length > 800 ? stackLines.substring(0, 797) + '...' : stackLines;
            message += `\n\n**Stack Trace:**\n\`\`\`\n${truncatedStack}\n\`\`\``;
        }

        // Add context data
        for (const [key, value] of Object.entries(context)) {
            if (value !== null && value !== undefined) {
                const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                const displayValue = stringValue.length > 300 ? stringValue.substring(0, 297) + '...' : stringValue;
                message += `\n**${key}:** \`${displayValue}\``;
            }
        }

        try {
            // Split message if too long
            if (message.length > 1900) {
                const parts = this.splitMessage(message, 1900);
                for (const part of parts) {
                    await this.debugChannel.send(part);
                }
            } else {
                await this.debugChannel.send(message);
            }
        } catch (sendError) {
            console.error('Failed to log error:', sendError);
        }
    }

    /**
     * Log statistics summary
     */
    async logStats() {
        if (!this.debugChannel) return;

        const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
        const memory = process.memoryUsage();
        const timestamp = new Date().toISOString();
        const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memory.heapTotal / 1024 / 1024);

        let message = `📊 **INSTANCE STATISTICS**\n` +
            `📅 **Time:** ${timestamp}\n` +
            `🆔 **Instance ID:** \`${this.instanceId}\`\n` +
            `⏱️ **Uptime:** \`${uptime}s\`\n` +
            `💾 **Memory:** \`${heapUsedMB}MB / ${heapTotalMB}MB\``;

        // Add event counts
        if (this.eventCounts.size > 0) {
            message += `\n\n**Event Counts:**`;
            for (const [event, count] of this.eventCounts.entries()) {
                message += `\n• ${event}: \`${count}\``;
            }
        }

        try {
            await this.debugChannel.send(message);
        } catch (error) {
            console.error('Failed to log stats:', error);
        }
    }

    /**
     * Format event-specific data as text
     */
    formatEventDataAsText(eventType, data) {
        let text = '';

        switch (eventType) {
            case 'messageCreate':
                if (data.author) text += `\n👤 **Author:** ${data.author.tag} (\`${data.author.id}\`)`;
                if (data.channel) text += `\n📝 **Channel:** #${data.channel.name}`;
                if (data.id) text += `\n💬 **Message ID:** \`${data.id}\``;
                if (data.content) {
                    const content = data.content.length > 500 ? data.content.substring(0, 497) + '...' : data.content;
                    text += `\n📄 **Content:** \`${content}\``;
                }
                break;

            case 'error':
            case 'warn':
                if (data.message) text += `\n⚠️ **Message:** \`${data.message}\``;
                break;

            default:
                // Generic data formatting
                for (const [key, value] of Object.entries(data)) {
                    if (value !== null && value !== undefined) {
                        const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                        const displayValue = stringValue.length > 500 ? stringValue.substring(0, 497) + '...' : stringValue;
                        text += `\n**${key}:** \`${displayValue}\``;
                    }
                }
        }

        return text;
    }

    /**
     * Split long messages into chunks
     */
    splitMessage(message, maxLength) {
        const parts = [];
        let currentPart = '';
        const lines = message.split('\n');

        for (const line of lines) {
            if ((currentPart + line + '\n').length > maxLength) {
                if (currentPart) parts.push(currentPart);
                currentPart = line + '\n';
            } else {
                currentPart += line + '\n';
            }
        }

        if (currentPart) parts.push(currentPart);
        return parts;
    }

    /**
     * Generate a unique execution ID
     */
    generateExecutionId() {
        return crypto.randomBytes(8).toString('hex');
    }

    /**
     * Get instance information
     */
    getInstanceInfo() {
        return {
            instanceId: this.instanceId,
            pid: process.pid,
            startTime: this.startTime,
            uptime: Date.now() - this.startTime.getTime(),
            nodeVersion: process.version
        };
    }
}

// Singleton instance
const debugService = new DebugService();

module.exports = debugService;
