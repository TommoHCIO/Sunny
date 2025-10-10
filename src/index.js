// src/index.js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const winston = require('winston');
const http = require('http');

// Load environment variables
dotenv.config();

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

// Connect to MongoDB
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => {
        logger.info('✅ Connected to MongoDB');
    })
    .catch((error) => {
        logger.error('❌ MongoDB connection error:', error);
        logger.warn('⚠️  Bot will run without database (context won\'t persist)');
    });
} else {
    logger.warn('⚠️  MONGODB_URI not set - running without database');
}

// Bot ready event
client.once('ready', async () => {
    logger.info(`✅ Sunny is online! Logged in as ${client.user.tag}`);
    logger.info(`📊 Serving ${client.guilds.cache.size} server(s)`);
    
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
});

// Message events
client.on('messageCreate', async (message) => {
    try {
        await messageHandler(client, message);
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

process.on('unhandledRejection', async (error) => {
    logger.error('Unhandled promise rejection:', error);
    await debugService.logError(error, { source: 'Unhandled Rejection' });
});

process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception:', error);
    await debugService.logError(error, { source: 'Uncaught Exception' });
    // Don't exit immediately - give time for log to send
    setTimeout(() => process.exit(1), 1000);
});

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
