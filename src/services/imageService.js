// src/services/imageService.js
/**
 * Image Processing Service
 * Handles image download, resizing, and compression for Discord stickers and emojis
 * Uses Sharp library for high-performance image processing
 */

const sharp = require('sharp');
const fetch = require('node-fetch');

/**
 * Process image for Discord sticker requirements
 * Requirements: 320x320 pixels, under 500KB, PNG format
 *
 * @param {string} imageUrl - URL or local path to image
 * @returns {Promise<Buffer>} Processed image buffer
 */
async function processImageForSticker(imageUrl) {
    try {
        console.log(`[ImageService] Processing image for sticker: ${imageUrl}`);

        // Download image from URL
        const buffer = await downloadImage(imageUrl);

        // Process with Sharp - resize to 320x320
        let processed = await sharp(buffer)
            .resize(320, 320, {
                fit: 'contain', // Maintain aspect ratio
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
            })
            .png({
                quality: 80,
                compressionLevel: 9,
                effort: 10 // Maximum compression effort
            })
            .toBuffer();

        console.log(`[ImageService] Initial processed size: ${(processed.length / 1024).toFixed(2)} KB`);

        // Check file size - Discord limit is 500KB, aim for 480KB to be safe
        if (processed.length > 480000) {
            console.log(`[ImageService] Image too large, compressing further...`);
            processed = await sharp(processed)
                .png({
                    quality: 60,
                    compressionLevel: 9,
                    effort: 10
                })
                .toBuffer();

            console.log(`[ImageService] Re-compressed size: ${(processed.length / 1024).toFixed(2)} KB`);
        }

        // Final size check
        if (processed.length > 500000) {
            throw new Error(`Image still too large after compression: ${(processed.length / 1024).toFixed(2)} KB. Discord limit is 500KB.`);
        }

        console.log(`[ImageService] ✅ Sticker image processed successfully: ${(processed.length / 1024).toFixed(2)} KB`);
        return processed;
    } catch (error) {
        console.error('[ImageService] Failed to process image for sticker:', error);
        throw new Error(`Failed to process image: ${error.message}`);
    }
}

/**
 * Process image for Discord emoji requirements
 * Requirements: 256x256 pixels, under 256KB, PNG format
 *
 * @param {string} imageUrl - URL or local path to image
 * @returns {Promise<Buffer>} Processed image buffer
 */
async function processImageForEmoji(imageUrl) {
    try {
        console.log(`[ImageService] Processing image for emoji: ${imageUrl}`);

        // Download image from URL
        const buffer = await downloadImage(imageUrl);

        // Process with Sharp - resize to 256x256
        let processed = await sharp(buffer)
            .resize(256, 256, {
                fit: 'contain', // Maintain aspect ratio
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
            })
            .png({
                quality: 80,
                compressionLevel: 9
            })
            .toBuffer();

        console.log(`[ImageService] Initial processed size: ${(processed.length / 1024).toFixed(2)} KB`);

        // Check file size - Discord limit is 256KB, aim for 240KB to be safe
        if (processed.length > 240000) {
            console.log(`[ImageService] Image too large, compressing further...`);
            processed = await sharp(processed)
                .png({
                    quality: 60,
                    compressionLevel: 9
                })
                .toBuffer();

            console.log(`[ImageService] Re-compressed size: ${(processed.length / 1024).toFixed(2)} KB`);
        }

        // Final size check
        if (processed.length > 256000) {
            throw new Error(`Image still too large after compression: ${(processed.length / 1024).toFixed(2)} KB. Discord limit is 256KB.`);
        }

        console.log(`[ImageService] ✅ Emoji image processed successfully: ${(processed.length / 1024).toFixed(2)} KB`);
        return processed;
    } catch (error) {
        console.error('[ImageService] Failed to process image for emoji:', error);
        throw new Error(`Failed to process image: ${error.message}`);
    }
}

/**
 * Download image from URL
 *
 * @param {string} imageUrl - URL to download from
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadImage(imageUrl) {
    try {
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error('[ImageService] Failed to download image:', error);
        throw new Error(`Failed to download image: ${error.message}`);
    }
}

/**
 * Validate if URL is an image
 *
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL appears to be an image
 */
function isImageUrl(url) {
    if (!url || typeof url !== 'string') return false;

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const urlLower = url.toLowerCase();

    return imageExtensions.some(ext => urlLower.includes(ext));
}

module.exports = {
    processImageForSticker,
    processImageForEmoji,
    downloadImage,
    isImageUrl
};
