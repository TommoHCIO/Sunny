// src/tools/channelMemberTools.js
/**
 * Additional Channel and Member Management Tools
 * Tools for channel positioning, voice member management, webhook execution, and automod editing
 */

const { PermissionFlagsBits, AutoModerationRuleTriggerType, AutoModerationActionType } = require('discord.js');

/**
 * Set channel position in the channel list
 */
async function setChannelPosition(guild, channelName, position, reason = 'Channel position set by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const channel = guild.channels.cache.find(c => c.name.toLowerCase() === channelName.toLowerCase());
        if (!channel) {
            return { success: false, error: `Channel "${channelName}" not found` };
        }

        // Check permissions
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return {
                success: false,
                error: 'I don\'t have permission to manage channels. Please grant me the "Manage Channels" permission.'
            };
        }

        const oldPosition = channel.position;
        await channel.setPosition(position, { reason });

        return {
            success: true,
            message: `Channel ${channel.name} moved from position ${oldPosition} to ${position}`,
            channel: {
                name: channel.name,
                id: channel.id,
                oldPosition,
                newPosition: channel.position
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to set channel position: ${error.message}`
        };
    }
}

/**
 * Get channel permission overwrites
 */
async function getChannelPermissions(guild, channelName) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const channel = guild.channels.cache.find(c => c.name.toLowerCase() === channelName.toLowerCase());
        if (!channel) {
            return { success: false, error: `Channel "${channelName}" not found` };
        }

        const overwrites = Array.from(channel.permissionOverwrites.cache.values()).map(overwrite => {
            const target = overwrite.type === 0 ? guild.roles.cache.get(overwrite.id) : guild.members.cache.get(overwrite.id);

            return {
                id: overwrite.id,
                type: overwrite.type === 0 ? 'role' : 'member',
                name: target?.name || target?.user?.username || 'Unknown',
                allow: overwrite.allow.toArray(),
                deny: overwrite.deny.toArray()
            };
        });

        return {
            success: true,
            channel: {
                name: channel.name,
                id: channel.id,
                type: channel.type
            },
            permissionOverwrites: overwrites,
            count: overwrites.length
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get channel permissions: ${error.message}`
        };
    }
}

/**
 * Server deafen a member in voice
 */
async function setMemberDeaf(guild, userId, deaf, reason = 'Member deafened by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            return { success: false, error: `Member with ID ${userId} not found` };
        }

        // Check if member is in voice
        if (!member.voice.channel) {
            return {
                success: false,
                error: `${member.user.username} is not in a voice channel`
            };
        }

        // Check permissions
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.DeafenMembers)) {
            return {
                success: false,
                error: 'I don\'t have permission to deafen members. Please grant me the "Deafen Members" permission.'
            };
        }

        await member.voice.setDeaf(deaf, reason);

        return {
            success: true,
            message: `${member.user.username} has been ${deaf ? 'deafened' : 'undeafened'}`,
            member: {
                username: member.user.username,
                id: member.id,
                voiceChannel: member.voice.channel.name,
                deaf: deaf
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to ${deaf ? 'deafen' : 'undeafen'} member: ${error.message}`
        };
    }
}

/**
 * Server mute a member in voice
 */
async function setMemberMute(guild, userId, mute, reason = 'Member muted by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            return { success: false, error: `Member with ID ${userId} not found` };
        }

        // Check if member is in voice
        if (!member.voice.channel) {
            return {
                success: false,
                error: `${member.user.username} is not in a voice channel`
            };
        }

        // Check permissions
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.MuteMembers)) {
            return {
                success: false,
                error: 'I don\'t have permission to mute members. Please grant me the "Mute Members" permission.'
            };
        }

        await member.voice.setMute(mute, reason);

        return {
            success: true,
            message: `${member.user.username} has been ${mute ? 'muted' : 'unmuted'}`,
            member: {
                username: member.user.username,
                id: member.id,
                voiceChannel: member.voice.channel.name,
                mute: mute
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to ${mute ? 'mute' : 'unmute'} member: ${error.message}`
        };
    }
}

/**
 * Execute a webhook to send a message
 */
async function executeWebhook(guild, webhookId, content, options = {}) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        // Fetch all webhooks and find the one we need
        const webhooks = await guild.fetchWebhooks();
        const webhook = webhooks.get(webhookId);

        if (!webhook) {
            return { success: false, error: `Webhook with ID ${webhookId} not found` };
        }

        const sendOptions = {
            content: content,
            username: options.username || undefined,
            avatarURL: options.avatarURL || undefined,
            embeds: options.embeds || undefined,
            files: options.files || undefined,
            threadId: options.threadId || undefined
        };

        const message = await webhook.send(sendOptions);

        return {
            success: true,
            message: 'Webhook executed successfully',
            webhook: {
                name: webhook.name,
                id: webhook.id
            },
            sentMessage: {
                id: message.id,
                content: message.content,
                url: message.url
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to execute webhook: ${error.message}`
        };
    }
}

/**
 * Edit a webhook's properties
 */
async function editWebhook(guild, webhookId, options, reason = 'Webhook edited by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        // Fetch all webhooks and find the one we need
        const webhooks = await guild.fetchWebhooks();
        const webhook = webhooks.get(webhookId);

        if (!webhook) {
            return { success: false, error: `Webhook with ID ${webhookId} not found` };
        }

        const editOptions = {
            name: options.name || undefined,
            avatar: options.avatar || undefined,
            channel: options.channelId ? guild.channels.cache.get(options.channelId) : undefined,
            reason: reason
        };

        // Remove undefined values
        Object.keys(editOptions).forEach(key => editOptions[key] === undefined && delete editOptions[key]);

        await webhook.edit(editOptions);

        return {
            success: true,
            message: `Webhook ${webhook.name} edited successfully`,
            webhook: {
                name: webhook.name,
                id: webhook.id,
                channelId: webhook.channelId,
                url: webhook.url
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to edit webhook: ${error.message}`
        };
    }
}

/**
 * Edit an existing AutoMod rule
 */
async function editAutoModRule(guild, ruleName, options) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        // Fetch all automod rules
        const rules = await guild.autoModerationRules.fetch();
        const rule = rules.find(r => r.name.toLowerCase() === ruleName.toLowerCase());

        if (!rule) {
            return { success: false, error: `AutoMod rule "${ruleName}" not found` };
        }

        const editOptions = {};

        if (options.newName) editOptions.name = options.newName;
        if (options.enabled !== undefined) editOptions.enabled = options.enabled;
        if (options.exemptRoles) editOptions.exemptRoles = options.exemptRoles;
        if (options.exemptChannels) editOptions.exemptChannels = options.exemptChannels;

        // Update trigger metadata if provided
        if (options.keywords || options.mentionLimit) {
            editOptions.triggerMetadata = {};
            if (options.keywords) editOptions.triggerMetadata.keywordFilter = options.keywords;
            if (options.mentionLimit) editOptions.triggerMetadata.mentionTotalLimit = options.mentionLimit;
        }

        // Update actions if provided
        if (options.action) {
            const actionMap = {
                'block': { type: AutoModerationActionType.BlockMessage },
                'timeout': {
                    type: AutoModerationActionType.Timeout,
                    metadata: { durationSeconds: 60 }
                },
                'alert': options.alertChannelName ? {
                    type: AutoModerationActionType.SendAlertMessage,
                    metadata: {
                        channel: guild.channels.cache.find(c => c.name === options.alertChannelName)
                    }
                } : null
            };

            if (actionMap[options.action]) {
                editOptions.actions = [actionMap[options.action]];
            }
        }

        await rule.edit(editOptions);

        return {
            success: true,
            message: `AutoMod rule "${rule.name}" edited successfully`,
            rule: {
                name: rule.name,
                id: rule.id,
                enabled: rule.enabled,
                triggerType: rule.triggerType
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to edit AutoMod rule: ${error.message}`
        };
    }
}

module.exports = {
    setChannelPosition,
    getChannelPermissions,
    setMemberDeaf,
    setMemberMute,
    executeWebhook,
    editWebhook,
    editAutoModRule
};
