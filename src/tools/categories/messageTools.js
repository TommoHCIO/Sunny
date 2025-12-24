// src/tools/categories/messageTools.js
/**
 * Discord Message Management Tools
 * 
 * Tools for sending, editing, deleting, and managing messages and reactions.
 * Includes embed messages, reaction roles, pinning, and bulk message operations.
 * 
 * @module messageTools
 */

/**
 * Get all Discord message management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of message tool definitions
 */
function getMessageTools(guild) {
    return [
        // ===== MESSAGE MANAGEMENT TOOLS =====
        {
            name: "send_message",
            description: "Send a text message to any channel. Use this to post announcements, welcome messages, or any content to channels.",
            input_schema: {
                type: "object",
                properties: {
                    channel: {
                        type: "string",
                        description: "Name or ID of the channel to send message to"
                    },
                    content: {
                        type: "string",
                        description: "Message content to send"
                    }
                },
                required: ["channel", "content"]
            }
        },
        {
            name: "send_embed",
            description: "Send rich embed message to any channel. RETURNS message_id which is REQUIRED for add_reaction and setup_reaction_role tools. ACCEPTS BOTH: channel name (e.g., 'welcome') OR channel ID (e.g., '1425938574901121105'). The findChannel() function handles both automatically. IMPORTANT: Save the message_id from the result if you need to add reactions or setup reaction roles!",
            input_schema: {
                type: "object",
                properties: {
                    channel: {
                        type: "string",
                        description: "Channel name OR channel ID. Both formats work! Examples: 'welcome' or '1425938574901121105'"
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
                required: ["channel", "description"]
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
                    channel: {
                        type: "string",
                        description: "Channel containing the message"
                    },
                    newContent: {
                        type: "string",
                        description: "New message content"
                    }
                },
                required: ["messageId", "channel", "newContent"]
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
                    channel: {
                        type: "string",
                        description: "Channel containing the message"
                    }
                },
                required: ["messageId", "channel"]
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
                    channel: {
                        type: "string",
                        description: "Channel containing the message"
                    }
                },
                required: ["messageId", "channel"]
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
                    channel: {
                        type: "string",
                        description: "Channel containing the message"
                    }
                },
                required: ["messageId", "channel"]
            }
        },
        {
            name: "purge_messages",
            description: "Bulk delete multiple messages (up to 100) from a channel. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    channel: {
                        type: "string",
                        description: "Channel to purge messages from"
                    },
                    amount: {
                        type: "number",
                        description: "Number of messages to delete (1-100)"
                    }
                },
                required: ["channel", "amount"]
            }
        },

        // ===== REACTION MANAGEMENT TOOLS =====
        {
            name: "add_reaction",
            description: "Add reaction emoji to a message. Part of reaction role workflow: send_embed → add_reaction → setup_reaction_role. Use message_id from send_embed result. Channel parameter accepts both names and IDs.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "Message ID to add reaction to. Get this from send_embed or send_message result!"
                    },
                    channel: {
                        type: "string",
                        description: "Channel name OR ID containing the message. Examples: 'welcome' or '1425938574901121105'"
                    },
                    emoji: {
                        type: "string",
                        description: "Emoji to react with (e.g., '✅', '👍', '🍂'). Use exact Unicode or custom emoji name."
                    }
                },
                required: ["messageId", "channel", "emoji"]
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
                    channel: {
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
                required: ["messageId", "channel", "emoji"]
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
                    channel: {
                        type: "string",
                        description: "Channel containing the message"
                    }
                },
                required: ["messageId", "channel"]
            }
        },
        {
            name: "setup_reaction_role",
            description: "Set up automatic role assignment when users react with specific emoji. WORKFLOW: 1) First use send_embed/send_message to post message and GET message_id from result, 2) Then use add_reaction to add the emoji to that message, 3) Finally call THIS tool with that message_id. IMPORTANT: Always extract message_id from send_embed/send_message result! Channel parameter accepts both channel name and channel ID.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "Message ID returned from send_embed or send_message tool. MUST use the exact message_id from the tool result, not a random ID!"
                    },
                    channel: {
                        type: "string",
                        description: "Channel name OR channel ID containing the message. Examples: 'welcome' or '1425938574901121105'"
                    },
                    emoji: {
                        type: "string",
                        description: "Emoji for reaction (e.g., '✅', '👍', '🎮'). Use exact Unicode emoji or custom emoji name."
                    },
                    roleName: {
                        type: "string",
                        description: "Role name to assign when user reacts. Role will be auto-created if it doesn't exist."
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
        {
            name: "get_channel_messages",
            description: "Fetch recent messages from a channel, including full embed data (title, description, fields, colors, images, etc.). Returns up to 100 messages with complete information about embeds, reactions, and attachments. Use this to view existing announcements, embeds, or message history.",
            input_schema: {
                type: "object",
                properties: {
                    channel: {
                        type: "string",
                        description: "Channel name or ID to fetch messages from"
                    },
                    limit: {
                        type: "number",
                        description: "Number of messages to fetch (1-100, default: 50)"
                    }
                },
                required: ["channel"]
            }
        },
        {
            name: "send_button_message",
            description: "Send a message with interactive buttons. Useful for creating ticket panels, polls, or any interactive UI. Buttons can have custom IDs and labels. Supports up to 5 buttons per row and 5 rows max.",
            input_schema: {
                type: "object",
                properties: {
                    channel: {
                        type: "string",
                        description: "Channel name or ID where to send the message"
                    },
                    content: {
                        type: "string",
                        description: "Message content (optional if embed is provided)"
                    },
                    embed: {
                        type: "object",
                        description: "Optional embed configuration",
                        properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            color: { type: "string", description: "Hex color (e.g., #FF6B35)" },
                            footer: { type: "string" },
                            thumbnail: { type: "string" },
                            image: { type: "string" },
                            fields: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" },
                                        value: { type: "string" },
                                        inline: { type: "boolean" }
                                    }
                                }
                            }
                        }
                    },
                    buttons: {
                        type: "array",
                        description: "Array of button rows (max 5 rows)",
                        items: {
                            type: "object",
                            properties: {
                                customId: {
                                    type: "string",
                                    description: "Unique ID for the button (used to identify which button was clicked)"
                                },
                                label: {
                                    type: "string",
                                    description: "Text displayed on the button"
                                },
                                style: {
                                    type: "string",
                                    enum: ["primary", "secondary", "success", "danger", "link"],
                                    description: "Button color: primary (blue), secondary (gray), success (green), danger (red), link (gray with URL)"
                                },
                                emoji: {
                                    type: "string",
                                    description: "Optional emoji to display on button (e.g., '🎫', '✅')"
                                },
                                url: {
                                    type: "string",
                                    description: "For link style buttons: URL to open when clicked"
                                },
                                disabled: {
                                    type: "boolean",
                                    description: "Whether button is disabled (default: false)"
                                }
                            },
                            required: ["customId", "label", "style"]
                        }
                    }
                },
                required: ["channel", "buttons"]
            }
        }
    ];
}

module.exports = { getMessageTools };
