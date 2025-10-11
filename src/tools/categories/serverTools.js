// src/tools/categories/serverTools.js
/**
 * Discord Server Management Tools
 * 
 * Tools for managing server-wide settings, invites, webhooks, and automoderation.
 * Includes server customization, invite management, webhook operations, and AutoMod rules.
 * 
 * @module serverTools
 */

/**
 * Get all Discord server management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of server tool definitions
 */
function getServerTools(guild) {
    return [
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
            name: "list_webhooks",
            description: "List all webhooks in the server.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
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

        // ===== AUTOMODERATION TOOLS =====
        {
            name: "create_automod_rule",
            description: "Create an AutoMod rule to automatically filter spam, harmful links, or custom keywords. For keyword type, provide keywords as array like [\"spam\", \"bad\"]. Requires owner permissions.",
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
                        description: "Type: keyword (needs keywords array), spam (auto-detect), mention_spam (needs mentionLimit), harmful_link (auto-detect)"
                    },
                    keywords: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "REQUIRED for keyword type: Array of words/phrases to block, e.g. [\"spam\", \"badword\"]"
                    },
                    mentionLimit: {
                        type: "number",
                        description: "REQUIRED for mention_spam type: Max mentions allowed (e.g. 5)"
                    },
                    action: {
                        type: "string",
                        enum: ["block", "timeout", "alert"],
                        description: "Action: block (delete message), timeout (60s timeout), alert (send to channel)"
                    },
                    alertChannelName: {
                        type: "string",
                        description: "REQUIRED for alert action: Channel name to send alerts to"
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
        }
    ];
}

module.exports = { getServerTools };
