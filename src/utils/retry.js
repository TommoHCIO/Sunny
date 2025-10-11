// src/utils/retry.js
/**
 * Retry Utility with Exponential Backoff
 * Provides robust retry logic for API calls and operations that may fail transiently
 */

const winston = require('winston');
const { RETRY } = require('../constants');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * Determines if an error is retryable
 * 
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error should trigger a retry
 * 
 * @private
 */
function isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        return true;
    }
    
    // HTTP errors that are typically transient
    if (error.status) {
        // 429 Rate Limited - should retry with backoff
        // 500-503 Server errors - temporary issues
        // 408 Request Timeout
        return [408, 429, 500, 502, 503, 504].includes(error.status);
    }
    
    // Discord API specific errors
    if (error.code === 50013) return false; // Missing Permissions - not retryable
    if (error.code === 10008) return false; // Unknown Message - not retryable
    if (error.code === 10003) return false; // Unknown Channel - not retryable
    
    // Anthropic API rate limits
    if (error.type === 'rate_limit_error') return true;
    if (error.type === 'overloaded_error') return true;
    
    // MongoDB transient errors
    if (error.name === 'MongoNetworkError') return true;
    if (error.name === 'MongoTimeoutError') return true;
    
    // Default: don't retry unless we know it's safe
    return false;
}

/**
 * Calculates delay for next retry attempt using exponential backoff with jitter
 * 
 * Formula: min(maxDelay, baseDelay * (2 ^ attempt)) + random jitter
 * 
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 30000)
 * @returns {number} Delay in milliseconds before next retry
 * 
 * @private
 */
function calculateBackoff(attempt, baseDelay = RETRY.BASE_DELAY_MS, maxDelay = RETRY.MAX_DELAY_MS) {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    // Add jitter (±RETRY.JITTER_PERCENTAGE of delay) to prevent thundering herd
    const jitter = cappedDelay * RETRY.JITTER_PERCENTAGE * (Math.random() - 0.5);
    
    return Math.round(cappedDelay + jitter);
}

/**
 * Executes an async function with retry logic and exponential backoff
 * 
 * Retries failed operations automatically with increasing delays between attempts.
 * Only retries transient errors (network issues, rate limits, server errors).
 * 
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry configuration options
 * @param {number} [options.maxAttempts=3] - Maximum number of attempts (1-10)
 * @param {number} [options.baseDelay=1000] - Base delay in ms between retries
 * @param {number} [options.maxDelay=30000] - Maximum delay in ms between retries
 * @param {Function} [options.onRetry] - Callback called on each retry (attempt, error, delay)
 * @param {boolean} [options.retryIf] - Custom function to determine if error is retryable
 * @param {string} [options.operationName] - Name of operation for logging
 * @returns {Promise<any>} Result of the function if successful
 * @throws {Error} The last error if all retries fail
 * 
 * @example
 * // Basic usage
 * const result = await retryWithBackoff(
 *   () => fetch('https://api.example.com'),
 *   { maxAttempts: 5 }
 * );
 * 
 * @example
 * // With custom retry logic
 * const data = await retryWithBackoff(
 *   async () => {
 *     const response = await claudeAPI.messages.create({...});
 *     return response;
 *   },
 *   {
 *     maxAttempts: 3,
 *     operationName: 'Claude API Call',
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms due to: ${error.message}`);
 *     }
 *   }
 * );
 */
async function retryWithBackoff(fn, options = {}) {
    const {
        maxAttempts = RETRY.MAX_ATTEMPTS,
        baseDelay = RETRY.BASE_DELAY_MS,
        maxDelay = RETRY.MAX_DELAY_MS,
        onRetry = null,
        retryIf = isRetryableError,
        operationName = 'Operation'
    } = options;
    
    // Validate options
    if (maxAttempts < RETRY.MIN_ATTEMPTS || maxAttempts > RETRY.MAX_ATTEMPTS_LIMIT) {
        throw new Error(`maxAttempts must be between ${RETRY.MIN_ATTEMPTS} and ${RETRY.MAX_ATTEMPTS_LIMIT}`);
    }
    
    let lastError;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            // Execute the function
            const result = await fn();
            
            // Success! Log if we had previous failures
            if (attempt > 0) {
                logger.info(`✅ ${operationName} succeeded on attempt ${attempt + 1}/${maxAttempts}`);
            }
            
            return result;
            
        } catch (error) {
            lastError = error;
            
            // Check if we should retry
            const shouldRetry = retryIf(error);
            const isLastAttempt = attempt === maxAttempts - 1;
            
            if (!shouldRetry || isLastAttempt) {
                // Don't retry - either error is not retryable or we're out of attempts
                if (!shouldRetry) {
                    logger.error(`❌ ${operationName} failed with non-retryable error:`, {
                        error: error.message,
                        code: error.code,
                        status: error.status
                    });
                } else {
                    logger.error(`❌ ${operationName} failed after ${maxAttempts} attempts:`, {
                        error: error.message,
                        code: error.code,
                        status: error.status
                    });
                }
                throw error;
            }
            
            // Calculate backoff delay
            const delay = calculateBackoff(attempt, baseDelay, maxDelay);
            
            logger.warn(`⚠️  ${operationName} failed (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delay}ms:`, {
                error: error.message,
                code: error.code,
                status: error.status,
                nextRetryIn: `${delay}ms`
            });
            
            // Call onRetry callback if provided
            if (onRetry) {
                try {
                    await onRetry(attempt + 1, error, delay);
                } catch (callbackError) {
                    logger.error('Error in onRetry callback:', callbackError);
                }
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    // Should never reach here, but TypeScript needs it
    throw lastError;
}

/**
 * Wraps a function to automatically retry on failure
 * Returns a new function that will retry the original function with the specified options
 * 
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Retry options (same as retryWithBackoff)
 * @returns {Function} Wrapped function with retry logic
 * 
 * @example
 * const fetchWithRetry = withRetry(
 *   (url) => fetch(url),
 *   { maxAttempts: 3, operationName: 'HTTP Fetch' }
 * );
 * 
 * const response = await fetchWithRetry('https://api.example.com');
 */
function withRetry(fn, options = {}) {
    return async function(...args) {
        return retryWithBackoff(() => fn(...args), options);
    };
}

module.exports = {
    retryWithBackoff,
    withRetry,
    isRetryableError,
    calculateBackoff
};
