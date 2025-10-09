// src/services/claudeService.js
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY
});

// Load personality prompt once at startup
let personalityPrompt = null;

async function loadPersonality() {
    if (!personalityPrompt) {
        const promptPath = path.join(__dirname, '../../config/personality.txt');
        try {
            personalityPrompt = await fs.readFile(promptPath, 'utf-8');
            
            // Replace placeholders
            personalityPrompt = personalityPrompt
                .replace('[OWNER_ID]', process.env.DISCORD_OWNER_ID || 'Not Set')
                .replace('[OWNER_USERNAME]', 'Server Owner')
                .replace('[LEVEL_1_2_OR_3]', process.env.MODERATION_LEVEL || '2');
        } catch (error) {
            console.warn('⚠️  Could not load personality.txt, using default');
            personalityPrompt = getDefaultPersonality();
        }
    }
    return personalityPrompt;
}

function getDefaultPersonality() {
    return `You are Sunny, the AI administrator and head moderator of The Nook, a cozy autumn-themed Discord community where everyone belongs.

You are warm, friendly, and welcoming. You use casual language and autumn-themed emojis like 🍂🍁☕🧡. You help members feel at home while keeping the community safe.

Keep responses concise (2-4 sentences usually) but complete. Be genuinely helpful and maintain The Nook's cozy atmosphere.`;
}

/**
 * Get response from Claude API
 */
async function getResponse(userMessage, conversationContext, author) {
    const personality = await loadPersonality();
    
    // Check if user is owner
    const isOwner = String(author.id) === String(process.env.DISCORD_OWNER_ID);
    const ownerStatus = isOwner ? ' (SERVER OWNER)' : '';
    
    // Build full prompt
    const fullPrompt = `
${conversationContext}

Current user: ${author.username} (ID: ${author.id})${ownerStatus}

${isOwner ? 'IMPORTANT: This user is the SERVER OWNER. You can execute owner-only actions like CREATE_CHANNEL, DELETE_CHANNEL, CREATE_CATEGORY, BAN, etc. when they request them.\n\n' : ''}
Respond to the current message as Sunny. Keep your response concise (2-4 sentences usually) but complete. Include appropriate autumn emojis 🍂🍁☕🧡.

If you need to take actions (add/remove roles, timeout, create/delete channels, etc.), include them in this format:
[ACTION: TYPE | DETAILS]

Examples:
[ACTION: ADD_ROLE | roleName: Artist]
[ACTION: TIMEOUT | userId: ${author.id} | duration: 10 | reason: Spam]
[ACTION: DELETE_CHANNEL | channelName: general]
[ACTION: CREATE_CATEGORY | categoryName: WELCOME]
    `;
    
    try {
        const response = await anthropic.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 500,
            temperature: 0.7,
            system: [
                {
                    type: 'text',
                    text: personality,
                    cache_control: { type: 'ephemeral' }  // Cache personality for 5 min
                }
            ],
            messages: [
                {
                    role: 'user',
                    content: fullPrompt
                }
            ]
        });
        
        return response.content[0].text;
        
    } catch (error) {
        console.error('Claude API error:', error);
        
        // Fallback responses
        if (error.status === 429) {
            return "Whoa, I'm a bit overwhelmed right now! 🍂 Give me a moment to catch my breath and try again!";
        } else if (error.status === 500) {
            return "My brain is having a moment 😅 Let me try that again in a sec!";
        } else if (error.message && error.message.includes('API key')) {
            return "Oops! There's an issue with my configuration 🍂 Let the server owner know!";
        } else {
            throw error;
        }
    }
}

/**
 * Parse AI response for text and actions
 */
async function parseResponse(aiResponse) {
    const actions = [];
    let text = aiResponse;
    
    // Extract actions using regex - match complete action tags
    const actionPattern = /\[ACTION: (\w+)([^\]]+)\]/g;
    const matches = [...aiResponse.matchAll(actionPattern)];
    
    for (const match of matches) {
        const actionType = match[1];
        const details = match[2];
        
        // Parse details (format: | key: value | key: value)
        const detailsObj = {};
        const detailPattern = /\| (\w+): ([^|]+)/g;
        const detailMatches = [...details.matchAll(detailPattern)];
        
        for (const detailMatch of detailMatches) {
            detailsObj[detailMatch[1].trim()] = detailMatch[2].trim();
        }
        
        actions.push({
            type: actionType,
            ...detailsObj
        });
    }
    
    // Remove ALL action tags from text using global replace
    text = text.replace(/\[ACTION:[^\]]+\]/g, '');
    
    // Clean up multiple newlines and extra whitespace
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    
    return {
        text: text || null,
        actions: actions
    };
}

module.exports = {
    getResponse,
    parseResponse
};
