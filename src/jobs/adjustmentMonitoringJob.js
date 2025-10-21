const cron = require('node-cron');
const selfAdjustmentEngine = require('../services/selfAdjustmentEngine');
const AdjustmentHistory = require('../models/AdjustmentHistory');

/**
 * Adjustment Monitoring Cron Job - AGI Learning System Phase 3
 * 
 * Schedule: Every hour on the hour ('0 * * * *')
 * Purpose: Monitor active adjustments, calculate A/B metrics, progress canary stages
 * 
 * Responsibilities:
 * - Calculate statistical significance for active adjustments
 * - Progress canary rollout when criteria met (100+ samples, p<0.05, improvement)
 * - Trigger automatic rollback on performance drops >10%
 * - Complete adjustments that reach full_100 rollout
 * 
 * Research-validated configuration:
 * - Runs hourly to ensure timely progression/rollback
 * - Min 100 samples per stage before progression (statistical power)
 * - p<0.05 significance threshold before progression
 * - >10% drop triggers immediate rollback (industry standard)
 */

let isRunning = false;

/**
 * Core monitoring task (called by cron job and manual trigger)
 */
async function runMonitoringTask() {
    // Prevent concurrent executions
    if (isRunning) {
        console.log('[AdjustmentMonitoringJob] Previous monitoring still running, skipping...');
        return;
    }
    
    isRunning = true;
    const startTime = Date.now();
    
    console.log('[AdjustmentMonitoringJob] Starting hourly adjustment monitoring...');
    
    try {
        // Get all active adjustments across all guilds
        const activeAdjustments = await AdjustmentHistory.getActiveAdjustments();
        
        if (activeAdjustments.length === 0) {
            console.log('[AdjustmentMonitoringJob] No active adjustments to monitor');
            isRunning = false;
            return;
        }
        
        console.log(`[AdjustmentMonitoringJob] Monitoring ${activeAdjustments.length} active adjustments`);
        
        // Monitor each adjustment
        for (const adjustment of activeAdjustments) {
            try {
                console.log(`[AdjustmentMonitoringJob] Monitoring adjustment ${adjustment._id} [${adjustment.rolloutStage}]`);
                
                // Use self-adjustment engine to evaluate
                const result = await selfAdjustmentEngine.monitorAdjustments(adjustment.guildId);
                
                if (!result.success) {
                    console.log(`[AdjustmentMonitoringJob] Failed to monitor ${adjustment._id}: ${result.message}`);
                }
                
            } catch (error) {
                console.error(`[AdjustmentMonitoringJob] Error monitoring adjustment ${adjustment._id}:`, error.message);
                // Continue with next adjustment
            }
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[AdjustmentMonitoringJob] Monitoring complete in ${duration}s`);
        
    } catch (error) {
        console.error('[AdjustmentMonitoringJob] Monitoring failed:', error.message);
        console.error(error.stack);
        // Don't throw - job should always complete gracefully
    } finally {
        isRunning = false;
    }
}

const job = cron.schedule('0 * * * *', runMonitoringTask, {
    scheduled: false, // Start manually via job.start()
    timezone: "UTC",
    
    // Research-validated options (from node-cron best practices)
    errorHandler: (err) => {
        console.error('[AdjustmentMonitoringJob] Cron scheduler error:', err.message);
        isRunning = false; // Reset flag on scheduler errors
    }
    // Note: Using manual isRunning flag to prevent concurrent executions
});

/**
 * Manual trigger for testing/debugging
 */
async function runManualMonitoring() {
    console.log('[AdjustmentMonitoringJob] Manual trigger requested');
    
    if (isRunning) {
        console.log('[AdjustmentMonitoringJob] Monitoring already running');
        return { success: false, message: 'Monitoring already running' };
    }
    
    // Trigger the monitoring task manually
    await runMonitoringTask();
    
    return { success: true, message: 'Manual monitoring completed' };
}

/**
 * Get job status
 */
function getStatus() {
    return {
        isRunning,
        scheduled: true,
        schedule: 'Every hour on the hour (0 * * * *)',
        timezone: 'UTC'
    };
}

/**
 * Start the cron job
 */
function start() {
    try {
        job.start();
        console.log('[AdjustmentMonitoringJob] Cron job started (every hour at :00)');
    } catch (error) {
        console.error('[AdjustmentMonitoringJob] Failed to start cron job:', error.message);
        throw error;
    }
}

/**
 * Stop the cron job
 */
function stop() {
    job.stop();
    console.log('[AdjustmentMonitoringJob] Cron job stopped');
}

module.exports = {
    start,
    stop,
    runManualMonitoring,
    getStatus
};
