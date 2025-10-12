// src/tools/categories/channelTools.js
/**
 * Discord Channel Management Tools
 * 
 * Tools for creating, modifying, and managing text, voice, stage, and forum channels.
 * Includes channel permissions, voice/stage settings, and forum-specific features.
 * 
 * @module channelTools
 */

/**
 * Get all Discord channel management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of channel tool definitions
 */
function getChannelTools(guild) {
    return [
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
        {
            name: "set_channel_position",
            description: "Set a channel's position in the channel list. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name of the channel to reposition"
                    },
                    position: {
                        type: "number",
                        description: "New position (0 = top)"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for repositioning (default: 'Channel position set by Sunny')"
                    }
                },
                required: ["channelName", "position"]
            }
        },
        {
            name: "get_channel_permissions",
            description: "Get all permission overwrites for a channel including roles and members with their allow/deny permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Name of the channel to inspect"
                    }
                },
                required: ["channelName"]
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
        }
    ];
}

module.exports = { getChannelTools };
