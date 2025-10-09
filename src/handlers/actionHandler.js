// src/handlers/actionHandler.js
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils/permissions');

/**
 * Comprehensive action handler for all Discord server management commands
 * Supports channels, roles, members, moderation, server settings, and more
 */

class ActionHandler {
    constructor(client) {
        this.client = client;
    }

    /**
     * Execute an action based on type
     */
    async execute(action, message) {
        const authorId = message.author.id;
        const guild = message.guild;

        try {
            switch (action.type) {
                // ===== CHANNEL MANAGEMENT =====
                case 'CREATE_CHANNEL':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create channel');
                    return await this.createChannel(guild, action);

                case 'DELETE_CHANNEL':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to delete channel');
                    return await this.deleteChannel(guild, action);

                case 'RENAME_CHANNEL':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to rename channel');
                    return await this.renameChannel(guild, action);

                case 'CREATE_CATEGORY':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create category');
                    return await this.createCategory(guild, action);

                case 'DELETE_CATEGORY':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to delete category');
                    return await this.deleteCategory(guild, action);

                case 'MOVE_CHANNEL':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to move channel');
                    return await this.moveChannel(guild, action);

                case 'SET_CHANNEL_TOPIC':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set channel topic');
                    return await this.setChannelTopic(guild, action);

                case 'SET_CHANNEL_SLOWMODE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set slowmode');
                    return await this.setChannelSlowmode(guild, action);

                case 'SET_CHANNEL_NSFW':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set NSFW');
                    return await this.setChannelNSFW(guild, action);

                // ===== ROLE MANAGEMENT =====
                case 'CREATE_ROLE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create role');
                    return await this.createRole(guild, action);

                case 'DELETE_ROLE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to delete role');
                    return await this.deleteRole(guild, action);

                case 'RENAME_ROLE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to rename role');
                    return await this.renameRole(guild, action);

                case 'SET_ROLE_COLOR':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set role color');
                    return await this.setRoleColor(guild, action);

                case 'SET_ROLE_PERMISSIONS':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set role permissions');
                    return await this.setRolePermissions(guild, action);

                case 'ADD_ROLE':
                    // Anyone can request self-assignable roles
                    const roleService = require('../services/roleService');
                    if (action.roleName) {
                        await roleService.addRole(message.member, action.roleName);
                        this.log('✅', `Added role ${action.roleName} to ${message.author.tag}`);
                    }
                    break;

                case 'REMOVE_ROLE':
                    // Anyone can remove their own roles
                    const roleServiceRemove = require('../services/roleService');
                    if (action.roleName) {
                        await roleServiceRemove.removeRole(message.member, action.roleName);
                        this.log('✅', `Removed role ${action.roleName} from ${message.author.tag}`);
                    }
                    break;

                case 'ASSIGN_ROLE_TO_MEMBER':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to assign role');
                    return await this.assignRoleToMember(guild, action);

                // ===== MEMBER MANAGEMENT =====
                case 'KICK':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to kick');
                    return await this.kickMember(guild, action);

                case 'BAN':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to ban');
                    return await this.banMember(guild, action);

                case 'UNBAN':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to unban');
                    return await this.unbanMember(guild, action);

                case 'TIMEOUT':
                    // Autonomous moderation
                    return await this.timeoutMember(guild, action);

                case 'REMOVE_TIMEOUT':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to remove timeout');
                    return await this.removeTimeout(guild, action);

                case 'SET_NICKNAME':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set nickname');
                    return await this.setNickname(guild, action);

                // ===== MESSAGE MANAGEMENT =====
                case 'DELETE_MESSAGE':
                    // Autonomous moderation
                    return await this.deleteMessage(message, action);

                case 'PIN_MESSAGE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to pin message');
                    return await this.pinMessage(message, action);

                case 'UNPIN_MESSAGE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to unpin message');
                    return await this.unpinMessage(message, action);

                case 'PURGE_MESSAGES':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to purge messages');
                    return await this.purgeMessages(message, action);

                // ===== SERVER SETTINGS =====
                case 'SET_SERVER_NAME':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set server name');
                    return await this.setServerName(guild, action);

                case 'SET_SERVER_ICON':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set server icon');
                    return await this.setServerIcon(guild, action);

                case 'SET_SERVER_BANNER':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set server banner');
                    return await this.setServerBanner(guild, action);

                case 'SET_VERIFICATION_LEVEL':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set verification level');
                    return await this.setVerificationLevel(guild, action);

                // ===== INVITE MANAGEMENT =====
                case 'CREATE_INVITE':
                    return await this.createInvite(message, action);

                case 'DELETE_INVITE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to delete invite');
                    return await this.deleteInvite(guild, action);

                // ===== WEBHOOK MANAGEMENT =====
                case 'CREATE_WEBHOOK':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create webhook');
                    return await this.createWebhook(guild, action);

                case 'DELETE_WEBHOOK':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to delete webhook');
                    return await this.deleteWebhook(guild, action);

                default:
                    this.log('⚠️', `Unknown action type: ${action.type}`);
            }
        } catch (error) {
            console.error(`Error executing action ${action.type}:`, error);
        }
    }

    // ===== CHANNEL MANAGEMENT IMPLEMENTATIONS =====

    async createChannel(guild, action) {
        const { channelName, channelType, categoryName, topic, position } = action;
        
        const type = channelType === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
        
        let parent = null;
        if (categoryName) {
            parent = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && c.name === categoryName
            );
        }

        const options = {
            name: channelName,
            type: type,
            parent: parent?.id,
            topic: topic || undefined,
            position: position ? parseInt(position) : undefined
        };

        const channel = await guild.channels.create(options);
        this.log('✅', `Created channel: #${channelName}`);
        return channel;
    }

    async deleteChannel(guild, action) {
        const { channelName, channelId } = action;
        
        const channel = channelId 
            ? guild.channels.cache.get(channelId)
            : guild.channels.cache.find(c => c.name === channelName);
            
        if (channel) {
            await channel.delete();
            this.log('✅', `Deleted channel: #${channel.name}`);
        }
    }

    async renameChannel(guild, action) {
        const { oldName, newName, channelId } = action;
        
        const channel = channelId 
            ? guild.channels.cache.get(channelId)
            : guild.channels.cache.find(c => c.name === oldName);
            
        if (channel) {
            await channel.setName(newName);
            this.log('✅', `Renamed channel: ${oldName} → ${newName}`);
        }
    }

    async createCategory(guild, action) {
        const { categoryName, position } = action;
        
        const category = await guild.channels.create({
            name: categoryName,
            type: ChannelType.GuildCategory,
            position: position ? parseInt(position) : undefined
        });
        
        this.log('✅', `Created category: ${categoryName}`);
        return category;
    }

    async deleteCategory(guild, action) {
        const { categoryName, deleteChildren } = action;
        
        const category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === categoryName
        );
        
        if (category) {
            if (deleteChildren === 'true') {
                // Delete all child channels
                const children = guild.channels.cache.filter(c => c.parentId === category.id);
                for (const child of children.values()) {
                    await child.delete();
                }
            }
            await category.delete();
            this.log('✅', `Deleted category: ${categoryName}`);
        }
    }

    async moveChannel(guild, action) {
        const { channelName, categoryName } = action;
        
        const channel = guild.channels.cache.find(c => c.name === channelName);
        const category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === categoryName
        );
        
        if (channel && category) {
            await channel.setParent(category.id);
            this.log('✅', `Moved #${channelName} to ${categoryName}`);
        }
    }

    async setChannelTopic(guild, action) {
        const { channelName, topic } = action;
        
        const channel = guild.channels.cache.find(c => c.name === channelName);
        if (channel && channel.setTopic) {
            await channel.setTopic(topic);
            this.log('✅', `Set topic for #${channelName}`);
        }
    }

    async setChannelSlowmode(guild, action) {
        const { channelName, seconds } = action;
        
        const channel = guild.channels.cache.find(c => c.name === channelName);
        if (channel && channel.setRateLimitPerUser) {
            await channel.setRateLimitPerUser(parseInt(seconds));
            this.log('✅', `Set slowmode for #${channelName}: ${seconds}s`);
        }
    }

    async setChannelNSFW(guild, action) {
        const { channelName, nsfw } = action;
        
        const channel = guild.channels.cache.find(c => c.name === channelName);
        if (channel && channel.setNSFW) {
            await channel.setNSFW(nsfw === 'true');
            this.log('✅', `Set NSFW for #${channelName}: ${nsfw}`);
        }
    }

    // ===== ROLE MANAGEMENT IMPLEMENTATIONS =====

    async createRole(guild, action) {
        const { roleName, color, hoist, mentionable, permissions } = action;
        
        const role = await guild.roles.create({
            name: roleName,
            color: color || undefined,
            hoist: hoist === 'true',
            mentionable: mentionable === 'true',
            permissions: permissions ? BigInt(permissions) : undefined
        });
        
        this.log('✅', `Created role: ${roleName}`);
        return role;
    }

    async deleteRole(guild, action) {
        const { roleName, roleId } = action;
        
        const role = roleId 
            ? guild.roles.cache.get(roleId)
            : guild.roles.cache.find(r => r.name === roleName);
            
        if (role) {
            await role.delete();
            this.log('✅', `Deleted role: ${role.name}`);
        }
    }

    async renameRole(guild, action) {
        const { oldName, newName, roleId } = action;
        
        const role = roleId 
            ? guild.roles.cache.get(roleId)
            : guild.roles.cache.find(r => r.name === oldName);
            
        if (role) {
            await role.setName(newName);
            this.log('✅', `Renamed role: ${oldName} → ${newName}`);
        }
    }

    async setRoleColor(guild, action) {
        const { roleName, color } = action;
        
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (role) {
            await role.setColor(color);
            this.log('✅', `Set color for role ${roleName}`);
        }
    }

    async setRolePermissions(guild, action) {
        const { roleName, permissions } = action;
        
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (role) {
            await role.setPermissions(BigInt(permissions));
            this.log('✅', `Set permissions for role ${roleName}`);
        }
    }

    async assignRoleToMember(guild, action) {
        const { userId, roleName } = action;
        
        const member = await guild.members.fetch(userId);
        const role = guild.roles.cache.find(r => r.name === roleName);
        
        if (member && role) {
            await member.roles.add(role);
            this.log('✅', `Assigned role ${roleName} to ${member.user.tag}`);
        }
    }

    // ===== MEMBER MANAGEMENT IMPLEMENTATIONS =====

    async kickMember(guild, action) {
        const { userId, reason } = action;
        
        const member = await guild.members.fetch(userId);
        if (member) {
            await member.kick(reason || 'No reason provided');
            this.log('✅', `Kicked ${member.user.tag}`);
        }
    }

    async banMember(guild, action) {
        const { userId, reason, deleteMessageDays } = action;
        
        const member = await guild.members.fetch(userId);
        if (member) {
            await member.ban({
                reason: reason || 'Banned by owner via Sunny',
                deleteMessageDays: deleteMessageDays ? parseInt(deleteMessageDays) : 0
            });
            this.log('✅', `Banned ${member.user.tag}`);
        }
    }

    async unbanMember(guild, action) {
        const { userId } = action;
        
        await guild.members.unban(userId);
        this.log('✅', `Unbanned user ${userId}`);
    }

    async timeoutMember(guild, action) {
        const { userId, duration, reason } = action;
        
        const member = await guild.members.fetch(userId);
        if (member) {
            const durationMs = parseInt(duration) * 60 * 1000; // Convert minutes to ms
            await member.timeout(durationMs, reason || 'Moderation by Sunny');
            this.log('✅', `Timed out ${member.user.tag} for ${duration} minutes`);
        }
    }

    async removeTimeout(guild, action) {
        const { userId } = action;
        
        const member = await guild.members.fetch(userId);
        if (member) {
            await member.timeout(null);
            this.log('✅', `Removed timeout from ${member.user.tag}`);
        }
    }

    async setNickname(guild, action) {
        const { userId, nickname } = action;
        
        const member = await guild.members.fetch(userId);
        if (member) {
            await member.setNickname(nickname);
            this.log('✅', `Set nickname for ${member.user.tag}: ${nickname}`);
        }
    }

    // ===== MESSAGE MANAGEMENT IMPLEMENTATIONS =====

    async deleteMessage(message, action) {
        const { messageId, channelId } = action;
        
        if (messageId) {
            const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;
            if (channel) {
                const msg = await channel.messages.fetch(messageId);
                if (msg) {
                    await msg.delete();
                    this.log('✅', `Deleted message ${messageId}`);
                }
            }
        }
    }

    async pinMessage(message, action) {
        const { messageId, channelId } = action;
        
        const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;
        if (channel) {
            const msg = await channel.messages.fetch(messageId);
            if (msg) {
                await msg.pin();
                this.log('✅', `Pinned message ${messageId}`);
            }
        }
    }

    async unpinMessage(message, action) {
        const { messageId, channelId } = action;
        
        const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;
        if (channel) {
            const msg = await channel.messages.fetch(messageId);
            if (msg) {
                await msg.unpin();
                this.log('✅', `Unpinned message ${messageId}`);
            }
        }
    }

    async purgeMessages(message, action) {
        const { amount } = action;
        
        const count = Math.min(parseInt(amount), 100); // Discord limit is 100
        await message.channel.bulkDelete(count, true);
        this.log('✅', `Purged ${count} messages`);
    }

    // ===== SERVER SETTINGS IMPLEMENTATIONS =====

    async setServerName(guild, action) {
        const { name } = action;
        
        await guild.setName(name);
        this.log('✅', `Set server name: ${name}`);
    }

    async setServerIcon(guild, action) {
        const { iconUrl } = action;
        
        await guild.setIcon(iconUrl);
        this.log('✅', `Set server icon`);
    }

    async setServerBanner(guild, action) {
        const { bannerUrl } = action;
        
        await guild.setBanner(bannerUrl);
        this.log('✅', `Set server banner`);
    }

    async setVerificationLevel(guild, action) {
        const { level } = action;
        
        await guild.setVerificationLevel(parseInt(level));
        this.log('✅', `Set verification level: ${level}`);
    }

    // ===== INVITE MANAGEMENT IMPLEMENTATIONS =====

    async createInvite(message, action) {
        const { maxAge, maxUses, temporary } = action;
        
        const invite = await message.channel.createInvite({
            maxAge: maxAge ? parseInt(maxAge) : 0,
            maxUses: maxUses ? parseInt(maxUses) : 0,
            temporary: temporary === 'true'
        });
        
        this.log('✅', `Created invite: ${invite.code}`);
        return invite;
    }

    async deleteInvite(guild, action) {
        const { inviteCode } = action;
        
        const invites = await guild.invites.fetch();
        const invite = invites.find(i => i.code === inviteCode);
        
        if (invite) {
            await invite.delete();
            this.log('✅', `Deleted invite: ${inviteCode}`);
        }
    }

    // ===== WEBHOOK MANAGEMENT IMPLEMENTATIONS =====

    async createWebhook(guild, action) {
        const { channelName, webhookName, avatarUrl } = action;
        
        const channel = guild.channels.cache.find(c => c.name === channelName);
        if (channel && channel.createWebhook) {
            const webhook = await channel.createWebhook({
                name: webhookName,
                avatar: avatarUrl || undefined
            });
            this.log('✅', `Created webhook: ${webhookName}`);
            return webhook;
        }
    }

    async deleteWebhook(guild, action) {
        const { webhookId } = action;
        
        const webhooks = await guild.fetchWebhooks();
        const webhook = webhooks.get(webhookId);
        
        if (webhook) {
            await webhook.delete();
            this.log('✅', `Deleted webhook: ${webhook.name}`);
        }
    }

    // ===== UTILITY METHODS =====

    log(icon, message) {
        console.log(`${icon} ${message}`);
    }
}

module.exports = ActionHandler;
