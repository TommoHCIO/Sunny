// src/tools/advancedModeration.js
/**
 * Advanced Moderation Tools
 * Tools for detailed moderation control and audit logs
 */

const { AuditLogEvent } = require('discord.js');
const { canTimeout, canKick, canBan } = require('../utils/permissions');

/**
 * Tool #104: List all currently timed-out members
 */
async function listTimeouts(guild) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        // Fetch all members to ensure cache is populated
        await guild.members.fetch();

        const now = new Date();
        const timedOutMembers = guild.members.cache
            .filter(member => member.communicationDisabledUntil && member.communicationDisabledUntil > now)
            .map(member => {
                const until = member.communicationDisabledUntil;
                const remaining = Math.floor((until - now) / 1000 / 60); // minutes
                
                return {
                    username: member.user.username,
                    displayName: member.displayName,
                    id: member.id,
                    timedOutUntil: until.toISOString(),
                    remainingMinutes: remaining,
                    remainingFormatted: remaining > 60 
                        ? `${Math.floor(remaining / 60)}h ${remaining % 60}m` 
                        : `${remaining}m`
                };
            });

        return {
            success: true,
            timedOutMembers: timedOutMembers,
            count: timedOutMembers.length
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list timeouts: ${error.message}`
        };
    }
}

/**
 * Tool #105: Remove timeout from a member
 */
async function removeTimeout(guild, userId, reason = 'Timeout removed by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    // Check permissions
    if (!canTimeout(guild)) {
        return {
            success: false,
            error: 'I don\'t have permission to manage timeouts. Please grant me the "Moderate Members" permission.'
        };
    }

    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            return { success: false, error: `Member with ID ${userId} not found` };
        }

        if (!member.communicationDisabledUntil) {
            return {
                success: false,
                error: `${member.user.username} is not currently timed out`
            };
        }

        await member.timeout(null, reason);

        return {
            success: true,
            message: `Timeout removed for ${member.user.username}`,
            member: {
                username: member.user.username,
                displayName: member.displayName,
                id: member.id
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to remove timeout: ${error.message}`
        };
    }
}

/**
 * Tool #106: Get audit log (recent moderation actions)
 */
async function getAuditLog(guild, options = {}) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const {
            limit = 25,
            actionType = null,
            userId = null
        } = options;

        const fetchOptions = { limit };
        
        if (actionType) {
            // Map action type strings to AuditLogEvent
            const eventMap = {
                'timeout': AuditLogEvent.MemberUpdate,
                'kick': AuditLogEvent.MemberKick,
                'ban': AuditLogEvent.MemberBanAdd,
                'unban': AuditLogEvent.MemberBanRemove,
                'role_update': AuditLogEvent.MemberRoleUpdate,
                'channel_create': AuditLogEvent.ChannelCreate,
                'channel_delete': AuditLogEvent.ChannelDelete,
                'message_delete': AuditLogEvent.MessageDelete,
                'member_prune': AuditLogEvent.MemberPrune
            };
            
            if (eventMap[actionType]) {
                fetchOptions.type = eventMap[actionType];
            }
        }

        if (userId) {
            fetchOptions.user = userId;
        }

        const auditLogs = await guild.fetchAuditLogs(fetchOptions);

        const entries = auditLogs.entries.map(entry => ({
            id: entry.id,
            action: entry.action,
            actionType: entry.actionType,
            executor: {
                username: entry.executor?.username,
                id: entry.executor?.id
            },
            target: {
                username: entry.target?.username || entry.target?.name,
                id: entry.target?.id
            },
            reason: entry.reason || 'No reason provided',
            createdAt: entry.createdAt.toISOString(),
            changes: entry.changes || []
        }));

        return {
            success: true,
            entries: entries,
            count: entries.length
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get audit log: ${error.message}`
        };
    }
}

/**
 * Tool #107: Ban a member from the server
 */
async function banMember(guild, userId, options = {}) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    // Check permissions
    if (!canBan(guild)) {
        return {
            success: false,
            error: 'I don\'t have permission to ban members. Please grant me the "Ban Members" permission.'
        };
    }

    try {
        const {
            reason = 'Banned by Sunny',
            deleteMessageDays = 0
        } = options;

        // Validate deleteMessageDays
        if (deleteMessageDays < 0 || deleteMessageDays > 7) {
            return {
                success: false,
                error: 'deleteMessageDays must be between 0 and 7'
            };
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        const username = member?.user.username || `User ${userId}`;

        // Check if target is protected
        if (member) {
            if (member.id === guild.ownerId) {
                return { success: false, error: 'Cannot ban the server owner' };
            }
            
            if (member.permissions.has('Administrator')) {
                return { success: false, error: 'Cannot ban administrators' };
            }
        }

        await guild.members.ban(userId, {
            reason,
            deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60
        });

        return {
            success: true,
            message: `${username} has been banned`,
            user: {
                username,
                id: userId
            },
            reason,
            deleteMessageDays
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to ban member: ${error.message}`
        };
    }
}

/**
 * Tool #108: Unban a user from the server
 */
async function unbanMember(guild, userId, reason = 'Unbanned by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    // Check permissions
    if (!canBan(guild)) {
        return {
            success: false,
            error: 'I don\'t have permission to unban members. Please grant me the "Ban Members" permission.'
        };
    }

    try {
        // Check if user is actually banned
        const bans = await guild.bans.fetch();
        const ban = bans.get(userId);
        
        if (!ban) {
            return {
                success: false,
                error: `User ${userId} is not banned`
            };
        }

        await guild.members.unban(userId, reason);

        return {
            success: true,
            message: `${ban.user.username} has been unbanned`,
            user: {
                username: ban.user.username,
                id: userId
            },
            reason
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to unban member: ${error.message}`
        };
    }
}

module.exports = {
    listTimeouts,
    removeTimeout,
    getAuditLog,
    banMember,
    unbanMember
};
