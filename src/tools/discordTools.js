// src/tools/discordTools.js
/**
 * Discord Tool Definitions for Claude AI Agent
 * Defines all Discord operations as Claude tools with JSON schemas
 * Organized by category: Inspection, Channels, Roles, Members, Threads, Events
 */

/**
 * Get all Discord tools available to Claude
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of tool definitions
 */
function getDiscordTools(guild) {
    return [
        // ===== SERVER INSPECTION TOOLS (READ-ONLY) =====
        {
            name: "list_channels",
            description: "List all channels, categories, and threads in the server. Use this BEFORE creating, deleting, or modifying channels to see what currently exists. Returns channel names, types, categories, and topics.",
            input_schema: {
                type: "object",
                properties: {
                    filter_type: {
                        type: "string",
                        enum: ["text", "voice", "category", "forum", "stage", "thread", "all"],
                        description: "Filter by channel type. Use 'all' to see everything."
                    },
                    include_ids: {
                        type: "boolean",
                        description: "Include channel IDs in the response (useful for moderation actions)"
                    }
                },
                required: []
            }
        },
        {
            name: "list_roles",
            description: "List all roles in the server with their colors, permissions, and member counts. Use this to see what roles exist before creating or modifying roles.",
            input_schema: {
                type: "object",
                properties: {
                    include_permissions: {
                        type: "boolean",
                        description: "Include detailed permission list for each role"
                    }
                },
                required: []
            }
        },
        {
            name: "list_members",
            description: "Get information about server members including their roles, online status, and join date. Useful for moderation and member management.",
            input_schema: {
                type: "object",
                properties: {
                    online_only: {
                        type: "boolean",
                        description: "Only show members who are currently online"
                    },
                    role_filter: {
                        type: "string",
                        description: "Filter members by role name"
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of members to return (default: 50)"
                    }
                },
                required: []
            }
        },
        {
            name: "get_channel_info",
            description: "Get detailed information about a specific channel including permissions, topic, slowmode, and member access.",
            input_schema: {
                type: "object",
                properties: {
                    channel_name: {
                        type: "string",
                        description: "Name of the channel to inspect"
                    }
                },
                required: ["channel_name"]
            }
        },

        // ===== CHANNEL MANAGEMENT TOOLS =====
        {
            name: "create_channel",
            description: "Create a new text, voice, or announcement channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name for the new channel"
                    },
                    channelType: {
                        type: "string",
                        enum: ["text", "voice", "announcement"],
                        description: "Type of channel to create"
                    },
                    categoryName: {
                        type: "string",
                        description: "Optional: Category to place the channel in"
                    },
                    topic: {
                        type: "string",
                        description: "Optional: Topic/description for the channel"
                    }
                },
                required: ["channelName", "channelType"]
            }
        },
        {
            name: "delete_channel",
            description: "Delete a channel from the server. Requires owner permissions. Use list_channels first to see what channels exist.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Exact name of the channel to delete"
                    }
                },
                required: ["channelName"]
            }
        },
        {
            name: "rename_channel",
            description: "Rename an existing channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    oldName: {
                        type: "string",
                        description: "Current name of the channel"
                    },
                    newName: {
                        type: "string",
                        description: "New name for the channel"
                    }
                },
                required: ["oldName", "newName"]
            }
        },
        {
            name: "create_category",
            description: "Create a new category to organize channels. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    categoryName: {
                        type: "string",
                        description: "Name for the new category"
                    }
                },
                required: ["categoryName"]
            }
        },
        {
            name: "delete_category",
            description: "Delete a category and optionally its channels. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    categoryName: {
                        type: "string",
                        description: "Name of the category to delete"
                    }
                },
                required: ["categoryName"]
            }
        },
        {
            name: "move_channel",
            description: "Move a channel to a different category. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name of the channel to move"
                    },
                    categoryName: {
                        type: "string",
                        description: "Name of the category to move it to"
                    }
                },
                required: ["channelName", "categoryName"]
            }
        },
        {
            name: "set_channel_topic",
            description: "Set or update the topic/description of a channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name of the channel"
                    },
                    topic: {
                        type: "string",
                        description: "New topic/description for the channel"
                    }
                },
                required: ["channelName", "topic"]
            }
        },
        {
            name: "set_slowmode",
            description: "Set slowmode delay for a channel (rate limiting). Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name of the channel"
                    },
                    seconds: {
                        type: "number",
                        description: "Slowmode delay in seconds (0-21600)"
                    }
                },
                required: ["channelName", "seconds"]
            }
        },
        {
            name: "set_channel_nsfw",
            description: "Mark a channel as NSFW or remove NSFW status. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name of the channel"
                    },
                    nsfw: {
                        type: "boolean",
                        description: "true to mark as NSFW, false to remove"
                    }
                },
                required: ["channelName", "nsfw"]
            }
        },

        // ===== ROLE MANAGEMENT TOOLS =====
        {
            name: "create_role",
            description: "Create a new role in the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name for the new role"
                    },
                    color: {
                        type: "string",
                        description: "Hex color code for the role (e.g., #FF6B35)"
                    },
                    hoist: {
                        type: "boolean",
                        description: "Display role members separately in the member list"
                    }
                },
                required: ["roleName"]
            }
        },
        {
            name: "delete_role",
            description: "Delete a role from the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name of the role to delete"
                    }
                },
                required: ["roleName"]
            }
        },
        {
            name: "rename_role",
            description: "Rename an existing role. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    oldName: {
                        type: "string",
                        description: "Current name of the role"
                    },
                    newName: {
                        type: "string",
                        description: "New name for the role"
                    }
                },
                required: ["oldName", "newName"]
            }
        },
        {
            name: "set_role_color",
            description: "Change the color of a role. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name of the role"
                    },
                    color: {
                        type: "string",
                        description: "Hex color code (e.g., #FF6B35)"
                    }
                },
                required: ["roleName", "color"]
            }
        },
        {
            name: "assign_role",
            description: "Assign a role to a member. Anyone can request self-assignable roles for themselves. Owner can assign any role to anyone.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name of the role to assign"
                    },
                    userId: {
                        type: "string",
                        description: "Optional: Discord user ID. If not provided, assigns to the current user."
                    }
                },
                required: ["roleName"]
            }
        },
        {
            name: "remove_role",
            description: "Remove a role from a member. Anyone can remove their own self-assignable roles.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name of the role to remove"
                    },
                    userId: {
                        type: "string",
                        description: "Optional: Discord user ID. If not provided, removes from current user."
                    }
                },
                required: ["roleName"]
            }
        },

        // ===== MEMBER MANAGEMENT TOOLS =====
        {
            name: "timeout_member",
            description: "Timeout (mute) a member for a specified duration. Autonomous moderation action - can be used without owner permission for short timeouts.",
            input_schema: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "Discord user ID of the member to timeout"
                    },
                    duration: {
                        type: "number",
                        description: "Duration in minutes (max 1440 for 24 hours)"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for the timeout"
                    }
                },
                required: ["userId", "duration", "reason"]
            }
        },
        {
            name: "remove_timeout",
            description: "Remove an active timeout from a member. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "Discord user ID of the member"
                    }
                },
                required: ["userId"]
            }
        },
        {
            name: "kick_member",
            description: "Kick a member from the server. They can rejoin with a new invite. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "Discord user ID of the member to kick"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for kicking"
                    }
                },
                required: ["userId", "reason"]
            }
        },
        {
            name: "ban_member",
            description: "Ban a member from the server permanently. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "Discord user ID of the member to ban"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for the ban"
                    },
                    deleteMessageDays: {
                        type: "number",
                        description: "Number of days of messages to delete (0-7)"
                    }
                },
                required: ["userId", "reason"]
            }
        },
        {
            name: "unban_member",
            description: "Unban a previously banned member. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "Discord user ID of the banned member"
                    }
                },
                required: ["userId"]
            }
        },
        {
            name: "set_nickname",
            description: "Set or change a member's nickname. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        description: "Discord user ID of the member"
                    },
                    nickname: {
                        type: "string",
                        description: "New nickname (empty string to remove nickname)"
                    }
                },
                required: ["userId", "nickname"]
            }
        },

        // ===== THREAD MANAGEMENT TOOLS =====
        {
            name: "create_thread",
            description: "Create a new thread in a text channel. Useful for focused discussions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name of the channel to create the thread in"
                    },
                    threadName: {
                        type: "string",
                        description: "Name for the thread"
                    },
                    autoArchiveDuration: {
                        type: "number",
                        enum: [60, 1440, 4320, 10080],
                        description: "Auto-archive duration in minutes (60=1hr, 1440=1day, 4320=3days, 10080=1week)"
                    }
                },
                required: ["channelName", "threadName"]
            }
        },
        {
            name: "archive_thread",
            description: "Archive an active thread. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    threadName: {
                        type: "string",
                        description: "Name of the thread to archive"
                    }
                },
                required: ["threadName"]
            }
        },
        {
            name: "lock_thread",
            description: "Lock a thread to prevent new messages. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    threadName: {
                        type: "string",
                        description: "Name of the thread to lock"
                    }
                },
                required: ["threadName"]
            }
        },
        {
            name: "create_forum_post",
            description: "Create a new forum post in a forum channel.",
            input_schema: {
                type: "object",
                properties: {
                    forumName: {
                        type: "string",
                        description: "Name of the forum channel"
                    },
                    postTitle: {
                        type: "string",
                        description: "Title for the forum post"
                    },
                    postContent: {
                        type: "string",
                        description: "Content of the first message in the post"
                    }
                },
                required: ["forumName", "postTitle", "postContent"]
            }
        },

        // ===== EVENT MANAGEMENT TOOLS =====
        {
            name: "create_event",
            description: "Create a scheduled event for the server.",
            input_schema: {
                type: "object",
                properties: {
                    eventName: {
                        type: "string",
                        description: "Name of the event"
                    },
                    description: {
                        type: "string",
                        description: "Description of the event"
                    },
                    startTime: {
                        type: "string",
                        description: "Start time in ISO format (e.g., '2025-10-10T20:00:00')"
                    },
                    endTime: {
                        type: "string",
                        description: "Optional: End time in ISO format"
                    },
                    location: {
                        type: "string",
                        description: "Optional: Location if it's an external event"
                    },
                    channelName: {
                        type: "string",
                        description: "Optional: Voice channel name if it's a voice event"
                    }
                },
                required: ["eventName", "startTime"]
            }
        },
        {
            name: "delete_event",
            description: "Delete a scheduled event. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    eventName: {
                        type: "string",
                        description: "Name of the event to delete"
                    }
                },
                required: ["eventName"]
            }
        },

        // ===== EMOJI & STICKER TOOLS =====
        {
            name: "create_emoji",
            description: "Create a custom emoji for the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    emojiName: {
                        type: "string",
                        description: "Name for the emoji (without colons)"
                    },
                    emojiUrl: {
                        type: "string",
                        description: "URL to the emoji image"
                    }
                },
                required: ["emojiName", "emojiUrl"]
            }
        },
        {
            name: "delete_emoji",
            description: "Delete a custom emoji from the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    emojiName: {
                        type: "string",
                        description: "Name of the emoji to delete"
                    }
                },
                required: ["emojiName"]
            }
        },

        // ===== MESSAGE MANAGEMENT TOOLS =====
        {
            name: "send_message",
            description: "Send a text message to any channel. Use this to post announcements, welcome messages, or any content to channels.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name of the channel to send message to"
                    },
                    content: {
                        type: "string",
                        description: "Message content to send"
                    }
                },
                required: ["channelName", "content"]
            }
        },
        {
            name: "send_embed",
            description: "Send a rich embed message with formatting, colors, fields, and images. Perfect for announcements, welcome messages, and structured information.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name of the channel"
                    },
                    title: {
                        type: "string",
                        description: "Embed title"
                    },
                    description: {
                        type: "string",
                        description: "Main embed content"
                    },
                    color: {
                        type: "string",
                        description: "Hex color code (e.g., #FF6B35 for autumn orange)"
                    },
                    footer: {
                        type: "string",
                        description: "Footer text"
                    },
                    imageUrl: {
                        type: "string",
                        description: "Large image URL"
                    },
                    thumbnailUrl: {
                        type: "string",
                        description: "Small thumbnail image URL"
                    }
                },
                required: ["channelName", "description"]
            }
        },
        {
            name: "edit_message",
            description: "Edit an existing message sent by the bot. Can update content or embeds.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "ID of the message to edit"
                    },
                    channelName: {
                        type: "string",
                        description: "Channel containing the message"
                    },
                    newContent: {
                        type: "string",
                        description: "New message content"
                    }
                },
                required: ["messageId", "channelName", "newContent"]
            }
        },
        {
            name: "delete_message",
            description: "Delete a specific message. Autonomous moderation action for removing inappropriate content.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "ID of the message to delete"
                    },
                    channelName: {
                        type: "string",
                        description: "Channel containing the message"
                    }
                },
                required: ["messageId", "channelName"]
            }
        },
        {
            name: "pin_message",
            description: "Pin an important message to the channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "ID of the message to pin"
                    },
                    channelName: {
                        type: "string",
                        description: "Channel containing the message"
                    }
                },
                required: ["messageId", "channelName"]
            }
        },
        {
            name: "unpin_message",
            description: "Unpin a message from the channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "ID of the message to unpin"
                    },
                    channelName: {
                        type: "string",
                        description: "Channel containing the message"
                    }
                },
                required: ["messageId", "channelName"]
            }
        },
        {
            name: "purge_messages",
            description: "Bulk delete multiple messages (up to 100) from a channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to purge messages from"
                    },
                    amount: {
                        type: "number",
                        description: "Number of messages to delete (1-100)"
                    }
                },
                required: ["channelName", "amount"]
            }
        },

        // ===== REACTION MANAGEMENT TOOLS =====
        {
            name: "add_reaction",
            description: "Add a reaction emoji to a message. Works with Unicode emojis (🍂) and custom server emojis.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "ID of the message to react to"
                    },
                    channelName: {
                        type: "string",
                        description: "Channel containing the message"
                    },
                    emoji: {
                        type: "string",
                        description: "Emoji to react with (e.g., '✅', '🍂', or custom emoji name)"
                    }
                },
                required: ["messageId", "channelName", "emoji"]
            }
        },
        {
            name: "remove_reaction",
            description: "Remove a specific reaction from a message.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "ID of the message"
                    },
                    channelName: {
                        type: "string",
                        description: "Channel containing the message"
                    },
                    emoji: {
                        type: "string",
                        description: "Emoji to remove"
                    },
                    userId: {
                        type: "string",
                        description: "Optional: User ID to remove reaction from (defaults to all users)"
                    }
                },
                required: ["messageId", "channelName", "emoji"]
            }
        },
        {
            name: "remove_all_reactions",
            description: "Clear all reactions from a message. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "ID of the message"
                    },
                    channelName: {
                        type: "string",
                        description: "Channel containing the message"
                    }
                },
                required: ["messageId", "channelName"]
            }
        },
        {
            name: "setup_reaction_role",
            description: "Set up automatic role assignment when users react to a message with a specific emoji. Perfect for verification systems and self-assignable roles.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "Message ID to watch for reactions"
                    },
                    channelName: {
                        type: "string",
                        description: "Channel containing the message"
                    },
                    emoji: {
                        type: "string",
                        description: "Emoji that triggers role assignment"
                    },
                    roleName: {
                        type: "string",
                        description: "Role to assign when user reacts"
                    }
                },
                required: ["messageId", "emoji", "roleName"]
            }
        },
        {
            name: "remove_reaction_role",
            description: "Remove a reaction role setup. Stops automatic role assignment for that emoji.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "Message ID with reaction role"
                    },
                    emoji: {
                        type: "string",
                        description: "Emoji to remove binding from"
                    }
                },
                required: ["messageId", "emoji"]
            }
        },
        {
            name: "list_reaction_roles",
            description: "List all active reaction role setups in the server.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },

        // ===== SERVER SETTINGS TOOLS =====
        {
            name: "set_server_name",
            description: "Change the server name. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "New server name"
                    }
                },
                required: ["name"]
            }
        },
        {
            name: "set_server_icon",
            description: "Set the server icon from a URL. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    iconUrl: {
                        type: "string",
                        description: "URL to the icon image (PNG, JPG, GIF)"
                    }
                },
                required: ["iconUrl"]
            }
        },
        {
            name: "set_server_banner",
            description: "Set the server banner from a URL. Requires owner permissions and server boost level 2.",
            input_schema: {
                type: "object",
                properties: {
                    bannerUrl: {
                        type: "string",
                        description: "URL to the banner image"
                    }
                },
                required: ["bannerUrl"]
            }
        },
        {
            name: "set_verification_level",
            description: "Set server verification level (0=None, 1=Low, 2=Medium, 3=High, 4=Highest). Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    level: {
                        type: "number",
                        description: "Verification level (0-4)"
                    }
                },
                required: ["level"]
            }
        },

        // ===== INVITE MANAGEMENT TOOLS =====
        {
            name: "create_invite",
            description: "Create an invite link for a channel with custom settings.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to create invite for"
                    },
                    maxAge: {
                        type: "number",
                        description: "Max age in seconds (0 = never expires)"
                    },
                    maxUses: {
                        type: "number",
                        description: "Max number of uses (0 = unlimited)"
                    },
                    temporary: {
                        type: "boolean",
                        description: "Whether members are kicked on disconnect if they don't have a role"
                    }
                },
                required: ["channelName"]
            }
        },
        {
            name: "delete_invite",
            description: "Delete an invite by its code. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    inviteCode: {
                        type: "string",
                        description: "Invite code to delete (e.g., 'abc123')"
                    }
                },
                required: ["inviteCode"]
            }
        },
        {
            name: "list_invites",
            description: "List all active invites in the server with their usage stats.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },

        // ===== WEBHOOK MANAGEMENT TOOLS =====
        {
            name: "create_webhook",
            description: "Create a webhook for a channel. Webhooks allow external services to post messages. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to create webhook in"
                    },
                    webhookName: {
                        type: "string",
                        description: "Name for the webhook"
                    },
                    avatarUrl: {
                        type: "string",
                        description: "Optional: Avatar URL for the webhook"
                    }
                },
                required: ["channelName", "webhookName"]
            }
        },
        {
            name: "delete_webhook",
            description: "Delete a webhook. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    webhookId: {
                        type: "string",
                        description: "ID of the webhook to delete"
                    }
                },
                required: ["webhookId"]
            }
        },

        // ===== EXTENDED THREAD TOOLS =====
        {
            name: "delete_thread",
            description: "Delete a thread. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    threadName: {
                        type: "string",
                        description: "Name of the thread to delete"
                    }
                },
                required: ["threadName"]
            }
        },
        {
            name: "pin_thread",
            description: "Pin a forum thread. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    threadName: {
                        type: "string",
                        description: "Name of the thread to pin"
                    }
                },
                required: ["threadName"]
            }
        },

        // ===== EXTENDED EMOJI TOOLS =====
        {
            name: "edit_emoji",
            description: "Rename an existing emoji. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    emojiName: {
                        type: "string",
                        description: "Current name of the emoji"
                    },
                    newName: {
                        type: "string",
                        description: "New name for the emoji"
                    }
                },
                required: ["emojiName", "newName"]
            }
        },

        // ===== STICKER MANAGEMENT TOOLS =====
        {
            name: "create_sticker",
            description: "Create a custom sticker for the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    stickerName: {
                        type: "string",
                        description: "Name for the sticker"
                    },
                    stickerFile: {
                        type: "string",
                        description: "Path or URL to sticker file (PNG or APNG)"
                    },
                    description: {
                        type: "string",
                        description: "Description of the sticker"
                    },
                    emoji: {
                        type: "string",
                        description: "Related emoji tag"
                    }
                },
                required: ["stickerName", "stickerFile"]
            }
        },
        {
            name: "edit_sticker",
            description: "Edit a sticker's name or description. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    stickerName: {
                        type: "string",
                        description: "Current sticker name"
                    },
                    newName: {
                        type: "string",
                        description: "New name for the sticker"
                    },
                    description: {
                        type: "string",
                        description: "New description"
                    }
                },
                required: ["stickerName"]
            }
        },
        {
            name: "delete_sticker",
            description: "Delete a sticker from the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    stickerName: {
                        type: "string",
                        description: "Name of the sticker to delete"
                    }
                },
                required: ["stickerName"]
            }
        },

        // ===== EXTENDED EVENT TOOLS =====
        {
            name: "edit_event",
            description: "Edit a scheduled event's details. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    eventName: {
                        type: "string",
                        description: "Current name of the event"
                    },
                    newName: {
                        type: "string",
                        description: "New name for the event"
                    },
                    description: {
                        type: "string",
                        description: "New description"
                    },
                    startTime: {
                        type: "string",
                        description: "New start time in ISO format"
                    }
                },
                required: ["eventName"]
            }
        },
        {
            name: "start_event",
            description: "Manually start a scheduled event. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    eventName: {
                        type: "string",
                        description: "Name of the event to start"
                    }
                },
                required: ["eventName"]
            }
        },
        {
            name: "end_event",
            description: "Manually end an active event. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    eventName: {
                        type: "string",
                        description: "Name of the event to end"
                    }
                },
                required: ["eventName"]
            }
        },

        // ===== VOICE/STAGE CHANNEL TOOLS =====
        {
            name: "create_stage_channel",
            description: "Create a stage channel for large audio events. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name for the stage channel"
                    },
                    categoryName: {
                        type: "string",
                        description: "Optional: Category to place channel in"
                    },
                    topic: {
                        type: "string",
                        description: "Optional: Channel topic"
                    }
                },
                required: ["channelName"]
            }
        },
        {
            name: "set_bitrate",
            description: "Set audio bitrate for voice/stage channels (8-384 kbps depending on boost level). Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Voice or stage channel name"
                    },
                    bitrate: {
                        type: "number",
                        description: "Bitrate in kbps (8-384)"
                    }
                },
                required: ["channelName", "bitrate"]
            }
        },
        {
            name: "set_user_limit",
            description: "Set maximum user limit for voice channels (0-99, 0=unlimited). Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Voice channel name"
                    },
                    limit: {
                        type: "number",
                        description: "User limit (0-99)"
                    }
                },
                required: ["channelName", "limit"]
            }
        },
        {
            name: "set_rtc_region",
            description: "Set voice region for optimal audio quality. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Voice or stage channel name"
                    },
                    region: {
                        type: "string",
                        description: "Region code (e.g., 'us-east', 'europe', 'auto')"
                    }
                },
                required: ["channelName", "region"]
            }
        },
        {
            name: "create_stage_instance",
            description: "Start a stage instance (live audio event) in a stage channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Stage channel name"
                    },
                    topic: {
                        type: "string",
                        description: "Topic of the stage event"
                    },
                    privacy: {
                        type: "string",
                        enum: ["public", "guild_only"],
                        description: "Privacy level of the stage"
                    }
                },
                required: ["channelName", "topic"]
            }
        },

        // ===== CHANNEL PERMISSIONS TOOLS =====
        {
            name: "set_channel_permissions",
            description: "Set specific permissions for a role or user in a channel. Perfect for creating private channels or verification systems. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to modify permissions for"
                    },
                    targetName: {
                        type: "string",
                        description: "Role name or username to set permissions for"
                    },
                    targetType: {
                        type: "string",
                        enum: ["role", "member"],
                        description: "Whether target is a role or member"
                    },
                    permissions: {
                        type: "string",
                        description: "Comma-separated permissions (e.g., 'ViewChannel,SendMessages,ReadMessageHistory')"
                    }
                },
                required: ["channelName", "targetName", "targetType", "permissions"]
            }
        },
        {
            name: "remove_channel_permission",
            description: "Remove all permission overwrites for a role or user in a channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to modify"
                    },
                    targetName: {
                        type: "string",
                        description: "Role name or username"
                    },
                    targetType: {
                        type: "string",
                        enum: ["role", "member"],
                        description: "Whether target is a role or member"
                    }
                },
                required: ["channelName", "targetName", "targetType"]
            }
        },
        {
            name: "sync_channel_permissions",
            description: "Sync a channel's permissions with its parent category. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to sync permissions for"
                    }
                },
                required: ["channelName"]
            }
        },

        // ===== FORUM CHANNEL TOOLS =====
        {
            name: "create_forum_channel",
            description: "Create a forum channel for organized discussions with tags and threads. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name for the forum channel"
                    },
                    categoryName: {
                        type: "string",
                        description: "Optional: Category to place channel in"
                    },
                    topic: {
                        type: "string",
                        description: "Optional: Channel description"
                    },
                    tags: {
                        type: "string",
                        description: "Optional: Comma-separated tag names (e.g., 'Question,Bug,Feature')"
                    }
                },
                required: ["channelName"]
            }
        },
        {
            name: "set_default_thread_slowmode",
            description: "Set default slowmode for all new threads in a forum channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Forum channel name"
                    },
                    seconds: {
                        type: "number",
                        description: "Slowmode delay in seconds"
                    }
                },
                required: ["channelName", "seconds"]
            }
        },
        {
            name: "set_available_tags",
            description: "Set the available tags for a forum channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Forum channel name"
                    },
                    tags: {
                        type: "string",
                        description: "Comma-separated tag names"
                    }
                },
                required: ["channelName", "tags"]
            }
        },

        // ===== ROLE PERMISSIONS TOOLS =====
        {
            name: "set_role_permissions",
            description: "Set permissions for a role (Admin, Moderator, etc.). Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Role to modify"
                    },
                    permissions: {
                        type: "string",
                        description: "Permission bit value or comma-separated permission names"
                    }
                },
                required: ["roleName", "permissions"]
            }
        },

        // ===== AUTOMODERATION TOOLS =====
        {
            name: "create_automod_rule",
            description: "Create an AutoMod rule to automatically filter spam, harmful links, or custom keywords. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    ruleName: {
                        type: "string",
                        description: "Name for the AutoMod rule"
                    },
                    triggerType: {
                        type: "string",
                        enum: ["keyword", "spam", "mention_spam", "harmful_link"],
                        description: "Type of content to filter"
                    },
                    keywords: {
                        type: "array",
                        description: "For keyword type: Array of words/phrases to block"
                    },
                    mentionLimit: {
                        type: "number",
                        description: "For mention_spam: Max mentions allowed per message"
                    },
                    action: {
                        type: "string",
                        enum: ["block", "timeout", "alert"],
                        description: "Action to take when rule triggers"
                    },
                    alertChannelName: {
                        type: "string",
                        description: "Channel to send alerts to"
                    }
                },
                required: ["ruleName", "triggerType", "action"]
            }
        },
        {
            name: "list_automod_rules",
            description: "List all AutoMod rules in the server.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },
        {
            name: "delete_automod_rule",
            description: "Delete an AutoMod rule. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    ruleName: {
                        type: "string",
                        description: "Name of the rule to delete"
                    }
                },
                required: ["ruleName"]
            }
        },

        // ===== MODERATION LOGS TOOLS =====
        {
            name: "get_audit_logs",
            description: "Fetch recent audit logs to see moderation actions and server changes. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    limit: {
                        type: "number",
                        description: "Number of log entries to fetch (1-100)"
                    },
                    actionType: {
                        type: "string",
                        description: "Optional: Filter by action type (e.g., 'MEMBER_BAN_ADD', 'CHANNEL_CREATE')"
                    }
                },
                required: []
            }
        },
        {
            name: "get_bans",
            description: "List all banned users in the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        }
    ];
}

module.exports = { getDiscordTools };
