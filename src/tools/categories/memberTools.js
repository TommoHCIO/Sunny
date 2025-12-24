// src/tools/categories/memberTools.js
/**
 * Discord Member Management Tools
 *
 * Tools for member management, moderation actions, and member information retrieval.
 * Includes timeouts, kicks, bans, nickname management, and detailed member lookups.
 *
 * @module memberTools
 */

/**
 * Get all Discord member management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of member tool definitions
 */
function getMemberTools(guild) {
    return [
        // ===== MEMBER MANAGEMENT TOOLS =====
        {
            name: "timeout_member",
            description: "Timeout (mute) a member for a specified duration. Autonomous moderation action - can be used without owner permission for short timeouts.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member to timeout"
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
                required: ["user", "duration", "reason"]
            }
        },
        {
            name: "kick_member",
            description: "Kick a member from the server. They can rejoin with a new invite. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member to kick"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for kicking"
                    }
                },
                required: ["user", "reason"]
            }
        },
        {
            name: "set_nickname",
            description: "Set or change a member's nickname. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member"
                    },
                    nickname: {
                        type: "string",
                        description: "New nickname (empty string to remove nickname)"
                    }
                },
                required: ["user", "nickname"]
            }
        },

        // ===== MEMBER MANAGEMENT TOOLS (ADVANCED) =====
        {
            name: "get_member_info",
            description: "Get detailed information about a specific member including username, roles, join date, permissions, timeout status, and voice state.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member"
                    }
                },
                required: ["user"]
            }
        },
        {
            name: "get_member_roles",
            description: "Get all roles assigned to a member with detailed information including permissions, colors, and positions.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member"
                    }
                },
                required: ["user"]
            }
        },
        {
            name: "get_member_permissions",
            description: "Get all permissions for a specific member including key moderation permissions.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member"
                    }
                },
                required: ["user"]
            }
        },
        {
            name: "list_members_with_role",
            description: "List all members who have a specific role. Shows username, display name, bot status, join date, and admin status.",
            input_schema: {
                type: "object",
                properties: {
                    role: {
                        type: "string",
                        description: "Role name or role ID to search for"
                    }
                },
                required: ["role"]
            }
        },
        {
            name: "search_members",
            description: "Search for members by username, display name, or nickname. Useful for finding specific users.",
            input_schema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Search query (partial match)"
                    },
                    limit: {
                        type: "number",
                        description: "Maximum results to return (default: 25)"
                    }
                },
                required: ["query"]
            }
        },

        // ===== ADVANCED MODERATION TOOLS =====
        {
            name: "list_timeouts",
            description: "List all currently timed-out members with their timeout duration and remaining time.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },
        {
            name: "remove_timeout",
            description: "Remove an active timeout from a member. Requires Moderate Members permission.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for removing timeout (default: 'Timeout removed by Sunny')"
                    }
                },
                required: ["user"]
            }
        },
        {
            name: "get_audit_log",
            description: "Get detailed audit log entries showing recent moderation actions, channel changes, role updates, and more. Can filter by action type and user.",
            input_schema: {
                type: "object",
                properties: {
                    limit: {
                        type: "number",
                        description: "Number of entries to fetch (default: 25)"
                    },
                    actionType: {
                        type: "string",
                        enum: ["timeout", "kick", "ban", "unban", "role_update", "channel_create", "channel_delete", "message_delete", "member_prune"],
                        description: "Filter by specific action type"
                    },
                    user: {
                        type: "string",
                        description: "Filter by executor username or user ID"
                    }
                },
                required: []
            }
        },
        {
            name: "ban_member",
            description: "Ban a member from the server permanently. Cannot ban server owner or administrators. Requires Ban Members permission.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member to ban"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for the ban (default: 'Banned by Sunny')"
                    },
                    deleteMessageDays: {
                        type: "number",
                        description: "Delete messages from the last N days (0-7, default: 0)"
                    }
                },
                required: ["user"]
            }
        },
        {
            name: "unban_member",
            description: "Remove a ban from a user, allowing them to rejoin. Requires Ban Members permission.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username or user ID of the banned member"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for unbanning (default: 'Unbanned by Sunny')"
                    }
                },
                required: ["user"]
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
        },

        // ===== VOICE MEMBER MANAGEMENT =====
        {
            name: "set_member_deaf",
            description: "Server deafen or undeafen a member in a voice channel. Member must be in voice. Requires Deafen Members permission.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member"
                    },
                    deaf: {
                        type: "boolean",
                        description: "true to deafen, false to undeafen"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for action (default: 'Member deafened by Sunny')"
                    }
                },
                required: ["user", "deaf"]
            }
        },
        {
            name: "set_member_mute",
            description: "Server mute or unmute a member in a voice channel. Member must be in voice. Requires Mute Members permission.",
            input_schema: {
                type: "object",
                properties: {
                    user: {
                        type: "string",
                        description: "Username, display name, or user ID of the member"
                    },
                    mute: {
                        type: "boolean",
                        description: "true to mute, false to unmute"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for action (default: 'Member muted by Sunny')"
                    }
                },
                required: ["user", "mute"]
            }
        }
    ];
}

module.exports = { getMemberTools };
