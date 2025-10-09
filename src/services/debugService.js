const { EmbedBuilder } = require('discord.js');
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
     */
    async initialize(client) {
        try {
            const guilds = client.guilds.cache;
            if (guilds.size === 0) {
                console.warn('⚠️  No guilds available for debug channel');
                return;
            }

            this.guild = guilds.first();
            
            // Look for existing debug channel
            this.debugChannel = this.guild.channels.cache.find(
                ch => ch.name === 'sunny-debug' && ch.isTextBased()
            );

            if (!this.debugChannel) {
                console.log('📝 Creating sunny-debug channel...');
                this.debugChannel = await this.guild.channels.create({
                    name: 'sunny-debug',
                    topic: '🔍 Real-time debug logs for Sunny bot',
                    permissionOverwrites: [
                        {
                            id: this.guild.id,
                            deny: ['ViewChannel'], // Hide from @everyone
                        },
                        {
                            id: this.guild.ownerId,
                            allow: ['ViewChannel', 'SendMessages'], // Owner can see
                        },
                    ],
                });
                console.log('✅ Debug channel created');
            }

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

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🟢 Sunny Instance Started')
            .setDescription('Debug monitoring active')
            .addFields(
                { name: 'Instance ID', value: `\`${this.instanceId}\``, inline: true },
                { name: 'Process ID', value: `\`${process.pid}\``, inline: true },
                { name: 'Node Version', value: `\`${process.version}\``, inline: true },
                { name: 'Start Time', value: `<t:${Math.floor(this.startTime.getTime() / 1000)}:T>`, inline: true },
                { name: 'Memory', value: `\`${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\``, inline: true }
            )
            .setTimestamp();

        try {
            await this.debugChannel.send({ embeds: [embed] });
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

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle(`📡 Event: ${eventType}`)
            .addFields(
                { name: 'Instance', value: `\`${this.instanceId}\``, inline: true },
                { name: 'Count', value: `\`${this.eventCounts.get(eventType)}\``, inline: true },
                { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
            )
            .setTimestamp();

        if (executionId) {
            embed.addFields({ name: 'Execution ID', value: `\`${executionId}\``, inline: false });
        }

        // Add event-specific data
        if (data) {
            const fields = this.formatEventData(eventType, data);
            if (fields.length > 0) {
                embed.addFields(fields);
            }
        }

        try {
            await this.debugChannel.send({ embeds: [embed] });
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

        const stageColors = {
            'received': '#95A5A6',
            'filtered': '#3498DB',
            'processing': '#F39C12',
            'agent_start': '#9B59B6',
            'agent_loop': '#E67E22',
            'agent_complete': '#27AE60',
            'sending': '#1ABC9C',
            'sent': '#2ECC71',
            'error': '#E74C3C'
        };

        const emoji = stageEmojis[stage] || '•';
        const color = stageColors[stage] || '#95A5A6';

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${emoji} ${stage.toUpperCase().replace('_', ' ')}`)
            .addFields(
                { name: 'Message ID', value: `\`${messageId}\``, inline: true },
                { name: 'Execution ID', value: `\`${executionId}\``, inline: true },
                { name: 'Instance', value: `\`${this.instanceId}\``, inline: true }
            )
            .setTimestamp();

        // Add stage-specific data
        if (data) {
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                    const displayValue = stringValue.length > 1024 ? stringValue.substring(0, 1021) + '...' : stringValue;
                    embed.addFields({ name: key, value: `\`\`\`${displayValue}\`\`\``, inline: false });
                }
            }
        }

        try {
            await this.debugChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to log message flow:', error);
        }
    }

    /**
     * Log errors with stack traces
     */
    async logError(error, context = {}, executionId = null) {
        if (!this.debugChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('❌ ERROR')
            .setDescription(`\`\`\`${error.message}\`\`\``)
            .addFields(
                { name: 'Instance', value: `\`${this.instanceId}\``, inline: true },
                { name: 'Process ID', value: `\`${process.pid}\``, inline: true }
            )
            .setTimestamp();

        if (executionId) {
            embed.addFields({ name: 'Execution ID', value: `\`${executionId}\``, inline: false });
        }

        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(0, 10).join('\n');
            const truncatedStack = stackLines.length > 1024 ? stackLines.substring(0, 1021) + '...' : stackLines;
            embed.addFields({ name: 'Stack Trace', value: `\`\`\`${truncatedStack}\`\`\``, inline: false });
        }

        // Add context data
        for (const [key, value] of Object.entries(context)) {
            if (value !== null && value !== undefined) {
                const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                const displayValue = stringValue.length > 1024 ? stringValue.substring(0, 1021) + '...' : stringValue;
                embed.addFields({ name: key, value: `\`\`\`${displayValue}\`\`\``, inline: false });
            }
        }

        try {
            await this.debugChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to log error:', error);
        }
    }

    /**
     * Log statistics summary
     */
    async logStats() {
        if (!this.debugChannel) return;

        const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
        const memory = process.memoryUsage();

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('📊 Instance Statistics')
            .addFields(
                { name: 'Instance ID', value: `\`${this.instanceId}\``, inline: true },
                { name: 'Uptime', value: `\`${uptime}s\``, inline: true },
                { name: 'Memory', value: `\`${Math.round(memory.heapUsed / 1024 / 1024)}MB / ${Math.round(memory.heapTotal / 1024 / 1024)}MB\``, inline: true }
            )
            .setTimestamp();

        // Add event counts
        if (this.eventCounts.size > 0) {
            const eventSummary = Array.from(this.eventCounts.entries())
                .map(([event, count]) => `${event}: ${count}`)
                .join('\n');
            embed.addFields({ name: 'Event Counts', value: `\`\`\`${eventSummary}\`\`\``, inline: false });
        }

        try {
            await this.debugChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to log stats:', error);
        }
    }

    /**
     * Format event-specific data into embed fields
     */
    formatEventData(eventType, data) {
        const fields = [];

        switch (eventType) {
            case 'messageCreate':
                if (data.author) fields.push({ name: 'Author', value: `${data.author.tag} (${data.author.id})`, inline: true });
                if (data.channel) fields.push({ name: 'Channel', value: `#${data.channel.name}`, inline: true });
                if (data.content) {
                    const content = data.content.length > 1024 ? data.content.substring(0, 1021) + '...' : data.content;
                    fields.push({ name: 'Content', value: `\`\`\`${content}\`\`\``, inline: false });
                }
                if (data.id) fields.push({ name: 'Message ID', value: `\`${data.id}\``, inline: true });
                break;

            case 'error':
            case 'warn':
                if (data.message) fields.push({ name: 'Message', value: `\`\`\`${data.message}\`\`\``, inline: false });
                break;

            default:
                // Generic data formatting
                for (const [key, value] of Object.entries(data)) {
                    if (value !== null && value !== undefined) {
                        const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                        const displayValue = stringValue.length > 1024 ? stringValue.substring(0, 1021) + '...' : stringValue;
                        fields.push({ name: key, value: `\`${displayValue}\``, inline: true });
                    }
                }
        }

        return fields;
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
