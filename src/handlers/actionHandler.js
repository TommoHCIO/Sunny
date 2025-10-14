// src/handlers/actionHandler.js
const { ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { isOwner } = require('../utils/permissions');
const imageService = require('../services/imageService');
const videoService = require('../services/videoService');

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

        this.log('🔧', `Executing action: ${action.type} | Details: ${JSON.stringify(action)}`);

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
                        const result = await roleService.addRole(message.member, action.roleName);
                        if (result.success) {
                            this.log('✅', `Added role ${action.roleName} to ${message.author.tag}`);
                        } else {
                            this.log('❌', `Failed to add role ${action.roleName}: ${result.error}`);
                        }
                        return result;
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

                // ===== THREAD MANAGEMENT =====
                case 'CREATE_THREAD':
                    return await this.createThread(message, action);

                case 'CREATE_FORUM_POST':
                    return await this.createForumPost(guild, action);

                case 'DELETE_THREAD':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to delete thread');
                    return await this.deleteThread(guild, action);

                case 'ARCHIVE_THREAD':
                    return await this.archiveThread(guild, action);

                case 'LOCK_THREAD':
                    return await this.lockThread(guild, action);

                case 'PIN_THREAD':
                    return await this.pinThread(guild, action);

                // ===== EMOJI MANAGEMENT =====
                case 'CREATE_EMOJI':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create emoji');
                    return await this.createEmoji(guild, action);

                case 'EDIT_EMOJI':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to edit emoji');
                    return await this.editEmoji(guild, action);

                case 'DELETE_EMOJI':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to delete emoji');
                    return await this.deleteEmoji(guild, action);

                // ===== STICKER MANAGEMENT =====
                case 'CREATE_STICKER':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create sticker');
                    return await this.createSticker(guild, action);

                case 'EDIT_STICKER':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to edit sticker');
                    return await this.editSticker(guild, action);

                case 'DELETE_STICKER':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to delete sticker');
                    return await this.deleteSticker(guild, action);

                // ===== SCHEDULED EVENTS =====
                case 'CREATE_EVENT':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create event');
                    return await this.createScheduledEvent(guild, action);

                case 'EDIT_EVENT':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to edit event');
                    return await this.editScheduledEvent(guild, action);

                case 'DELETE_EVENT':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to delete event');
                    return await this.deleteScheduledEvent(guild, action);

                case 'START_EVENT':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to start event');
                    return await this.startScheduledEvent(guild, action);

                case 'END_EVENT':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to end event');
                    return await this.endScheduledEvent(guild, action);

                // ===== ADVANCED VOICE/STAGE =====
                case 'CREATE_STAGE_CHANNEL':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create stage channel');
                    return await this.createStageChannel(guild, action);

                case 'SET_BITRATE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set bitrate');
                    return await this.setBitrate(guild, action);

                case 'SET_USER_LIMIT':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set user limit');
                    return await this.setUserLimit(guild, action);

                case 'SET_RTC_REGION':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set RTC region');
                    return await this.setRTCRegion(guild, action);

                case 'CREATE_STAGE_INSTANCE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create stage instance');
                    return await this.createStageInstance(guild, action);

                // ===== CHANNEL PERMISSIONS =====
                case 'SET_CHANNEL_PERMISSIONS':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set channel permissions');
                    return await this.setChannelPermissions(guild, action);

                case 'REMOVE_CHANNEL_PERMISSION':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to remove channel permission');
                    return await this.removeChannelPermission(guild, action);

                case 'SYNC_CHANNEL_PERMISSIONS':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to sync permissions');
                    return await this.syncChannelPermissions(guild, action);

                // ===== ADVANCED CHANNEL TYPES =====
                case 'CREATE_FORUM_CHANNEL':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to create forum channel');
                    return await this.createForumChannel(guild, action);

                case 'SET_DEFAULT_THREAD_SLOWMODE':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set default thread slowmode');
                    return await this.setDefaultThreadSlowmode(guild, action);

                case 'SET_AVAILABLE_TAGS':
                    if (!isOwner(authorId)) return this.log('❌', 'Non-owner tried to set available tags');
                    return await this.setAvailableTags(guild, action);

                default:
                    this.log('⚠️', `Unknown action type: ${action.type}`);
                    return { success: false, error: `Unknown action type: ${action.type}` };
            }
        } catch (error) {
            this.log('❌', `FATAL ERROR executing ${action.type}: ${error.message}`);
            console.error(`Full error stack for ${action.type}:`, error);
            return { success: false, error: error.message };
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

        if (!channel) {
            return {
                success: false,
                error: `Channel "${channelName || channelId}" not found`
            };
        }

        const name = channel.name;
        await channel.delete();
        this.log('✅', `Deleted channel: #${name}`);

        return {
            success: true,
            message: `Deleted channel: #${name}`
        };
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

        if (!category) {
            return {
                success: false,
                error: `Category "${categoryName}" not found`
            };
        }

        if (deleteChildren === 'true') {
            // Delete all child channels
            const children = guild.channels.cache.filter(c => c.parentId === category.id);
            for (const child of children.values()) {
                await child.delete();
            }
        }

        await category.delete();
        this.log('✅', `Deleted category: ${categoryName}`);

        return {
            success: true,
            message: `Deleted category: ${categoryName}`
        };
    }

    async moveChannel(guild, action) {
        const { channelName, categoryName } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName);
        if (!channel) {
            return {
                success: false,
                error: `Channel "${channelName}" not found`
            };
        }

        const category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === categoryName
        );
        if (!category) {
            return {
                success: false,
                error: `Category "${categoryName}" not found`
            };
        }

        await channel.setParent(category.id);
        this.log('✅', `Moved #${channelName} to ${categoryName}`);

        return {
            success: true,
            message: `Moved #${channelName} to ${categoryName}`
        };
    }

    async setChannelTopic(guild, action) {
        const { channelName, topic } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName);

        if (!channel) {
            return {
                success: false,
                error: `Channel "${channelName}" not found`
            };
        }

        if (!channel.setTopic) {
            return {
                success: false,
                error: `Channel "${channelName}" does not support topics`
            };
        }

        await channel.setTopic(topic);
        this.log('✅', `Set topic for #${channelName}`);

        return {
            success: true,
            message: `Set topic for #${channelName}`
        };
    }

    async setChannelSlowmode(guild, action) {
        const { channelName, seconds } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName);

        if (!channel) {
            return {
                success: false,
                error: `Channel "${channelName}" not found`
            };
        }

        if (!channel.setRateLimitPerUser) {
            return {
                success: false,
                error: `Channel "${channelName}" does not support slowmode`
            };
        }

        await channel.setRateLimitPerUser(parseInt(seconds));
        this.log('✅', `Set slowmode for #${channelName}: ${seconds}s`);

        return {
            success: true,
            message: `Set slowmode for #${channelName}: ${seconds}s`
        };
    }

    async setChannelNSFW(guild, action) {
        const { channelName, nsfw } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName);

        if (!channel) {
            return {
                success: false,
                error: `Channel "${channelName}" not found`
            };
        }

        if (!channel.setNSFW) {
            return {
                success: false,
                error: `Channel "${channelName}" does not support NSFW setting`
            };
        }

        await channel.setNSFW(nsfw === 'true');
        this.log('✅', `Set NSFW for #${channelName}: ${nsfw}`);

        return {
            success: true,
            message: `Set NSFW for #${channelName}: ${nsfw}`
        };
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

        if (!role) {
            return {
                success: false,
                error: `Role "${roleName || roleId}" not found`
            };
        }

        const name = role.name;
        await role.delete();
        this.log('✅', `Deleted role: ${name}`);

        return {
            success: true,
            message: `Deleted role: ${name}`
        };
    }

    async renameRole(guild, action) {
        const { oldName, newName, roleId } = action;

        const role = roleId
            ? guild.roles.cache.get(roleId)
            : guild.roles.cache.find(r => r.name === oldName);

        if (!role) {
            return {
                success: false,
                error: `Role "${oldName || roleId}" not found`
            };
        }

        await role.setName(newName);
        this.log('✅', `Renamed role: ${oldName} → ${newName}`);

        return {
            success: true,
            message: `Renamed role: ${oldName} → ${newName}`
        };
    }

    async setRoleColor(guild, action) {
        const { roleName, color } = action;

        const role = guild.roles.cache.find(r => r.name === roleName);

        if (!role) {
            return {
                success: false,
                error: `Role "${roleName}" not found`
            };
        }

        await role.setColor(color);
        this.log('✅', `Set color for role ${roleName}`);

        return {
            success: true,
            message: `Set color for role ${roleName} to ${color}`
        };
    }

    async setRolePermissions(guild, action) {
        const { roleName, permissions } = action;

        const role = guild.roles.cache.find(r => r.name === roleName);

        if (!role) {
            return {
                success: false,
                error: `Role "${roleName}" not found`
            };
        }

        await role.setPermissions(BigInt(permissions));
        this.log('✅', `Set permissions for role ${roleName}`);

        return {
            success: true,
            message: `Set permissions for role ${roleName}`
        };
    }

    async assignRoleToMember(guild, action) {
        const { userId, roleName } = action;

        const member = await guild.members.fetch(userId);
        if (!member) {
            return {
                success: false,
                error: `Member with ID "${userId}" not found`
            };
        }

        const role = guild.roles.cache.find(r => r.name === roleName);
        if (!role) {
            return {
                success: false,
                error: `Role "${roleName}" not found`
            };
        }

        await member.roles.add(role);
        this.log('✅', `Assigned role ${roleName} to ${member.user.tag}`);

        return {
            success: true,
            message: `Assigned role ${roleName} to ${member.user.tag}`
        };
    }

    // ===== MEMBER MANAGEMENT IMPLEMENTATIONS =====

    async kickMember(guild, action) {
        const { userId, reason } = action;

        const member = await guild.members.fetch(userId);

        if (!member) {
            return {
                success: false,
                error: `Member with ID "${userId}" not found`
            };
        }

        const tag = member.user.tag;
        await member.kick(reason || 'No reason provided');
        this.log('✅', `Kicked ${tag}`);

        return {
            success: true,
            message: `Kicked ${tag}`
        };
    }

    async banMember(guild, action) {
        const { userId, reason, deleteMessageDays } = action;

        const member = await guild.members.fetch(userId);

        if (!member) {
            return {
                success: false,
                error: `Member with ID "${userId}" not found`
            };
        }

        const tag = member.user.tag;
        await member.ban({
            reason: reason || 'Banned by owner via Sunny',
            deleteMessageDays: deleteMessageDays ? parseInt(deleteMessageDays) : 0
        });
        this.log('✅', `Banned ${tag}`);

        return {
            success: true,
            message: `Banned ${tag}`
        };
    }

    async unbanMember(guild, action) {
        const { userId } = action;

        await guild.members.unban(userId);
        this.log('✅', `Unbanned user ${userId}`);

        return {
            success: true,
            message: `Unbanned user ${userId}`
        };
    }

    async timeoutMember(guild, action) {
        const { userId, duration, reason } = action;

        const member = await guild.members.fetch(userId);

        if (!member) {
            return {
                success: false,
                error: `Member with ID "${userId}" not found`
            };
        }

        const durationMs = parseInt(duration) * 60 * 1000; // Convert minutes to ms
        await member.timeout(durationMs, reason || 'Moderation by Sunny');
        this.log('✅', `Timed out ${member.user.tag} for ${duration} minutes`);

        return {
            success: true,
            message: `Timed out ${member.user.tag} for ${duration} minutes`
        };
    }

    async removeTimeout(guild, action) {
        const { userId } = action;

        const member = await guild.members.fetch(userId);

        if (!member) {
            return {
                success: false,
                error: `Member with ID "${userId}" not found`
            };
        }

        await member.timeout(null);
        this.log('✅', `Removed timeout from ${member.user.tag}`);

        return {
            success: true,
            message: `Removed timeout from ${member.user.tag}`
        };
    }

    async setNickname(guild, action) {
        const { userId, nickname } = action;

        const member = await guild.members.fetch(userId);

        if (!member) {
            return {
                success: false,
                error: `Member with ID "${userId}" not found`
            };
        }

        await member.setNickname(nickname);
        this.log('✅', `Set nickname for ${member.user.tag}: ${nickname}`);

        return {
            success: true,
            message: `Set nickname for ${member.user.tag}: ${nickname}`
        };
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

        return {
            success: true,
            message: `Set server name to: ${name}`
        };
    }

    async setServerIcon(guild, action) {
        const { iconUrl } = action;

        await guild.setIcon(iconUrl);
        this.log('✅', `Set server icon`);

        return {
            success: true,
            message: `Set server icon to: ${iconUrl}`
        };
    }

    async setServerBanner(guild, action) {
        const { bannerUrl } = action;

        await guild.setBanner(bannerUrl);
        this.log('✅', `Set server banner`);

        return {
            success: true,
            message: `Set server banner to: ${bannerUrl}`
        };
    }

    async setVerificationLevel(guild, action) {
        const { level } = action;

        await guild.setVerificationLevel(parseInt(level));
        this.log('✅', `Set verification level: ${level}`);

        return {
            success: true,
            message: `Set verification level to: ${level}`
        };
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

        return {
            success: true,
            message: `Created invite: https://discord.gg/${invite.code}`,
            invite_code: invite.code,
            invite_url: `https://discord.gg/${invite.code}`
        };
    }

    async deleteInvite(guild, action) {
        const { inviteCode } = action;

        const invites = await guild.invites.fetch();
        const invite = invites.find(i => i.code === inviteCode);

        if (!invite) {
            return {
                success: false,
                error: `Invite with code "${inviteCode}" not found`
            };
        }

        await invite.delete();
        this.log('✅', `Deleted invite: ${inviteCode}`);

        return {
            success: true,
            message: `Deleted invite: ${inviteCode}`
        };
    }

    // ===== WEBHOOK MANAGEMENT IMPLEMENTATIONS =====

    async createWebhook(guild, action) {
        const { channelName, webhookName, avatarUrl } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName);

        if (!channel) {
            return {
                success: false,
                error: `Channel "${channelName}" not found`
            };
        }

        if (!channel.createWebhook) {
            return {
                success: false,
                error: `Channel "${channelName}" does not support webhooks`
            };
        }

        const webhook = await channel.createWebhook({
            name: webhookName,
            avatar: avatarUrl || undefined
        });
        this.log('✅', `Created webhook: ${webhookName}`);

        return {
            success: true,
            message: `Created webhook: ${webhookName}`,
            webhook_id: webhook.id,
            webhook_url: webhook.url
        };
    }

    async deleteWebhook(guild, action) {
        const { webhookId } = action;

        const webhooks = await guild.fetchWebhooks();
        const webhook = webhooks.get(webhookId);

        if (!webhook) {
            return {
                success: false,
                error: `Webhook with ID "${webhookId}" not found`
            };
        }

        const name = webhook.name;
        await webhook.delete();
        this.log('✅', `Deleted webhook: ${name}`);

        return {
            success: true,
            message: `Deleted webhook: ${name}`
        };
    }

    // ===== THREAD MANAGEMENT IMPLEMENTATIONS =====

    async createThread(message, action) {
        const { threadName, autoArchiveDuration, messageContent } = action;

        const thread = await message.channel.threads.create({
            name: threadName,
            autoArchiveDuration: parseInt(autoArchiveDuration) || 60,
            reason: `Created by Sunny for ${message.author.tag}`
        });

        if (messageContent) {
            await thread.send(messageContent);
        }

        this.log('✅', `Created thread: ${threadName}`);
        return thread;
    }

    async createForumPost(guild, action) {
        const { forumChannelName, postName, messageContent, tags } = action;

        const forumChannel = guild.channels.cache.find(c => c.name === forumChannelName && c.isThreadOnly());

        if (forumChannel) {
            const thread = await forumChannel.threads.create({
                name: postName,
                message: { content: messageContent },
                appliedTags: tags ? tags.split(',') : []
            });

            this.log('✅', `Created forum post: ${postName}`);
            return thread;
        }
    }

    async deleteThread(guild, action) {
        const { threadName, threadId } = action;

        const thread = threadId
            ? await guild.channels.fetch(threadId)
            : guild.channels.cache.find(c => c.isThread() && c.name === threadName);

        if (!thread) {
            return {
                success: false,
                error: `Thread "${threadName || threadId}" not found`
            };
        }

        const name = thread.name;
        await thread.delete();
        this.log('✅', `Deleted thread: ${name}`);

        return {
            success: true,
            message: `Deleted thread: ${name}`
        };
    }

    async archiveThread(guild, action) {
        const { threadName, archived } = action;

        const thread = guild.channels.cache.find(c => c.isThread() && c.name === threadName);

        if (!thread) {
            return {
                success: false,
                error: `Thread "${threadName}" not found`
            };
        }

        await thread.setArchived(archived === 'true');
        const status = archived === 'true' ? 'Archived' : 'Unarchived';
        this.log('✅', `${status} thread: ${threadName}`);

        return {
            success: true,
            message: `${status} thread: ${threadName}`
        };
    }

    async lockThread(guild, action) {
        const { threadName, locked } = action;

        const thread = guild.channels.cache.find(c => c.isThread() && c.name === threadName);

        if (!thread) {
            return {
                success: false,
                error: `Thread "${threadName}" not found`
            };
        }

        await thread.setLocked(locked === 'true');
        const status = locked === 'true' ? 'Locked' : 'Unlocked';
        this.log('✅', `${status} thread: ${threadName}`);

        return {
            success: true,
            message: `${status} thread: ${threadName}`
        };
    }

    async pinThread(guild, action) {
        const { threadName } = action;

        const thread = guild.channels.cache.find(c => c.isThread() && c.name === threadName);

        if (!thread) {
            return {
                success: false,
                error: `Thread "${threadName}" not found`
            };
        }

        if (thread.parent?.type !== 15) { // 15 = Forum channel
            return {
                success: false,
                error: `Thread "${threadName}" is not in a forum channel (only forum threads can be pinned)`
            };
        }

        await thread.pin();
        this.log('✅', `Pinned thread: ${threadName}`);

        return {
            success: true,
            message: `Pinned thread: ${threadName}`
        };
    }

    // ===== EMOJI MANAGEMENT IMPLEMENTATIONS =====

    async createEmoji(guild, action) {
        const { emojiName, emojiUrl, roles } = action;

        console.log('[DEBUG] createEmoji called with:', { emojiName, emojiUrl, roles });

        try {
            // Check if the file is a video or image URL that needs processing
            let fileToUpload = emojiUrl;
            console.log('[DEBUG] isVideoUrl check:', videoService.isVideoUrl(emojiUrl));

            if (videoService.isVideoUrl(emojiUrl)) {
                this.log('🎬', `Converting MP4 to GIF for animated emoji: ${emojiName}`);

                // Get video info first
                try {
                    const videoInfo = await videoService.getVideoInfo(emojiUrl);
                    this.log('📊', `Video info - Duration: ${videoInfo.duration}s, Size: ${(videoInfo.sizeBytes / 1024).toFixed(2)}KB, ${videoInfo.width}x${videoInfo.height} @ ${videoInfo.fps}fps`);

                    if (videoInfo.duration > 3) {
                        this.log('⚠️', `Video is ${videoInfo.duration}s - will be truncated for Discord emoji`);
                    }
                } catch (infoError) {
                    this.log('⚠️', `Could not get video info: ${infoError.message}`);
                }

                // Convert MP4 to GIF (Discord emojis require GIF format, not APNG like stickers)
                const gifBuffer = await videoService.convertMP4ToGIF(emojiUrl);

                // Create AttachmentBuilder from GIF buffer
                fileToUpload = new AttachmentBuilder(gifBuffer, {
                    name: `${emojiName}.gif`
                });

                this.log('✅', `Video converted successfully to GIF for emoji: ${emojiName}`);
            } else if (imageService.isImageUrl(emojiUrl)) {
                this.log('🖼️', `Processing image for emoji: ${emojiName}`);

                // Process image (resize, compress)
                const processedBuffer = await imageService.processImageForEmoji(emojiUrl);

                // Create AttachmentBuilder from processed buffer
                fileToUpload = new AttachmentBuilder(processedBuffer, {
                    name: `${emojiName}.png`
                });

                this.log('✅', `Image processed successfully for emoji: ${emojiName}`);
            }

            const emoji = await guild.emojis.create({
                attachment: fileToUpload,
                name: emojiName,
                roles: roles ? roles.split(',') : []
            });

            this.log('✅', `Created emoji: ${emojiName}`);

            return {
                success: true,
                message: `Created emoji: ${emojiName}`,
                emoji_id: emoji.id,
                emoji_name: emoji.name
            };
        } catch (error) {
            this.log('❌', `Failed to create emoji: ${error.message}`);
            throw error;
        }
    }

    async editEmoji(guild, action) {
        const { emojiName, newName } = action;

        const emoji = guild.emojis.cache.find(e => e.name === emojiName);

        if (!emoji) {
            return {
                success: false,
                error: `Emoji "${emojiName}" not found`
            };
        }

        await emoji.edit({ name: newName });
        this.log('✅', `Renamed emoji: ${emojiName} → ${newName}`);

        return {
            success: true,
            message: `Renamed emoji: ${emojiName} → ${newName}`
        };
    }

    async deleteEmoji(guild, action) {
        const { emojiName, emojiId } = action;

        const emoji = emojiId
            ? guild.emojis.cache.get(emojiId)
            : guild.emojis.cache.find(e => e.name === emojiName);

        if (!emoji) {
            return {
                success: false,
                error: `Emoji "${emojiName || emojiId}" not found`
            };
        }

        const name = emoji.name;
        await emoji.delete();
        this.log('✅', `Deleted emoji: ${name}`);

        return {
            success: true,
            message: `Deleted emoji: ${name}`
        };
    }

    // ===== STICKER MANAGEMENT IMPLEMENTATIONS =====

    async createSticker(guild, action) {
        const { stickerName, stickerFile, description, emoji } = action;

        try {
            // Check if the file is a video URL that needs conversion to APNG
            let fileToUpload = stickerFile;

            if (videoService.isVideoUrl(stickerFile)) {
                this.log('🎬', `Converting MP4 to APNG for animated sticker: ${stickerName}`);

                // Get video info first
                try {
                    const videoInfo = await videoService.getVideoInfo(stickerFile);
                    this.log('📊', `Video info - Duration: ${videoInfo.duration}s, Size: ${(videoInfo.sizeBytes / 1024).toFixed(2)}KB, ${videoInfo.width}x${videoInfo.height} @ ${videoInfo.fps}fps`);

                    if (videoInfo.duration > 5) {
                        this.log('⚠️', `Video is ${videoInfo.duration}s - will be truncated to 5 seconds for Discord sticker`);
                    }
                } catch (infoError) {
                    this.log('⚠️', `Could not get video info: ${infoError.message}`);
                }

                // Convert MP4 to APNG
                const apngBuffer = await videoService.convertMP4ToAPNG(stickerFile);

                // Create AttachmentBuilder from APNG buffer
                fileToUpload = new AttachmentBuilder(apngBuffer, {
                    name: `${stickerName}.apng`
                });

                this.log('✅', `Video converted successfully to APNG for sticker: ${stickerName}`);
            } else if (imageService.isImageUrl(stickerFile)) {
                this.log('🖼️', `Processing image for sticker: ${stickerName}`);

                // Process image (resize, compress)
                const processedBuffer = await imageService.processImageForSticker(stickerFile);

                // Create AttachmentBuilder from processed buffer
                fileToUpload = new AttachmentBuilder(processedBuffer, {
                    name: `${stickerName}.png`
                });

                this.log('✅', `Image processed successfully for sticker: ${stickerName}`);
            }

            const sticker = await guild.stickers.create({
                file: fileToUpload,
                name: stickerName,
                tags: emoji || '🍂',
                description: description || stickerName
            });

            this.log('✅', `Created sticker: ${stickerName}`);

            return {
                success: true,
                message: `Created sticker: ${stickerName}`,
                sticker_id: sticker.id,
                sticker_name: sticker.name
            };
        } catch (error) {
            this.log('❌', `Failed to create sticker: ${error.message}`);
            throw error;
        }
    }

    async editSticker(guild, action) {
        const { stickerName, newName, description } = action;

        const sticker = guild.stickers.cache.find(s => s.name === stickerName);

        if (!sticker) {
            return {
                success: false,
                error: `Sticker "${stickerName}" not found`
            };
        }

        await sticker.edit({
            name: newName || stickerName,
            description: description
        });
        this.log('✅', `Edited sticker: ${stickerName}`);

        return {
            success: true,
            message: `Edited sticker: ${stickerName}`
        };
    }

    async deleteSticker(guild, action) {
        const { stickerName, stickerId } = action;

        const sticker = stickerId
            ? guild.stickers.cache.get(stickerId)
            : guild.stickers.cache.find(s => s.name === stickerName);

        if (!sticker) {
            return {
                success: false,
                error: `Sticker "${stickerName || stickerId}" not found`
            };
        }

        const name = sticker.name;
        await sticker.delete();
        this.log('✅', `Deleted sticker: ${name}`);

        return {
            success: true,
            message: `Deleted sticker: ${name}`
        };
    }

    // ===== SCHEDULED EVENTS IMPLEMENTATIONS =====

    async createScheduledEvent(guild, action) {
        const { eventName, description, startTime, endTime, location, channelName } = action;

        const channel = channelName ? guild.channels.cache.find(c => c.name === channelName) : null;

        const event = await guild.scheduledEvents.create({
            name: eventName,
            description: description,
            scheduledStartTime: new Date(startTime),
            scheduledEndTime: endTime ? new Date(endTime) : null,
            privacyLevel: 2, // Guild Only
            entityType: channel ? 2 : 3, // 2 = Voice, 3 = External
            channel: channel?.id,
            entityMetadata: location ? { location: location } : undefined
        });

        this.log('✅', `Created event: ${eventName}`);
        return event;
    }

    async editScheduledEvent(guild, action) {
        const { eventName, newName, description, startTime } = action;

        const event = guild.scheduledEvents.cache.find(e => e.name === eventName);

        if (!event) {
            return {
                success: false,
                error: `Event "${eventName}" not found`
            };
        }

        await event.edit({
            name: newName || eventName,
            description: description,
            scheduledStartTime: startTime ? new Date(startTime) : undefined
        });
        this.log('✅', `Edited event: ${eventName}`);

        return {
            success: true,
            message: `Edited event: ${eventName}`
        };
    }

    async deleteScheduledEvent(guild, action) {
        const { eventName, eventId } = action;

        const event = eventId
            ? guild.scheduledEvents.cache.get(eventId)
            : guild.scheduledEvents.cache.find(e => e.name === eventName);

        if (!event) {
            return {
                success: false,
                error: `Event "${eventName || eventId}" not found`
            };
        }

        const name = event.name;
        await event.delete();
        this.log('✅', `Deleted event: ${name}`);

        return {
            success: true,
            message: `Deleted event: ${name}`
        };
    }

    async startScheduledEvent(guild, action) {
        const { eventName } = action;

        const event = guild.scheduledEvents.cache.find(e => e.name === eventName);

        if (!event) {
            return {
                success: false,
                error: `Event "${eventName}" not found`
            };
        }

        await event.setStatus(2); // Active
        this.log('✅', `Started event: ${eventName}`);

        return {
            success: true,
            message: `Started event: ${eventName}`
        };
    }

    async endScheduledEvent(guild, action) {
        const { eventName } = action;

        const event = guild.scheduledEvents.cache.find(e => e.name === eventName);

        if (!event) {
            return {
                success: false,
                error: `Event "${eventName}" not found`
            };
        }

        await event.setStatus(3); // Completed
        this.log('✅', `Ended event: ${eventName}`);

        return {
            success: true,
            message: `Ended event: ${eventName}`
        };
    }

    // ===== ADVANCED VOICE/STAGE IMPLEMENTATIONS =====

    async createStageChannel(guild, action) {
        const { channelName, categoryName, topic } = action;

        let parent = null;
        if (categoryName) {
            parent = guild.channels.cache.find(c => c.type === 4 && c.name === categoryName);
        }

        const channel = await guild.channels.create({
            name: channelName,
            type: 13, // Stage Channel
            parent: parent?.id,
            topic: topic
        });

        this.log('✅', `Created stage channel: ${channelName}`);
        return channel;
    }

    async setBitrate(guild, action) {
        const { channelName, bitrate } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName && (c.type === 2 || c.type === 13));

        if (!channel) {
            return {
                success: false,
                error: `Voice/Stage channel "${channelName}" not found`
            };
        }

        await channel.setBitrate(parseInt(bitrate) * 1000); // Convert to bps
        this.log('✅', `Set bitrate for ${channelName}: ${bitrate}kbps`);

        return {
            success: true,
            message: `Set bitrate for ${channelName}: ${bitrate}kbps`
        };
    }

    async setUserLimit(guild, action) {
        const { channelName, limit } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName && (c.type === 2 || c.type === 13));

        if (!channel) {
            return {
                success: false,
                error: `Voice/Stage channel "${channelName}" not found`
            };
        }

        await channel.setUserLimit(parseInt(limit));
        this.log('✅', `Set user limit for ${channelName}: ${limit}`);

        return {
            success: true,
            message: `Set user limit for ${channelName}: ${limit}`
        };
    }

    async setRTCRegion(guild, action) {
        const { channelName, region } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName && (c.type === 2 || c.type === 13));

        if (!channel) {
            return {
                success: false,
                error: `Voice/Stage channel "${channelName}" not found`
            };
        }

        await channel.setRTCRegion(region || null); // null = automatic
        this.log('✅', `Set RTC region for ${channelName}: ${region || 'automatic'}`);

        return {
            success: true,
            message: `Set RTC region for ${channelName}: ${region || 'automatic'}`
        };
    }

    async createStageInstance(guild, action) {
        const { channelName, topic, privacy } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName && c.type === 13);

        if (!channel) {
            return {
                success: false,
                error: `Stage channel "${channelName}" not found`
            };
        }

        await channel.createStageInstance({
            topic: topic,
            privacyLevel: privacy === 'public' ? 1 : 2
        });
        this.log('✅', `Started stage in ${channelName}: ${topic}`);

        return {
            success: true,
            message: `Started stage in ${channelName}: ${topic}`
        };
    }

    // ===== CHANNEL PERMISSIONS IMPLEMENTATIONS =====

    async setChannelPermissions(guild, action) {
        const { channelName, targetName, targetType, permissions } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName);
        if (!channel) {
            return {
                success: false,
                error: `Channel "${channelName}" not found`
            };
        }

        const target = targetType === 'role'
            ? guild.roles.cache.find(r => r.name === targetName || r.name === `@${targetName}`)
            : await guild.members.fetch().then(members => members.find(m => m.user.username === targetName));

        if (!target) {
            return {
                success: false,
                error: `${targetType === 'role' ? 'Role' : 'Member'} "${targetName}" not found`
            };
        }

        // Parse permissions - format can be:
        // "ViewChannel,SendMessages" (allow these)
        // "ViewChannel:false,SendMessages:false" (deny these)
        // "" (empty = deny all/reset)
        const perms = {};
        if (permissions && permissions.trim()) {
            permissions.split(',').forEach(perm => {
                const trimmed = perm.trim();
                if (trimmed.includes(':')) {
                    const [key, value] = trimmed.split(':');
                    perms[key.trim()] = value.trim().toLowerCase() === 'true';
                } else {
                    perms[trimmed] = true;
                }
            });
        } else {
            // Empty permissions = deny ViewChannel
            perms.ViewChannel = false;
        }

        await channel.permissionOverwrites.edit(target, perms);
        this.log('✅', `Set permissions for ${targetName} in #${channelName}`);

        return {
            success: true,
            message: `Set permissions for ${targetName} in #${channelName}`
        };
    }

    async removeChannelPermission(guild, action) {
        const { channelName, targetName, targetType } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName);
        if (!channel) {
            return {
                success: false,
                error: `Channel "${channelName}" not found`
            };
        }

        const target = targetType === 'role'
            ? guild.roles.cache.find(r => r.name === targetName)
            : await guild.members.fetch().then(members => members.find(m => m.user.username === targetName));

        if (!target) {
            return {
                success: false,
                error: `${targetType === 'role' ? 'Role' : 'Member'} "${targetName}" not found`
            };
        }

        await channel.permissionOverwrites.delete(target);
        this.log('✅', `Removed permissions for ${targetName} from #${channelName}`);

        return {
            success: true,
            message: `Removed permissions for ${targetName} from #${channelName}`
        };
    }

    async syncChannelPermissions(guild, action) {
        const { channelName } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName);

        if (!channel) {
            return {
                success: false,
                error: `Channel "${channelName}" not found`
            };
        }

        if (!channel.parent) {
            return {
                success: false,
                error: `Channel "${channelName}" is not in a category`
            };
        }

        await channel.lockPermissions();
        this.log('✅', `Synced permissions for #${channelName} with category`);

        return {
            success: true,
            message: `Synced permissions for #${channelName} with category`
        };
    }

    // ===== ADVANCED CHANNEL TYPES IMPLEMENTATIONS =====

    async createForumChannel(guild, action) {
        const { channelName, categoryName, topic, tags } = action;

        let parent = null;
        if (categoryName) {
            parent = guild.channels.cache.find(c => c.type === 4 && c.name === categoryName);
        }

        const availableTags = tags ? tags.split(',').map(tag => ({ name: tag.trim() })) : [];

        const channel = await guild.channels.create({
            name: channelName,
            type: 15, // Forum Channel
            parent: parent?.id,
            topic: topic,
            availableTags: availableTags
        });

        this.log('✅', `Created forum channel: ${channelName}`);
        return channel;
    }

    async setDefaultThreadSlowmode(guild, action) {
        const { channelName, seconds } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName && c.type === 15);

        if (!channel) {
            return {
                success: false,
                error: `Forum channel "${channelName}" not found`
            };
        }

        await channel.setDefaultThreadRateLimitPerUser(parseInt(seconds));
        this.log('✅', `Set default thread slowmode for ${channelName}: ${seconds}s`);

        return {
            success: true,
            message: `Set default thread slowmode for ${channelName}: ${seconds}s`
        };
    }

    async setAvailableTags(guild, action) {
        const { channelName, tags } = action;

        const channel = guild.channels.cache.find(c => c.name === channelName && c.type === 15);

        if (!channel) {
            return {
                success: false,
                error: `Forum channel "${channelName}" not found`
            };
        }

        const availableTags = tags.split(',').map(tag => ({ name: tag.trim() }));
        await channel.setAvailableTags(availableTags);
        this.log('✅', `Set available tags for ${channelName}`);

        return {
            success: true,
            message: `Set available tags for ${channelName}`
        };
    }

    // ===== UTILITY METHODS =====

    log(icon, message) {
        console.log(`${icon} ${message}`);
    }
}

module.exports = ActionHandler;
