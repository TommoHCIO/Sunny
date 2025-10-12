// src/tools/categories/inspectionTools.js
/**
 * Discord Server Inspection Tools
 * 
 * Read-only tools for inspecting server state, channels, roles, members,
 * settings, permissions, and moderation statistics. These tools provide
 * comprehensive visibility into server configuration and status.
 * 
 * @module inspectionTools
 */

/**
 * Get all Discord inspection tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of inspection tool definitions
 */
function getInspectionTools(guild) {
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
                    },
                    include_ids: {
                        type: "boolean",
                        description: "Include role IDs in the response (required for reordering roles)"
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

        // ===== SERVER INSPECTION TOOLS (ADVANCED) =====
        {
            name: "get_server_info",
            description: "Get comprehensive server information including name, owner, creation date, member count, boost level, verification level, and features.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },
        {
            name: "get_server_settings",
            description: "Get detailed server settings including verification level, content filter, enabled features, channel counts, role counts, and emoji/sticker counts.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },
        {
            name: "get_current_permissions",
            description: "Get Sunny's current permissions in the server. Shows all granted and missing permissions, critical missing permissions, and administrator status.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },
        {
            name: "list_server_features",
            description: "List all enabled server features (Community, Partnered, Verified, Discoverable, AutoMod, etc.) with descriptions.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },
        {
            name: "get_moderation_stats",
            description: "Get moderation statistics including warning counts, active timeouts, and users flagged by the autonomous moderation system.",
            input_schema: {
                type: "object",
                properties: {
                    timeRange: {
                        type: "string",
                        enum: ["24h", "7d", "30d", "all"],
                        description: "Time range for statistics (default: 24h)"
                    }
                },
                required: []
            }
        }
    ];
}

module.exports = { getInspectionTools };
