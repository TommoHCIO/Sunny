// src/handlers/errorHandler.js
const winston = require('winston');

const logger = winston.createLogger({
    level: 'error',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * Handle errors gracefully and send user-friendly messages
 * @param {Message} message - Discord message object
 * @param {Error} error - Error that occurred
 */
async function handleError(message, error) {
    logger.error('Error handling message:', {
        error: error.message,
        stack: error.stack,
        messageId: message?.id,
        channelId: message?.channel?.id,
        authorId: message?.author?.id
    });

    // Don't try to send messages if the message object is invalid
    if (!message || !message.channel) {
        return;
    }

    try {
        // Send user-friendly error message
        await message.channel.send(
            "Oops! Something went wrong on my end. 🍂 Let me try that again, or feel free to rephrase your message!"
        );
    } catch (sendError) {
        // If we can't send the error message, just log it
        logger.error('Failed to send error message to user:', sendError);
    }
}

module.exports = handleError;
