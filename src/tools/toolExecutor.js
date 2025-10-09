// src/tools/toolExecutor.js
/**
 * Tool Executor - Maps Claude tool calls to Discord operations
 * Handles permission checks and executes Discord.js operations
 * Reuses existing ActionHandler logic where possible
 */

const { ChannelType } = require('discord.js');
const { isOwner } = require('../utils/permissions');
const ActionHandler = require('../handlers/actionHandler');

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
        'set_channel_nsfw', 'create_role', 'delete_role', 'rename_role',
        'set_role_color', 'kick_member', 'ban_member', 'unban_member',
        'remove_timeout', 'set_nickname', 'archive_thread', 'lock_thread',
        'delete_event', 'create_emoji', 'delete_emoji'
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
            case 'create_emoji':
                return await actionHandler.createEmoji(guild, input);

            case 'delete_emoji':
                return await deleteEmoji(guild, input);

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

        // Fetch all members (required for accurate list)
        await guild.members.fetch();

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
    const targetUserId = input.userId || author.id;

    try {
        // Get the member
        const member = await guild.members.fetch(targetUserId);

        // Use existing roleService
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
    const targetUserId = input.userId || author.id;

    try {
        const member = await guild.members.fetch(targetUserId);
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

module.exports = { execute };
