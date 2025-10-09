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
        }
    ];
}

module.exports = { getDiscordTools };
