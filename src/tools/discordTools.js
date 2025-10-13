// src/tools/discordTools.js
/**
 * Discord Tool Definitions for Claude AI Agent
 * Aggregates all Discord operations from modular category files
 * 
 * This file imports and combines tools from 11 focused modules:
 * - inspectionTools: Server inspection and information retrieval
 * - channelTools: Channel management, voice/stage, permissions, forums
 * - roleTools: Role management, permissions, and hierarchy
 * - memberTools: Member management and moderation
 * - messageTools: Message and reaction management
 * - threadTools: Thread management and forum posts
 * - eventTools: Scheduled event management
 * - emojiStickerTools: Emoji and sticker management
 * - serverTools: Server settings, invites, webhooks, automod
 * - autoMessageTools: Automatic message management (welcome, goodbye, scheduled, etc.)
 * - ticketTools: Thread-based ticketing system with transcripts
 */

const { getInspectionTools } = require('./categories/inspectionTools');
const { getChannelTools } = require('./categories/channelTools');
const { getRoleTools } = require('./categories/roleTools');
const { getMemberTools } = require('./categories/memberTools');
const { getMessageTools } = require('./categories/messageTools');
const { getThreadTools } = require('./categories/threadTools');
const { getEventTools } = require('./categories/eventTools');
const { getEmojiStickerTools } = require('./categories/emojiStickerTools');
const { getServerTools } = require('./categories/serverTools');
const { getAutoMessageTools } = require('./categories/autoMessageTools');
const { getTicketTools } = require('./categories/ticketTools');

/**
 * Get all Discord tools available to Claude
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of tool definitions from all categories
 */
function getDiscordTools(guild) {
    return [
        ...getInspectionTools(guild),
        ...getChannelTools(guild),
        ...getRoleTools(guild),
        ...getMemberTools(guild),
        ...getMessageTools(guild),
        ...getThreadTools(guild),
        ...getEventTools(guild),
        ...getEmojiStickerTools(guild),
        ...getServerTools(guild),
        ...getAutoMessageTools(guild),
        ...getTicketTools(guild)
    ];
}

module.exports = { getDiscordTools };
