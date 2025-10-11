// src/tools/categories/threadTools.js
/**
 * Discord Thread Management Tools
 * 
 * Tools for creating, managing, and moderating threads in text and forum channels.
 * Includes thread creation, archiving, locking, deletion, and pinning operations.
 * 
 * @module threadTools
 */

/**
 * Get all Discord thread management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of thread tool definitions
 */
function getThreadTools(guild) {
    return [
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
        }
    ];
}

module.exports = { getThreadTools };
