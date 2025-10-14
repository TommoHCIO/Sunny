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
    let tempFiles = [];

    try {
        console.log(`[VideoService] Converting MP4 to APNG: ${videoUrl}`);

        // Create temp file paths
        const tempId = crypto.randomBytes(16).toString('hex');
        tempInputPath = path.join(process.cwd(), `temp_${tempId}_input.mp4`);

        // Download video from URL
        console.log(`[VideoService] Downloading video...`);
        const videoBuffer = await downloadVideo(videoUrl);
        await fs.writeFile(tempInputPath, videoBuffer);
        console.log(`[VideoService] Video downloaded: ${(videoBuffer.length / 1024).toFixed(2)} KB`);

        // Progressive compression settings
        const compressionLevels = [
            { fps: 30, duration: 5, scale: 320, description: 'Normal quality' },
            { fps: 20, duration: 4, scale: 320, description: 'Reduced FPS' },
            { fps: 15, duration: 3, scale: 280, description: 'Lower FPS & duration' },
            { fps: 12, duration: 2.5, scale: 240, description: 'Aggressive compression' },
            { fps: 10, duration: 2, scale: 200, description: 'Very aggressive' },
            { fps: 8, duration: 1.5, scale: 160, description: 'Maximum compression' },
            { fps: 6, duration: 1, scale: 120, description: 'Last resort' }
        ];

        let finalBuffer = null;
        let attempts = 0;

        for (const level of compressionLevels) {
            attempts++;
            const tempOutputPath = path.join(process.cwd(), `temp_${tempId}_level${attempts}.apng`);
            tempFiles.push(tempOutputPath);

            console.log(`[VideoService] Attempt ${attempts}: ${level.description} (${level.fps}fps, ${level.duration}s, ${level.scale}px)`);

            await runFFmpegCompressionLevel(tempInputPath, tempOutputPath, level);

            // Read the output file
            const apngBuffer = await fs.readFile(tempOutputPath);
            const sizeInKB = (apngBuffer.length / 1024).toFixed(2);
            console.log(`[VideoService] APNG size: ${sizeInKB} KB`);

            // Check if size is within Discord limits (target 480KB to be safe)
            if (apngBuffer.length <= 480000) {
                console.log(`[VideoService] ✅ Success! APNG is under 480KB limit`);
                finalBuffer = apngBuffer;
                break;
            } else {
                console.log(`[VideoService] Still too large (${sizeInKB} KB), trying next compression level...`);
            }

            // Cleanup this attempt's file if not the final one
            await fs.unlink(tempOutputPath).catch(() => {});
            tempFiles.pop();
        }

        if (!finalBuffer) {
            throw new Error(`Could not compress video under 480KB even with maximum compression. Video may be too complex.`);
        }

        return finalBuffer;

    } catch (error) {
        console.error('[VideoService] Failed to convert MP4 to APNG:', error);
        throw new Error(`Failed to convert video: ${error.message}`);
    } finally {
        // Cleanup temp files
        if (tempInputPath) {
            await fs.unlink(tempInputPath).catch(() => {});
        }
        for (const tempFile of tempFiles) {
            await fs.unlink(tempFile).catch(() => {});
        }
    }
}

/**
 * Run FFmpeg conversion with specific compression level
 *
 * @param {string} inputPath - Path to input MP4 file
 * @param {string} outputPath - Path to output APNG file
 * @param {Object} level - Compression level settings
 * @returns {Promise<void>}
 */
function runFFmpegCompressionLevel(inputPath, outputPath, level) {
    return new Promise((resolve, reject) => {
        // Build FFmpeg arguments with compression level settings
        const args = [
            '-t', level.duration.toString(), // Duration limit
            '-i', inputPath,
            '-vf', `scale=${level.scale}:${level.scale}:force_original_aspect_ratio=decrease,pad=${level.scale}:${level.scale}:(ow-iw)/2:(oh-ih)/2,fps=${level.fps}`,
            '-plays', '0', // Loop forever
            '-pred', 'mixed', // Better APNG compression
            '-y', outputPath // Overwrite if exists
        ];

        console.log(`[VideoService] FFmpeg: ${level.description}`);

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

/**
 * Convert MP4 video to GIF for Discord animated emoji
 * Requirements: 256x256 pixels, under 256KB, GIF format
 * Version: 1.1 - Force Render redeploy
 *
 * @param {string} videoUrl - URL or local path to MP4 video
 * @returns {Promise<Buffer>} Processed GIF buffer
 */
async function convertMP4ToGIF(videoUrl) {
    let tempInputPath = null;
    let tempFiles = [];

    try {
        console.log(`[VideoService] Converting MP4 to GIF for emoji: ${videoUrl}`);

        // Create temp file paths
        const tempId = crypto.randomBytes(16).toString('hex');
        tempInputPath = path.join(process.cwd(), `temp_${tempId}_input.mp4`);

        // Download video from URL
        console.log(`[VideoService] Downloading video...`);
        const videoBuffer = await downloadVideo(videoUrl);
        await fs.writeFile(tempInputPath, videoBuffer);
        console.log(`[VideoService] Video downloaded: ${(videoBuffer.length / 1024).toFixed(2)} KB`);

        // Progressive compression settings for GIF (smaller size for emojis)
        const compressionLevels = [
            { fps: 20, duration: 3, scale: 256, colors: 256, description: 'Normal quality' },
            { fps: 15, duration: 2.5, scale: 256, colors: 128, description: 'Reduced FPS & colors' },
            { fps: 12, duration: 2, scale: 200, colors: 64, description: 'Lower quality' },
            { fps: 10, duration: 1.5, scale: 160, colors: 32, description: 'Aggressive compression' },
            { fps: 8, duration: 1, scale: 128, colors: 16, description: 'Very aggressive' },
            { fps: 5, duration: 0.5, scale: 96, colors: 16, description: 'Maximum compression' }
        ];

        let finalBuffer = null;
        let attempts = 0;

        for (const level of compressionLevels) {
            attempts++;
            const tempPalettePath = path.join(process.cwd(), `temp_${tempId}_palette${attempts}.png`);
            const tempOutputPath = path.join(process.cwd(), `temp_${tempId}_level${attempts}.gif`);
            tempFiles.push(tempPalettePath, tempOutputPath);

            console.log(`[VideoService] GIF Attempt ${attempts}: ${level.description} (${level.fps}fps, ${level.duration}s, ${level.scale}px, ${level.colors} colors)`);

            // Generate palette for better GIF quality
            await new Promise((resolve, reject) => {
                const paletteGen = spawn(ffmpegPath, [
                    '-i', tempInputPath,
                    '-vf', `fps=${level.fps},scale=${level.scale}:${level.scale}:flags=lanczos,palettegen=max_colors=${level.colors}`,
                    '-t', level.duration.toString(),
                    '-y', tempPalettePath
                ]);

                paletteGen.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Palette generation failed with code ${code}`));
                });

                paletteGen.on('error', reject);
            });

            // Convert to GIF using palette
            await new Promise((resolve, reject) => {
                const gifGen = spawn(ffmpegPath, [
                    '-i', tempInputPath,
                    '-i', tempPalettePath,
                    '-lavfi', `fps=${level.fps},scale=${level.scale}:${level.scale}:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
                    '-t', level.duration.toString(),
                    '-y', tempOutputPath
                ]);

                gifGen.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`GIF conversion failed with code ${code}`));
                });

                gifGen.on('error', reject);
            });

            // Read the output file
            const gifBuffer = await fs.readFile(tempOutputPath);
            const sizeInKB = (gifBuffer.length / 1024).toFixed(2);
            console.log(`[VideoService] GIF size: ${sizeInKB} KB`);

            // Check if size is within Discord emoji limits (target 240KB to be safe)
            if (gifBuffer.length <= 240000) {
                console.log(`[VideoService] ✅ Success! GIF is under 240KB limit`);
                finalBuffer = gifBuffer;
                break;
            } else {
                console.log(`[VideoService] Still too large (${sizeInKB} KB), trying next compression level...`);
            }

            // Cleanup this attempt's files if not the final one
            await fs.unlink(tempPalettePath).catch(() => {});
            await fs.unlink(tempOutputPath).catch(() => {});
            tempFiles = tempFiles.filter(f => f !== tempPalettePath && f !== tempOutputPath);
        }

        if (!finalBuffer) {
            throw new Error(`Could not compress video under 240KB even with maximum compression. Video may be too complex for Discord emoji.`);
        }

        return finalBuffer;

    } catch (error) {
        console.error('[VideoService] Failed to convert MP4 to GIF:', error);
        throw new Error(`Failed to convert video to GIF: ${error.message}`);
    } finally {
        // Cleanup temp files
        if (tempInputPath) {
            await fs.unlink(tempInputPath).catch(() => {});
        }
        for (const tempFile of tempFiles) {
            await fs.unlink(tempFile).catch(() => {});
        }
    }
}

module.exports = {
    convertMP4ToAPNG,
    convertMP4ToGIF,
    downloadVideo,
    isVideoUrl,
    getVideoInfo
};