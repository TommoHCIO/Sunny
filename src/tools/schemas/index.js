// src/tools/schemas/index.js
/**
 * Zod Validation Schemas for Tool Inputs
 * Provides type-safe validation for all Discord tool operations
 */

const { z } = require('zod');

// ===== BASE SCHEMAS =====

// Discord snowflake ID (17-19 digit string)
const snowflakeId = z.string().regex(/^\d{17,19}$/, 'Invalid Discord ID format');

// Channel name (Discord requirements)
const channelName = z.string()
    .min(1, 'Channel name required')
    .max(100, 'Channel name must be 100 characters or less')
    .regex(/^[a-z0-9_-]+$/, 'Channel name can only contain lowercase letters, numbers, hyphens, and underscores');

// Role name
const roleName = z.string()
    .min(1, 'Role name required')
    .max(100, 'Role name must be 100 characters or less');

// Username/display name
const username = z.string()
    .min(1, 'Username required')
    .max(32, 'Username must be 32 characters or less');

// Hex color (with or without #)
const hexColor = z.string()
    .regex(/^#?[0-9A-Fa-f]{6}$/, 'Invalid hex color format')
    .transform(val => val.startsWith('#') ? val : `#${val}`);

// URL validation
const url = z.string().url('Invalid URL format');

// Duration in various formats
const duration = z.union([
    z.number().positive('Duration must be positive'),
    z.string().regex(/^\d+[smhd]?$/, 'Invalid duration format (use: 60, 60s, 5m, 1h, 1d)')
]).transform(val => {
    if (typeof val === 'number') return val;
    const num = parseInt(val);
    const unit = val.slice(-1);
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return num * (multipliers[unit] || 1);
});

// ===== CHANNEL SCHEMAS =====

const channelSchemas = {
    create_channel: z.object({
        channel_name: channelName,
        channel_type: z.enum(['text', 'voice', 'forum', 'stage', 'announcement']).default('text'),
        category_name: z.string().max(100).optional(),
        topic: z.string().max(1024).optional(),
        nsfw: z.boolean().optional(),
        slowmode: z.number().min(0).max(21600).optional()
    }),

    delete_channel: z.object({
        channel_name: z.string().min(1, 'Channel name or ID required')
    }),

    rename_channel: z.object({
        old_name: z.string().min(1, 'Current channel name required'),
        new_name: channelName
    }),

    create_category: z.object({
        category_name: z.string().min(1).max(100, 'Category name must be 100 characters or less')
    }),

    delete_category: z.object({
        category_name: z.string().min(1, 'Category name required')
    }),

    move_channel: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        category_name: z.string().min(1, 'Category name required')
    }),

    set_channel_topic: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        topic: z.string().max(1024, 'Topic must be 1024 characters or less')
    }),

    set_slowmode: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        seconds: z.number().min(0).max(21600, 'Slowmode must be 0-21600 seconds')
    }),

    get_channel_info: z.object({
        channel_name: z.string().min(1, 'Channel name required')
    })
};

// ===== ROLE SCHEMAS =====

const roleSchemas = {
    create_role: z.object({
        role_name: roleName,
        color: hexColor.optional(),
        hoist: z.boolean().optional(),
        mentionable: z.boolean().optional(),
        permissions: z.array(z.string()).optional()
    }),

    delete_role: z.object({
        role_name: roleName
    }),

    rename_role: z.object({
        old_name: roleName,
        new_name: roleName
    }),

    set_role_color: z.object({
        role_name: roleName,
        color: hexColor
    }),

    assign_role: z.object({
        username: z.string().min(1, 'Username required'),
        role_name: roleName
    }),

    remove_role: z.object({
        username: z.string().min(1, 'Username required'),
        role_name: roleName
    }),

    get_role_info: z.object({
        role_name: roleName
    })
};

// ===== MEMBER SCHEMAS =====

const memberSchemas = {
    timeout_member: z.object({
        username: z.string().min(1, 'Username required'),
        duration: duration,
        reason: z.string().max(512).optional()
    }),

    remove_timeout: z.object({
        username: z.string().min(1, 'Username required'),
        reason: z.string().max(512).optional()
    }),

    kick_member: z.object({
        username: z.string().min(1, 'Username required'),
        reason: z.string().max(512).optional()
    }),

    ban_member: z.object({
        username: z.string().min(1, 'Username required'),
        reason: z.string().max(512).optional(),
        delete_messages: z.boolean().optional()
    }),

    unban_member: z.object({
        user_id: snowflakeId.optional(),
        username: z.string().optional()
    }).refine(data => data.user_id || data.username, {
        message: 'Either user_id or username is required'
    }),

    set_nickname: z.object({
        username: z.string().min(1, 'Username required'),
        nickname: z.string().max(32, 'Nickname must be 32 characters or less').nullable()
    }),

    get_member_info: z.object({
        username: z.string().min(1, 'Username required')
    }),

    search_members: z.object({
        query: z.string().min(1, 'Search query required'),
        limit: z.number().min(1).max(1000).optional()
    })
};

// ===== MESSAGE SCHEMAS =====

const messageSchemas = {
    send_message: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        content: z.string().min(1).max(2000, 'Message must be 2000 characters or less')
    }),

    send_embed: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        title: z.string().max(256).optional(),
        description: z.string().max(4096).optional(),
        color: hexColor.optional(),
        fields: z.array(z.object({
            name: z.string().min(1).max(256),
            value: z.string().min(1).max(1024),
            inline: z.boolean().optional()
        })).max(25).optional(),
        footer: z.string().max(2048).optional(),
        thumbnail: url.optional(),
        image: url.optional(),
        timestamp: z.boolean().optional()
    }).refine(data => data.title || data.description, {
        message: 'Either title or description is required'
    }),

    edit_message: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId,
        content: z.string().max(2000).optional(),
        embed: z.object({}).passthrough().optional()
    }),

    delete_message: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId
    }),

    pin_message: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId
    }),

    unpin_message: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId
    }),

    purge_messages: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        count: z.number().min(1).max(100, 'Can only purge 1-100 messages at once')
    }),

    get_channel_messages: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        limit: z.number().min(1).max(100).optional(),
        before: snowflakeId.optional(),
        after: snowflakeId.optional()
    })
};

// ===== REACTION SCHEMAS =====

const reactionSchemas = {
    add_reaction: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId,
        emoji: z.string().min(1, 'Emoji required')
    }),

    remove_reaction: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId,
        emoji: z.string().min(1, 'Emoji required'),
        user_id: snowflakeId.optional()
    }),

    remove_all_reactions: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId
    }),

    setup_reaction_role: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId,
        emoji: z.string().min(1, 'Emoji required'),
        role_name: roleName
    }),

    remove_reaction_role: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId,
        emoji: z.string().min(1, 'Emoji required')
    })
};

// ===== THREAD SCHEMAS =====

const threadSchemas = {
    create_thread: z.object({
        channel_name: z.string().min(1, 'Channel name required'),
        message_id: snowflakeId.optional(),
        thread_name: z.string().min(1).max(100, 'Thread name must be 100 characters or less'),
        auto_archive_duration: z.enum(['60', '1440', '4320', '10080']).optional()
    }),

    archive_thread: z.object({
        thread_name: z.string().min(1, 'Thread name required')
    }),

    lock_thread: z.object({
        thread_name: z.string().min(1, 'Thread name required'),
        locked: z.boolean().optional()
    }),

    delete_thread: z.object({
        thread_name: z.string().min(1, 'Thread name required')
    })
};

// ===== EVENT SCHEMAS =====

const eventSchemas = {
    create_event: z.object({
        name: z.string().min(1).max(100, 'Event name must be 100 characters or less'),
        description: z.string().max(1000).optional(),
        start_time: z.string().min(1, 'Start time required'),
        end_time: z.string().optional(),
        location: z.string().max(100).optional(),
        channel_name: z.string().optional(),
        image_url: url.optional()
    }),

    edit_event: z.object({
        event_name: z.string().min(1, 'Event name required'),
        new_name: z.string().max(100).optional(),
        description: z.string().max(1000).optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional()
    }),

    delete_event: z.object({
        event_name: z.string().min(1, 'Event name required')
    }),

    start_event: z.object({
        event_name: z.string().min(1, 'Event name required')
    }),

    end_event: z.object({
        event_name: z.string().min(1, 'Event name required')
    })
};

// ===== EMOJI/STICKER SCHEMAS =====

const assetSchemas = {
    create_emoji: z.object({
        name: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/, 'Emoji name can only contain letters, numbers, and underscores'),
        image_url: url
    }),

    delete_emoji: z.object({
        emoji_name: z.string().min(1, 'Emoji name required')
    }),

    edit_emoji: z.object({
        emoji_name: z.string().min(1, 'Emoji name required'),
        new_name: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/).optional()
    }),

    create_sticker: z.object({
        name: z.string().min(2).max(30, 'Sticker name must be 2-30 characters'),
        description: z.string().max(100).optional(),
        tags: z.string().min(1, 'At least one tag required'),
        image_url: url
    }),

    edit_sticker: z.object({
        sticker_name: z.string().min(1, 'Sticker name required'),
        new_name: z.string().min(2).max(30).optional(),
        description: z.string().max(100).optional(),
        tags: z.string().optional()
    }),

    delete_sticker: z.object({
        sticker_name: z.string().min(1, 'Sticker name required')
    })
};

// ===== TICKET SCHEMAS =====

const ticketSchemas = {
    create_ticket: z.object({
        category: z.string().min(1, 'Category required'),
        subject: z.string().min(1).max(100, 'Subject must be 100 characters or less'),
        description: z.string().max(2000).optional()
    }),

    close_ticket: z.object({
        ticket_id: z.string().min(1, 'Ticket ID required'),
        reason: z.string().max(500).optional()
    }),

    assign_ticket: z.object({
        ticket_id: z.string().min(1, 'Ticket ID required'),
        assignee: z.string().min(1, 'Assignee username required')
    }),

    update_ticket_priority: z.object({
        ticket_id: z.string().min(1, 'Ticket ID required'),
        priority: z.enum(['low', 'normal', 'high', 'urgent'])
    }),

    add_ticket_tag: z.object({
        ticket_id: z.string().min(1, 'Ticket ID required'),
        tag: z.string().min(1).max(50, 'Tag must be 50 characters or less')
    })
};

// ===== AUTO MESSAGE SCHEMAS =====

const autoMessageSchemas = {
    create_auto_message: z.object({
        message_type: z.enum(['welcome', 'goodbye', 'scheduled', 'triggered']),
        channel_name: z.string().min(1, 'Channel name required'),
        content: z.string().max(2000).optional(),
        embed: z.object({}).passthrough().optional(),
        schedule: z.string().optional(),
        triggers: z.array(z.string()).optional()
    }).refine(data => data.content || data.embed, {
        message: 'Either content or embed is required'
    }),

    update_auto_message: z.object({
        message_id: z.string().min(1, 'Message ID required'),
        content: z.string().max(2000).optional(),
        embed: z.object({}).passthrough().optional(),
        enabled: z.boolean().optional()
    }),

    delete_auto_message: z.object({
        message_id: z.string().min(1, 'Message ID required')
    })
};

// ===== GAME SCHEMAS =====

const gameSchemas = {
    generate_trivia_question: z.object({
        category: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional()
    }),

    start_trivia: z.object({
        category: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        question_count: z.number().min(1).max(20).optional()
    }),

    create_poll: z.object({
        question: z.string().min(1).max(300, 'Question must be 300 characters or less'),
        options: z.array(z.string().min(1).max(100)).min(2).max(10),
        duration: z.number().min(60).max(604800).optional()
    }),

    start_rps: z.object({
        opponent: z.string().optional()
    }),

    start_number_guess: z.object({
        max_number: z.number().min(10).max(1000000).optional(),
        max_attempts: z.number().min(1).max(50).optional()
    }),

    roll_dice: z.object({
        sides: z.number().min(2).max(1000).optional(),
        count: z.number().min(1).max(100).optional()
    }),

    flip_coin: z.object({
        count: z.number().min(1).max(100).optional()
    })
};

// ===== SERVER INSPECTION SCHEMAS =====

const inspectionSchemas = {
    list_channels: z.object({
        type: z.enum(['text', 'voice', 'category', 'all']).optional()
    }),

    list_roles: z.object({
        include_everyone: z.boolean().optional()
    }),

    list_members: z.object({
        limit: z.number().min(1).max(1000).optional(),
        role: z.string().optional()
    }),

    get_server_info: z.object({}),

    audit_permissions: z.object({
        channel_name: z.string().optional()
    })
};

// ===== COMBINED SCHEMA MAP =====

const schemas = {
    ...channelSchemas,
    ...roleSchemas,
    ...memberSchemas,
    ...messageSchemas,
    ...reactionSchemas,
    ...threadSchemas,
    ...eventSchemas,
    ...assetSchemas,
    ...ticketSchemas,
    ...autoMessageSchemas,
    ...gameSchemas,
    ...inspectionSchemas
};

/**
 * Validate tool input against its schema
 * @param {string} toolName - Name of the tool
 * @param {Object} input - Input to validate
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function validateToolInput(toolName, input) {
    const schema = schemas[toolName];

    if (!schema) {
        // No schema defined - allow passthrough with warning
        console.warn(`[Validation] No schema defined for tool: ${toolName}`);
        return { success: true, data: input };
    }

    try {
        const validated = schema.parse(input);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            return { success: false, error: messages.join('; ') };
        }
        return { success: false, error: error.message };
    }
}

/**
 * Get schema for a tool
 * @param {string} toolName - Name of the tool
 * @returns {z.ZodSchema|null}
 */
function getSchema(toolName) {
    return schemas[toolName] || null;
}

/**
 * Check if a tool has a schema defined
 * @param {string} toolName - Name of the tool
 * @returns {boolean}
 */
function hasSchema(toolName) {
    return toolName in schemas;
}

module.exports = {
    schemas,
    validateToolInput,
    getSchema,
    hasSchema,
    // Export individual schema groups for direct access
    channelSchemas,
    roleSchemas,
    memberSchemas,
    messageSchemas,
    reactionSchemas,
    threadSchemas,
    eventSchemas,
    assetSchemas,
    ticketSchemas,
    autoMessageSchemas,
    gameSchemas,
    inspectionSchemas,
    // Export base schemas for reuse
    snowflakeId,
    channelName,
    roleName,
    username,
    hexColor,
    url,
    duration
};
