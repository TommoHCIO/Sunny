// src/tools/categories/ticketTools.js
/**
 * Ticket Management Tools
 * 
 * Tools for creating, managing, and tracking support tickets through a
 * thread-based ticketing system with transcripts and analytics.
 * 
 * @module ticketTools
 */

/**
 * Get all ticket management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of ticket tool definitions
 */
function getTicketTools(guild) {
    return [
        // ===== TICKET MANAGEMENT TOOLS =====
        {
            name: "create_ticket",
            description: "Create a new support ticket. Creates a private thread for the ticket conversation.",
            input_schema: {
                type: "object",
                properties: {
                    memberName: {
                        type: "string",
                        description: "Name or mention of the member creating the ticket"
                    },
                    category: {
                        type: "string",
                        enum: ["support", "report", "question", "feedback", "bug", "event"],
                        description: "Ticket category"
                    },
                    subject: {
                        type: "string",
                        description: "Brief subject/title for the ticket (max 100 chars)"
                    },
                    description: {
                        type: "string",
                        description: "Detailed description of the issue or request"
                    }
                },
                required: ["memberName", "category", "subject"]
            }
        },
        {
            name: "close_ticket",
            description: "Close a ticket and generate a transcript. Archives and locks the ticket thread.",
            input_schema: {
                type: "object",
                properties: {
                    ticketId: {
                        type: "string",
                        description: "Ticket ID (e.g., ticket-a1b2c3-0001) or database ID"
                    },
                    staffMemberName: {
                        type: "string",
                        description: "Name or mention of the staff member closing the ticket"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for closing the ticket"
                    }
                },
                required: ["ticketId", "staffMemberName"]
            }
        },
        {
            name: "assign_ticket",
            description: "Claim/assign a ticket to a staff member. Marks ticket as in-progress.",
            input_schema: {
                type: "object",
                properties: {
                    ticketId: {
                        type: "string",
                        description: "Ticket ID (e.g., ticket-a1b2c3-0001) or database ID"
                    },
                    staffMemberName: {
                        type: "string",
                        description: "Name or mention of the staff member to assign"
                    }
                },
                required: ["ticketId", "staffMemberName"]
            }
        },
        {
            name: "update_ticket_priority",
            description: "Update the priority level of a ticket.",
            input_schema: {
                type: "object",
                properties: {
                    ticketId: {
                        type: "string",
                        description: "Ticket ID (e.g., ticket-a1b2c3-0001) or database ID"
                    },
                    priority: {
                        type: "string",
                        enum: ["low", "normal", "high", "urgent"],
                        description: "New priority level"
                    }
                },
                required: ["ticketId", "priority"]
            }
        },
        {
            name: "list_tickets",
            description: "List tickets with optional filtering by status, category, assignee, or creator.",
            input_schema: {
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        enum: ["open", "in-progress", "waiting", "resolved", "closed"],
                        description: "Filter by ticket status"
                    },
                    category: {
                        type: "string",
                        enum: ["support", "report", "question", "feedback", "bug", "event"],
                        description: "Filter by category"
                    },
                    assignedToName: {
                        type: "string",
                        description: "Filter by assigned staff member name"
                    },
                    creatorName: {
                        type: "string",
                        description: "Filter by ticket creator name"
                    }
                }
            }
        },
        {
            name: "get_ticket_stats",
            description: "Get comprehensive ticket statistics including total, open, closed, average resolution time, and category breakdown.",
            input_schema: {
                type: "object",
                properties: {}
            }
        },
        {
            name: "get_ticket",
            description: "Get detailed information about a specific ticket.",
            input_schema: {
                type: "object",
                properties: {
                    ticketId: {
                        type: "string",
                        description: "Ticket ID (e.g., ticket-a1b2c3-0001) or database ID"
                    }
                },
                required: ["ticketId"]
            }
        },
        {
            name: "add_ticket_tag",
            description: "Add a tag to a ticket for better organization and filtering.",
            input_schema: {
                type: "object",
                properties: {
                    ticketId: {
                        type: "string",
                        description: "Ticket ID (e.g., ticket-a1b2c3-0001) or database ID"
                    },
                    tag: {
                        type: "string",
                        description: "Tag to add (will be lowercased)"
                    }
                },
                required: ["ticketId", "tag"]
            }
        },
        {
            name: "enable_ticketing",
            description: "Enable the ticketing system for this server. Requires support channel configuration.",
            input_schema: {
                type: "object",
                properties: {
                    supportChannelName: {
                        type: "string",
                        description: "Name of the channel where tickets will be created"
                    },
                    staffNotifyChannelName: {
                        type: "string",
                        description: "Optional: Channel to notify staff of new tickets"
                    },
                    transcriptChannelName: {
                        type: "string",
                        description: "Optional: Channel to post ticket transcripts"
                    },
                    staffRoleNames: {
                        type: "array",
                        items: { type: "string" },
                        description: "Optional: Names of staff roles that can manage tickets"
                    }
                },
                required: ["supportChannelName"]
            }
        },
        {
            name: "disable_ticketing",
            description: "Disable the ticketing system for this server.",
            input_schema: {
                type: "object",
                properties: {}
            }
        },
        {
            name: "configure_ticket_categories",
            description: "Configure custom ticket categories with emojis and auto-assign roles.",
            input_schema: {
                type: "object",
                properties: {
                    categories: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "Category name" },
                                emoji: { type: "string", description: "Category emoji" },
                                autoAssignRoleName: { 
                                    type: "string", 
                                    description: "Optional: Role name to auto-assign when ticket is created in this category" 
                                }
                            }
                        },
                        description: "Array of category configurations"
                    }
                },
                required: ["categories"]
            }
        }
    ];
}

module.exports = { getTicketTools };
