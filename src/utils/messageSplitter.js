// src/utils/messageSplitter.js
/**
 * Message Splitter Utility
 * Splits long Discord messages to respect the 4000 character limit
 */

const DISCORD_MAX_LENGTH = 4000;
const SPLIT_MARKER = '\n\n---\n\n';
const CONTINUATION_PREFIX = '*(continued)*\n\n';

/**
 * Split a message into multiple parts if it exceeds Discord's character limit
 *
 * @param {string} message - The message to split
 * @param {string} watermark - Instance watermark to append to final message only
 * @returns {string[]} Array of message parts, each under 4000 characters
 */
function splitMessage(message, watermark = '') {
    // If message + watermark fits in one message, return as-is
    const totalLength = message.length + watermark.length;
    if (totalLength <= DISCORD_MAX_LENGTH) {
        return [message + watermark];
    }

    const parts = [];
    let remainingText = message;
    const watermarkLength = watermark.length;
    const continuationLength = CONTINUATION_PREFIX.length;

    // Calculate max length for first message and subsequent messages
    const firstMaxLength = DISCORD_MAX_LENGTH - SPLIT_MARKER.length;
    const subsequentMaxLength = DISCORD_MAX_LENGTH - continuationLength - watermarkLength;

    // Split first message
    if (remainingText.length > firstMaxLength) {
        const splitIndex = findGoodSplitPoint(remainingText, firstMaxLength);
        parts.push(remainingText.substring(0, splitIndex) + SPLIT_MARKER);
        remainingText = remainingText.substring(splitIndex);
    }

    // Split remaining text into chunks
    while (remainingText.length > 0) {
        const isLastChunk = remainingText.length <= subsequentMaxLength;

        if (isLastChunk) {
            // Last chunk - add watermark
            parts.push(CONTINUATION_PREFIX + remainingText + watermark);
            break;
        } else {
            // Not last chunk - continue splitting
            const maxLength = subsequentMaxLength - SPLIT_MARKER.length;
            const splitIndex = findGoodSplitPoint(remainingText, maxLength);
            parts.push(CONTINUATION_PREFIX + remainingText.substring(0, splitIndex) + SPLIT_MARKER);
            remainingText = remainingText.substring(splitIndex);
        }
    }

    return parts;
}

/**
 * Find a good point to split text, preferring natural breaks
 *
 * @param {string} text - Text to find split point in
 * @param {number} maxLength - Maximum length for this chunk
 * @returns {number} Index to split at
 */
function findGoodSplitPoint(text, maxLength) {
    if (text.length <= maxLength) {
        return text.length;
    }

    // Try to split at a paragraph break (double newline)
    const paragraphBreak = text.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > maxLength * 0.7) {
        return paragraphBreak + 2; // Include the newlines
    }

    // Try to split at a single newline
    const lineBreak = text.lastIndexOf('\n', maxLength);
    if (lineBreak > maxLength * 0.8) {
        return lineBreak + 1;
    }

    // Try to split at a sentence end
    const sentenceEnd = Math.max(
        text.lastIndexOf('. ', maxLength),
        text.lastIndexOf('! ', maxLength),
        text.lastIndexOf('? ', maxLength)
    );
    if (sentenceEnd > maxLength * 0.8) {
        return sentenceEnd + 2;
    }

    // Try to split at a word boundary
    const wordBreak = text.lastIndexOf(' ', maxLength);
    if (wordBreak > maxLength * 0.9) {
        return wordBreak + 1;
    }

    // Last resort: hard split at maxLength
    return maxLength;
}

module.exports = {
    splitMessage,
    DISCORD_MAX_LENGTH
};
