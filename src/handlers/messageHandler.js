// src/handlers/messageHandler.js
const { detectTrigger } = require('../utils/triggerDetection');
const agentService = require('../services/agentService');
const contextService = require('../services/contextService');
const debugService = require('../services/debugService');
const messageTracker = require('../utils/messageTracker');

module.exports = async function handleMessage(client, message) {
    const executionId = debugService.generateExecutionId();
    const startTime = Date.now();

    // Log EVERY messageCreate event (even if we don't process it)
    await debugService.logEvent('messageCreate', {
        id: message.id,
        author: message.author,
        channel: message.channel,
        content: message.content,
        isBot: message.author.bot,
        hasGuild: !!message.guild
    }, executionId);

    // Ignore bot messages (prevent loops)
    if (message.author.bot) {
        console.log(`🤖 Ignoring bot message from ${message.author.tag}`);
        return;
    }

    // Ignore DMs for now (can add support later)
    if (!message.guild) {
        console.log(`📪 Ignoring DM from ${message.author.tag}`);
        return;
    }

    // Add message to context (for all messages)
    await contextService.addMessage(message.channel.id, message);

    // Detect if Sunny should respond
    const triggerResult = await detectTrigger(client, message);

    if (!triggerResult.triggered) {
        return;
    }

    await debugService.logMessageFlow('received', message.id, {
        'Trigger Type': triggerResult.type,
        'Author': `${message.author.tag} (${message.author.id})`,
        'Channel': `#${message.channel.name}`,
        'Content': message.content
    }, executionId);

    // Check if we've already processed this message (with TTL-based tracking)
    const trackingInfo = messageTracker.checkMessage(message.id);
    
    if (trackingInfo.isProcessed) {
        console.error(`🚨 DUPLICATE EVENT DETECTED!`);
        console.error(`   Message ID: ${message.id}`);
        console.error(`   Current Execution ID: ${executionId}`);
        console.error(`   Original Execution ID: ${trackingInfo.executionId}`);
        console.error(`   Process Count: ${trackingInfo.count}`);
        console.error(`   Instance: ${debugService.getInstanceInfo().instanceId}`);
        console.error(`   PID: ${process.pid}`);
        
        await debugService.logError(
            new Error('DUPLICATE MESSAGE EVENT'),
            {
                'Message ID': message.id,
                'Current Execution': executionId,
                'Original Execution': trackingInfo.executionId,
                'Process Count': trackingInfo.count,
                'Author': message.author.tag,
                'Content': message.content
            },
            executionId
        );
        return;
    }

    // Mark as processed
    const processCount = messageTracker.markProcessed(message.id, executionId);
    console.log(`✅ Message ${message.id} marked as processed (count: ${processCount})`);
    console.log(`   Execution ID: ${executionId}`);
    console.log(`   Instance: ${debugService.getInstanceInfo().instanceId}`);
    console.log(`   PID: ${process.pid}`);
    console.log(`[${triggerResult.type}] ${message.author.tag}: ${message.content}`);

    // Show typing indicator
    await message.channel.sendTyping();

    try {
        await debugService.logMessageFlow('processing', message.id, {
            'Building Context': 'Fetching conversation history...'
        }, executionId);

        // Build context for AI
        const context = await contextService.buildContextPrompt(
            message.channel.id,
            message,
            triggerResult.replyContext
        );

        await debugService.logMessageFlow('agent_start', message.id, {
            'Context Length': `${context.length} chars`,
            'User Message': message.content
        }, executionId);

        console.log(`🚀 Calling agentService.runAgent...`);
        // Run AI agent with agentic loop
        // The agent will handle tool selection, execution, and multi-step reasoning
        const finalResponse = await agentService.runAgent(
            message.content,
            context,
            message.author,
            message.guild
        );

        const processingTime = Date.now() - startTime;
        console.log(`📨 Received finalResponse from agent (${processingTime}ms)`);
        console.log(`   Length: ${finalResponse?.length || 0} chars`);
        console.log(`   Preview: ${finalResponse?.substring(0, 100)}...`);

        await debugService.logMessageFlow('agent_complete', message.id, {
            'Response Length': `${finalResponse?.length || 0} chars`,
            'Processing Time': `${processingTime}ms`,
            'Response Preview': finalResponse?.substring(0, 200)
        }, executionId);

        // Send response
        if (finalResponse) {
            await debugService.logMessageFlow('sending', message.id, {
                'Response': finalResponse.substring(0, 500)
            }, executionId);

            console.log(`💬 Sending reply to Discord...`);
            const sentMessage = await message.reply(finalResponse);
            console.log(`✅ Reply sent! Message ID: ${sentMessage.id}`);

            await debugService.logMessageFlow('sent', message.id, {
                'Reply Message ID': sentMessage.id,
                'Total Time': `${Date.now() - startTime}ms`
            }, executionId);

            // Add Sunny's response to context
            await contextService.addMessage(message.channel.id, sentMessage);
        } else {
            console.log(`⚠️  finalResponse was empty/null`);
            await debugService.logError(
                new Error('Empty response from agent'),
                { 'Message': message.content },
                executionId
            );
        }

    } catch (error) {
        console.error('Error handling Sunny interaction:', error);
        
        await debugService.logError(error, {
            'Message ID': message.id,
            'Author': message.author.tag,
            'Content': message.content,
            'Processing Time': `${Date.now() - startTime}ms`
        }, executionId);

        await message.reply(
            "Oops! Something went wrong on my end 🍂 Let me try again or ask our server owner for help if this keeps happening!"
        ).catch(err => console.error('Could not send error message:', err));
    }
};


