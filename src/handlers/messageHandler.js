// src/handlers/messageHandler.js
const { detectTrigger } = require('../utils/triggerDetection');
const claudeService = require('../services/claudeService');
const contextService = require('../services/contextService');
const ActionHandler = require('./actionHandler');

let actionHandler = null;

module.exports = async function handleMessage(client, message) {
    // Ignore bot messages (prevent loops)
    if (message.author.bot) return;
    
    // Ignore DMs for now (can add support later)
    if (!message.guild) return;
    
    // Add message to context (for all messages)
    await contextService.addMessage(message.channel.id, message);
    
    // Detect if Sunny should respond
    const triggerResult = await detectTrigger(client, message);
    
    if (!triggerResult.triggered) {
        return;
    }
    
    // Sunny was triggered!
    console.log(`[${triggerResult.type}] ${message.author.tag}: ${message.content}`);
    
    // Show typing indicator
    await message.channel.sendTyping();
    
    try {
        // Build context for AI
        const context = await contextService.buildContextPrompt(
            message.channel.id,
            message,
            triggerResult.replyContext
        );
        
        // Get AI response
        const aiResponse = await claudeService.getResponse(
            message.content,
            context,
            message.author
        );
        
        // Parse AI response for actions
        const parsed = await claudeService.parseResponse(aiResponse);
        
        // Initialize action handler if needed
        if (!actionHandler) {
            actionHandler = new ActionHandler(client);
        }
        
        // Execute actions
        for (const action of parsed.actions) {
            await actionHandler.execute(action, message);
        }
        
        // Send response
        if (parsed.text) {
            const sentMessage = await message.reply(parsed.text);
            
            // Add Sunny's response to context
            await contextService.addMessage(message.channel.id, sentMessage);
        }
        
    } catch (error) {
        console.error('Error handling Sunny interaction:', error);
        await message.reply(
            "Oops! Something went wrong on my end 🍂 Let me try again or ask our server owner for help if this keeps happening!"
        ).catch(err => console.error('Could not send error message:', err));
    }
};


