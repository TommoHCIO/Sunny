// src/handlers/messageHandler.js
const { detectTrigger } = require('../utils/triggerDetection');
const agentService = require('../services/agentService');
const contextService = require('../services/contextService');

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
    console.log(`🔍 Message ID: ${message.id}`);

    // Show typing indicator
    await message.channel.sendTyping();

    try {
        // Build context for AI
        const context = await contextService.buildContextPrompt(
            message.channel.id,
            message,
            triggerResult.replyContext
        );

        console.log(`🚀 Calling agentService.runAgent...`);
        // Run AI agent with agentic loop
        // The agent will handle tool selection, execution, and multi-step reasoning
        const finalResponse = await agentService.runAgent(
            message.content,
            context,
            message.author,
            message.guild
        );

        console.log(`📨 Received finalResponse from agent`);
        console.log(`   Length: ${finalResponse?.length || 0} chars`);
        console.log(`   Preview: ${finalResponse?.substring(0, 100)}...`);

        // Send response
        if (finalResponse) {
            console.log(`💬 Sending reply to Discord...`);
            const sentMessage = await message.reply(finalResponse);
            console.log(`✅ Reply sent! Message ID: ${sentMessage.id}`);

            // Add Sunny's response to context
            await contextService.addMessage(message.channel.id, sentMessage);
        } else {
            console.log(`⚠️  finalResponse was empty/null`);
        }

    } catch (error) {
        console.error('Error handling Sunny interaction:', error);
        await message.reply(
            "Oops! Something went wrong on my end 🍂 Let me try again or ask our server owner for help if this keeps happening!"
        ).catch(err => console.error('Could not send error message:', err));
    }
};


