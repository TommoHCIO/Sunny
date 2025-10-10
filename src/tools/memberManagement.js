// src/tools/memberManagement.js
/**
 * Member Management Tools
 * Tools for getting detailed information about server members
 */

/**
 * Tool #99: Get detailed member information
 */
async function getMemberInfo(guild, userId) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            return { success: false, error: `Member with ID ${userId} not found` };
        }

        const roles = member.roles.cache
            .filter(role => role.id !== guild.id) // Exclude @everyone
            .sort((a, b) => b.position - a.position)
            .map(role => ({
                name: role.name,
                id: role.id,
                color: role.hexColor,
                position: role.position
            }));

        return {
            success: true,
            member: {
                username: member.user.username,
                displayName: member.displayName,
                id: member.id,
                bot: member.user.bot,
                joinedAt: member.joinedAt?.toISOString(),
                accountCreatedAt: member.user.createdAt.toISOString(),
                nickname: member.nickname,
                roles: roles,
                roleCount: roles.length,
                highestRole: {
                    name: member.roles.highest.name,
                    color: member.roles.highest.hexColor,
                    position: member.roles.highest.position
                },
                isOwner: member.id === guild.ownerId,
                isAdmin: member.permissions.has('Administrator'),
                isModerator: member.permissions.has('ModerateMembers') || member.permissions.has('KickMembers') || member.permissions.has('BanMembers'),
                isPending: member.pending,
                timedOut: member.communicationDisabledUntil ? {
                    until: member.communicationDisabledUntil.toISOString(),
                    remaining: Math.floor((member.communicationDisabledUntil - new Date()) / 1000 / 60) + ' minutes'
                } : null,
                voice: {
                    channel: member.voice.channel?.name || null,
                    muted: member.voice.mute,
                    deafened: member.voice.deaf,
                    selfMuted: member.voice.selfMute,
                    selfDeafened: member.voice.selfDeaf,
                    streaming: member.voice.streaming
                }
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get member info: ${error.message}`
        };
    }
}

/**
 * Tool #100: Get member's roles
 */
async function getMemberRoles(guild, userId) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            return { success: false, error: `Member with ID ${userId} not found` };
        }

        const roles = member.roles.cache
            .filter(role => role.id !== guild.id) // Exclude @everyone
            .sort((a, b) => b.position - a.position)
            .map(role => ({
                name: role.name,
                id: role.id,
                color: role.hexColor,
                position: role.position,
                hoisted: role.hoist,
                managed: role.managed,
                mentionable: role.mentionable,
                permissions: role.permissions.toArray()
            }));

        return {
            success: true,
            member: {
                username: member.user.username,
                displayName: member.displayName,
                id: member.id
            },
            roles: roles,
            count: roles.length,
            highestRole: roles[0] || null
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get member roles: ${error.message}`
        };
    }
}

/**
 * Tool #101: Get member's permissions
 */
async function getMemberPermissions(guild, userId) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            return { success: false, error: `Member with ID ${userId} not found` };
        }

        const permissions = member.permissions.toArray();
        const hasAdmin = member.permissions.has('Administrator');

        return {
            success: true,
            member: {
                username: member.user.username,
                displayName: member.displayName,
                id: member.id
            },
            permissions: {
                all: permissions,
                count: permissions.length,
                hasAdministrator: hasAdmin,
                keyPermissions: {
                    admin: hasAdmin,
                    manageGuild: member.permissions.has('ManageGuild'),
                    manageRoles: member.permissions.has('ManageRoles'),
                    manageChannels: member.permissions.has('ManageChannels'),
                    moderateMembers: member.permissions.has('ModerateMembers'),
                    kickMembers: member.permissions.has('KickMembers'),
                    banMembers: member.permissions.has('BanMembers'),
                    manageMessages: member.permissions.has('ManageMessages'),
                    viewAuditLog: member.permissions.has('ViewAuditLog')
                }
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get member permissions: ${error.message}`
        };
    }
}

/**
 * Tool #102: List all members with a specific role
 */
async function listMembersWithRole(guild, roleId) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
            return { success: false, error: `Role with ID ${roleId} not found` };
        }

        // Fetch all members to ensure cache is populated
        await guild.members.fetch();

        const members = role.members.map(member => ({
            username: member.user.username,
            displayName: member.displayName,
            id: member.id,
            bot: member.user.bot,
            joinedAt: member.joinedAt?.toISOString(),
            nickname: member.nickname,
            isAdmin: member.permissions.has('Administrator')
        }));

        return {
            success: true,
            role: {
                name: role.name,
                id: role.id,
                color: role.hexColor,
                position: role.position
            },
            members: members,
            count: members.length,
            bots: members.filter(m => m.bot).length,
            humans: members.filter(m => !m.bot).length
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list members with role: ${error.message}`
        };
    }
}

/**
 * Tool #103: Search members by name or nickname
 */
async function searchMembers(guild, query, limit = 25) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    if (!query || query.trim().length === 0) {
        return { success: false, error: 'Search query is required' };
    }

    try {
        // Fetch all members to ensure cache is populated
        await guild.members.fetch();

        const searchQuery = query.toLowerCase();
        const matches = guild.members.cache
            .filter(member => {
                const username = member.user.username.toLowerCase();
                const displayName = member.displayName.toLowerCase();
                const nickname = member.nickname?.toLowerCase() || '';
                
                return username.includes(searchQuery) ||
                       displayName.includes(searchQuery) ||
                       nickname.includes(searchQuery);
            })
            .first(limit)
            .map(member => ({
                username: member.user.username,
                displayName: member.displayName,
                id: member.id,
                bot: member.user.bot,
                nickname: member.nickname,
                highestRole: {
                    name: member.roles.highest.name,
                    color: member.roles.highest.hexColor
                },
                isAdmin: member.permissions.has('Administrator')
            }));

        return {
            success: true,
            query: query,
            matches: matches,
            count: matches.length,
            limitReached: matches.length === limit
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to search members: ${error.message}`
        };
    }
}

module.exports = {
    getMemberInfo,
    getMemberRoles,
    getMemberPermissions,
    listMembersWithRole,
    searchMembers
};
