// src/services/reactionRoleService.js
/**
 * Reaction Role Service - Manages automatic role assignment based on reactions
 * Stores reaction role mappings and handles reaction events
 * Now with MongoDB persistence for reliability across bot restarts
 */

const { z } = require('zod');
const databaseService = require('./database/databaseService');

// Input validation schemas
const setupReactionRoleSchema = z.object({
    messageId: z.string()
        .regex(/^\d{17,19}$/, 'Message ID must be a valid Discord snowflake (17-19 digits)'),
    channelName: z.string()
        .min(1, 'Channel name/ID cannot be empty')
        .optional(),
    emoji: z.string()
        .min(1, 'Emoji cannot be empty')
        .max(100, 'Emoji too long'),
    roleName: z.string()
        .min(1, 'Role name cannot be empty')
        .max(100, 'Role name too long (max 100 characters)')
});

const removeReactionRoleSchema = z.object({
    messageId: z.string()
        .regex(/^\d{17,19}$/, 'Message ID must be a valid Discord snowflake'),
    emoji: z.string()
        .min(1, 'Emoji cannot be empty')
});

// In-memory storage for reaction roles (for fast lookup)
// Format: { messageId: { emoji: roleName } }
const reactionRoles = new Map();

/**
 * Set up a reaction role binding
 * 
 * Creates a mapping between a message reaction and a role assignment.
 * When users react with the specified emoji, they automatically receive the role.
 * 
 * Process:
 * 1. Validates input parameters using Zod schema
 * 2. Locates the channel (by name or ID)
 * 3. Finds or auto-creates the role
 * 4. Adds bot's reaction to the message
 * 5. Stores mapping in memory and MongoDB
 * 
 * @param {import('discord.js').Guild} guild - Discord guild where reaction role is being set up
 * @param {Object} input - Configuration for the reaction role
 * @param {string} input.messageId - Discord message ID (snowflake format, 17-19 digits)
 * @param {string} [input.channelName] - Channel name or ID (optional, for validation)
 * @param {string} input.emoji - Emoji to react with (Unicode or custom emoji)
 * @param {string} input.roleName - Name of role to assign (will be created if doesn't exist)
 * @returns {Promise<Object>} Result object with success status and details
 * @returns {boolean} return.success - Whether operation succeeded
 * @returns {string} [return.message] - Success message for user
 * @returns {string} [return.error] - Error message if operation failed
 * @returns {string} [return.message_id] - Message ID where reaction role was set up
 * @returns {string} [return.emoji] - Emoji used for the reaction role
 * @returns {string} [return.role] - Role name assigned
 * 
 * @example
 * const result = await setupReactionRole(guild, {
 *   messageId: '1234567890123456789',
 *   channelName: 'welcome',
 *   emoji: '👋',
 *   roleName: 'Member'
 * });
 * console.log(result.message); // "Set up reaction role: React with 👋 to get the Member role"
 */
async function setupReactionRole(guild, input) {
    try {
        // Validate input
        const validationResult = setupReactionRoleSchema.safeParse(input);
        if (!validationResult.success) {
            const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            return { 
                success: false, 
                error: `Input validation failed: ${errors.join(', ')}` 
            };
        }
        
        const { messageId, channelName, emoji, roleName } = validationResult.data;

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

        // Store the reaction role mapping in memory
        if (!reactionRoles.has(messageId)) {
            reactionRoles.set(messageId, new Map());
        }

        const messageRoles = reactionRoles.get(messageId);
        messageRoles.set(emoji, roleName);

        // Persist to database for survival across bot restarts
        const channelId = channel ? channel.id : null;
        await databaseService.saveReactionRole(messageId, channelId, guild.id, emoji, roleName);

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
 * 
 * Deletes a specific reaction role mapping from both memory and database.
 * Users will no longer receive the role when reacting with this emoji.
 * 
 * @param {Object} input - Parameters identifying which reaction role to remove
 * @param {string} input.messageId - Discord message ID (snowflake format)
 * @param {string} input.emoji - Emoji to remove from reaction roles
 * @returns {Promise<Object>} Result object
 * @returns {boolean} return.success - Whether operation succeeded
 * @returns {string} [return.message] - Success message
 * @returns {string} [return.error] - Error message if operation failed
 * @returns {string} [return.role] - Name of role that was removed
 * 
 * @example
 * const result = await removeReactionRole({
 *   messageId: '1234567890123456789',
 *   emoji: '👋'
 * });
 */
async function removeReactionRole(input) {
    try {
        // Validate input
        const validationResult = removeReactionRoleSchema.safeParse(input);
        if (!validationResult.success) {
            const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            return { 
                success: false, 
                error: `Input validation failed: ${errors.join(', ')}` 
            };
        }
        
        const { messageId, emoji } = validationResult.data;

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

        // Delete from database
        await databaseService.deleteReactionRole(messageId, emoji);

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
 * 
 * Returns all currently configured reaction role mappings for the guild.
 * 
 * @param {import('discord.js').Guild} guild - Discord guild to query
 * @returns {Promise<Object>} Result object containing reaction role list
 * @returns {boolean} return.success - Whether operation succeeded
 * @returns {Array<Object>} return.reaction_roles - Array of reaction role configurations
 * @returns {string} return.reaction_roles[].message_id - Message ID
 * @returns {string} return.reaction_roles[].emoji - Emoji used
 * @returns {string} return.reaction_roles[].role - Role name assigned
 * @returns {number} return.total - Total count of reaction roles
 * @returns {string} [return.error] - Error message if operation failed
 * 
 * @example
 * const result = await listReactionRoles(guild);
 * console.log(`Found ${result.total} reaction roles`);
 * result.reaction_roles.forEach(rr => {
 *   console.log(`${rr.emoji} → ${rr.role}`);
 * });
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
 * 
 * Automatically called when a user adds a reaction to a message.
 * Checks if the reaction matches a configured reaction role and assigns
 * the corresponding role to the user.
 * 
 * @param {import('discord.js').MessageReaction} reaction - Discord reaction object
 * @param {import('discord.js').User} user - User who added the reaction
 * @param {import('discord.js').Guild} guild - Guild where reaction occurred
 * @returns {Promise<void>}
 * 
 * @example
 * // Called automatically by Discord.js event handler
 * client.on('messageReactionAdd', async (reaction, user) => {
 *   await handleReactionAdd(reaction, user, reaction.message.guild);
 * });
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
 * 
 * Automatically called when a user removes a reaction from a message.
 * Checks if the reaction matches a configured reaction role and removes
 * the corresponding role from the user.
 * 
 * @param {import('discord.js').MessageReaction} reaction - Discord reaction object
 * @param {import('discord.js').User} user - User who removed the reaction
 * @param {import('discord.js').Guild} guild - Guild where reaction was removed
 * @returns {Promise<void>}
 * 
 * @example
 * // Called automatically by Discord.js event handler
 * client.on('messageReactionRemove', async (reaction, user) => {
 *   await handleReactionRemove(reaction, user, reaction.message.guild);
 * });
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

/**
 * Load all reaction roles from database on bot startup
 * 
 * Initializes the in-memory reaction role cache from persistent storage.
 * Should be called once during bot initialization to restore reaction roles
 * that were configured before the bot restarted.
 * 
 * @param {import('discord.js').Client} client - Discord client instance
 * @returns {Promise<Object>} Result object with load statistics
 * @returns {boolean} return.success - Whether operation succeeded
 * @returns {number} return.count - Number of reaction roles loaded
 * @returns {number} [return.errors] - Number of reaction roles that failed to load
 * @returns {string} [return.error] - Error message if operation failed
 * 
 * @example
 * // During bot startup
 * client.once('ready', async () => {
 *   const result = await loadReactionRoles(client);
 *   console.log(`Loaded ${result.count} reaction roles`);
 * });
 */
async function loadReactionRoles(client) {
    try {
        console.log('📥 Loading reaction roles from database...');
        
        const allRoles = await databaseService.getAllReactionRoles();
        
        if (!allRoles || allRoles.length === 0) {
            console.log('📭 No reaction roles found in database');
            return { success: true, count: 0 };
        }

        let loadedCount = 0;
        let errorCount = 0;

        for (const roleData of allRoles) {
            try {
                // Store in memory Map
                if (!reactionRoles.has(roleData.messageId)) {
                    reactionRoles.set(roleData.messageId, new Map());
                }
                
                const messageRoles = reactionRoles.get(roleData.messageId);
                messageRoles.set(roleData.emoji, roleData.roleName);
                
                loadedCount++;
            } catch (error) {
                console.error(`❌ Failed to load reaction role: ${roleData.emoji} → ${roleData.roleName}`, error);
                errorCount++;
            }
        }

        console.log(`✅ Loaded ${loadedCount} reaction role(s) from database`);
        if (errorCount > 0) {
            console.log(`⚠️  Failed to load ${errorCount} reaction role(s)`);
        }

        return { success: true, count: loadedCount, errors: errorCount };
    } catch (error) {
        console.error('❌ Error loading reaction roles from database:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    setupReactionRole,
    removeReactionRole,
    listReactionRoles,
    handleReactionAdd,
    handleReactionRemove,
    loadReactionRoles
};
