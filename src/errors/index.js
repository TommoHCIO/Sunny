// src/errors/index.js
/**
 * Structured Error Classes
 * Provides typed errors for better error handling and debugging
 */

/**
 * Base error class for all bot errors
 */
class BotError extends Error {
    constructor(message, code, recoverable = true) {
        super(message);
        this.name = 'BotError';
        this.code = code;
        this.recoverable = recoverable;
        this.timestamp = new Date();
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            recoverable: this.recoverable,
            timestamp: this.timestamp
        };
    }
}

/**
 * Permission denied error
 */
class PermissionError extends BotError {
    constructor(action, required, userId = null) {
        super(`Permission denied: ${required} required for ${action}`, 'PERMISSION_DENIED');
        this.name = 'PermissionError';
        this.action = action;
        this.required = required;
        this.userId = userId;
    }
}

/**
 * Rate limit error
 */
class RateLimitError extends BotError {
    constructor(retryAfter, endpoint = null) {
        super(`Rate limited, retry after ${retryAfter}ms`, 'RATE_LIMITED', true);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
        this.endpoint = endpoint;
    }
}

/**
 * Validation error for invalid inputs
 */
class ValidationError extends BotError {
    constructor(field, message, value = undefined) {
        super(`Validation failed for ${field}: ${message}`, 'VALIDATION_ERROR', true);
        this.name = 'ValidationError';
        this.field = field;
        this.validationMessage = message;
        // Don't store the actual value if it might be sensitive
        this.hasValue = value !== undefined;
    }
}

/**
 * Discord API error wrapper
 */
class DiscordAPIError extends BotError {
    constructor(originalError, action = null) {
        const message = originalError.message || 'Discord API error';
        const code = originalError.code || 'DISCORD_API_ERROR';
        super(message, code, true);
        this.name = 'DiscordAPIError';
        this.action = action;
        this.httpStatus = originalError.httpStatus || originalError.status;
        this.discordCode = originalError.code;
        this.originalError = originalError;
    }

    static isRetryable(error) {
        // 5xx errors and rate limits are retryable
        const status = error.httpStatus || error.status;
        return status >= 500 || error.code === 429;
    }
}

/**
 * AI Provider error
 */
class AIProviderError extends BotError {
    constructor(provider, message, originalError = null) {
        super(`${provider} error: ${message}`, 'AI_PROVIDER_ERROR', true);
        this.name = 'AIProviderError';
        this.provider = provider;
        this.originalError = originalError;
    }
}

/**
 * Database error
 */
class DatabaseError extends BotError {
    constructor(operation, message, originalError = null) {
        super(`Database ${operation} failed: ${message}`, 'DATABASE_ERROR', true);
        this.name = 'DatabaseError';
        this.operation = operation;
        this.originalError = originalError;
    }

    static isConnectionError(error) {
        const connectionCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'];
        return connectionCodes.some(code =>
            error.message?.includes(code) || error.code === code
        );
    }
}

/**
 * Tool execution error
 */
class ToolExecutionError extends BotError {
    constructor(toolName, message, originalError = null) {
        super(`Tool ${toolName} failed: ${message}`, 'TOOL_EXECUTION_ERROR', true);
        this.name = 'ToolExecutionError';
        this.toolName = toolName;
        this.originalError = originalError;
    }
}

/**
 * Configuration error (non-recoverable)
 */
class ConfigurationError extends BotError {
    constructor(configKey, message) {
        super(`Configuration error for ${configKey}: ${message}`, 'CONFIGURATION_ERROR', false);
        this.name = 'ConfigurationError';
        this.configKey = configKey;
    }
}

/**
 * Timeout error
 */
class TimeoutError extends BotError {
    constructor(operation, timeoutMs) {
        super(`${operation} timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR', true);
        this.name = 'TimeoutError';
        this.operation = operation;
        this.timeoutMs = timeoutMs;
    }
}

/**
 * Idempotency error - operation already executed
 */
class IdempotencyError extends BotError {
    constructor(operationId, cachedResult) {
        super(`Operation ${operationId} already executed`, 'IDEMPOTENCY_ERROR', true);
        this.name = 'IdempotencyError';
        this.operationId = operationId;
        this.cachedResult = cachedResult;
    }
}

/**
 * Error handler utility
 */
class ErrorHandler {
    /**
     * Wrap an error in the appropriate BotError subclass
     */
    static wrap(error, context = {}) {
        if (error instanceof BotError) {
            return error;
        }

        // Discord.js errors
        if (error.code && typeof error.code === 'number') {
            return new DiscordAPIError(error, context.action);
        }

        // MongoDB errors
        if (error.name === 'MongoError' || error.name === 'MongooseError') {
            return new DatabaseError(context.operation || 'unknown', error.message, error);
        }

        // Generic error
        return new BotError(error.message, 'UNKNOWN_ERROR', true);
    }

    /**
     * Get user-friendly message for an error
     */
    static getUserMessage(error) {
        if (error instanceof PermissionError) {
            return `I can't do that - only the server owner can ${error.action}! 🍂`;
        }
        if (error instanceof RateLimitError) {
            return `Whoa, I'm a bit overwhelmed! Give me a moment and try again. 🍂`;
        }
        if (error instanceof ValidationError) {
            return `Hmm, there's an issue with the ${error.field}: ${error.validationMessage} 🍂`;
        }
        if (error instanceof TimeoutError) {
            return `That took too long! Let me try again with something simpler. 🍂`;
        }
        if (error instanceof AIProviderError) {
            return `My brain had a hiccup! Let me try that again. 🍂`;
        }
        if (error instanceof DatabaseError) {
            return `I had trouble remembering something, but I'll keep going! 🍂`;
        }
        if (error instanceof ConfigurationError) {
            return `There's a configuration issue - please let the server owner know! 🍂`;
        }

        return `Something went wrong on my end! Let me try again. 🍂`;
    }

    /**
     * Determine if error should be logged
     */
    static shouldLog(error) {
        // Always log non-recoverable errors
        if (error instanceof BotError && !error.recoverable) {
            return true;
        }
        // Don't spam logs with permission denied
        if (error instanceof PermissionError) {
            return false;
        }
        // Log rate limits at debug level only
        if (error instanceof RateLimitError) {
            return false;
        }
        return true;
    }
}

module.exports = {
    BotError,
    PermissionError,
    RateLimitError,
    ValidationError,
    DiscordAPIError,
    AIProviderError,
    DatabaseError,
    ToolExecutionError,
    ConfigurationError,
    TimeoutError,
    IdempotencyError,
    ErrorHandler
};
