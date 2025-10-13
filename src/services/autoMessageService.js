// src/services/autoMessageService.js
/**
 * Automatic Message Service
 * Handles welcome, goodbye, milestone, scheduled, and trigger-based messages
 */

const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const AutoMessage = require('../models/AutoMessage');
const ServerSettings = require('../models/ServerSettings');

// Store active cron jobs
const activeCronJobs = new Map();

/**
 * Initialize scheduled messages when bot starts
 * @param {Client} client - Discord client
 */
async function initializeScheduledMessages(client) {
    try {
        console.log('[AutoMessage] Initializing scheduled messages...');
        
        // Clear existing cron jobs
        activeCronJobs.forEach(job => job.stop());
        activeCronJobs.clear();
        
        // Load all scheduled messages
        const scheduledMessages = await AutoMessage.find({
            messageType: 'scheduled',
            enabled: true
        });
        
        for (const message of scheduledMessages) {
            if (!message.triggers?.schedule) continue;
            
            try {
                // Validate cron expression
                if (!cron.validate(message.triggers.schedule)) {
                    console.warn(`[AutoMessage] Invalid cron expression for message ${message._id}: ${message.triggers.schedule}`);
                    continue;
                }
                
                // Schedule the message
                const job = cron.schedule(message.triggers.schedule, async () => {
                    await sendScheduledMessage(client, message);
                }, {
                    timezone: message.triggers.timezone || 'UTC'
                });
                
                activeCronJobs.set(message._id.toString(), job);
                console.log(`[AutoMessage] Scheduled message ${message._id} with cron: ${message.triggers.schedule}`);
            } catch (error) {
                console.error(`[AutoMessage] Failed to schedule message ${message._id}:`, error);
            }
        }
        
        console.log(`[AutoMessage] Initialized ${activeCronJobs.size} scheduled messages`);
    } catch (error) {
        console.error('[AutoMessage] Failed to initialize scheduled messages:', error);
    }
}

/**
 * Send welcome message when member joins
 * @param {GuildMember} member - Member who joined
 */
async function sendWelcomeMessage(member) {
    try {
        const settings = await ServerSettings.findOne({ guildId: member.guild.id });
        if (!settings?.autoMessages?.welcomeEnabled) return;
        
        const welcomeMessages = await AutoMessage.find({
            guildId: member.guild.id,
            messageType: 'welcome',
            enabled: true
        });
        
        for (const message of welcomeMessages) {
            await sendAutoMessage(member.guild, message, member);
        }
    } catch (error) {
        console.error('[AutoMessage] Failed to send welcome message:', error);
    }
}

/**
 * Send goodbye message when member leaves
 * @param {GuildMember} member - Member who left
 */
async function sendGoodbyeMessage(member) {
    try {
        const settings = await ServerSettings.findOne({ guildId: member.guild.id });
        if (!settings?.autoMessages?.goodbyeEnabled) return;
        
        const goodbyeMessages = await AutoMessage.find({
            guildId: member.guild.id,
            messageType: 'goodbye',
            enabled: true
        });
        
        for (const message of goodbyeMessages) {
            await sendAutoMessage(member.guild, message, member);
        }
    } catch (error) {
        console.error('[AutoMessage] Failed to send goodbye message:', error);
    }
}

/**
 * Check for milestone achievement and send message
 * @param {Guild} guild - Discord guild
 */
async function checkMilestone(guild) {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id });
        if (!settings?.autoMessages?.milestonesEnabled) return;
        
        const milestoneMessages = await AutoMessage.find({
            guildId: guild.id,
            messageType: 'milestone',
            enabled: true,
            'triggers.memberCount': guild.memberCount
        });
        
        for (const message of milestoneMessages) {
            await sendAutoMessage(guild, message);
        }
    } catch (error) {
        console.error('[AutoMessage] Failed to check milestone:', error);
    }
}

/**
 * Check for trigger keywords in message
 * @param {Message} message - Discord message
 */
async function checkTriggers(message) {
    try {
        if (message.author.bot) return;
        
        const settings = await ServerSettings.findOne({ guildId: message.guild.id });
        if (!settings?.autoMessages?.triggersEnabled) return;
        
        const triggerMessages = await AutoMessage.find({
            guildId: message.guild.id,
            messageType: 'trigger',
            enabled: true
        });
        
        const messageContent = message.content.toLowerCase();
        
        for (const autoMsg of triggerMessages) {
            if (!autoMsg.triggers?.keywords?.length) continue;
            
            const hasKeyword = autoMsg.triggers.keywords.some(keyword => 
                messageContent.includes(keyword.toLowerCase())
            );
            
            if (hasKeyword) {
                await sendAutoMessage(message.guild, autoMsg, message.member);
            }
        }
    } catch (error) {
        console.error('[AutoMessage] Failed to check triggers:', error);
    }
}

/**
 * Send a scheduled message
 * @param {Client} client - Discord client
 * @param {AutoMessage} autoMessage - Auto message document
 */
async function sendScheduledMessage(client, autoMessage) {
    try {
        const guild = client.guilds.cache.get(autoMessage.guildId);
        if (!guild) return;
        
        await sendAutoMessage(guild, autoMessage);
    } catch (error) {
        console.error('[AutoMessage] Failed to send scheduled message:', error);
    }
}

/**
 * Send an automatic message
 * @param {Guild} guild - Discord guild
 * @param {AutoMessage} autoMessage - Auto message document
 * @param {GuildMember} member - Optional member for variable replacement
 */
async function sendAutoMessage(guild, autoMessage, member = null) {
    try {
        const channel = guild.channels.cache.get(autoMessage.channelId);
        if (!channel) {
            console.warn(`[AutoMessage] Channel ${autoMessage.channelId} not found`);
            return;
        }
        
        // Build message content
        const messageContent = autoMessage.replaceVariables(guild, member);
        
        // Build embed if enabled
        let embed = null;
        if (autoMessage.embedConfig?.enabled) {
            embed = buildEmbed(autoMessage.embedConfig, guild, member);
        }
        
        // Send to channel
        const messagePayload = {};
        if (messageContent) messagePayload.content = messageContent;
        if (embed) messagePayload.embeds = [embed];
        
        await channel.send(messagePayload);
        
        // Send DM if enabled (welcome messages only)
        if (autoMessage.messageType === 'welcome' && autoMessage.dmUser && member) {
            try {
                const dm = await member.createDM();
                const dmPayload = {};
                if (messageContent) dmPayload.content = messageContent;
                if (embed) dmPayload.embeds = [embed];
                await dm.send(dmPayload);
            } catch (error) {
                console.log('[AutoMessage] Could not send DM (user has DMs disabled)');
            }
        }
    } catch (error) {
        console.error('[AutoMessage] Failed to send auto message:', error);
    }
}

/**
 * Build an embed from config
 * @param {Object} embedConfig - Embed configuration
 * @param {Guild} guild - Discord guild
 * @param {GuildMember} member - Optional member for variable replacement
 * @returns {EmbedBuilder}
 */
function buildEmbed(embedConfig, guild, member = null) {
    const embed = new EmbedBuilder();
    
    if (embedConfig.title) {
        embed.setTitle(replaceVariablesInText(embedConfig.title, guild, member));
    }
    if (embedConfig.description) {
        embed.setDescription(replaceVariablesInText(embedConfig.description, guild, member));
    }
    if (embedConfig.color) {
        embed.setColor(embedConfig.color);
    }
    if (embedConfig.footer) {
        embed.setFooter({ text: replaceVariablesInText(embedConfig.footer, guild, member) });
    }
    if (embedConfig.thumbnail) {
        embed.setThumbnail(embedConfig.thumbnail);
    }
    if (embedConfig.image) {
        embed.setImage(embedConfig.image);
    }
    if (embedConfig.fields?.length) {
        for (const field of embedConfig.fields) {
            embed.addFields({
                name: replaceVariablesInText(field.name, guild, member),
                value: replaceVariablesInText(field.value, guild, member),
                inline: field.inline || false
            });
        }
    }
    
    return embed;
}

/**
 * Replace variables in text
 * @param {string} text - Text with variables
 * @param {Guild} guild - Discord guild
 * @param {GuildMember} member - Optional member
 * @returns {string}
 */
function replaceVariablesInText(text, guild, member = null) {
    const replacements = {
        '{user}': member ? `<@${member.id}>` : '{user}',
        '{username}': member ? member.user.username : '{username}',
        '{server}': guild.name,
        '{memberCount}': guild.memberCount,
        '{date}': new Date().toLocaleDateString(),
        '{time}': new Date().toLocaleTimeString()
    };
    
    for (const [key, value] of Object.entries(replacements)) {
        text = text.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    
    return text;
}

// ===== CRUD OPERATIONS =====

/**
 * Create a new automatic message
 * @param {string} guildId - Guild ID
 * @param {Object} config - Message configuration
 * @returns {Promise<AutoMessage>}
 */
async function createAutoMessage(guildId, config) {
    try {
        const autoMessage = await AutoMessage.create({
            guildId,
            ...config
        });
        
        // If scheduled message, start cron job
        if (config.messageType === 'scheduled' && config.enabled && config.triggers?.schedule) {
            const client = require('../index').client;
            if (cron.validate(config.triggers.schedule)) {
                const job = cron.schedule(config.triggers.schedule, async () => {
                    await sendScheduledMessage(client, autoMessage);
                }, {
                    timezone: config.triggers.timezone || 'UTC'
                });
                activeCronJobs.set(autoMessage._id.toString(), job);
            }
        }
        
        return autoMessage;
    } catch (error) {
        console.error('[AutoMessage] Failed to create auto message:', error);
        throw error;
    }
}

/**
 * Update an automatic message
 * @param {string} messageId - Message ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<AutoMessage>}
 */
async function updateAutoMessage(messageId, updates) {
    try {
        const autoMessage = await AutoMessage.findByIdAndUpdate(
            messageId,
            { $set: updates },
            { new: true }
        );
        
        if (!autoMessage) {
            throw new Error('Auto message not found');
        }
        
        // Update cron job if scheduled message
        if (autoMessage.messageType === 'scheduled') {
            const existingJob = activeCronJobs.get(messageId);
            if (existingJob) {
                existingJob.stop();
                activeCronJobs.delete(messageId);
            }
            
            if (autoMessage.enabled && autoMessage.triggers?.schedule) {
                const client = require('../index').client;
                if (cron.validate(autoMessage.triggers.schedule)) {
                    const job = cron.schedule(autoMessage.triggers.schedule, async () => {
                        await sendScheduledMessage(client, autoMessage);
                    }, {
                        timezone: autoMessage.triggers.timezone || 'UTC'
                    });
                    activeCronJobs.set(messageId, job);
                }
            }
        }
        
        return autoMessage;
    } catch (error) {
        console.error('[AutoMessage] Failed to update auto message:', error);
        throw error;
    }
}

/**
 * Delete an automatic message
 * @param {string} messageId - Message ID
 * @returns {Promise<boolean>}
 */
async function deleteAutoMessage(messageId) {
    try {
        const autoMessage = await AutoMessage.findByIdAndDelete(messageId);
        
        if (!autoMessage) {
            throw new Error('Auto message not found');
        }
        
        // Stop cron job if scheduled message
        const existingJob = activeCronJobs.get(messageId);
        if (existingJob) {
            existingJob.stop();
            activeCronJobs.delete(messageId);
        }
        
        return true;
    } catch (error) {
        console.error('[AutoMessage] Failed to delete auto message:', error);
        throw error;
    }
}

/**
 * List automatic messages for a guild
 * @param {string} guildId - Guild ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>}
 */
async function listAutoMessages(guildId, filters = {}) {
    try {
        const query = { guildId, ...filters };
        return await AutoMessage.find(query).sort({ createdAt: -1 });
    } catch (error) {
        console.error('[AutoMessage] Failed to list auto messages:', error);
        throw error;
    }
}

/**
 * Get a specific automatic message
 * @param {string} messageId - Message ID
 * @returns {Promise<AutoMessage>}
 */
async function getAutoMessage(messageId) {
    try {
        return await AutoMessage.findById(messageId);
    } catch (error) {
        console.error('[AutoMessage] Failed to get auto message:', error);
        throw error;
    }
}

module.exports = {
    initializeScheduledMessages,
    sendWelcomeMessage,
    sendGoodbyeMessage,
    checkMilestone,
    checkTriggers,
    createAutoMessage,
    updateAutoMessage,
    deleteAutoMessage,
    listAutoMessages,
    getAutoMessage,
    buildEmbed,
    sendAutoMessage
};
