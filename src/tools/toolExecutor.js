// src/tools/toolExecutor.js
/**
 * Tool Executor - Maps Claude tool calls to Discord operations
 * Handles permission checks and executes Discord.js operations
 * Reuses existing ActionHandler logic where possible
 */

const { ChannelType } = require('discord.js');
const { isOwner } = require('../utils/permissions');
const { retryWithBackoff } = require('../utils/retry');
const { toolExecutionRateLimiter } = require('../utils/rateLimiter');
const ActionHandler = require('../handlers/actionHandler');
const serverInspection = require('./serverInspection');
const memberManagement = require('./memberManagement');
const advancedModeration = require('./advancedModeration');
const roleManagement = require('./roleManagement');
const channelMemberTools = require('./channelMemberTools');

// Initialize action handler (singleton pattern)
let actionHandler = null;

/**
 * Execute a Discord tool based on Claude's request
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} input - Tool input parameters
 * @param {Object} guild - Discord guild object
 * @param {Object} author - Discord user object (for permission checks)
 * @returns {Promise<Object>} Tool execution result
 */
async function execute(toolName, input, guild, author) {
    // Initialize action handler if needed
    if (!actionHandler) {
        // Create a minimal client object for ActionHandler
        const mockClient = {
            guilds: {
                cache: new Map([[guild.id, guild]])
            }
        };
        actionHandler = new ActionHandler(mockClient);
    }

    // Define owner-only tools
    const ownerOnlyTools = [
        'delete_channel', 'create_channel', 'rename_channel', 'create_category',
        'delete_category', 'move_channel', 'set_channel_topic', 'set_slowmode',
        'set_channel_nsfw', 'set_channel_position', 'create_role', 'delete_role', 'rename_role',
        'set_role_color', 'kick_member', 'ban_member', 'unban_member',
        'remove_timeout', 'set_nickname', 'archive_thread', 'lock_thread',
        'delete_event', 'create_emoji', 'delete_emoji', 'edit_emoji',
        // New owner-only tools
        'pin_message', 'unpin_message', 'purge_messages', 'remove_all_reactions',
        'set_server_name', 'set_server_icon', 'set_server_banner', 'set_verification_level',
        'delete_invite', 'create_webhook', 'delete_webhook', 'edit_webhook', 'execute_webhook',
        'delete_thread', 'pin_thread', 'create_sticker', 'edit_sticker', 'delete_sticker',
        'edit_event', 'start_event', 'end_event',
        'create_stage_channel', 'set_bitrate', 'set_user_limit', 'set_rtc_region', 'create_stage_instance',
        'set_channel_permissions', 'remove_channel_permission', 'sync_channel_permissions',
        'create_forum_channel', 'set_default_thread_slowmode', 'set_available_tags',
        'set_role_permissions', 'add_role_permission', 'remove_role_permission', 'hoist_role', 'mentionable_role',
        'set_role_position', 'create_automod_rule', 'delete_automod_rule', 'edit_automod_rule',
        'set_member_deaf', 'set_member_mute',
        'get_audit_logs', 'get_bans'
    ];

    // Permission check for owner-only tools
    if (ownerOnlyTools.includes(toolName) && !isOwner(author.id)) {
        console.log(`❌ Permission denied: ${author.username} tried to use ${toolName}`);
        return {
            success: false,
            error: `Only the server owner can use ${toolName}. This action requires elevated permissions to keep the server safe! 🍂`,
            permission_denied: true
        };
    }

    try {
        // Apply rate limiting before executing any tool
        // This prevents hammering Discord API with rapid tool calls
        await toolExecutionRateLimiter.removeTokens(1);

        // Route tool to appropriate handler
        switch (toolName) {
            // ===== SERVER INSPECTION TOOLS =====
            case 'list_channels':
                return await listChannels(guild, input);

            case 'list_roles':
                return await listRoles(guild, input);

            case 'list_members':
                return await listMembers(guild, input);

            case 'get_channel_info':
                return await getChannelInfo(guild, input);

            // ===== CHANNEL MANAGEMENT =====
            case 'create_channel':
                return await actionHandler.createChannel(guild, input);

            case 'delete_channel':
                return await actionHandler.deleteChannel(guild, input);

            case 'rename_channel':
                return await actionHandler.renameChannel(guild, input);

            case 'create_category':
                return await actionHandler.createCategory(guild, input);

            case 'delete_category':
                return await actionHandler.deleteCategory(guild, input);

            case 'move_channel':
                return await actionHandler.moveChannel(guild, input);

            case 'set_channel_topic':
                return await actionHandler.setChannelTopic(guild, input);

            case 'set_slowmode':
                return await actionHandler.setChannelSlowmode(guild, { channelName: input.channelName, seconds: input.seconds });

            case 'set_channel_nsfw':
                return await actionHandler.setChannelNSFW(guild, input);

            // ===== ROLE MANAGEMENT =====
            case 'create_role':
                return await actionHandler.createRole(guild, input);

            case 'delete_role':
                return await actionHandler.deleteRole(guild, input);

            case 'rename_role':
                return await actionHandler.renameRole(guild, input);

            case 'set_role_color':
                return await actionHandler.setRoleColor(guild, input);

            case 'assign_role':
                return await assignRole(guild, author, input);

            case 'remove_role':
                return await removeRole(guild, author, input);

            // ===== MEMBER MANAGEMENT =====
            case 'timeout_member':
                return await actionHandler.timeoutMember(guild, input);

            case 'remove_timeout':
                return await actionHandler.removeTimeout(guild, input);

            case 'kick_member':
                return await actionHandler.kickMember(guild, input);

            case 'ban_member':
                return await actionHandler.banMember(guild, input);

            case 'unban_member':
                return await actionHandler.unbanMember(guild, input);

            case 'set_nickname':
                return await actionHandler.setNickname(guild, input);

            // ===== THREAD MANAGEMENT =====
            case 'create_thread':
                return await createThreadInChannel(guild, input);

            case 'archive_thread':
                return await actionHandler.archiveThread(guild, input);

            case 'lock_thread':
                return await actionHandler.lockThread(guild, input);

            case 'create_forum_post':
                return await actionHandler.createForumPost(guild, input);

            // ===== EVENT MANAGEMENT =====
            case 'create_event':
                return await actionHandler.createScheduledEvent(guild, input);

            case 'delete_event':
                return await deleteScheduledEvent(guild, input);

            // ===== EMOJI MANAGEMENT =====
            case 'list_emojis':
                return await listEmojis(guild, input);

            case 'create_emoji':
                return await actionHandler.createEmoji(guild, input);

            case 'delete_emoji':
                return await deleteEmoji(guild, input);

            case 'list_stickers':
                return await listStickers(guild, input);

            case 'edit_emoji':
                return await actionHandler.editEmoji(guild, input);

            // ===== MESSAGE MANAGEMENT =====
            case 'send_message':
                return await sendMessage(guild, input);

            case 'send_embed':
                return await sendEmbed(guild, input);

            case 'edit_message':
                return await editMessage(guild, input);

            case 'delete_message':
                return await deleteMessage(guild, input);

            case 'pin_message':
                return await pinMessage(guild, input);

            case 'unpin_message':
                return await unpinMessage(guild, input);

            case 'purge_messages':
                return await purgeMessages(guild, input);

            // ===== REACTION MANAGEMENT =====
            case 'add_reaction':
                return await addReaction(guild, input);

            case 'remove_reaction':
                return await removeReaction(guild, input);

            case 'remove_all_reactions':
                return await removeAllReactions(guild, input);

            case 'setup_reaction_role':
                return await setupReactionRole(guild, input);

            case 'remove_reaction_role':
                return await removeReactionRole(guild, input);

            case 'list_reaction_roles':
                return await listReactionRoles(guild, input);

            // ===== SERVER SETTINGS =====
            case 'set_server_name':
                return await actionHandler.setServerName(guild, input);

            case 'set_server_icon':
                return await actionHandler.setServerIcon(guild, input);

            case 'set_server_banner':
                return await actionHandler.setServerBanner(guild, input);

            case 'set_verification_level':
                return await actionHandler.setVerificationLevel(guild, input);

            // ===== INVITE MANAGEMENT =====
            case 'create_invite':
                return await createInvite(guild, input);

            case 'delete_invite':
                return await actionHandler.deleteInvite(guild, input);

            case 'list_invites':
                return await listInvites(guild, input);

            // ===== WEBHOOK MANAGEMENT =====
            case 'create_webhook':
                return await actionHandler.createWebhook(guild, input);

            case 'list_webhooks':
                return await listWebhooks(guild, input);

            case 'delete_webhook':
                return await actionHandler.deleteWebhook(guild, input);

            // ===== EXTENDED THREAD TOOLS =====
            case 'delete_thread':
                return await actionHandler.deleteThread(guild, input);

            case 'pin_thread':
                return await actionHandler.pinThread(guild, input);

            // ===== STICKER MANAGEMENT =====
            case 'create_sticker':
                return await actionHandler.createSticker(guild, input);

            case 'edit_sticker':
                return await actionHandler.editSticker(guild, input);

            case 'delete_sticker':
                return await actionHandler.deleteSticker(guild, input);

            // ===== EXTENDED EVENT TOOLS =====
            case 'edit_event':
                return await actionHandler.editScheduledEvent(guild, input);

            case 'start_event':
                return await actionHandler.startScheduledEvent(guild, input);

            case 'end_event':
                return await actionHandler.endScheduledEvent(guild, input);

            // ===== VOICE/STAGE CHANNEL TOOLS =====
            case 'create_stage_channel':
                return await actionHandler.createStageChannel(guild, input);

            case 'set_bitrate':
                return await actionHandler.setBitrate(guild, input);

            case 'set_user_limit':
                return await actionHandler.setUserLimit(guild, input);

            case 'set_rtc_region':
                return await actionHandler.setRTCRegion(guild, input);

            case 'create_stage_instance':
                return await actionHandler.createStageInstance(guild, input);

            // ===== CHANNEL PERMISSIONS TOOLS =====
            case 'set_channel_permissions':
                return await actionHandler.setChannelPermissions(guild, input);

            case 'remove_channel_permission':
                return await actionHandler.removeChannelPermission(guild, input);

            case 'sync_channel_permissions':
                return await actionHandler.syncChannelPermissions(guild, input);

            // ===== FORUM CHANNEL TOOLS =====
            case 'create_forum_channel':
                return await actionHandler.createForumChannel(guild, input);

            case 'set_default_thread_slowmode':
                return await actionHandler.setDefaultThreadSlowmode(guild, input);

            case 'set_available_tags':
                return await actionHandler.setAvailableTags(guild, input);

            // ===== ROLE PERMISSIONS TOOLS =====
            case 'set_role_permissions':
                return await actionHandler.setRolePermissions(guild, input);

            // ===== AUTOMODERATION TOOLS =====
            case 'create_automod_rule':
                return await createAutoModRule(guild, input);

            case 'list_automod_rules':
                return await listAutoModRules(guild, input);

            case 'delete_automod_rule':
                return await deleteAutoModRule(guild, input);

            // ===== MODERATION LOGS TOOLS =====
            case 'get_audit_logs':
                return await getAuditLogs(guild, input);

            case 'get_bans':
                return await getBans(guild, input);

            // ===== SERVER INSPECTION TOOLS (#94-98) =====
            case 'get_server_info':
                return await serverInspection.getServerInfo(guild);

            case 'get_server_settings':
                return await serverInspection.getServerSettings(guild);

            case 'get_current_permissions':
                return await serverInspection.getCurrentPermissions(guild);

            case 'list_server_features':
                return await serverInspection.listServerFeatures(guild);

            case 'get_moderation_stats':
                return await serverInspection.getModerationStats(guild);

            // ===== MEMBER MANAGEMENT TOOLS (#99-103) =====
            case 'get_member_info':
                return await memberManagement.getMemberInfo(guild, input);

            case 'get_member_roles':
                return await memberManagement.getMemberRoles(guild, input);

            case 'get_member_permissions':
                return await memberManagement.getMemberPermissions(guild, input);

            case 'list_members_with_role':
                return await memberManagement.listMembersWithRole(guild, input);

            case 'search_members':
                return await memberManagement.searchMembers(guild, input);

            // ===== ADVANCED MODERATION TOOLS (#104-108) =====
            case 'list_timeouts':
                return await advancedModeration.listTimeouts(guild);

            case 'remove_timeout':
                return await advancedModeration.removeTimeout(guild, input);

            case 'get_audit_log':
                return await advancedModeration.getAuditLog(guild, input);

            case 'ban_member':
                return await advancedModeration.banMember(guild, input);

            case 'unban_member':
                return await advancedModeration.unbanMember(guild, input);

            // ===== ROLE MANAGEMENT TOOLS (#109-112+) =====
            case 'get_role_info':
                return await roleManagement.getRoleInfo(guild, input.roleId);

            case 'get_role_members':
                return await roleManagement.getRoleMembers(guild, input.roleId);

            case 'update_role_permissions':
                return await roleManagement.updateRolePermissions(guild, input.roleId, input.permissions, input.reason);

            case 'reorder_roles':
                return await roleManagement.reorderRoles(guild, input.roleId, input.newPosition, input.reason);

            case 'add_role_permission':
                return await roleManagement.addRolePermission(guild, input.roleId, input.permissions, input.reason);

            case 'remove_role_permission':
                return await roleManagement.removeRolePermission(guild, input.roleId, input.permissions, input.reason);

            case 'hoist_role':
                return await roleManagement.hoistRole(guild, input.roleId, input.hoisted, input.reason);

            case 'mentionable_role':
                return await roleManagement.mentionableRole(guild, input.roleId, input.mentionable, input.reason);

            case 'set_role_position':
                return await roleManagement.setRolePosition(guild, input.roleId, input.position, input.reason);

            // ===== CHANNEL & MEMBER EXTENDED TOOLS =====
            case 'set_channel_position':
                return await channelMemberTools.setChannelPosition(guild, input.channelName, input.position, input.reason);

            case 'get_channel_permissions':
                return await channelMemberTools.getChannelPermissions(guild, input.channelName);

            case 'set_member_deaf':
                return await channelMemberTools.setMemberDeaf(guild, input.userId, input.deaf, input.reason);

            case 'set_member_mute':
                return await channelMemberTools.setMemberMute(guild, input.userId, input.mute, input.reason);

            case 'execute_webhook':
                return await channelMemberTools.executeWebhook(guild, input.webhookId, input.content, {
                    username: input.username,
                    avatarURL: input.avatarURL
                });

            case 'edit_webhook':
                return await channelMemberTools.editWebhook(guild, input.webhookId, {
                    name: input.name,
                    avatar: input.avatar,
                    channelId: input.channelId
                }, input.reason);

            case 'edit_automod_rule':
                return await channelMemberTools.editAutoModRule(guild, input.ruleName, {
                    newName: input.newName,
                    enabled: input.enabled,
                    keywords: input.keywords,
                    mentionLimit: input.mentionLimit,
                    action: input.action,
                    alertChannelName: input.alertChannelName
                });

            default:
                console.error(`❌ Unknown tool: ${toolName}`);
                return {
                    success: false,
                    error: `Unknown tool: ${toolName}. This shouldn't happen - let the developer know!`
                };
        }
    } catch (error) {
        console.error(`❌ Error executing tool ${toolName}:`, error);
        return {
            success: false,
            error: error.message,
            tool: toolName
        };
    }
}

// ===== SERVER INSPECTION IMPLEMENTATIONS =====

async function listChannels(guild, input) {
    try {
        const filterType = input.filter_type || 'all';
        const includeIds = input.include_ids || false;

        let channels = Array.from(guild.channels.cache.values());

        // Filter by type
        if (filterType !== 'all') {
            const typeMap = {
                'text': ChannelType.GuildText,
                'voice': ChannelType.GuildVoice,
                'category': ChannelType.GuildCategory,
                'forum': ChannelType.GuildForum,
                'stage': ChannelType.GuildStageVoice,
                'thread': ChannelType.PublicThread
            };

            const targetType = typeMap[filterType];
            if (targetType) {
                channels = channels.filter(c => c.type === targetType);
            }
        }

        // Map to readable format
        const channelList = channels.map(c => {
            const info = {
                name: c.name,
                type: getChannelTypeName(c.type),
                category: c.parent?.name || 'No category'
            };

            if (c.topic) info.topic = c.topic;
            if (includeIds) info.id = c.id;

            return info;
        });

        return {
            success: true,
            channels: channelList,
            total: channelList.length,
            filter_applied: filterType
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list channels: ${error.message}`
        };
    }
}

async function listRoles(guild, input) {
    try {
        const includePermissions = input.include_permissions || false;
        const includeIds = input.include_ids || false;

        const roles = Array.from(guild.roles.cache.values())
            .filter(r => r.name !== '@everyone')  // Exclude @everyone
            .map(r => {
                const info = {
                    name: r.name,
                    color: r.hexColor,
                    position: r.position,
                    member_count: r.members.size,
                    hoisted: r.hoist,
                    mentionable: r.mentionable
                };

                if (includeIds) {
                    info.id = r.id;
                }

                if (includePermissions) {
                    info.permissions = r.permissions.toArray();
                }

                return info;
            })
            .sort((a, b) => b.position - a.position);  // Sort by position (highest first)

        return {
            success: true,
            roles: roles,
            total: roles.length
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list roles: ${error.message}`
        };
    }
}

async function listMembers(guild, input) {
    try {
        const onlineOnly = input.online_only || false;
        const roleFilter = input.role_filter || null;
        const limit = input.limit || 50;

        // Fetch all members (required for accurate list) with retry logic
        await retryWithBackoff(
            () => guild.members.fetch(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Guild Members'
            }
        );

        let members = Array.from(guild.members.cache.values());

        // Filter by online status
        if (onlineOnly) {
            members = members.filter(m => m.presence?.status && m.presence.status !== 'offline');
        }

        // Filter by role
        if (roleFilter) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleFilter.toLowerCase());
            if (role) {
                members = members.filter(m => m.roles.cache.has(role.id));
            }
        }

        // Limit results
        members = members.slice(0, limit);

        // Map to readable format
        const memberList = members.map(m => ({
            username: m.user.username,
            nickname: m.nickname || 'None',
            id: m.id,
            roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name),
            joined_at: m.joinedAt?.toLocaleDateString() || 'Unknown',
            status: m.presence?.status || 'offline'
        }));

        return {
            success: true,
            members: memberList,
            total: memberList.length,
            showing_limit: limit,
            total_in_server: guild.memberCount
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list members: ${error.message}`
        };
    }
}

async function getChannelInfo(guild, input) {
    try {
        const channel = guild.channels.cache.find(c => c.name.toLowerCase() === input.channel_name.toLowerCase());

        if (!channel) {
            return {
                success: false,
                error: `Channel "${input.channel_name}" not found`
            };
        }

        const info = {
            name: channel.name,
            id: channel.id,
            type: getChannelTypeName(channel.type),
            category: channel.parent?.name || 'No category',
            topic: channel.topic || 'No topic',
            nsfw: channel.nsfw || false,
            position: channel.position
        };

        if (channel.rateLimitPerUser) {
            info.slowmode = `${channel.rateLimitPerUser} seconds`;
        }

        return {
            success: true,
            channel: info
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get channel info: ${error.message}`
        };
    }
}

// ===== HELPER FUNCTIONS =====

async function assignRole(guild, author, input) {
    const roleService = require('../services/roleService');
    const { isOwner } = require('../utils/permissions');
    const targetUserId = input.userId || author.id;

    try {
        // Get the member with retry logic
        const member = await retryWithBackoff(
            () => guild.members.fetch(targetUserId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Member'
            }
        );

        // If owner is requesting, bypass self-assignable check
        if (isOwner(author.id)) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === input.roleName.toLowerCase());

            if (!role) {
                return {
                    success: false,
                    error: `Role "${input.roleName}" not found`
                };
            }

            if (member.roles.cache.has(role.id)) {
                return {
                    success: false,
                    error: `${member.user.username} already has the ${input.roleName} role`
                };
            }

            await retryWithBackoff(
                () => member.roles.add(role),
                {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    operationName: 'Add Role'
                }
            );
            return {
                success: true,
                message: `Added ${input.roleName} role to ${member.user.username}`
            };
        }

        // For non-owners, use roleService (self-assignable roles only)
        const result = await roleService.addRole(member, input.roleName);

        if (result.success) {
            return {
                success: true,
                message: `Added ${input.roleName} role to ${member.user.username}`
            };
        } else {
            return {
                success: false,
                error: result.error
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Failed to assign role: ${error.message}`
        };
    }
}

async function removeRole(guild, author, input) {
    const roleService = require('../services/roleService');
    const { isOwner } = require('../utils/permissions');
    const targetUserId = input.userId || author.id;

    try {
        const member = await retryWithBackoff(
            () => guild.members.fetch(targetUserId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Member'
            }
        );

        // If owner is requesting, bypass self-assignable check
        if (isOwner(author.id)) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === input.roleName.toLowerCase());

            if (!role) {
                return {
                    success: false,
                    error: `Role "${input.roleName}" not found`
                };
            }

            if (!member.roles.cache.has(role.id)) {
                return {
                    success: false,
                    error: `${member.user.username} doesn't have the ${input.roleName} role`
                };
            }

            await retryWithBackoff(
                () => member.roles.remove(role),
                {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    operationName: 'Remove Role'
                }
            );
            return {
                success: true,
                message: `Removed ${input.roleName} role from ${member.user.username}`
            };
        }

        // For non-owners, use roleService (self-assignable roles only)
        const result = await roleService.removeRole(member, input.roleName);

        if (result.success) {
            return {
                success: true,
                message: `Removed ${input.roleName} role from ${member.user.username}`
            };
        } else {
            return {
                success: false,
                error: result.error
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Failed to remove role: ${error.message}`
        };
    }
}

async function createThreadInChannel(guild, input) {
    try {
        const channel = guild.channels.cache.find(c => c.name.toLowerCase() === input.channelName.toLowerCase());

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const thread = await channel.threads.create({
            name: input.threadName,
            autoArchiveDuration: input.autoArchiveDuration || 60,
            reason: 'Created by Sunny'
        });

        return {
            success: true,
            message: `Created thread "${input.threadName}" in #${input.channelName}`,
            thread_id: thread.id
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to create thread: ${error.message}`
        };
    }
}

async function deleteScheduledEvent(guild, input) {
    try {
        const events = await guild.scheduledEvents.fetch();
        const event = events.find(e => e.name.toLowerCase() === input.eventName.toLowerCase());

        if (!event) {
            return { success: false, error: `Event "${input.eventName}" not found` };
        }

        await event.delete();

        return {
            success: true,
            message: `Deleted event "${input.eventName}"`
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to delete event: ${error.message}`
        };
    }
}

async function deleteEmoji(guild, input) {
    try {
        const emoji = guild.emojis.cache.find(e => e.name.toLowerCase() === input.emojiName.toLowerCase());

        if (!emoji) {
            return { success: false, error: `Emoji "${input.emojiName}" not found` };
        }

        await emoji.delete();

        return {
            success: true,
            message: `Deleted emoji "${input.emojiName}"`
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to delete emoji: ${error.message}`
        };
    }
}

function getChannelTypeName(type) {
    const typeMap = {
        [ChannelType.GuildText]: 'Text',
        [ChannelType.GuildVoice]: 'Voice',
        [ChannelType.GuildCategory]: 'Category',
        [ChannelType.GuildForum]: 'Forum',
        [ChannelType.GuildStageVoice]: 'Stage',
        [ChannelType.PublicThread]: 'Thread',
        [ChannelType.PrivateThread]: 'Private Thread',
        [ChannelType.GuildAnnouncement]: 'Announcement'
    };

    return typeMap[type] || 'Unknown';
}

// Helper function to find channel by name or ID
function findChannel(guild, identifier) {
    if (!identifier) return null;

    // Try to find by ID first (if identifier looks like a snowflake ID)
    if (/^\d{17,19}$/.test(identifier)) {
        const channelById = guild.channels.cache.get(identifier);
        if (channelById) return channelById;
    }

    // Try to find by name (case-insensitive)
    return guild.channels.cache.find(c => c.name.toLowerCase() === identifier.toLowerCase());
}

// ===== MESSAGE MANAGEMENT IMPLEMENTATIONS =====

async function sendMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.send(input.content),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Send Message'
            }
        );

        return {
            success: true,
            message: `Message sent to #${channel.name}`,
            message_id: message.id
        };
    } catch (error) {
        return { success: false, error: `Failed to send message: ${error.message}` };
    }
}

async function sendEmbed(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const embed = new EmbedBuilder()
            .setDescription(input.description);

        if (input.title) embed.setTitle(input.title);
        if (input.color) embed.setColor(input.color);
        if (input.footer) embed.setFooter({ text: input.footer });
        if (input.imageUrl) embed.setImage(input.imageUrl);
        if (input.thumbnailUrl) embed.setThumbnail(input.thumbnailUrl);

        const message = await retryWithBackoff(
            () => channel.send({ embeds: [embed] }),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Send Embed'
            }
        );

        return {
            success: true,
            message: `Embed sent to #${channel.name}`,
            message_id: message.id
        };
    } catch (error) {
        return { success: false, error: `Failed to send embed: ${error.message}` };
    }
}

async function editMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.edit(input.newContent),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Edit Message'
            }
        );

        return {
            success: true,
            message: `Message edited in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to edit message: ${error.message}` };
    }
}

async function deleteMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.delete(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Delete Message'
            }
        );

        return {
            success: true,
            message: `Message deleted from #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to delete message: ${error.message}` };
    }
}

async function pinMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.pin(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Pin Message'
            }
        );

        return {
            success: true,
            message: `Message pinned in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to pin message: ${error.message}` };
    }
}

async function unpinMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.unpin(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Unpin Message'
            }
        );

        return {
            success: true,
            message: `Message unpinned from #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to unpin message: ${error.message}` };
    }
}

async function purgeMessages(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const amount = Math.min(input.amount, 100);
        await retryWithBackoff(
            () => channel.bulkDelete(amount, true),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Bulk Delete Messages'
            }
        );

        return {
            success: true,
            message: `Purged ${amount} messages from #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to purge messages: ${error.message}` };
    }
}

// ===== REACTION MANAGEMENT IMPLEMENTATIONS =====

async function addReaction(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        // Try to fetch the message with better error handling and retry logic
        let message;
        try {
            message = await retryWithBackoff(
                () => channel.messages.fetch(input.messageId),
                {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    operationName: 'Fetch Message for Reaction'
                }
            );
        } catch (fetchError) {
            if (fetchError.code === 10008) {
                return { success: false, error: `Message ${input.messageId} not found in #${channel.name}. The message may have been deleted or the ID is incorrect.` };
            }
            return { success: false, error: `Could not fetch message: ${fetchError.message} (Code: ${fetchError.code || 'unknown'})` };
        }

        // Try to add the reaction with retry logic
        try {
            await retryWithBackoff(
                () => message.react(input.emoji),
                {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    operationName: 'Add Reaction'
                }
            );
        } catch (reactError) {
            if (reactError.code === 10014) {
                return { success: false, error: `Invalid emoji: "${input.emoji}". Use Unicode emojis (like ✅) or custom emoji names from this server.` };
            }
            if (reactError.code === 50013) {
                return { success: false, error: `Missing permissions to add reactions in #${channel.name}. Bot needs "Add Reactions" permission.` };
            }
            return { success: false, error: `Failed to add reaction: ${reactError.message} (Code: ${reactError.code || 'unknown'})` };
        }

        return {
            success: true,
            message: `Added reaction ${input.emoji} to message in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to add reaction: ${error.message}` };
    }
}

async function removeReaction(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );

        if (input.userId) {
            const userReaction = message.reactions.cache.find(r => r.emoji.name === input.emoji || r.emoji.toString() === input.emoji);
            if (userReaction) {
                await userReaction.users.remove(input.userId);
            }
        } else {
            const reaction = message.reactions.cache.find(r => r.emoji.name === input.emoji || r.emoji.toString() === input.emoji);
            if (reaction) {
                await reaction.remove();
            }
        }

        return {
            success: true,
            message: `Removed reaction ${input.emoji} from message in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to remove reaction: ${error.message}` };
    }
}

async function removeAllReactions(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.reactions.removeAll(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Remove All Reactions'
            }
        );

        return {
            success: true,
            message: `Removed all reactions from message in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to remove all reactions: ${error.message}` };
    }
}

async function setupReactionRole(guild, input) {
    try {
        const reactionRoleService = require('../services/reactionRoleService');
        return await reactionRoleService.setupReactionRole(guild, input);
    } catch (error) {
        return { success: false, error: `Failed to setup reaction role: ${error.message}` };
    }
}

async function removeReactionRole(guild, input) {
    try {
        const reactionRoleService = require('../services/reactionRoleService');
        return await reactionRoleService.removeReactionRole(input);
    } catch (error) {
        return { success: false, error: `Failed to remove reaction role: ${error.message}` };
    }
}

async function listReactionRoles(guild, input) {
    try {
        const reactionRoleService = require('../services/reactionRoleService');
        return await reactionRoleService.listReactionRoles(guild);
    } catch (error) {
        return { success: false, error: `Failed to list reaction roles: ${error.message}` };
    }
}

// ===== INVITE MANAGEMENT IMPLEMENTATIONS =====

async function createInvite(guild, input) {
    try {
        const channel = guild.channels.cache.find(c => c.name.toLowerCase() === input.channelName.toLowerCase());

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const invite = await channel.createInvite({
            maxAge: input.maxAge || 0,
            maxUses: input.maxUses || 0,
            temporary: input.temporary || false
        });

        return {
            success: true,
            message: `Created invite: https://discord.gg/${invite.code}`,
            invite_code: invite.code,
            invite_url: `https://discord.gg/${invite.code}`
        };
    } catch (error) {
        return { success: false, error: `Failed to create invite: ${error.message}` };
    }
}

async function listInvites(guild, input) {
    try {
        const invites = await guild.invites.fetch();
        const inviteList = invites.map(i => ({
            code: i.code,
            url: `https://discord.gg/${i.code}`,
            uses: i.uses,
            max_uses: i.maxUses || 'Unlimited',
            expires: i.expiresAt ? i.expiresAt.toLocaleDateString() : 'Never',
            created_by: i.inviter?.username || 'Unknown'
        }));

        return {
            success: true,
            invites: inviteList,
            total: inviteList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list invites: ${error.message}` };
    }
}

async function listWebhooks(guild, input) {
    try {
        const webhooks = await guild.fetchWebhooks();
        const webhookList = webhooks.map(w => ({
            id: w.id,
            name: w.name,
            channel: w.channel?.name || 'Unknown',
            channel_id: w.channelId,
            created_by: w.owner?.username || 'Unknown',
            avatar: w.avatarURL() || 'None'
        }));

        return {
            success: true,
            webhooks: webhookList,
            total: webhookList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list webhooks: ${error.message}` };
    }
}

async function listEmojis(guild, input) {
    try {
        const emojis = guild.emojis.cache;
        const emojiList = emojis.map(e => ({
            id: e.id,
            name: e.name,
            animated: e.animated,
            url: e.url,
            created_by: e.author?.username || 'Unknown'
        }));

        return {
            success: true,
            emojis: emojiList,
            total: emojiList.length,
            message: emojiList.length === 0 ? 'No custom emojis in this server' : `Found ${emojiList.length} custom emoji(s)`
        };
    } catch (error) {
        return { success: false, error: `Failed to list emojis: ${error.message}` };
    }
}

async function listStickers(guild, input) {
    try {
        const stickers = guild.stickers.cache;
        const stickerList = stickers.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description || 'No description',
            tags: s.tags || 'None',
            url: s.url
        }));

        return {
            success: true,
            stickers: stickerList,
            total: stickerList.length,
            message: stickerList.length === 0 ? 'No custom stickers in this server' : `Found ${stickerList.length} custom sticker(s)`
        };
    } catch (error) {
        return { success: false, error: `Failed to list stickers: ${error.message}` };
    }
}

// ===== AUTOMODERATION IMPLEMENTATIONS =====

async function createAutoModRule(guild, input) {
    try {
        const { AutoModerationRuleTriggerType, AutoModerationActionType } = require('discord.js');

        let triggerType;
        let triggerMetadata = {};

        switch (input.triggerType) {
            case 'keyword':
                triggerType = AutoModerationRuleTriggerType.Keyword;
                triggerMetadata.keywordFilter = input.keywords || [];
                break;
            case 'spam':
                triggerType = AutoModerationRuleTriggerType.Spam;
                break;
            case 'mention_spam':
                triggerType = AutoModerationRuleTriggerType.MentionSpam;
                triggerMetadata.mentionTotalLimit = input.mentionLimit || 5;
                break;
            case 'harmful_link':
                triggerType = 4; // Harmful link filtering
                break;
        }

        const actions = [];

        if (input.action === 'block') {
            actions.push({
                type: AutoModerationActionType.BlockMessage
            });
        }

        if (input.action === 'timeout') {
            actions.push({
                type: AutoModerationActionType.Timeout,
                metadata: { durationSeconds: 60 }
            });
        }

        if (input.action === 'alert' && input.alertChannelName) {
            const alertChannel = guild.channels.cache.find(c => c.name.toLowerCase() === input.alertChannelName.toLowerCase());
            if (alertChannel) {
                actions.push({
                    type: AutoModerationActionType.SendAlertMessage,
                    metadata: { channelId: alertChannel.id }
                });
            }
        }

        const rule = await guild.autoModerationRules.create({
            name: input.ruleName,
            eventType: 1, // MESSAGE_SEND - Required parameter for AutoMod rules
            triggerType: triggerType,
            triggerMetadata: triggerMetadata,
            actions: actions,
            enabled: true
        });

        return {
            success: true,
            message: `Created AutoMod rule: ${input.ruleName}`,
            rule_id: rule.id
        };
    } catch (error) {
        return { success: false, error: `Failed to create AutoMod rule: ${error.message}` };
    }
}

async function listAutoModRules(guild, input) {
    try {
        const rules = await guild.autoModerationRules.fetch();
        const ruleList = rules.map(r => ({
            name: r.name,
            trigger_type: r.triggerType,
            enabled: r.enabled,
            actions: r.actions.length
        }));

        return {
            success: true,
            rules: ruleList,
            total: ruleList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list AutoMod rules: ${error.message}` };
    }
}

async function deleteAutoModRule(guild, input) {
    try {
        const rules = await guild.autoModerationRules.fetch();
        const rule = rules.find(r => r.name.toLowerCase() === input.ruleName.toLowerCase());

        if (!rule) {
            return { success: false, error: `AutoMod rule "${input.ruleName}" not found` };
        }

        await rule.delete();

        return {
            success: true,
            message: `Deleted AutoMod rule: ${input.ruleName}`
        };
    } catch (error) {
        return { success: false, error: `Failed to delete AutoMod rule: ${error.message}` };
    }
}

// ===== MODERATION LOGS IMPLEMENTATIONS =====

async function getAuditLogs(guild, input) {
    try {
        const limit = Math.min(input.limit || 10, 100);
        const logs = await guild.fetchAuditLogs({ limit });

        const logList = logs.entries.map(entry => ({
            action: entry.actionType,
            executor: entry.executor?.username || 'Unknown',
            target: entry.target?.username || entry.target?.name || 'Unknown',
            reason: entry.reason || 'No reason provided',
            timestamp: entry.createdAt.toLocaleString()
        }));

        return {
            success: true,
            logs: logList,
            total: logList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to get audit logs: ${error.message}` };
    }
}

async function getBans(guild, input) {
    try {
        const bans = await guild.bans.fetch();
        const banList = bans.map(ban => ({
            user: ban.user.username,
            user_id: ban.user.id,
            reason: ban.reason || 'No reason provided'
        }));

        return {
            success: true,
            bans: banList,
            total: banList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to get bans: ${error.message}` };
    }
}

module.exports = { execute };
