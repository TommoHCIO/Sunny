const cron = require('node-cron');
const patternAnalyzer = require('../services/patternAnalyzer');
const Outcome = require('../models/Outcome');

/**
 * Pattern Analysis Cron Job - AGI Learning System Phase 2
 * 
 * Schedule: Every Sunday at midnight UTC ('0 0 * * 0')
 * Purpose: Analyze weekly AI interaction patterns
 * 
 * Research-validated configuration:
 * - waitForCompletion: Prevents task stacking if previous run still executing
 * - errorHandler: Catches cron-level errors (not task errors)
 * - threshold: Executes if within 250ms of scheduled time (prevents skipping)
 */

let isRunning = false;

/**
 * Core analysis task (called by cron job and manual trigger)
 */
async function runAnalysisTask() {
    // Prevent concurrent executions
    if (isRunning) {
        console.log('[PatternAnalysisJob] Previous analysis still running, skipping...');
        return;
    }
    
    isRunning = true;
    const startTime = Date.now();
    
    console.log('[PatternAnalysisJob] Starting weekly pattern analysis...');
    
    try {
        // Check minimum sample size (100+ validated by research)
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
        const outcomeCount = await Outcome.countDocuments({
            timestamp: { $gte: cutoffDate }
        });
        
        console.log(`[PatternAnalysisJob] Found ${outcomeCount} outcomes in last 7 days`);
        
        if (outcomeCount < 100) {
            console.log(`[PatternAnalysisJob] Insufficient samples (${outcomeCount}/100). Skipping analysis.`);
            isRunning = false;
            return;
        }
        
        // Run all analyses in parallel
        const patterns = await patternAnalyzer.analyzeAll();
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[PatternAnalysisJob] Analysis complete in ${duration}s: ${patterns.length} patterns detected`);
        
        // Log pattern summaries
        patterns.forEach(pattern => {
            console.log(`  - [${pattern.confidence.toUpperCase()}] ${pattern.patternType}: ${pattern.description}`);
        });
        
    } catch (error) {
        console.error('[PatternAnalysisJob] Analysis failed:', error.message);
        console.error(error.stack);
        // Don't throw - job should always complete gracefully
    } finally {
        isRunning = false;
    }
}

const job = cron.schedule('0 0 * * 0', runAnalysisTask, {
    scheduled: false, // Start manually via job.start()
    timezone: "UTC",
    
    // Research-validated options (from node-cron best practices)
    errorHandler: (err) => {
        console.error('[PatternAnalysisJob] Cron scheduler error:', err.message);
        isRunning = false; // Reset flag on scheduler errors
    }
    // Note: waitForCompletion and threshold are not available in node-cron 3.x
    // Using manual isRunning flag instead for same effect
});

/**
 * Manual trigger for testing/debugging
 */
async function runManualAnalysis() {
    console.log('[PatternAnalysisJob] Manual trigger requested');
    
    if (isRunning) {
        console.log('[PatternAnalysisJob] Analysis already running');
        return { success: false, message: 'Analysis already running' };
    }
    
    // Trigger the analysis task manually
    await runAnalysisTask();
    
    return { success: true, message: 'Manual analysis completed' };
}

/**
 * Get job status
 */
function getJobStatus() {
    return {
        isRunning,
        schedule: '0 0 * * 0', // Every Sunday at midnight UTC
        timezone: 'UTC',
        nextRun: 'Sundays at 00:00 UTC'
    };
}

/**
 * Start the cron job
 */
function start() {
    try {
        job.start();
        console.log('[PatternAnalysisJob] Cron job started - runs every Sunday at midnight UTC');
    } catch (error) {
        console.error('[PatternAnalysisJob] Failed to start cron job:', error.message);
    }
}

/**
 * Stop the cron job
 */
function stop() {
    try {
        job.stop();
        console.log('[PatternAnalysisJob] Cron job stopped');
    } catch (error) {
        console.error('[PatternAnalysisJob] Failed to stop cron job:', error.message);
    }
}

module.exports = {
    job,
    start,
    stop,
    runManualAnalysis,
    getJobStatus
};
