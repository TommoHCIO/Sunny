const Pattern = require('../models/Pattern');
const AdjustmentHistory = require('../models/AdjustmentHistory');
const Outcome = require('../models/Outcome');
const mongoose = require('mongoose');

/**
 * Self-Adjustment Engine - AGI Learning System Phase 3
 * 
 * Implements autonomous adjustments based on approved patterns with:
 * - Human-in-the-loop approval workflow
 * - Canary rollout (5% → 25% → 50% → 75% → 100%)
 * - A/B testing with statistical validation
 * - Automatic rollback on performance degradation
 * - Complete adjustment history tracking
 * 
 * Research-validated approach:
 * - p<0.05 for statistical significance
 * - Minimum 100 samples per canary stage
 * - Maximum 20% weight change per adjustment
 * - >10% performance drop triggers rollback
 */

class SelfAdjustmentEngine {
    constructor() {
        this.MIN_OUTCOMES_FOR_ADJUSTMENT = 1000; // Need baseline before adjusting
        this.MIN_SAMPLES_PER_STAGE = 100;         // Research-validated minimum
        this.MAX_WEIGHT_CHANGE = 0.20;            // Maximum 20% change
        this.ROLLBACK_THRESHOLD = 0.10;           // Rollback if >10% performance drop
        this.MIN_DAYS_BETWEEN_ADJUSTMENTS = 7;    // One week minimum
    }
    
    /**
     * Propose adjustments based on approved patterns
     * Requires human approval before activation
     */
    async proposeAdjustments(guildId) {
        console.log('[SelfAdjustment] Proposing adjustments for guild:', guildId);
        
        try {
            // Check if we have enough data
            const totalOutcomes = await Outcome.countDocuments({ guildId });
            if (totalOutcomes < this.MIN_OUTCOMES_FOR_ADJUSTMENT) {
                console.log(`[SelfAdjustment] Insufficient outcomes (${totalOutcomes}/${this.MIN_OUTCOMES_FOR_ADJUSTMENT})`);
                return { success: false, message: `Need ${this.MIN_OUTCOMES_FOR_ADJUSTMENT}+ outcomes before proposing adjustments` };
            }
            
            // Check for recent adjustments (minimum 7 days between)
            const recentAdjustment = await AdjustmentHistory.findOne({
                guildId,
                timestamp: { $gte: new Date(Date.now() - this.MIN_DAYS_BETWEEN_ADJUSTMENTS * 24 * 60 * 60 * 1000) }
            }).sort({ timestamp: -1 });
            
            if (recentAdjustment) {
                console.log('[SelfAdjustment] Recent adjustment found, waiting for cooldown period');
                return { success: false, message: 'Must wait 7 days between adjustments' };
            }
            
            // Get approved patterns from Phase 2
            const approvedPatterns = await Pattern.find({
                guildId,
                approved: true
            }).sort({ confidence: -1, timestamp: -1 });
            
            if (approvedPatterns.length === 0) {
                console.log('[SelfAdjustment] No approved patterns found');
                return { success: false, message: 'No approved patterns to implement' };
            }
            
            const proposals = [];
            
            // Process each pattern type
            for (const pattern of approvedPatterns) {
                // Check if already has pending/active adjustment
                const existingAdjustment = await AdjustmentHistory.findOne({
                    guildId,
                    patternId: pattern._id,
                    status: { $in: ['pending_approval', 'active'] }
                });
                
                if (existingAdjustment) {
                    console.log(`[SelfAdjustment] Pattern ${pattern._id} already has adjustment: ${existingAdjustment.status}`);
                    continue;
                }
                
                let adjustment = null;
                
                switch (pattern.patternType) {
                    case 'model_accuracy':
                        adjustment = await this._proposeModelAdjustment(guildId, pattern);
                        break;
                    
                    case 'tool_reliability':
                        adjustment = await this._proposeToolAdjustment(guildId, pattern);
                        break;
                    
                    case 'complexity_correlation':
                        adjustment = await this._proposeComplexityAdjustment(guildId, pattern);
                        break;
                    
                    case 'satisfaction_pattern':
                        adjustment = await this._proposeSatisfactionAdjustment(guildId, pattern);
                        break;
                }
                
                if (adjustment) {
                    proposals.push(adjustment);
                }
            }
            
            console.log(`[SelfAdjustment] Created ${proposals.length} adjustment proposals`);
            return { success: true, proposals, count: proposals.length };
            
        } catch (error) {
            console.error('[SelfAdjustment] Propose adjustments failed:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Propose model preference adjustment
     */
    async _proposeModelAdjustment(guildId, pattern) {
        const { bestModel, worstModel } = pattern.data;
        
        // Calculate weight change (max 20%)
        const improvement = bestModel.successRate - worstModel.successRate;
        const weightChange = Math.min(improvement, this.MAX_WEIGHT_CHANGE);
        
        const adjustment = await AdjustmentHistory.create({
            guildId,
            patternId: pattern._id,
            patternType: 'model_accuracy',
            adjustmentType: 'model_preference',
            description: `Increase ${bestModel.name} usage by ${(weightChange * 100).toFixed(1)}% based on ${(improvement * 100).toFixed(1)}% higher success rate`,
            previousConfiguration: {
                modelWeights: 'baseline' // Will be populated from current config
            },
            newConfiguration: {
                model: bestModel.name,
                weightChange: weightChange,
                reason: pattern.description
            },
            status: 'pending_approval'
        });
        
        console.log(`[SelfAdjustment] Proposed model adjustment: ${adjustment._id}`);
        return adjustment;
    }
    
    /**
     * Propose tool usage adjustment
     */
    async _proposeToolAdjustment(guildId, pattern) {
        const { toolName, successRate, errorBreakdown } = pattern.data;
        
        const adjustment = await AdjustmentHistory.create({
            guildId,
            patternId: pattern._id,
            patternType: 'tool_reliability',
            adjustmentType: 'tool_usage',
            description: `Reduce usage of "${toolName}" tool (${(successRate * 100).toFixed(1)}% success rate) in favor of alternatives`,
            previousConfiguration: {
                toolPreferences: 'baseline'
            },
            newConfiguration: {
                deprecatedTool: toolName,
                successRate: successRate,
                primaryError: Object.keys(errorBreakdown).sort((a, b) => errorBreakdown[b] - errorBreakdown[a])[0],
                reason: pattern.description
            },
            status: 'pending_approval'
        });
        
        console.log(`[SelfAdjustment] Proposed tool adjustment: ${adjustment._id}`);
        return adjustment;
    }
    
    /**
     * Propose complexity threshold adjustment
     */
    async _proposeComplexityAdjustment(guildId, pattern) {
        const { correlation, avgIterations, avgToolCount } = pattern.data;
        
        const adjustment = await AdjustmentHistory.create({
            guildId,
            patternId: pattern._id,
            patternType: 'complexity_correlation',
            adjustmentType: 'complexity_threshold',
            description: `Adjust complexity thresholds based on ${correlation > 0 ? 'positive' : 'negative'} correlation (r=${correlation.toFixed(3)})`,
            previousConfiguration: {
                complexityThresholds: 'baseline'
            },
            newConfiguration: {
                correlation,
                avgIterations,
                avgToolCount,
                adjustment: correlation > 0 ? 'increase_threshold' : 'decrease_threshold',
                reason: pattern.description
            },
            status: 'pending_approval'
        });
        
        console.log(`[SelfAdjustment] Proposed complexity adjustment: ${adjustment._id}`);
        return adjustment;
    }
    
    /**
     * Propose satisfaction-based adjustment
     */
    async _proposeSatisfactionAdjustment(guildId, pattern) {
        const { bestModel, positiveRate } = pattern.data;
        
        const weightChange = Math.min(positiveRate - 0.5, this.MAX_WEIGHT_CHANGE); // Cap at 20%
        
        const adjustment = await AdjustmentHistory.create({
            guildId,
            patternId: pattern._id,
            patternType: 'satisfaction_pattern',
            adjustmentType: 'model_preference',
            description: `Increase ${bestModel} usage based on ${(positiveRate * 100).toFixed(1)}% positive feedback rate`,
            previousConfiguration: {
                modelWeights: 'baseline'
            },
            newConfiguration: {
                model: bestModel,
                weightChange: weightChange,
                satisfactionRate: positiveRate,
                reason: pattern.description
            },
            status: 'pending_approval'
        });
        
        console.log(`[SelfAdjustment] Proposed satisfaction adjustment: ${adjustment._id}`);
        return adjustment;
    }
    
    /**
     * Apply an approved adjustment (start canary rollout)
     */
    async applyAdjustment(adjustmentId, userId) {
        console.log(`[SelfAdjustment] Applying adjustment ${adjustmentId} by user ${userId}`);
        
        try {
            const adjustment = await AdjustmentHistory.findById(adjustmentId);
            
            if (!adjustment) {
                return { success: false, error: 'Adjustment not found' };
            }
            
            if (adjustment.status !== 'pending_approval') {
                return { success: false, error: `Adjustment is ${adjustment.status}, cannot apply` };
            }
            
            // Check for active adjustments (max 1 at a time)
            const activeAdjustments = await AdjustmentHistory.countDocuments({
                guildId: adjustment.guildId,
                status: 'active'
            });
            
            if (activeAdjustments > 0) {
                return { success: false, error: 'Another adjustment is already active. Please wait for it to complete.' };
            }
            
            // Approve and start canary rollout at 5%
            await adjustment.approve(userId);
            
            console.log(`[SelfAdjustment] Started canary rollout at 5% for adjustment ${adjustmentId}`);
            return { 
                success: true, 
                adjustment,
                message: `Canary rollout started at 5%. Monitoring A/B metrics...`
            };
            
        } catch (error) {
            console.error('[SelfAdjustment] Apply adjustment failed:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Monitor active adjustments and progress canary stages
     * Called periodically to check if adjustments should progress or rollback
     */
    async monitorAdjustments() {
        console.log('[SelfAdjustment] Monitoring active adjustments...');
        
        try {
            const activeAdjustments = await AdjustmentHistory.find({
                status: 'active',
                rolloutStage: { $in: ['canary_5', 'canary_25', 'canary_50', 'canary_75'] }
            });
            
            for (const adjustment of activeAdjustments) {
                await this._monitorSingleAdjustment(adjustment);
            }
            
            console.log(`[SelfAdjustment] Monitored ${activeAdjustments.length} active adjustments`);
            return { success: true, monitored: activeAdjustments.length };
            
        } catch (error) {
            console.error('[SelfAdjustment] Monitor adjustments failed:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Monitor a single adjustment
     */
    async _monitorSingleAdjustment(adjustment) {
        // Check if we have enough samples at this stage
        const totalSamples = adjustment.controlGroup.samples + adjustment.treatmentGroup.samples;
        
        if (totalSamples < this.MIN_SAMPLES_PER_STAGE) {
            console.log(`[SelfAdjustment] ${adjustment._id}: Waiting for more samples (${totalSamples}/${this.MIN_SAMPLES_PER_STAGE})`);
            return;
        }
        
        // Calculate statistical significance
        const stats = this._calculateStatistics(adjustment.controlGroup, adjustment.treatmentGroup);
        
        // Update adjustment with latest stats
        adjustment.pValue = stats.pValue;
        adjustment.effectSize = stats.effectSize;
        adjustment.isSignificant = stats.pValue < 0.05;
        adjustment.performanceDrop = stats.performanceDrop;
        adjustment.successRateDrop = stats.successRateDrop;
        
        await adjustment.save();
        
        // Check for rollback conditions
        if (this._shouldRollback(adjustment, stats)) {
            await this.rollbackAdjustment(adjustment._id, stats.rollbackReason, true);
            return;
        }
        
        // Check if ready to progress to next stage
        if (stats.pValue < 0.05 && stats.effectSize > 0 && totalSamples >= this.MIN_SAMPLES_PER_STAGE) {
            console.log(`[SelfAdjustment] ${adjustment._id}: Progressing to next canary stage`);
            await adjustment.progressCanary();
        } else {
            console.log(`[SelfAdjustment] ${adjustment._id}: Not ready to progress (p=${stats.pValue.toFixed(4)}, effect=${stats.effectSize.toFixed(4)})`);
        }
    }
    
    /**
     * Calculate A/B testing statistics
     */
    _calculateStatistics(controlGroup, treatmentGroup) {
        const n1 = controlGroup.samples;
        const n2 = treatmentGroup.samples;
        const p1 = controlGroup.successRate;
        const p2 = treatmentGroup.successRate;
        
        // Effect size (improvement percentage)
        const effectSize = p1 > 0 ? (p2 - p1) / p1 : 0;
        
        // Performance drop
        const performanceDrop = p1 - p2;
        const successRateDrop = performanceDrop / p1;
        
        // Chi-square test for proportions
        const pooled = (controlGroup.successCount + treatmentGroup.successCount) / (n1 + n2);
        const se = Math.sqrt(pooled * (1 - pooled) * (1/n1 + 1/n2));
        const z = se > 0 ? (p2 - p1) / se : 0;
        
        // P-value approximation (two-tailed)
        const pValue = this._calculatePValue(Math.abs(z));
        
        // Rollback reason if applicable
        let rollbackReason = null;
        if (performanceDrop > this.ROLLBACK_THRESHOLD) {
            rollbackReason = `Success rate dropped ${(performanceDrop * 100).toFixed(1)}% (threshold: ${(this.ROLLBACK_THRESHOLD * 100)}%)`;
        } else if (pValue > 0.05 && (n1 + n2) >= this.MIN_SAMPLES_PER_STAGE * 2) {
            rollbackReason = `Not statistically significant after ${n1 + n2} samples (p=${pValue.toFixed(4)})`;
        }
        
        return {
            pValue,
            effectSize,
            performanceDrop,
            successRateDrop,
            zScore: z,
            rollbackReason
        };
    }
    
    /**
     * Calculate p-value from z-score (standard normal distribution)
     */
    _calculatePValue(z) {
        // Approximation of cumulative standard normal distribution
        const t = 1 / (1 + 0.2316419 * z);
        const d = 0.3989423 * Math.exp(-z * z / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return 2 * p; // Two-tailed
    }
    
    /**
     * Check if adjustment should be rolled back
     */
    _shouldRollback(adjustment, stats) {
        // Rollback if performance dropped >10%
        if (stats.performanceDrop > this.ROLLBACK_THRESHOLD) {
            return true;
        }
        
        // Rollback if not significant after enough samples
        if (stats.pValue > 0.05 && 
            (adjustment.controlGroup.samples + adjustment.treatmentGroup.samples) >= this.MIN_SAMPLES_PER_STAGE * 3) {
            return true;
        }
        
        // Rollback if negative effect with high confidence
        if (stats.effectSize < -0.05 && stats.pValue < 0.05) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Rollback an adjustment (with MongoDB transaction for atomicity)
     */
    async rollbackAdjustment(adjustmentId, reason, isAutomatic = false) {
        console.log(`[SelfAdjustment] Rolling back adjustment ${adjustmentId}: ${reason}`);
        
        const session = await mongoose.startSession();
        
        try {
            await session.withTransaction(async () => {
                // 1. Find and update adjustment status
                const adjustment = await AdjustmentHistory.findById(adjustmentId).session(session);
                
                if (!adjustment) {
                    throw new Error('Adjustment not found');
                }
                
                // 2. Mark as rolled back
                await adjustment.rollback(reason, isAutomatic);
                
                // 3. Restore previous configuration (application-level, no DB changes needed)
                console.log(`[SelfAdjustment] Configuration will revert to baseline automatically`);
                
                // 4. Log rollback event
                console.log(`[SelfAdjustment] Rollback complete - adjustment ${adjustmentId} reverted`);
            });
            
            return { success: true, message: 'Adjustment rolled back successfully' };
            
        } catch (error) {
            console.error('[SelfAdjustment] Rollback failed:', error.message);
            return { success: false, error: error.message };
        } finally {
            session.endSession();
        }
    }
    
    /**
     * Get adjustment status and metrics
     */
    async getAdjustmentStatus(adjustmentId) {
        try {
            const adjustment = await AdjustmentHistory.findById(adjustmentId).populate('patternId');
            
            if (!adjustment) {
                return { success: false, error: 'Adjustment not found' };
            }
            
            const stats = this._calculateStatistics(adjustment.controlGroup, adjustment.treatmentGroup);
            
            return {
                success: true,
                adjustment,
                stats,
                canProgress: stats.pValue < 0.05 && stats.effectSize > 0,
                shouldRollback: this._shouldRollback(adjustment, stats)
            };
            
        } catch (error) {
            console.error('[SelfAdjustment] Get status failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Singleton export
module.exports = new SelfAdjustmentEngine();
