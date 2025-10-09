// src/utils/permissions.js

const OWNER_ID = process.env.DISCORD_OWNER_ID;

/**
 * Check if user is the server owner
 */
function isOwner(userId) {
    if (!userId || !OWNER_ID) {
        console.error('Missing user ID or owner ID');
        return false;
    }
    return String(userId) === String(OWNER_ID);
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
    checkPermission
};
