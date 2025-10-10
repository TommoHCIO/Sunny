// src/utils/permissions.js
const { PermissionFlagsBits } = require('discord.js');

// Support multiple owners - comma-separated list in env or single ID
const OWNER_IDS = process.env.DISCORD_OWNER_ID
    ? process.env.DISCORD_OWNER_ID.split(',').map(id => id.trim())
    : [];

/**
 * Check if user is a server owner (supports multiple owners)
 */
function isOwner(userId) {
    if (!userId || OWNER_IDS.length === 0) {
        console.error('Missing user ID or owner ID');
        return false;
    }
    return OWNER_IDS.some(ownerId => String(userId) === String(ownerId));
}

/**
 * Check if command requires owner permissions
 */
function requiresOwner(commandType) {
    const ownerCommands = [
        'create_channel', 'delete_channel', 'rename_channel',
        'ban', 'unban', 'configure_bot', 'server_settings'
    ];
    return ownerCommands.includes(commandType);
}

/**
 * Check if bot has required permission in guild
 * @param {Guild} guild - Discord guild object
 * @param {string} permission - Permission flag name (e.g., 'ModerateMembers')
 * @returns {boolean} Whether bot has the permission
 */
function hasBotPermission(guild, permission) {
    if (!guild || !guild.members || !guild.members.me) {
        console.error('❌ Invalid guild or bot member object');
        return false;
    }
    
    const botMember = guild.members.me;
    const permissionFlag = PermissionFlagsBits[permission];
    
    if (!permissionFlag) {
        console.error(`❌ Unknown permission flag: ${permission}`);
        return false;
    }
    
    return botMember.permissions.has(permissionFlag);
}

/**
 * Check if bot can timeout members (requires ModerateMembers permission)
 * @param {Guild} guild - Discord guild object
 * @returns {boolean} Whether bot can timeout
 */
function canTimeout(guild) {
    return hasBotPermission(guild, 'ModerateMembers');
}

/**
 * Check if bot can kick members
 * @param {Guild} guild - Discord guild object
 * @returns {boolean} Whether bot can kick
 */
function canKick(guild) {
    return hasBotPermission(guild, 'KickMembers');
}

/**
 * Check if bot can ban members
 * @param {Guild} guild - Discord guild object
 * @returns {boolean} Whether bot can ban
 */
function canBan(guild) {
    return hasBotPermission(guild, 'BanMembers');
}

/**
 * Get list of missing critical permissions
 * @param {Guild} guild - Discord guild object
 * @returns {Array<string>} Array of missing permission names
 */
function getMissingCriticalPermissions(guild) {
    const criticalPermissions = [
        'ModerateMembers',  // For timeouts
        'ManageRoles',      // For role management
        'ManageChannels',   // For channel management
        'ManageMessages',   // For message moderation
        'ViewAuditLog'      // For logging
    ];
    
    const missing = [];
    for (const perm of criticalPermissions) {
        if (!hasBotPermission(guild, perm)) {
            missing.push(perm);
        }
    }
    
    return missing;
}

/**
 * Check if user has permission for command
 */
async function checkPermission(message, commandType) {
    if (requiresOwner(commandType)) {
        if (!isOwner(message.author.id)) {
            await message.reply(
                "I can't do that! Only our server owner can manage channels, bans, and server settings. 🍂 Is there something else I can help with?"
            );
            return false;
        }
    }
    return true;
}

module.exports = {
    isOwner,
    requiresOwner,
    checkPermission,
    hasBotPermission,
    canTimeout,
    canKick,
    canBan,
    getMissingCriticalPermissions
};
