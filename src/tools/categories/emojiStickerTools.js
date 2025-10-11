// src/tools/categories/emojiStickerTools.js
/**
 * Discord Emoji and Sticker Management Tools
 * 
 * Tools for creating, managing, and moderating custom emojis and stickers.
 * Includes listing, creation, editing, and deletion operations.
 * 
 * @module emojiStickerTools
 */

/**
 * Get all Discord emoji and sticker management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of emoji and sticker tool definitions
 */
function getEmojiStickerTools(guild) {
    return [
        // ===== EMOJI & STICKER TOOLS =====
        {
            name: "list_emojis",
            description: "List all custom emojis in the server.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },
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
        },
        {
            name: "list_stickers",
            description: "List all custom stickers in the server.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            }
        },

        // ===== EXTENDED EMOJI TOOLS =====
        {
            name: "edit_emoji",
            description: "Rename an existing emoji. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    emojiName: {
                        type: "string",
                        description: "Current name of the emoji"
                    },
                    newName: {
                        type: "string",
                        description: "New name for the emoji"
                    }
                },
                required: ["emojiName", "newName"]
            }
        },

        // ===== STICKER MANAGEMENT TOOLS =====
        {
            name: "create_sticker",
            description: "Create a custom sticker for the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    stickerName: {
                        type: "string",
                        description: "Name for the sticker"
                    },
                    stickerFile: {
                        type: "string",
                        description: "Path or URL to sticker file (PNG or APNG)"
                    },
                    description: {
                        type: "string",
                        description: "Description of the sticker"
                    },
                    emoji: {
                        type: "string",
                        description: "Related emoji tag"
                    }
                },
                required: ["stickerName", "stickerFile"]
            }
        },
        {
            name: "edit_sticker",
            description: "Edit a sticker's name or description. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    stickerName: {
                        type: "string",
                        description: "Current sticker name"
                    },
                    newName: {
                        type: "string",
                        description: "New name for the sticker"
                    },
                    description: {
                        type: "string",
                        description: "New description"
                    }
                },
                required: ["stickerName"]
            }
        },
        {
            name: "delete_sticker",
            description: "Delete a sticker from the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    stickerName: {
                        type: "string",
                        description: "Name of the sticker to delete"
                    }
                },
                required: ["stickerName"]
            }
        }
    ];
}

module.exports = { getEmojiStickerTools };
