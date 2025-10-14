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
const autoMessageService = require('../services/autoMessageService');
const ticketService = require('../services/ticketService');
const gameService = require('../services/gameService');
const ServerSettings = require('../models/ServerSettings');

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
        'get_audit_logs', 'get_bans',
        // Auto message and ticketing tools
        'create_auto_message', 'update_auto_message', 'delete_auto_message', 'enable_auto_messages', 'disable_auto_messages',
        'create_ticket', 'close_ticket', 'assign_ticket', 'update_ticket_priority', 'add_ticket_tag',
        'enable_ticketing', 'disable_ticketing', 'configure_ticket_categories'
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

            case 'send_button_message':
                return await sendButtonMessage(guild, input);

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

            // ===== AUTOMATIC MESSAGE TOOLS =====
            case 'create_auto_message':
                return await createAutoMessage(guild, input);

            case 'list_auto_messages':
                return await listAutoMessages(guild, input);

            case 'update_auto_message':
                return await updateAutoMessage(guild, input);

            case 'delete_auto_message':
                return await deleteAutoMessage(guild, input);

            case 'get_auto_message':
                return await getAutoMessage(guild, input);

            case 'enable_auto_messages':
                return await enableAutoMessages(guild, input);

            case 'disable_auto_messages':
                return await disableAutoMessages(guild, input);

            // ===== TICKETING SYSTEM TOOLS =====
            case 'create_ticket':
                return await createTicket(guild, input);

            case 'close_ticket':
                return await closeTicket(guild, input);

            case 'assign_ticket':
                return await assignTicket(guild, input);

            case 'update_ticket_priority':
                return await updateTicketPriority(guild, input);

            case 'list_tickets':
                return await listTickets(guild, input);

            case 'get_ticket_stats':
                return await getTicketStats(guild, input);

            case 'get_ticket':
                return await getTicket(guild, input);

            case 'add_ticket_tag':
                return await addTicketTag(guild, input);

            case 'enable_ticketing':
                return await enableTicketing(guild, input);

            case 'disable_ticketing':
                return await disableTicketing(guild, input);

            case 'configure_ticket_categories':
                return await configureTicketCategories(guild, input);

            // ===== GAME AND ENTERTAINMENT TOOLS =====
            case 'start_trivia':
                return await startTrivia(guild, input);

            case 'get_trivia_leaderboard':
                return await getTriviaLeaderboard(guild, input);

            case 'create_poll':
                return await createPoll(guild, input);

            case 'create_quick_poll':
                return await createQuickPoll(guild, input);

            case 'start_rps':
                return await startRockPaperScissors(guild, input);

            case 'start_number_guess':
                return await startNumberGuess(guild, input);

            case 'roll_dice':
                return await rollDice(guild, input);

            case 'flip_coin':
                return await flipCoin(guild, input);

            case 'magic_8ball':
                return await magic8Ball(guild, input);

            case 'get_random_fact':
                return await getRandomFact(guild, input);

            case 'get_game_leaderboard':
                return await getGameLeaderboard(guild, input);

            case 'get_user_game_stats':
                return await getUserGameStats(guild, input);

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

async function sendButtonMessage(guild, input) {
    try {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        // Build message payload
        const messagePayload = {};

        // Add content if provided
        if (input.content) {
            messagePayload.content = input.content;
        }

        // Build embed if provided
        if (input.embed) {
            const embed = new EmbedBuilder();
            if (input.embed.title) embed.setTitle(input.embed.title);
            if (input.embed.description) embed.setDescription(input.embed.description);
            if (input.embed.color) embed.setColor(input.embed.color);
            if (input.embed.footer) embed.setFooter({ text: input.embed.footer });
            if (input.embed.thumbnail) embed.setThumbnail(input.embed.thumbnail);
            if (input.embed.image) embed.setImage(input.embed.image);
            if (input.embed.fields?.length) {
                for (const field of input.embed.fields) {
                    embed.addFields({
                        name: field.name,
                        value: field.value,
                        inline: field.inline || false
                    });
                }
            }
            messagePayload.embeds = [embed];
        }

        // Build buttons
        const rows = [];
        const styleMap = {
            'primary': ButtonStyle.Primary,
            'secondary': ButtonStyle.Secondary,
            'success': ButtonStyle.Success,
            'danger': ButtonStyle.Danger,
            'link': ButtonStyle.Link
        };

        // Group buttons into rows (max 5 buttons per row)
        for (let i = 0; i < input.buttons.length; i += 5) {
            const row = new ActionRowBuilder();
            const buttonsInRow = input.buttons.slice(i, i + 5);

            for (const buttonConfig of buttonsInRow) {
                const button = new ButtonBuilder()
                    .setLabel(buttonConfig.label)
                    .setStyle(styleMap[buttonConfig.style] || ButtonStyle.Primary);

                // Set custom ID or URL based on style
                if (buttonConfig.style === 'link') {
                    if (!buttonConfig.url) {
                        return { success: false, error: `Link button "${buttonConfig.label}" requires a URL` };
                    }
                    button.setURL(buttonConfig.url);
                } else {
                    button.setCustomId(buttonConfig.customId);
                }

                // Add emoji if provided
                if (buttonConfig.emoji) {
                    button.setEmoji(buttonConfig.emoji);
                }

                // Set disabled state
                if (buttonConfig.disabled) {
                    button.setDisabled(true);
                }

                row.addComponents(button);
            }

            rows.push(row);

            // Discord allows max 5 action rows
            if (rows.length >= 5) break;
        }

        messagePayload.components = rows;

        // Send the message
        const message = await retryWithBackoff(
            () => channel.send(messagePayload),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Send Button Message'
            }
        );

        return {
            success: true,
            message: `Button message sent to #${channel.name}`,
            message_id: message.id,
            button_count: input.buttons.length
        };
    } catch (error) {
        return { success: false, error: `Failed to send button message: ${error.message}` };
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

// ===== AUTOMATIC MESSAGE IMPLEMENTATIONS =====

async function createAutoMessage(guild, input) {
    try {
        // Find channel by name
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const config = {
            messageType: input.messageType,
            channelId: channel.id,
            content: input.content,
            embedConfig: input.embedConfig,
            triggers: input.triggers,
            dmUser: input.dmUser,
            enabled: input.enabled !== false
        };

        const autoMessage = await autoMessageService.createAutoMessage(guild.id, config);

        return {
            success: true,
            message: `Created ${input.messageType} automatic message for #${channel.name}`,
            message_id: autoMessage._id.toString()
        };
    } catch (error) {
        return { success: false, error: `Failed to create automatic message: ${error.message}` };
    }
}

async function listAutoMessages(guild, input) {
    try {
        const filters = {};
        if (input.messageType) filters.messageType = input.messageType;
        if (input.enabled !== undefined) filters.enabled = input.enabled;

        const messages = await autoMessageService.listAutoMessages(guild.id, filters);

        const messageList = messages.map(m => ({
            id: m._id.toString(),
            type: m.messageType,
            channel: guild.channels.cache.get(m.channelId)?.name || 'Unknown',
            enabled: m.enabled,
            content: m.content?.substring(0, 50) + (m.content?.length > 50 ? '...' : ''),
            has_embed: m.embedConfig?.enabled || false
        }));

        return {
            success: true,
            messages: messageList,
            total: messageList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list automatic messages: ${error.message}` };
    }
}

async function updateAutoMessage(guild, input) {
    try {
        const updates = input.updates;

        // If channel name is provided, convert to channel ID
        if (updates.channelName) {
            const channel = findChannel(guild, updates.channelName);
            if (!channel) {
                return { success: false, error: `Channel "${updates.channelName}" not found` };
            }
            updates.channelId = channel.id;
            delete updates.channelName;
        }

        await autoMessageService.updateAutoMessage(input.messageId, updates);

        return {
            success: true,
            message: `Updated automatic message ${input.messageId}`
        };
    } catch (error) {
        return { success: false, error: `Failed to update automatic message: ${error.message}` };
    }
}

async function deleteAutoMessage(guild, input) {
    try {
        await autoMessageService.deleteAutoMessage(input.messageId);

        return {
            success: true,
            message: `Deleted automatic message ${input.messageId}`
        };
    } catch (error) {
        return { success: false, error: `Failed to delete automatic message: ${error.message}` };
    }
}

async function getAutoMessage(guild, input) {
    try {
        const message = await autoMessageService.getAutoMessage(input.messageId);

        if (!message) {
            return { success: false, error: `Automatic message ${input.messageId} not found` };
        }

        return {
            success: true,
            message: {
                id: message._id.toString(),
                type: message.messageType,
                channel: guild.channels.cache.get(message.channelId)?.name || 'Unknown',
                content: message.content,
                embed_config: message.embedConfig,
                triggers: message.triggers,
                enabled: message.enabled,
                dm_user: message.dmUser
            }
        };
    } catch (error) {
        return { success: false, error: `Failed to get automatic message: ${error.message}` };
    }
}

async function enableAutoMessages(guild, input) {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id }) || new ServerSettings({ guildId: guild.id });

        const featureMap = {
            'welcome': 'welcomeEnabled',
            'goodbye': 'goodbyeEnabled',
            'milestones': 'milestonesEnabled',
            'triggers': 'triggersEnabled'
        };

        const field = featureMap[input.featureType];
        if (!field) {
            return { success: false, error: `Invalid feature type: ${input.featureType}` };
        }

        if (!settings.autoMessages) settings.autoMessages = {};
        settings.autoMessages[field] = true;
        await settings.save();

        return {
            success: true,
            message: `Enabled ${input.featureType} automatic messages`
        };
    } catch (error) {
        return { success: false, error: `Failed to enable automatic messages: ${error.message}` };
    }
}

async function disableAutoMessages(guild, input) {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id });
        if (!settings) {
            return { success: false, error: 'Server settings not found' };
        }

        const featureMap = {
            'welcome': 'welcomeEnabled',
            'goodbye': 'goodbyeEnabled',
            'milestones': 'milestonesEnabled',
            'triggers': 'triggersEnabled'
        };

        const field = featureMap[input.featureType];
        if (!field) {
            return { success: false, error: `Invalid feature type: ${input.featureType}` };
        }

        if (!settings.autoMessages) settings.autoMessages = {};
        settings.autoMessages[field] = false;
        await settings.save();

        return {
            success: true,
            message: `Disabled ${input.featureType} automatic messages`
        };
    } catch (error) {
        return { success: false, error: `Failed to disable automatic messages: ${error.message}` };
    }
}

// ===== TICKETING SYSTEM IMPLEMENTATIONS =====

async function createTicket(guild, input) {
    try {
        // Find member by name
        const member = guild.members.cache.find(m => 
            m.user.username.toLowerCase() === input.memberName.toLowerCase() ||
            m.displayName.toLowerCase() === input.memberName.toLowerCase()
        );

        if (!member) {
            return { success: false, error: `Member "${input.memberName}" not found` };
        }

        const result = await ticketService.createTicket(
            guild,
            member,
            input.category,
            input.subject,
            input.description
        );

        return {
            success: true,
            message: `Created ticket #${result.ticket.ticketNumber} for ${member.user.username}`,
            ticket_id: result.ticket.ticketId,
            thread_id: result.thread.id
        };
    } catch (error) {
        return { success: false, error: `Failed to create ticket: ${error.message}` };
    }
}

async function closeTicket(guild, input) {
    try {
        // Find staff member by name
        const staffMember = guild.members.cache.find(m => 
            m.user.username.toLowerCase() === input.staffMemberName.toLowerCase() ||
            m.displayName.toLowerCase() === input.staffMemberName.toLowerCase()
        );

        if (!staffMember) {
            return { success: false, error: `Staff member "${input.staffMemberName}" not found` };
        }

        const ticket = await ticketService.closeTicket(
            input.ticketId,
            staffMember,
            input.reason
        );

        return {
            success: true,
            message: `Closed ticket #${ticket.ticketNumber}`,
            transcript_url: ticket.transcriptUrl
        };
    } catch (error) {
        return { success: false, error: `Failed to close ticket: ${error.message}` };
    }
}

async function assignTicket(guild, input) {
    try {
        // Find staff member by name
        const staffMember = guild.members.cache.find(m => 
            m.user.username.toLowerCase() === input.staffMemberName.toLowerCase() ||
            m.displayName.toLowerCase() === input.staffMemberName.toLowerCase()
        );

        if (!staffMember) {
            return { success: false, error: `Staff member "${input.staffMemberName}" not found` };
        }

        const ticket = await ticketService.assignTicket(input.ticketId, staffMember);

        return {
            success: true,
            message: `Assigned ticket #${ticket.ticketNumber} to ${staffMember.user.username}`
        };
    } catch (error) {
        return { success: false, error: `Failed to assign ticket: ${error.message}` };
    }
}

async function updateTicketPriority(guild, input) {
    try {
        const ticket = await ticketService.updateTicketPriority(input.ticketId, input.priority);

        return {
            success: true,
            message: `Updated ticket #${ticket.ticketNumber} priority to ${input.priority}`
        };
    } catch (error) {
        return { success: false, error: `Failed to update ticket priority: ${error.message}` };
    }
}

async function listTickets(guild, input) {
    try {
        const filters = {};
        if (input.status) filters.status = input.status;
        if (input.category) filters.category = input.category;

        // Convert member names to IDs if provided
        if (input.assignedToName) {
            const member = guild.members.cache.find(m => 
                m.user.username.toLowerCase() === input.assignedToName.toLowerCase() ||
                m.displayName.toLowerCase() === input.assignedToName.toLowerCase()
            );
            if (member) filters.assignedTo = member.id;
        }

        if (input.creatorName) {
            const member = guild.members.cache.find(m => 
                m.user.username.toLowerCase() === input.creatorName.toLowerCase() ||
                m.displayName.toLowerCase() === input.creatorName.toLowerCase()
            );
            if (member) filters.creatorId = member.id;
        }

        const tickets = await ticketService.listTickets(guild.id, filters);

        const ticketList = tickets.map(t => ({
            ticket_number: t.ticketNumber,
            ticket_id: t.ticketId,
            subject: t.subject,
            category: t.category,
            status: t.status,
            priority: t.priority,
            creator: guild.members.cache.get(t.creatorId)?.user.username || 'Unknown',
            assigned_to: t.assignedTo ? (guild.members.cache.get(t.assignedTo)?.user.username || 'Unknown') : 'Unassigned',
            created_at: t.createdAt.toLocaleDateString()
        }));

        return {
            success: true,
            tickets: ticketList,
            total: ticketList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list tickets: ${error.message}` };
    }
}

async function getTicketStats(guild, input) {
    try {
        const stats = await ticketService.getTicketStats(guild.id);

        return {
            success: true,
            stats: {
                total: stats.total,
                open: stats.open,
                in_progress: stats.inProgress,
                closed: stats.closed,
                by_category: stats.byCategory,
                avg_resolution_time: ticketService.formatDuration(stats.avgResolutionTime),
                avg_first_response_time: ticketService.formatDuration(stats.avgFirstResponseTime)
            }
        };
    } catch (error) {
        return { success: false, error: `Failed to get ticket stats: ${error.message}` };
    }
}

async function getTicket(guild, input) {
    try {
        const ticket = await ticketService.getTicket(input.ticketId);

        if (!ticket) {
            return { success: false, error: `Ticket ${input.ticketId} not found` };
        }

        return {
            success: true,
            ticket: {
                ticket_number: ticket.ticketNumber,
                ticket_id: ticket.ticketId,
                subject: ticket.subject,
                description: ticket.description,
                category: ticket.category,
                status: ticket.status,
                priority: ticket.priority,
                creator: guild.members.cache.get(ticket.creatorId)?.user.username || 'Unknown',
                assigned_to: ticket.assignedTo ? (guild.members.cache.get(ticket.assignedTo)?.user.username || 'Unknown') : 'Unassigned',
                tags: ticket.tags,
                created_at: ticket.createdAt.toLocaleString(),
                closed_at: ticket.closedAt?.toLocaleString() || 'Not closed',
                transcript_url: ticket.transcriptUrl
            }
        };
    } catch (error) {
        return { success: false, error: `Failed to get ticket: ${error.message}` };
    }
}

async function addTicketTag(guild, input) {
    try {
        const ticket = await ticketService.addTicketTag(input.ticketId, input.tag);

        return {
            success: true,
            message: `Added tag "${input.tag}" to ticket #${ticket.ticketNumber}`
        };
    } catch (error) {
        return { success: false, error: `Failed to add ticket tag: ${error.message}` };
    }
}

async function enableTicketing(guild, input) {
    try {
        // Find channels
        const supportChannel = findChannel(guild, input.supportChannelName);
        if (!supportChannel) {
            return { success: false, error: `Support channel "${input.supportChannelName}" not found` };
        }

        const settings = await ServerSettings.findOne({ guildId: guild.id }) || new ServerSettings({ guildId: guild.id });

        if (!settings.ticketing) settings.ticketing = {};
        settings.ticketing.enabled = true;
        settings.ticketing.supportChannelId = supportChannel.id;

        // Optional: staff notify channel
        if (input.staffNotifyChannelName) {
            const notifyChannel = findChannel(guild, input.staffNotifyChannelName);
            if (notifyChannel) {
                settings.ticketing.staffNotifyChannelId = notifyChannel.id;
            }
        }

        // Optional: transcript channel
        if (input.transcriptChannelName) {
            const transcriptChannel = findChannel(guild, input.transcriptChannelName);
            if (transcriptChannel) {
                settings.ticketing.transcripts = settings.ticketing.transcripts || {};
                settings.ticketing.transcripts.enabled = true;
                settings.ticketing.transcripts.channelId = transcriptChannel.id;
            }
        }

        // Optional: staff roles
        if (input.staffRoleNames?.length) {
            const roleIds = [];
            for (const roleName of input.staffRoleNames) {
                const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
                if (role) roleIds.push(role.id);
            }
            settings.ticketing.staffRoleIds = roleIds;
        }

        await settings.save();

        return {
            success: true,
            message: `Enabled ticketing system with support channel #${supportChannel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to enable ticketing: ${error.message}` };
    }
}

async function disableTicketing(guild, input) {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id });
        if (!settings) {
            return { success: false, error: 'Server settings not found' };
        }

        if (!settings.ticketing) settings.ticketing = {};
        settings.ticketing.enabled = false;
        await settings.save();

        return {
            success: true,
            message: 'Disabled ticketing system'
        };
    } catch (error) {
        return { success: false, error: `Failed to disable ticketing: ${error.message}` };
    }
}

async function configureTicketCategories(guild, input) {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id }) || new ServerSettings({ guildId: guild.id });

        if (!settings.ticketing) settings.ticketing = {};

        // Convert role names to IDs
        const categories = input.categories.map(cat => {
            const result = {
                name: cat.name,
                emoji: cat.emoji
            };

            if (cat.autoAssignRoleName) {
                const role = guild.roles.cache.find(r => r.name.toLowerCase() === cat.autoAssignRoleName.toLowerCase());
                if (role) result.autoAssignRoleId = role.id;
            }

            return result;
        });

        settings.ticketing.categories = categories;
        await settings.save();

        return {
            success: true,
            message: `Configured ${categories.length} ticket categories`
        };
    } catch (error) {
        return { success: false, error: `Failed to configure ticket categories: ${error.message}` };
    }
}

// ===== GAME AND ENTERTAINMENT IMPLEMENTATIONS =====

async function startTrivia(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const result = await gameService.startTrivia(channel, {
            category: input.category,
            difficulty: input.difficulty,
            questionCount: input.questionCount
        });

        return result;
    } catch (error) {
        return { success: false, error: `Failed to start trivia: ${error.message}` };
    }
}

async function getTriviaLeaderboard(guild, input) {
    try {
        const leaderboard = await gameService.getLeaderboard(guild.id, 'trivia', input.limit || 10);

        return {
            success: true,
            leaderboard: leaderboard,
            total: leaderboard.length
        };
    } catch (error) {
        return { success: false, error: `Failed to get trivia leaderboard: ${error.message}` };
    }
}

async function createPoll(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const pollData = await gameService.createPoll(input);
        if (!pollData.success) {
            return pollData;
        }

        // Send poll to channel
        const message = await channel.send({ poll: pollData.poll });

        return {
            success: true,
            message: `Created poll in #${channel.name}`,
            message_id: message.id
        };
    } catch (error) {
        return { success: false, error: `Failed to create poll: ${error.message}` };
    }
}

async function createQuickPoll(guild, input) {
    try {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const embed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle('📊 Quick Poll')
            .setDescription(input.question)
            .setFooter({ text: 'Click a button to vote!' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('poll_yes')
                    .setLabel('Yes')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('poll_no')
                    .setLabel('No')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('poll_maybe')
                    .setLabel('Maybe')
                    .setEmoji('🤔')
                    .setStyle(ButtonStyle.Secondary)
            );

        const message = await channel.send({ embeds: [embed], components: [row] });

        return {
            success: true,
            message: `Created quick poll in #${channel.name}`,
            message_id: message.id
        };
    } catch (error) {
        return { success: false, error: `Failed to create quick poll: ${error.message}` };
    }
}

async function startRockPaperScissors(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        let opponent = null;
        if (input.opponent) {
            opponent = guild.members.cache.find(m =>
                m.user.username.toLowerCase() === input.opponent.toLowerCase() ||
                m.displayName.toLowerCase() === input.opponent.toLowerCase()
            );
        }

        // Create a fake interaction object for the game
        const fakeInteraction = {
            user: guild.members.cache.get(guild.ownerId).user,
            guild: guild,
            channel: channel,
            reply: async (options) => channel.send(options),
            editReply: async (options) => null,
            message: { edit: async (options) => null }
        };

        await gameService.startRockPaperScissors(fakeInteraction, opponent?.user || null);

        return {
            success: true,
            message: `Started Rock Paper Scissors game in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to start Rock Paper Scissors: ${error.message}` };
    }
}

async function startNumberGuess(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const user = guild.members.cache.get(guild.ownerId).user;

        const result = await gameService.startNumberGuessing(channel, user, {
            min: input.min,
            max: input.max,
            maxGuesses: input.maxGuesses
        });

        return result;
    } catch (error) {
        return { success: false, error: `Failed to start number guessing: ${error.message}` };
    }
}

async function rollDice(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const sides = input.sides || 6;
        const count = input.count || 1;
        const rolls = [];
        let total = 0;

        for (let i = 0; i < count; i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            rolls.push(roll);
            total += roll;
        }

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🎲 Dice Roll!')
            .setDescription(`Rolling ${count}d${sides}...`)
            .addFields(
                { name: 'Rolls', value: rolls.join(', '), inline: true },
                { name: 'Total', value: `**${total}**`, inline: true }
            );

        await channel.send({ embeds: [embed] });

        return {
            success: true,
            message: `Rolled ${count}d${sides} in #${channel.name}: ${rolls.join(', ')} (Total: ${total})`
        };
    } catch (error) {
        return { success: false, error: `Failed to roll dice: ${error.message}` };
    }
}

async function flipCoin(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const emoji = result === 'Heads' ? '🪙' : '🔄';

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`${emoji} Coin Flip!`)
            .setDescription(`The coin landed on **${result}**!`);

        await channel.send({ embeds: [embed] });

        return {
            success: true,
            message: `Flipped coin in #${channel.name}: ${result}`
        };
    } catch (error) {
        return { success: false, error: `Failed to flip coin: ${error.message}` };
    }
}

async function magic8Ball(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const responses = [
            'It is certain.',
            'It is decidedly so.',
            'Without a doubt.',
            'Yes definitely.',
            'You may rely on it.',
            'As I see it, yes.',
            'Most likely.',
            'Outlook good.',
            'Yes.',
            'Signs point to yes.',
            'Reply hazy, try again.',
            'Ask again later.',
            'Better not tell you now.',
            'Cannot predict now.',
            'Concentrate and ask again.',
            "Don't count on it.",
            'My reply is no.',
            'My sources say no.',
            'Outlook not so good.',
            'Very doubtful.'
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];

        const embed = new EmbedBuilder()
            .setColor('#8B008B')
            .setTitle('🔮 Magic 8-Ball')
            .addFields(
                { name: 'Question', value: input.question },
                { name: 'Answer', value: `**${response}**` }
            );

        await channel.send({ embeds: [embed] });

        return {
            success: true,
            message: `Magic 8-ball answered in #${channel.name}: ${response}`
        };
    } catch (error) {
        return { success: false, error: `Failed to use magic 8-ball: ${error.message}` };
    }
}

async function getRandomFact(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const facts = {
            general: [
                'Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old!',
                'Octopuses have three hearts and blue blood.',
                'Bananas are berries, but strawberries are not.',
                'The shortest war in history lasted 38-45 minutes.',
                'A group of flamingos is called a "flamboyance".'
            ],
            science: [
                'Water can exist in three states at once (triple point).',
                'Diamond is not the hardest natural material anymore - wurtzite boron nitride is harder.',
                'One teaspoon of a neutron star would weigh about 6 billion tons.',
                'Glass is neither liquid nor solid, but an amorphous solid.',
                'The human brain uses about 20% of the body\'s energy despite being only 2% of body weight.'
            ],
            history: [
                'Oxford University is older than the Aztec Empire.',
                'Cleopatra lived closer to the moon landing than to the construction of the pyramids.',
                'The Great Wall of China is not visible from space without aid.',
                'Vikings never wore horned helmets.',
                'Napoleon was actually average height for his time.'
            ],
            space: [
                'A day on Venus is longer than its year.',
                'Saturn\'s moon Titan has rivers and lakes of liquid methane.',
                'There are more stars in the universe than grains of sand on Earth.',
                'The footprints on the moon will last for millions of years.',
                'Jupiter\'s Great Red Spot is shrinking.'
            ],
            animals: [
                'Dolphins have names for each other.',
                'Crows can hold grudges and recognize human faces.',
                'Sea otters hold hands while sleeping to keep from drifting apart.',
                'Penguins propose to their mates with pebbles.',
                'Elephants are afraid of bees.'
            ],
            food: [
                'Peanuts are not nuts, they\'re legumes.',
                'Carrots were originally purple.',
                'Vanilla is the second most expensive spice after saffron.',
                'Apples float in water because they are 25% air.',
                'Chocolate was once used as currency.'
            ]
        };

        const category = input.category || 'general';
        const categoryFacts = facts[category] || facts.general;
        const fact = categoryFacts[Math.floor(Math.random() * categoryFacts.length)];

        const embed = new EmbedBuilder()
            .setColor('#00CED1')
            .setTitle('💡 Random Fact')
            .setDescription(fact)
            .setFooter({ text: `Category: ${category}` });

        await channel.send({ embeds: [embed] });

        return {
            success: true,
            message: `Shared a ${category} fact in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to get random fact: ${error.message}` };
    }
}

async function getGameLeaderboard(guild, input) {
    try {
        const gameType = input.gameType === 'all' ? null : input.gameType;
        const leaderboard = await gameService.getLeaderboard(guild.id, gameType, input.limit || 10);

        return {
            success: true,
            leaderboard: leaderboard,
            total: leaderboard.length,
            game_type: input.gameType
        };
    } catch (error) {
        return { success: false, error: `Failed to get game leaderboard: ${error.message}` };
    }
}

async function getUserGameStats(guild, input) {
    try {
        const user = guild.members.cache.find(m =>
            m.user.username.toLowerCase() === input.username.toLowerCase() ||
            m.displayName.toLowerCase() === input.username.toLowerCase()
        );

        if (!user) {
            return { success: false, error: `User "${input.username}" not found` };
        }

        const UserMemory = require('../models/UserMemory');
        const stats = await UserMemory.findOne({ userId: user.id, guildId: guild.id });

        if (!stats || !stats.games) {
            return {
                success: true,
                stats: {
                    username: user.user.username,
                    total_plays: 0,
                    message: 'No game stats found for this user'
                }
            };
        }

        return {
            success: true,
            stats: {
                username: user.user.username,
                total_plays: stats.games.totalPlays || 0,
                trivia: stats.games.trivia || { plays: 0, totalScore: 0, highScore: 0 },
                rps: stats.games.rps || { plays: 0, totalScore: 0 },
                number_guess: stats.games.number_guess || { plays: 0, totalScore: 0 }
            }
        };
    } catch (error) {
        return { success: false, error: `Failed to get user game stats: ${error.message}` };
    }
}

module.exports = { execute };
