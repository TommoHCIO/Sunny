// src/index.js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const winston = require('winston');

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
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Import handlers
const messageHandler = require('./handlers/messageHandler');
const memberHandler = require('./handlers/memberHandler');
const errorHandler = require('./handlers/errorHandler');

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
client.once('ready', () => {
    logger.info(`✅ Sunny is online! Logged in as ${client.user.tag}`);
    logger.info(`📊 Serving ${client.guilds.cache.size} server(s)`);
    
    // Set bot status
    client.user.setPresence({
        activities: [{ name: 'The Nook 🍂', type: 3 }], // Type 3 = Watching
        status: 'online'
    });
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

// Error handling
client.on('error', (error) => {
    logger.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('🛑 Shutting down Sunny...');
    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
    }
    client.destroy();
    process.exit(0);
});

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
