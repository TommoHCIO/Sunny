// src/tools/categories/eventTools.js
/**
 * Discord Event Management Tools
 * 
 * Tools for creating, managing, and moderating scheduled server events.
 * Includes event creation, editing, deletion, and manual event control.
 * 
 * @module eventTools
 */

/**
 * Get all Discord event management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of event tool definitions
 */
function getEventTools(guild) {
    return [
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
        }
    ];
}

module.exports = { getEventTools };
