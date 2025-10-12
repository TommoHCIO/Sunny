// src/tools/roleManagement.js
/**
 * Role Management Tools
 * Tools for detailed role management and hierarchy control
 */

const { PermissionFlagsBits } = require('discord.js');

/**
 * Tool #109: Get detailed role information
 */
async function getRoleInfo(guild, roleId) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
            return { success: false, error: `Role with ID ${roleId} not found` };
        }

        // Get member count
        await guild.members.fetch();
        const memberCount = role.members.size;

        const permissions = role.permissions.toArray();

        return {
            success: true,
            role: {
                name: role.name,
                id: role.id,
                color: role.hexColor,
                position: role.position,
                hoisted: role.hoist,
                mentionable: role.mentionable,
                managed: role.managed,
                createdAt: role.createdAt.toISOString(),
                memberCount: memberCount,
                permissions: {
                    all: permissions,
                    count: permissions.length,
                    hasAdministrator: role.permissions.has(PermissionFlagsBits.Administrator),
                    keyPermissions: {
                        administrator: role.permissions.has(PermissionFlagsBits.Administrator),
                        manageGuild: role.permissions.has(PermissionFlagsBits.ManageGuild),
                        manageRoles: role.permissions.has(PermissionFlagsBits.ManageRoles),
                        manageChannels: role.permissions.has(PermissionFlagsBits.ManageChannels),
                        moderateMembers: role.permissions.has(PermissionFlagsBits.ModerateMembers),
                        kickMembers: role.permissions.has(PermissionFlagsBits.KickMembers),
                        banMembers: role.permissions.has(PermissionFlagsBits.BanMembers),
                        manageMessages: role.permissions.has(PermissionFlagsBits.ManageMessages),
                        viewAuditLog: role.permissions.has(PermissionFlagsBits.ViewAuditLog)
                    }
                },
                tags: {
                    botId: role.tags?.botId || null,
                    integrationId: role.tags?.integrationId || null,
                    premiumSubscriber: role.tags?.premiumSubscriberRole || false
                }
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get role info: ${error.message}`
        };
    }
}

/**
 * Tool #110: Get all members with a specific role
 */
async function getRoleMembers(guild, roleId) {
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

        const members = role.members
            .sort((a, b) => a.joinedAt - b.joinedAt)
            .map(member => ({
                username: member.user.username,
                displayName: member.displayName,
                id: member.id,
                bot: member.user.bot,
                joinedAt: member.joinedAt?.toISOString(),
                nickname: member.nickname,
                isAdmin: member.permissions.has(PermissionFlagsBits.Administrator),
                highestRole: {
                    name: member.roles.highest.name,
                    color: member.roles.highest.hexColor,
                    position: member.roles.highest.position
                }
            }));

        return {
            success: true,
            role: {
                name: role.name,
                id: role.id,
                color: role.hexColor
            },
            members: members,
            count: members.length,
            bots: members.filter(m => m.bot).length,
            humans: members.filter(m => !m.bot).length
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get role members: ${error.message}`
        };
    }
}

/**
 * Tool #111: Update role permissions
 */
async function updateRolePermissions(guild, roleId, permissions, reason = 'Updated by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
            return { success: false, error: `Role with ID ${roleId} not found` };
        }

        // Check if bot can manage this role
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return {
                success: false,
                error: 'I don\'t have permission to manage roles. Please grant me the "Manage Roles" permission.'
            };
        }

        if (role.position >= botMember.roles.highest.position) {
            return {
                success: false,
                error: `I cannot manage this role because it's higher than or equal to my highest role in the hierarchy.`
            };
        }

        if (role.managed) {
            return {
                success: false,
                error: 'Cannot modify permissions for managed roles (bot roles, integration roles, etc.)'
            };
        }

        // Validate and convert permission names to flags
        const permissionFlags = [];
        for (const perm of permissions) {
            if (!PermissionFlagsBits[perm]) {
                return {
                    success: false,
                    error: `Invalid permission: ${perm}`
                };
            }
            permissionFlags.push(PermissionFlagsBits[perm]);
        }

        const oldPermissions = role.permissions.toArray();
        await role.setPermissions(permissionFlags, reason);

        return {
            success: true,
            message: `Permissions updated for role ${role.name}`,
            role: {
                name: role.name,
                id: role.id
            },
            oldPermissions: oldPermissions,
            newPermissions: role.permissions.toArray()
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to update role permissions: ${error.message}`
        };
    }
}

/**
 * Tool #112: Reorder roles (change role hierarchy)
 */
async function reorderRoles(guild, roleId, newPosition, reason = 'Role reordered by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    // Validate roleId parameter type
    if (typeof roleId !== 'string') {
        return {
            success: false,
            error: `Invalid roleId parameter: expected string, got ${typeof roleId}. Please provide the role ID as a string.`
        };
    }

    try {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
            return { success: false, error: `Role with ID ${roleId} not found` };
        }

        // Check permissions
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return {
                success: false,
                error: 'I don\'t have permission to manage roles. Please grant me the "Manage Roles" permission.'
            };
        }

        if (role.managed) {
            return {
                success: false,
                error: 'Cannot reorder managed roles (bot roles, integration roles, etc.)'
            };
        }

        // Validate new position
        const maxPosition = botMember.roles.highest.position - 1;
        if (newPosition >= maxPosition) {
            return {
                success: false,
                error: `Cannot move role to position ${newPosition} as it would be higher than my highest role (max position: ${maxPosition})`
            };
        }

        const oldPosition = role.position;
        await role.setPosition(newPosition, { reason });

        return {
            success: true,
            message: `Role ${role.name} moved from position ${oldPosition} to ${newPosition}`,
            role: {
                name: role.name,
                id: role.id,
                oldPosition,
                newPosition: role.position
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to reorder role: ${error.message}`
        };
    }
}

/**
 * Add specific permission(s) to a role (Tool: add_role_permission)
 */
async function addRolePermission(guild, roleId, permissions, reason = 'Permissions added by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
            return { success: false, error: `Role with ID ${roleId} not found` };
        }

        // Check permissions
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return {
                success: false,
                error: 'I don\'t have permission to manage roles. Please grant me the "Manage Roles" permission.'
            };
        }

        if (role.position >= botMember.roles.highest.position) {
            return {
                success: false,
                error: `I cannot manage this role because it's higher than or equal to my highest role in the hierarchy.`
            };
        }

        if (role.managed) {
            return {
                success: false,
                error: 'Cannot modify permissions for managed roles (bot roles, integration roles, etc.)'
            };
        }

        // Get current permissions
        const currentPermissions = role.permissions.toArray();

        // Validate and add new permissions
        const permissionsToAdd = [];
        for (const perm of permissions) {
            if (!PermissionFlagsBits[perm]) {
                return {
                    success: false,
                    error: `Invalid permission: ${perm}`
                };
            }
            if (!currentPermissions.includes(perm)) {
                permissionsToAdd.push(PermissionFlagsBits[perm]);
            }
        }

        // Combine existing and new permissions
        const newPermissions = [...new Set([...currentPermissions.map(p => PermissionFlagsBits[p]), ...permissionsToAdd])];
        await role.setPermissions(newPermissions, reason);

        return {
            success: true,
            message: `Added permissions to role ${role.name}`,
            role: {
                name: role.name,
                id: role.id
            },
            addedPermissions: permissions,
            currentPermissions: role.permissions.toArray()
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to add role permissions: ${error.message}`
        };
    }
}

/**
 * Remove specific permission(s) from a role (Tool: remove_role_permission)
 */
async function removeRolePermission(guild, roleId, permissions, reason = 'Permissions removed by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
            return { success: false, error: `Role with ID ${roleId} not found` };
        }

        // Check permissions
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return {
                success: false,
                error: 'I don\'t have permission to manage roles. Please grant me the "Manage Roles" permission.'
            };
        }

        if (role.position >= botMember.roles.highest.position) {
            return {
                success: false,
                error: `I cannot manage this role because it's higher than or equal to my highest role in the hierarchy.`
            };
        }

        if (role.managed) {
            return {
                success: false,
                error: 'Cannot modify permissions for managed roles (bot roles, integration roles, etc.)'
            };
        }

        // Get current permissions and filter out the ones to remove
        const currentPermissionBits = role.permissions.toArray().map(p => PermissionFlagsBits[p]);
        const permissionsToRemoveBits = permissions.map(p => PermissionFlagsBits[p]).filter(Boolean);

        const newPermissions = currentPermissionBits.filter(bit => !permissionsToRemoveBits.includes(bit));
        await role.setPermissions(newPermissions, reason);

        return {
            success: true,
            message: `Removed permissions from role ${role.name}`,
            role: {
                name: role.name,
                id: role.id
            },
            removedPermissions: permissions,
            currentPermissions: role.permissions.toArray()
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to remove role permissions: ${error.message}`
        };
    }
}

/**
 * Set role hoist status (Tool: hoist_role)
 */
async function hoistRole(guild, roleId, hoisted, reason = 'Role hoist changed by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
            return { success: false, error: `Role with ID ${roleId} not found` };
        }

        // Check permissions
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return {
                success: false,
                error: 'I don\'t have permission to manage roles. Please grant me the "Manage Roles" permission.'
            };
        }

        if (role.position >= botMember.roles.highest.position) {
            return {
                success: false,
                error: `I cannot manage this role because it's higher than or equal to my highest role in the hierarchy.`
            };
        }

        if (role.managed) {
            return {
                success: false,
                error: 'Cannot modify managed roles (bot roles, integration roles, etc.)'
            };
        }

        await role.edit({ hoist: hoisted }, reason);

        return {
            success: true,
            message: `Role ${role.name} is now ${hoisted ? 'hoisted (displayed separately)' : 'not hoisted'}`,
            role: {
                name: role.name,
                id: role.id,
                hoisted: hoisted
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to change role hoist status: ${error.message}`
        };
    }
}

/**
 * Set role mentionable status (Tool: mentionable_role)
 */
async function mentionableRole(guild, roleId, mentionable, reason = 'Role mentionability changed by Sunny') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
            return { success: false, error: `Role with ID ${roleId} not found` };
        }

        // Check permissions
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return {
                success: false,
                error: 'I don\'t have permission to manage roles. Please grant me the "Manage Roles" permission.'
            };
        }

        if (role.position >= botMember.roles.highest.position) {
            return {
                success: false,
                error: `I cannot manage this role because it's higher than or equal to my highest role in the hierarchy.`
            };
        }

        if (role.managed) {
            return {
                success: false,
                error: 'Cannot modify managed roles (bot roles, integration roles, etc.)'
            };
        }

        await role.edit({ mentionable: mentionable }, reason);

        return {
            success: true,
            message: `Role ${role.name} is now ${mentionable ? 'mentionable by everyone' : 'not mentionable'}`,
            role: {
                name: role.name,
                id: role.id,
                mentionable: mentionable
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to change role mentionability: ${error.message}`
        };
    }
}

/**
 * Alias for reorderRoles (Tool: set_role_position)
 */
async function setRolePosition(guild, roleId, position, reason = 'Role position set by Sunny') {
    return await reorderRoles(guild, roleId, position, reason);
}

module.exports = {
    getRoleInfo,
    getRoleMembers,
    updateRolePermissions,
    reorderRoles,
    addRolePermission,
    removeRolePermission,
    hoistRole,
    mentionableRole,
    setRolePosition
};
