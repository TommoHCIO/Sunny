// src/services/reactionRoleService.js
/**
 * Reaction Role Service - Manages automatic role assignment based on reactions
 * Stores reaction role mappings and handles reaction events
 */

// In-memory storage for reaction roles
// Format: { messageId: { emoji: roleName } }
const reactionRoles = new Map();

/**
 * Set up a reaction role binding
 * @param {Guild} guild - Discord guild object
 * @param {Object} input - Input parameters (messageId, channelName, emoji, roleName)
 * @returns {Object} Result object
 */
async function setupReactionRole(guild, input) {
    try {
        const { messageId, channelName, emoji, roleName } = input;

        // Find the channel - handles both channel names and IDs
        let channel = null;
        if (channelName) {
            // Try to find by ID first (if identifier looks like a snowflake ID)
            if (/^\d{17,19}$/.test(channelName)) {
                channel = guild.channels.cache.get(channelName);
            }
            // If not found by ID, try by name (case-insensitive)
            if (!channel) {
                channel = guild.channels.cache.find(c => c.name.toLowerCase() === channelName.toLowerCase());
            }
        }

        if (channelName && !channel) {
            return { success: false, error: `Channel "${channelName}" not found. Provide either channel name or channel ID.` };
        }

        // Verify the role exists or create it
        let role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

        if (!role) {
            // Auto-create the role if it doesn't exist
            role = await guild.roles.create({
                name: roleName,
                reason: `Auto-created by Sunny for reaction role setup`
            });
        }

        // If channel is provided, verify the message exists and add the reaction
        if (channel) {
            try {
                const message = await channel.messages.fetch(messageId);
                await message.react(emoji);
            } catch (error) {
                return { success: false, error: `Failed to react to message: ${error.message}` };
            }
        }

        // Store the reaction role mapping
        if (!reactionRoles.has(messageId)) {
            reactionRoles.set(messageId, new Map());
        }

        const messageRoles = reactionRoles.get(messageId);
        messageRoles.set(emoji, roleName);

        console.log(`✅ Set up reaction role: ${emoji} → ${roleName} on message ${messageId}`);

        return {
            success: true,
            message: `Set up reaction role: React with ${emoji} to get the ${roleName} role`,
            message_id: messageId,
            emoji: emoji,
            role: roleName
        };
    } catch (error) {
        return { success: false, error: `Failed to setup reaction role: ${error.message}` };
    }
}

/**
 * Remove a reaction role binding
 * @param {Object} input - Input parameters (messageId, emoji)
 * @returns {Object} Result object
 */
async function removeReactionRole(input) {
    try {
        const { messageId, emoji } = input;

        if (!reactionRoles.has(messageId)) {
            return { success: false, error: `No reaction roles found for message ${messageId}` };
        }

        const messageRoles = reactionRoles.get(messageId);

        if (!messageRoles.has(emoji)) {
            return { success: false, error: `No reaction role found for emoji ${emoji} on message ${messageId}` };
        }

        const roleName = messageRoles.get(emoji);
        messageRoles.delete(emoji);

        // If no more roles for this message, remove the message entry
        if (messageRoles.size === 0) {
            reactionRoles.delete(messageId);
        }

        console.log(`✅ Removed reaction role: ${emoji} → ${roleName} from message ${messageId}`);

        return {
            success: true,
            message: `Removed reaction role binding for ${emoji}`,
            role: roleName
        };
    } catch (error) {
        return { success: false, error: `Failed to remove reaction role: ${error.message}` };
    }
}

/**
 * List all reaction roles in the server
 * @param {Guild} guild - Discord guild object
 * @returns {Object} Result object with list of reaction roles
 */
async function listReactionRoles(guild) {
    try {
        const roleList = [];

        for (const [messageId, emojiMap] of reactionRoles.entries()) {
            for (const [emoji, roleName] of emojiMap.entries()) {
                roleList.push({
                    message_id: messageId,
                    emoji: emoji,
                    role: roleName
                });
            }
        }

        return {
            success: true,
            reaction_roles: roleList,
            total: roleList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list reaction roles: ${error.message}` };
    }
}

/**
 * Handle reaction add event - assign role to user
 * @param {MessageReaction} reaction - The reaction object
 * @param {User} user - The user who reacted
 * @param {Guild} guild - The guild object
 */
async function handleReactionAdd(reaction, user, guild) {
    try {
        // Ignore bot reactions
        if (user.bot) return;

        const messageId = reaction.message.id;
        const emoji = reaction.emoji.name || reaction.emoji.toString();

        // Check if this message has reaction roles set up
        if (!reactionRoles.has(messageId)) return;

        const messageRoles = reactionRoles.get(messageId);

        // Check if this emoji is mapped to a role
        if (!messageRoles.has(emoji)) return;

        const roleName = messageRoles.get(emoji);

        // Find the role
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

        if (!role) {
            console.error(`❌ Role "${roleName}" not found for reaction role`);
            return;
        }

        // Get the member and assign the role
        const member = await guild.members.fetch(user.id);
        await member.roles.add(role);

        console.log(`✅ Assigned role "${roleName}" to ${user.username} via reaction role`);
    } catch (error) {
        console.error(`❌ Error handling reaction add:`, error);
    }
}

/**
 * Handle reaction remove event - remove role from user
 * @param {MessageReaction} reaction - The reaction object
 * @param {User} user - The user who removed their reaction
 * @param {Guild} guild - The guild object
 */
async function handleReactionRemove(reaction, user, guild) {
    try {
        // Ignore bot reactions
        if (user.bot) return;

        const messageId = reaction.message.id;
        const emoji = reaction.emoji.name || reaction.emoji.toString();

        // Check if this message has reaction roles set up
        if (!reactionRoles.has(messageId)) return;

        const messageRoles = reactionRoles.get(messageId);

        // Check if this emoji is mapped to a role
        if (!messageRoles.has(emoji)) return;

        const roleName = messageRoles.get(emoji);

        // Find the role
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

        if (!role) {
            console.error(`❌ Role "${roleName}" not found for reaction role`);
            return;
        }

        // Get the member and remove the role
        const member = await guild.members.fetch(user.id);
        await member.roles.remove(role);

        console.log(`✅ Removed role "${roleName}" from ${user.username} via reaction role`);
    } catch (error) {
        console.error(`❌ Error handling reaction remove:`, error);
    }
}

module.exports = {
    setupReactionRole,
    removeReactionRole,
    listReactionRoles,
    handleReactionAdd,
    handleReactionRemove
};
