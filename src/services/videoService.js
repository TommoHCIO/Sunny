// src/services/videoService.js
/**
 * Video Processing Service
 * Handles MP4 to APNG conversion for animated Discord stickers
 * Uses ffmpeg-static for video processing
 */

const { spawn } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const crypto = require('crypto');

/**
 * Convert MP4 video to APNG for Discord animated sticker
 * Requirements: 320x320 pixels, under 500KB, APNG format, max 60 FPS
 *
 * @param {string} videoUrl - URL or local path to MP4 video
 * @returns {Promise<Buffer>} Processed APNG buffer
 */
async function convertMP4ToAPNG(videoUrl) {
    let tempInputPath = null;
    let tempOutputPath = null;

    try {
        console.log(`[VideoService] Converting MP4 to APNG: ${videoUrl}`);

        // Create temp file paths
        const tempId = crypto.randomBytes(16).toString('hex');
        tempInputPath = path.join(process.cwd(), `temp_${tempId}_input.mp4`);
        tempOutputPath = path.join(process.cwd(), `temp_${tempId}_output.apng`);

        // Download video from URL
        console.log(`[VideoService] Downloading video...`);
        const videoBuffer = await downloadVideo(videoUrl);
        await fs.writeFile(tempInputPath, videoBuffer);
        console.log(`[VideoService] Video downloaded: ${(videoBuffer.length / 1024).toFixed(2)} KB`);

        // Convert MP4 to APNG using FFmpeg
        console.log(`[VideoService] Starting FFmpeg conversion...`);
        await runFFmpegConversion(tempInputPath, tempOutputPath);

        // Read the output file
        const apngBuffer = await fs.readFile(tempOutputPath);
        const sizeInKB = (apngBuffer.length / 1024).toFixed(2);
        console.log(`[VideoService] ✅ APNG created: ${sizeInKB} KB`);

        // Check if size is within Discord limits
        if (apngBuffer.length > 500000) {
            console.log(`[VideoService] APNG too large (${sizeInKB} KB), attempting aggressive compression...`);

            // Try again with more aggressive compression
            const compressedPath = path.join(process.cwd(), `temp_${tempId}_compressed.apng`);
            await runFFmpegConversion(tempInputPath, compressedPath, true);

            const compressedBuffer = await fs.readFile(compressedPath);
            const compressedSizeKB = (compressedBuffer.length / 1024).toFixed(2);
            console.log(`[VideoService] Compressed APNG: ${compressedSizeKB} KB`);

            // Cleanup compressed temp file
            await fs.unlink(compressedPath).catch(() => {});

            if (compressedBuffer.length > 500000) {
                throw new Error(`APNG still too large after compression: ${compressedSizeKB} KB. Discord limit is 500KB.`);
            }

            return compressedBuffer;
        }

        return apngBuffer;

    } catch (error) {
        console.error('[VideoService] Failed to convert MP4 to APNG:', error);
        throw new Error(`Failed to convert video: ${error.message}`);
    } finally {
        // Cleanup temp files
        if (tempInputPath) {
            await fs.unlink(tempInputPath).catch(() => {});
        }
        if (tempOutputPath) {
            await fs.unlink(tempOutputPath).catch(() => {});
        }
    }
}

/**
 * Run FFmpeg conversion process
 *
 * @param {string} inputPath - Path to input MP4 file
 * @param {string} outputPath - Path to output APNG file
 * @param {boolean} aggressive - Use aggressive compression settings
 * @returns {Promise<void>}
 */
function runFFmpegConversion(inputPath, outputPath, aggressive = false) {
    return new Promise((resolve, reject) => {
        // Build FFmpeg arguments
        const args = [
            '-i', inputPath,
            '-vf', aggressive
                ? 'scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2,fps=15' // Lower FPS for smaller size
                : 'scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2,fps=30', // Normal FPS
            '-plays', '0', // Loop forever
            '-pred', 'mixed', // Better APNG compression
        ];

        // Add duration limit for aggressive compression
        if (aggressive) {
            args.unshift('-t', '3'); // Limit to 3 seconds
        } else {
            args.unshift('-t', '5'); // Limit to 5 seconds normally
        }

        // Add output path
        args.push('-y', outputPath); // -y to overwrite if exists

        console.log(`[VideoService] FFmpeg command: ${ffmpegPath} ${args.join(' ')}`);

        const ffmpeg = spawn(ffmpegPath, args);

        let errorOutput = '';

        ffmpeg.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code}: ${errorOutput}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`FFmpeg process error: ${err.message}`));
        });
    });
}

/**
 * Download video from URL
 *
 * @param {string} videoUrl - URL to download from
 * @returns {Promise<Buffer>} Video buffer
 */
async function downloadVideo(videoUrl) {
    try {
        const response = await fetch(videoUrl);

        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error('[VideoService] Failed to download video:', error);
        throw new Error(`Failed to download video: ${error.message}`);
    }
}

/**
 * Check if URL/file is a video
 *
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL appears to be a video
 */
function isVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;

    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv', '.wmv', '.m4v'];
    const urlLower = url.toLowerCase();

    return videoExtensions.some(ext => urlLower.includes(ext));
}

/**
 * Get video information using FFmpeg
 *
 * @param {string} videoUrl - URL to analyze
 * @returns {Promise<Object>} Video metadata
 */
async function getVideoInfo(videoUrl) {
    return new Promise(async (resolve, reject) => {
        let tempPath = null;

        try {
            // Download video first
            const tempId = crypto.randomBytes(16).toString('hex');
            tempPath = path.join(process.cwd(), `temp_${tempId}_probe.mp4`);

            const videoBuffer = await downloadVideo(videoUrl);
            await fs.writeFile(tempPath, videoBuffer);

            // Use FFmpeg to get video info
            const ffmpeg = spawn(ffmpegPath, [
                '-i', tempPath,
                '-hide_banner'
            ]);

            let output = '';
            ffmpeg.stderr.on('data', (data) => {
                output += data.toString();
            });

            ffmpeg.on('close', async () => {
                // Cleanup temp file
                if (tempPath) {
                    await fs.unlink(tempPath).catch(() => {});
                }

                // Parse duration from output
                const durationMatch = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
                let duration = 0;
                if (durationMatch) {
                    const hours = parseInt(durationMatch[1]);
                    const minutes = parseInt(durationMatch[2]);
                    const seconds = parseFloat(durationMatch[3]);
                    duration = hours * 3600 + minutes * 60 + seconds;
                }

                // Parse resolution
                const resolutionMatch = output.match(/(\d+)x(\d+)/);
                let width = 0, height = 0;
                if (resolutionMatch) {
                    width = parseInt(resolutionMatch[1]);
                    height = parseInt(resolutionMatch[2]);
                }

                // Parse FPS
                const fpsMatch = output.match(/(\d+(?:\.\d+)?)\s*fps/);
                let fps = 0;
                if (fpsMatch) {
                    fps = parseFloat(fpsMatch[1]);
                }

                resolve({
                    duration,
                    width,
                    height,
                    fps,
                    sizeBytes: videoBuffer.length
                });
            });

            ffmpeg.on('error', (err) => {
                if (tempPath) {
                    fs.unlink(tempPath).catch(() => {});
                }
                reject(new Error(`Failed to get video info: ${err.message}`));
            });
        } catch (error) {
            if (tempPath) {
                await fs.unlink(tempPath).catch(() => {});
            }
            reject(error);
        }
    });
}

module.exports = {
    convertMP4ToAPNG,
    downloadVideo,
    isVideoUrl,
    getVideoInfo
};