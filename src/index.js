// src/index.js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const winston = require('winston');
const http = require('http');

// Load environment variables
dotenv.config();

// Validate environment before proceeding
const { validateOrExit } = require('./config/validator');
const validatedConfig = validateOrExit();

// Configure logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions  // Added for reaction roles
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],  // Added Reaction partial
    // Disable REST retries to prevent duplicate messages
    // This fixes the issue where failed API requests are retried but the first request actually succeeded
    rest: {
        timeout: 30000,  // 30 second timeout
        retries: 0       // Disable automatic retries (prevents duplicate messages)
    }
});

// Import handlers and services
const messageHandler = require('./handlers/messageHandler');
const memberHandler = require('./handlers/memberHandler');
const errorHandler = require('./handlers/errorHandler');
const debugService = require('./services/debugService');
const messageTracker = require('./utils/messageTracker');
const { detectBotProcesses, logProcessInfo } = require('./utils/processDetector');
const reactionRoleService = require('./services/reactionRoleService');
const moderationService = require('./services/moderationService');
const databaseService = require('./services/database/databaseService');
const autoMessageService = require('./services/autoMessageService');
const ticketService = require('./services/ticketService');

// Connect to MongoDB (async function to await connection)
let mongoConnected = false;
const connectMongoDB = async () => {
    if (process.env.MONGODB_URI) {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            logger.info('✅ Connected to MongoDB');
            mongoConnected = true;
        } catch (error) {
            logger.error('❌ MongoDB connection error:', error);
            logger.warn('⚠️  Bot will run without database (context won\'t persist)');
            mongoConnected = false;
        }
    } else {
        logger.warn('⚠️  MONGODB_URI not set - running without database');
        mongoConnected = false;
    }
};

// Start MongoDB connection (don't await here, will await in ready event)
connectMongoDB();

// Bot ready event
client.once('ready', async () => {
    logger.info(`✅ Sunny is online! Logged in as ${client.user.tag}`);
    logger.info(`📊 Serving ${client.guilds.cache.size} server(s)`);
    
    // Validate bot permissions in all guilds
    const { getMissingCriticalPermissions, canTimeout } = require('./utils/permissions');
    for (const [guildId, guild] of client.guilds.cache) {
        const missingPerms = getMissingCriticalPermissions(guild);
        if (missingPerms.length > 0) {
            logger.warn(`⚠️  Missing permissions in ${guild.name}: ${missingPerms.join(', ')}`);
            logger.warn(`   Bot functionality will be limited. Please grant these permissions.`);
        } else {
            logger.info(`✅ All critical permissions granted in ${guild.name}`);
        }
        
        if (!canTimeout(guild)) {
            logger.warn(`⚠️  Cannot timeout members in ${guild.name} - autonomous moderation disabled`);
        }
    }
    
    // Detect multiple bot instances
    try {
        const processes = await detectBotProcesses();
        logProcessInfo(processes);
        
        // Send process info to debug channel
        const instanceInfo = debugService.getInstanceInfo();
        logger.info(`🏷️  Instance ID: ${instanceInfo.instanceId}`);
        logger.info(`🔢 Process ID: ${instanceInfo.pid}`);
    } catch (error) {
        logger.error('⚠️  Failed to detect processes:', error);
    }
    
    // Initialize debug channel
    try {
        await debugService.initialize(client);
        logger.info('🔍 Debug monitoring initialized');
    } catch (error) {
        logger.error('⚠️  Failed to initialize debug monitoring:', error);
    }
    
    // Wait for MongoDB connection to complete before loading reaction roles
    // This ensures we don't try to load from DB before connection is ready
    let retries = 0;
    const maxRetries = 10;
    while (!mongoConnected && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
        retries++;
    }
    
    if (mongoConnected) {
        logger.info('⏳ MongoDB ready, loading reaction roles...');
    } else {
        logger.warn('⚠️  MongoDB not connected, skipping reaction role load');
    }
    
    // Load reaction roles from database
    try {
        const result = await reactionRoleService.loadReactionRoles(client);
        if (result.success && result.count > 0) {
            logger.info(`✅ Loaded ${result.count} reaction role(s) from database`);
        } else if (result.count === 0) {
            logger.info('📭 No reaction roles in database');
        }
    } catch (error) {
        logger.error('⚠️  Failed to load reaction roles:', error);
    }
    
    // Initialize scheduled messages (cron jobs)
    try {
        await autoMessageService.initializeScheduledMessages(client);
        logger.info('✅ Scheduled messages initialized');
    } catch (error) {
        logger.error('⚠️  Failed to initialize scheduled messages:', error);
    }
    
    // Set bot status
    client.user.setPresence({
        activities: [{ name: 'The Nook 🍂', type: 3 }], // Type 3 = Watching
        status: 'online'
    });
    
    // Log stats every 5 minutes
    setInterval(async () => {
        try {
            await debugService.logStats();
            const trackerStats = messageTracker.getStats();
            logger.info('📊 Tracker stats:', trackerStats);
        } catch (error) {
            logger.error('Failed to log stats:', error);
        }
    }, 5 * 60 * 1000);
    
    // Database cleanup every 6 hours
    setInterval(async () => {
        try {
            if (mongoose.connection.readyState === 1) {
                logger.info('🧹 Running database cleanup...');
                const cleanupResults = await databaseService.runCleanup();
                logger.info(`✅ Cleanup complete - Warnings: ${cleanupResults.warnings}, Conversations: ${cleanupResults.conversations}`);
                
                // Log database stats
                const dbStats = await databaseService.getDatabaseStats();
                logger.info('📊 Database stats:', dbStats);
            }
        } catch (error) {
            logger.error('❌ Database cleanup failed:', error);
        }
    }, 6 * 60 * 60 * 1000); // Every 6 hours
});

// Message events
client.on('messageCreate', async (message) => {
    try {
        await messageHandler(client, message);
        
        // Check for trigger-based auto messages
        await autoMessageService.checkTriggers(message);
    } catch (error) {
        logger.error('Error in messageCreate:', error);
        errorHandler(message, error);
    }
});

// Member events
client.on('guildMemberAdd', async (member) => {
    try {
        await memberHandler.onMemberJoin(client, member);
    } catch (error) {
        logger.error('Error in guildMemberAdd:', error);
    }
});

client.on('guildMemberRemove', async (member) => {
    try {
        await memberHandler.onMemberLeave(client, member);
    } catch (error) {
        logger.error('Error in guildMemberRemove:', error);
    }
});

// Reaction events (for reaction roles)
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        // Fetch partial reactions
        if (reaction.partial) {
            await reaction.fetch();
        }

        const guild = reaction.message.guild;
        if (guild) {
            await reactionRoleService.handleReactionAdd(reaction, user, guild);
        }
    } catch (error) {
        logger.error('Error in messageReactionAdd:', error);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    try {
        // Fetch partial reactions
        if (reaction.partial) {
            await reaction.fetch();
        }

        const guild = reaction.message.guild;
        if (guild) {
            await reactionRoleService.handleReactionRemove(reaction, user, guild);
        }
    } catch (error) {
        logger.error('Error in messageReactionRemove:', error);
    }
});

// Button interaction events (for ticket management and ticket panel)
client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isButton()) return;
        
        const customId = interaction.customId;
        
        // Handle ticket panel buttons (create new ticket)
        if (customId.startsWith('ticket_panel_')) {
            await interaction.deferReply({ ephemeral: true });
            
            const action = customId.replace('ticket_panel_', '');
            
            if (action === 'create') {
                // For now, send instructions to use text command
                // TODO: Implement modal form for ticket creation
                await interaction.editReply(
                    '🎫 **Create a Ticket**\n\n' +
                    'To create a ticket, please send a message in this channel like:\n' +
                    '`sunny create a support ticket about [your issue]`\n\n' +
                    '**Example:**\n' +
                    '`sunny create a support ticket about role permissions not working`'
                );
            } else if (action === 'view') {
                // View user's tickets
                try {
                    const tickets = await ticketService.listTickets(interaction.guild.id, {
                        creatorId: interaction.user.id,
                        status: { $in: ['open', 'in-progress'] }
                    });
                    
                    if (tickets.length === 0) {
                        await interaction.editReply('📭 You have no open tickets.');
                    } else {
                        const ticketList = tickets.map(t => 
                            `**Ticket #${t.ticketNumber}** - ${t.subject}\n` +
                            `Status: ${t.status} | Category: ${t.category}`
                        ).join('\n\n');
                        
                        await interaction.editReply(`🎫 **Your Open Tickets:**\n\n${ticketList}`);
                    }
                } catch (error) {
                    await interaction.editReply(`❌ Failed to view tickets: ${error.message}`);
                }
            }
        }
        
        // Handle ticket management buttons (on existing tickets)
        if (customId.startsWith('ticket_')) {
            await interaction.deferReply({ ephemeral: true });
            
            const [action, type, ticketId] = customId.split('_');
            
            if (type === 'claim') {
                try {
                    await ticketService.assignTicket(ticketId, interaction.member);
                    await interaction.editReply('✅ Ticket claimed successfully!');
                } catch (error) {
                    await interaction.editReply(`❌ Failed to claim ticket: ${error.message}`);
                }
            } else if (type === 'close') {
                try {
                    await ticketService.closeTicket(ticketId, interaction.member, 'Closed by staff');
                    await interaction.editReply('✅ Ticket closed successfully!');
                } catch (error) {
                    await interaction.editReply(`❌ Failed to close ticket: ${error.message}`);
                }
            } else if (type === 'priority') {
                // Simple priority toggle: normal -> high -> urgent -> normal
                try {
                    const ticket = await ticketService.getTicket(ticketId);
                    let newPriority = 'high';
                    if (ticket.priority === 'normal') newPriority = 'high';
                    else if (ticket.priority === 'high') newPriority = 'urgent';
                    else if (ticket.priority === 'urgent') newPriority = 'normal';
                    
                    await ticketService.updateTicketPriority(ticketId, newPriority);
                    await interaction.editReply(`✅ Ticket priority updated to: ${newPriority}`);
                } catch (error) {
                    await interaction.editReply(`❌ Failed to update priority: ${error.message}`);
                }
            }
        }
    } catch (error) {
        logger.error('Error in interactionCreate:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An error occurred processing this interaction.', ephemeral: true });
        }
    }
});

// Discord client events (for monitoring)
client.on('error', async (error) => {
    logger.error('Discord client error:', error);
    await debugService.logError(error, { source: 'Discord Client' });
});

client.on('warn', async (info) => {
    logger.warn('Discord client warning:', info);
    await debugService.logEvent('warn', { message: info });
});

client.on('disconnect', async () => {
    logger.warn('⚠️  Discord client disconnected');
    await debugService.logEvent('disconnect', { timestamp: new Date().toISOString() });
});

client.on('reconnecting', async () => {
    logger.info('🔄 Discord client reconnecting...');
    await debugService.logEvent('reconnecting', { timestamp: new Date().toISOString() });
});

client.on('resume', async () => {
    logger.info('✅ Discord client resumed');
    await debugService.logEvent('resume', { timestamp: new Date().toISOString() });
});

// Enhanced error handling with categorization
process.on('unhandledRejection', async (error) => {
    logger.error('❌ Unhandled promise rejection:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
    });
    
    // Categorize Discord API errors
    if (error.code) {
        const errorCategory = categorizeDiscordError(error.code);
        logger.error(`   Category: ${errorCategory}`);
    }
    
    await debugService.logError(error, { 
        source: 'Unhandled Rejection',
        severity: 'critical'
    });
    
    // Exit on fatal errors only
    if (error.code === 'FATAL' || error.name === 'MongoServerError') {
        logger.error('   Fatal error detected, exiting in 2s...');
        setTimeout(() => process.exit(1), 2000);
    }
});

process.on('uncaughtException', async (error) => {
    logger.error('❌ Uncaught exception:', {
        error: error.message,
        stack: error.stack,
        name: error.name
    });
    await debugService.logError(error, { 
        source: 'Uncaught Exception',
        severity: 'critical' 
    });
    // Don't exit immediately - give time for log to send
    setTimeout(() => process.exit(1), 1000);
});

// Handle Discord WebSocket/Shard errors
client.on('shardError', async (error, shardId) => {
    logger.error(`🌐 WebSocket error on shard ${shardId}:`, {
        error: error.message,
        code: error.code,
        shard: shardId
    });
    
    await debugService.logError(error, {
        source: 'WebSocket',
        shardId,
        severity: 'high'
    });
});

// Handle rate limiting (for monitoring)
client.rest.on('rateLimited', (info) => {
    logger.warn('⏱️  Rate limited:', {
        timeout: `${info.timeout}ms`,
        limit: info.limit,
        method: info.method,
        path: info.path,
        route: info.route,
        global: info.global
    });
    
    // Log rate limit events to debug channel (non-blocking)
    debugService.logEvent('rate_limit', {
        timeout: info.timeout,
        method: info.method,
        route: info.route,
        timestamp: new Date().toISOString()
    }).catch(err => {
        logger.error('Failed to log rate limit event:', err);
    });
});

// Discord API error categorization helper
function categorizeDiscordError(code) {
    const categories = {
        // Permission errors
        50001: 'Missing Access',
        50013: 'Missing Permissions',
        50021: 'Cannot execute action on system message',
        
        // Resource errors
        10003: 'Unknown Channel',
        10004: 'Unknown Guild',
        10008: 'Unknown Message',
        10011: 'Unknown Role',
        10013: 'Unknown User',
        10014: 'Unknown Emoji',
        
        // Rate limit errors
        429: 'Rate Limited',
        
        // Validation errors
        50035: 'Invalid Form Body',
        50036: 'Invalid Message Target',
        
        // Other errors
        40060: 'Interaction Already Acknowledged',
        30001: 'Maximum number of guilds reached',
        30013: 'Maximum number of reactions reached'
    };
    
    return categories[code] || `Unknown Error (${code})`;
}

// Health check endpoint for Render.com (required for free tier)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            uptime: process.uptime(),
            bot: client.user ? client.user.tag : 'connecting...',
            servers: client.guilds.cache.size
        }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    logger.info(`🌐 Health check server listening on port ${PORT}`);
});

// Graceful shutdown handler
async function gracefulShutdown(signal) {
    logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
    logger.info(`   Instance ID: ${debugService.getInstanceInfo().instanceId}`);
    logger.info(`   PID: ${process.pid}`);
    
    try {
        // Log shutdown to debug channel
        await debugService.logEvent('shutdown', {
            signal,
            instanceId: debugService.getInstanceInfo().instanceId,
            pid: process.pid,
            uptime: process.uptime()
        });
    } catch (error) {
        logger.error('Failed to log shutdown:', error);
    }
    
    // Close HTTP server
    server.close(() => {
        logger.info('✅ HTTP server closed');
    });
    
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        logger.info('✅ MongoDB connection closed');
    }
    
    // Stop message tracker cleanup
    messageTracker.stopCleanup();
    
    // Destroy Discord client
    client.destroy();
    logger.info('✅ Discord client destroyed');
    
    logger.info('✅ Shutdown complete');
    process.exit(0);
}

// Handle SIGTERM (Render.com sends this on new deployment)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle SIGHUP (terminal closed)
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Export client for autoMessageService to access in scheduled messages
module.exports = { client };

// Login to Discord
if (!process.env.DISCORD_TOKEN) {
    logger.error('❌ DISCORD_TOKEN not set in environment variables!');
    logger.info('📝 Copy config/.env.example to config/.env and fill in your token');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN)
    .catch((error) => {
        logger.error('❌ Failed to login:', error);
        logger.info('💡 Make sure your DISCORD_TOKEN is correct in config/.env');
        process.exit(1);
    });
