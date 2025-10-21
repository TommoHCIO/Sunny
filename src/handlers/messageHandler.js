// src/handlers/messageHandler.js
const { detectTrigger } = require('../utils/triggerDetection');
const agentService = require('../services/agentService');
const contextService = require('../services/contextService');
const debugService = require('../services/debugService');
const messageTracker = require('../utils/messageTracker');
const moderationService = require('../services/moderationService');
const statusService = require('../services/statusService');
const { splitMessage } = require('../utils/messageSplitter');
const memoryService = require('../services/memoryService');
const outcomeTracker = require('../services/outcomeTracker');
const messageComplexity = require('../utils/messageComplexity');
const { getExecutionMetadata } = require('../services/providers/zaiProvider');

// Bot startup time - used to filter out old messages
const BOT_START_TIME = Date.now();

module.exports = async function handleMessage(client, message) {
    const executionId = debugService.generateExecutionId();
    const startTime = Date.now();

    // Ignore bot messages EXCEPT whitelisted bots (prevent loops)
    if (message.author.bot) {
        // Always ignore Sunny's own messages (prevent infinite loops)
        if (message.author.id === client.user.id) {
            return; // Silent ignore
        }

        // Check if this bot is whitelisted (e.g., Claudee for MCP integration)
        const whitelistedBots = process.env.WHITELISTED_BOT_IDS
            ? process.env.WHITELISTED_BOT_IDS.split(',').map(id => id.trim())
            : [];

        if (!whitelistedBots.includes(message.author.id)) {
            return; // Ignore non-whitelisted bots
        }

        console.log(`✅ Processing message from whitelisted bot: ${message.author.tag}`);
    }

    // Ignore messages created before bot started (prevents processing old messages on startup)
    const messageAge = Date.now() - message.createdTimestamp;
    const botUptime = Date.now() - BOT_START_TIME;
    if (message.createdTimestamp < BOT_START_TIME && botUptime < 60000) {
        // Bot has been up less than 60 seconds, and message is older than bot start
        console.log(`🕰️ Ignoring old message from ${message.author.tag} (created ${Math.floor(messageAge / 1000)}s ago)`);
        return;
    }

    // Log messageCreate event for real user messages
    await debugService.logEvent('messageCreate', {
        id: message.id,
        author: message.author,
        channel: message.channel,
        content: message.content,
        isBot: message.author.bot,
        hasGuild: !!message.guild,
        messageAge: `${Math.floor(messageAge / 1000)}s`
    }, executionId);

    // Ignore DMs for now (can add support later)
    if (!message.guild) {
        console.log(`📪 Ignoring DM from ${message.author.tag}`);
        return;
    }

    // Add message to context (for all messages)
    await contextService.addMessage(message.channel.id, message);

    // Record interaction for memory system (if enabled)
    await memoryService.recordInteraction(message);
    
    // Check for violations BEFORE deciding if Sunny should respond
    // This ensures harmful messages are moderated even if they don't @mention Sunny
    const moderationResult = await moderationService.checkMessage(message);
    if (moderationResult && moderationResult.success) {
        // Autonomous action taken - send brief notification
        try {
            await message.reply(moderationResult.message);
        } catch (error) {
            console.error('Failed to send moderation message:', error);
        }
        // Don't continue processing - let the timeout speak for itself
        return;
    }

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

    // Create EventEmitter for real-time status updates
    const { EventEmitter } = require('events');
    const statusEmitter = new EventEmitter();

    // Start visual status tracking with event emitter
    let statusTracker = null;
    statusTracker = await statusService.start(message, statusEmitter);

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

        // Initialize interaction tracking for outcome learning
        const interaction = {
            startTime: Date.now(),
            userId: message.author.id,
            guildId: message.guild.id,
            channelId: message.channel.id,
            query: message.content,
            hasAttachments: message.attachments.size > 0,
            executionId: executionId,
            instanceId: debugService.getInstanceInfo().instanceId,
            success: false
        };

        // Capture predicted complexity for learning
        const complexitySummary = messageComplexity.getComplexitySummary(
            message.content,
            interaction.hasAttachments
        );
        interaction.predictedComplexity = complexitySummary.complexity;
        interaction.complexityScore = complexitySummary.score;

        await debugService.logMessageFlow('agent_start', message.id, {
            'Context Length': `${context.length} chars`,
            'User Message': message.content
        }, executionId);

        console.log(`🚀 Calling agentService.runAgent...`);
        // Run AI agent with agentic loop and real-time status updates
        // The agent will emit events that update the status indicator in real-time
        const finalResponse = await agentService.runAgent(
            message.content,
            context,
            message.author,
            message.guild,
            message.channel,
            statusEmitter,  // Pass event emitter for real-time status updates
            executionId     // Pass executionId for outcome tracking (AGI learning)
        );

        const processingTime = Date.now() - startTime;
        console.log(`📨 Received finalResponse from agent (${processingTime}ms)`);
        console.log(`   Length: ${finalResponse?.length || 0} chars`);
        console.log(`   Preview: ${finalResponse?.substring(0, 100)}...`);

        // Capture execution metadata for outcome tracking
        const metadata = getExecutionMetadata(executionId);
        if (metadata) {
            interaction.modelUsed = metadata.modelUsed;
            interaction.modelReasoning = metadata.modelReasoning;
            interaction.complexityScore = metadata.complexityScore;
            interaction.iterations = metadata.iterations;
            interaction.toolsUsed = metadata.toolsUsed;
            interaction.errors = metadata.errors;
            interaction.finishReason = metadata.finishReason;
        }
        interaction.duration = Date.now() - interaction.startTime;
        interaction.success = !!finalResponse && !finalResponse.includes('Something went wrong');
        interaction.responseLength = finalResponse?.length || 0;

        await debugService.logMessageFlow('agent_complete', message.id, {
            'Response Length': `${finalResponse?.length || 0} chars`,
            'Processing Time': `${processingTime}ms`,
            'Response Preview': finalResponse?.substring(0, 200)
        }, executionId);

        // Send response
        if (finalResponse) {
            // Add instance watermark to track which instance sent this response
            const instanceInfo = debugService.getInstanceInfo();
            const watermark = `\n\n-# Instance: \`${instanceInfo.instanceId}\` | PID: \`${instanceInfo.pid}\` | Exec: \`${executionId.substring(0, 8)}\``;

            // Split message if it exceeds Discord's 4000 character limit
            const messageParts = splitMessage(finalResponse, watermark);

            await debugService.logMessageFlow('sending', message.id, {
                'Response': finalResponse.substring(0, 500),
                'Response Length': `${finalResponse.length} chars`,
                'Message Parts': messageParts.length,
                'Instance ID': instanceInfo.instanceId,
                'PID': instanceInfo.pid,
                'Execution ID': executionId
            }, executionId);

            // Stop and delete status message before sending final response
            if (statusTracker) {
                await statusTracker.stop();
            }

            console.log(`💬 Sending reply to Discord...`);
            console.log(`   Response length: ${finalResponse.length} chars`);
            console.log(`   Split into ${messageParts.length} message(s)`);
            console.log(`   Instance watermark: ${instanceInfo.instanceId} | PID: ${instanceInfo.pid}`);

            // Send all message parts
            let firstMessage = null;
            const sentMessages = [];

            for (let i = 0; i < messageParts.length; i++) {
                const part = messageParts[i];
                const isFirst = i === 0;

                try {
                    let sentMessage;
                    if (isFirst) {
                        // Reply to original message for first part
                        sentMessage = await message.reply(part);
                        firstMessage = sentMessage;
                        console.log(`✅ Reply sent (part ${i + 1}/${messageParts.length})! Message ID: ${sentMessage.id}`);
                    } else {
                        // Send follow-up messages as regular messages
                        sentMessage = await message.channel.send(part);
                        console.log(`✅ Follow-up sent (part ${i + 1}/${messageParts.length})! Message ID: ${sentMessage.id}`);
                    }
                    sentMessages.push(sentMessage);
                } catch (sendError) {
                    // If the original message was deleted, send all parts as standalone
                    if (isFirst && (sendError.code === 50035 || sendError.code === 10008)) {
                        console.log(`⚠️  Original message deleted, sending as standalone message`);
                        const sentMessage = await message.channel.send(part);
                        sentMessages.push(sentMessage);
                        console.log(`✅ Standalone message sent (part ${i + 1}/${messageParts.length})! Message ID: ${sentMessage.id}`);
                    } else {
                        // Re-throw other errors
                        throw sendError;
                    }
                }
            }

            await debugService.logMessageFlow('sent', message.id, {
                'Reply Message ID': firstMessage?.id || sentMessages[0]?.id,
                'Message Count': sentMessages.length,
                'Total Time': `${Date.now() - startTime}ms`,
                'Instance ID': instanceInfo.instanceId
            }, executionId);

            // Add all sent messages to context
            for (const sentMessage of sentMessages) {
                await contextService.addMessage(message.channel.id, sentMessage);
            }

            // Add user satisfaction tracking (thumbs up/down reactions)
            // Fire-and-forget - failures won't break main execution
            if (firstMessage || sentMessages[0]) {
                const targetMessage = firstMessage || sentMessages[0];
                try {
                    // Add reaction options for user feedback
                    await targetMessage.react('👍');
                    await targetMessage.react('👎');

                    // Create reaction collector with 60-second timeout (Discord.js best practice)
                    const filter = (reaction, user) =>
                        ['👍', '👎'].includes(reaction.emoji.name) &&
                        user.id === message.author.id;

                    const collector = targetMessage.createReactionCollector({
                        filter,
                        time: 60000, // 60 seconds
                        max: 1 // Only collect first reaction
                    });

                    collector.on('collect', (reaction) => {
                        interaction.userSatisfaction = reaction.emoji.name === '👍' ? 1 : -1;
                        interaction.userReacted = true;
                        console.log(`📊 User reaction captured: ${reaction.emoji.name}`);
                    });

                    collector.on('end', async (collected, reason) => {
                        console.log(`📊 Reaction collector ended (${reason}), recording outcome...`);
                        // Fire-and-forget outcome recording - never blocks
                        outcomeTracker.recordOutcome(interaction).catch(err =>
                            console.error('[messageHandler] Failed to save outcome:', err)
                        );
                    });
                } catch (reactionError) {
                    // Reaction tracking failed (e.g., message deleted, permissions)
                    console.error('[messageHandler] Failed to add satisfaction tracking:', reactionError);
                    // Still record outcome without user satisfaction
                    outcomeTracker.recordOutcome(interaction).catch(() => {});
                }
            }
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

        // Stop status tracking on error
        if (statusTracker) {
            await statusTracker.stop();
        }

        await debugService.logError(error, {
            'Message ID': message.id,
            'Author': message.author.tag,
            'Content': message.content,
            'Processing Time': `${Date.now() - startTime}ms`
        }, executionId);

        // Try to send error message, fall back to channel send if reply fails
        try {
            await message.reply(
                "Oops! Something went wrong on my end 🍂 Let me try again or ask our server owner for help if this keeps happening!"
            );
        } catch (replyError) {
            // If message was deleted, send to channel instead
            if (replyError.code === 50035 || replyError.code === 10008) {
                await message.channel.send(
                    "Oops! Something went wrong on my end 🍂 Let me try again or ask our server owner for help if this keeps happening!"
                ).catch(err => console.error('Could not send error message:', err));
            } else {
                console.error('Could not send error message:', replyError);
            }
        }
    }
};


