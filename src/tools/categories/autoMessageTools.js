// src/tools/categories/autoMessageTools.js
/**
 * Automatic Message Management Tools
 * 
 * Tools for creating, managing, and configuring automatic messages including
 * welcome, goodbye, milestone, scheduled, and trigger-based messages.
 * 
 * @module autoMessageTools
 */

/**
 * Get all automatic message management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of auto message tool definitions
 */
function getAutoMessageTools(guild) {
    return [
        // ===== AUTO MESSAGE MANAGEMENT TOOLS =====
        {
            name: "create_auto_message",
            description: "Create a new automatic message (welcome, goodbye, milestone, scheduled, or trigger-based). Supports embeds and variable replacement like {user}, {server}, {memberCount}.",
            input_schema: {
                type: "object",
                properties: {
                    messageType: {
                        type: "string",
                        enum: ["welcome", "goodbye", "milestone", "scheduled", "trigger"],
                        description: "Type of automatic message"
                    },
                    channelName: {
                        type: "string",
                        description: "Name of the channel where the message will be sent"
                    },
                    content: {
                        type: "string",
                        description: "Message content (can use {user}, {username}, {server}, {memberCount}, {date}, {time})"
                    },
                    embedConfig: {
                        type: "object",
                        description: "Optional embed configuration",
                        properties: {
                            enabled: { type: "boolean" },
                            title: { type: "string" },
                            description: { type: "string" },
                            color: { type: "string", description: "Hex color code (e.g., #F1C40F)" },
                            footer: { type: "string" },
                            thumbnail: { type: "string", description: "Thumbnail URL" },
                            image: { type: "string", description: "Image URL" },
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
                    triggers: {
                        type: "object",
                        description: "Trigger configuration based on messageType",
                        properties: {
                            memberCount: {
                                type: "number",
                                description: "For milestone messages: member count to trigger at"
                            },
                            keywords: {
                                type: "array",
                                items: { type: "string" },
                                description: "For trigger messages: keywords to watch for"
                            },
                            schedule: {
                                type: "string",
                                description: "For scheduled messages: cron expression (e.g., '0 9 * * MON' for 9am Monday)"
                            },
                            timezone: {
                                type: "string",
                                description: "Timezone for scheduled messages (default: UTC)"
                            }
                        }
                    },
                    dmUser: {
                        type: "boolean",
                        description: "For welcome messages: also send as DM to the user"
                    },
                    enabled: {
                        type: "boolean",
                        description: "Whether the message is enabled (default: true)"
                    }
                },
                required: ["messageType", "channelName"]
            }
        },
        {
            name: "list_auto_messages",
            description: "List all automatic messages for this server, with optional filtering by type.",
            input_schema: {
                type: "object",
                properties: {
                    messageType: {
                        type: "string",
                        enum: ["welcome", "goodbye", "milestone", "scheduled", "trigger"],
                        description: "Optional: filter by message type"
                    },
                    enabled: {
                        type: "boolean",
                        description: "Optional: filter by enabled status"
                    }
                }
            }
        },
        {
            name: "update_auto_message",
            description: "Update an existing automatic message by its database ID.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "Database ID of the message to update"
                    },
                    updates: {
                        type: "object",
                        description: "Fields to update",
                        properties: {
                            content: { type: "string" },
                            enabled: { type: "boolean" },
                            channelName: { type: "string" },
                            embedConfig: { type: "object" },
                            triggers: { type: "object" },
                            dmUser: { type: "boolean" }
                        }
                    }
                },
                required: ["messageId", "updates"]
            }
        },
        {
            name: "delete_auto_message",
            description: "Delete an automatic message by its database ID.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "Database ID of the message to delete"
                    }
                },
                required: ["messageId"]
            }
        },
        {
            name: "get_auto_message",
            description: "Get details of a specific automatic message by its database ID.",
            input_schema: {
                type: "object",
                properties: {
                    messageId: {
                        type: "string",
                        description: "Database ID of the message"
                    }
                },
                required: ["messageId"]
            }
        },
        {
            name: "enable_auto_messages",
            description: "Enable automatic messages feature for welcome, goodbye, milestones, or triggers.",
            input_schema: {
                type: "object",
                properties: {
                    featureType: {
                        type: "string",
                        enum: ["welcome", "goodbye", "milestones", "triggers"],
                        description: "Which automatic message feature to enable"
                    }
                },
                required: ["featureType"]
            }
        },
        {
            name: "disable_auto_messages",
            description: "Disable automatic messages feature for welcome, goodbye, milestones, or triggers.",
            input_schema: {
                type: "object",
                properties: {
                    featureType: {
                        type: "string",
                        enum: ["welcome", "goodbye", "milestones", "triggers"],
                        description: "Which automatic message feature to disable"
                    }
                },
                required: ["featureType"]
            }
        }
    ];
}

module.exports = { getAutoMessageTools };
