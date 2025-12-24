// src/utils/sanitizer.js
/**
 * Data Sanitizer
 * Prevents sensitive information from being logged or stored
 */

// Patterns for sensitive data detection
const SENSITIVE_PATTERNS = [
    // API Keys and Tokens
    { pattern: /sk-ant-api\d+-[A-Za-z0-9_-]{20,}/gi, replacement: '[ANTHROPIC_KEY]' },
    { pattern: /sk-[A-Za-z0-9]{20,}/gi, replacement: '[API_KEY]' },
    { pattern: /ghp_[A-Za-z0-9]{36,}/gi, replacement: '[GITHUB_TOKEN]' },
    { pattern: /gho_[A-Za-z0-9]{36,}/gi, replacement: '[GITHUB_OAUTH]' },
    { pattern: /github_pat_[A-Za-z0-9_]{22,}/gi, replacement: '[GITHUB_PAT]' },
    { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/gi, replacement: '[SLACK_TOKEN]' },
    { pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/gi, replacement: 'Bearer [REDACTED]' },

    // Discord tokens (base64-encoded snowflake.timestamp.hmac)
    { pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27,}/g, replacement: '[DISCORD_TOKEN]' },
    { pattern: /mfa\.[A-Za-z0-9_-]{84}/gi, replacement: '[DISCORD_MFA]' },

    // Database URIs
    { pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^\s]+/gi, replacement: '[MONGODB_URI]' },
    { pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@[^\s]+/gi, replacement: '[POSTGRES_URI]' },
    { pattern: /mysql:\/\/[^:]+:[^@]+@[^\s]+/gi, replacement: '[MYSQL_URI]' },
    { pattern: /redis:\/\/[^:]+:[^@]+@[^\s]+/gi, replacement: '[REDIS_URI]' },

    // Generic credentials in URLs
    { pattern: /:\/\/[^:]+:[^@]+@/gi, replacement: '://[CREDENTIALS]@' },

    // Password-like patterns
    { pattern: /(?:password|passwd|pwd|secret|token|apikey|api_key|auth)[\s]*[:=][\s]*['"]?[^\s'"]{8,}['"]?/gi, replacement: '[CREDENTIAL_REDACTED]' },

    // AWS credentials
    { pattern: /AKIA[0-9A-Z]{16}/gi, replacement: '[AWS_ACCESS_KEY]' },
    { pattern: /(?:aws)?_?secret_?(?:access)?_?key[\s]*[:=][\s]*['"]?[A-Za-z0-9/+=]{40}['"]?/gi, replacement: '[AWS_SECRET_KEY]' },

    // Credit card numbers (basic detection)
    { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[CARD_NUMBER]' },

    // Social Security Numbers (US)
    { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, replacement: '[SSN]' },

    // Email addresses (optional - uncomment if needed)
    // { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },

    // IP addresses with ports (potentially sensitive internal IPs)
    { pattern: /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}(?::\d{1,5})?\b/g, replacement: '[INTERNAL_IP]' },

    // Private keys
    { pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi, replacement: '[PRIVATE_KEY]' },

    // JWT tokens
    { pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, replacement: '[JWT_TOKEN]' }
];

// Fields that should never be logged
const SENSITIVE_FIELDS = new Set([
    'password', 'passwd', 'pwd', 'secret', 'token', 'apikey', 'api_key',
    'authorization', 'auth', 'credential', 'credentials', 'private_key',
    'privatekey', 'access_token', 'refresh_token', 'session', 'cookie',
    'ssn', 'social_security', 'credit_card', 'card_number', 'cvv', 'cvc'
]);

/**
 * Sanitize a string by replacing sensitive patterns
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeString(text) {
    if (typeof text !== 'string') {
        return text;
    }

    let result = text;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

/**
 * Sanitize an object by replacing sensitive fields and values
 * @param {Object} obj - Object to sanitize
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) {
        return '[MAX_DEPTH_EXCEEDED]';
    }

    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1, maxDepth));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        // Check if this field should be redacted entirely
        if (SENSITIVE_FIELDS.has(lowerKey)) {
            sanitized[key] = '[REDACTED]';
            continue;
        }

        // Recursively sanitize the value
        sanitized[key] = sanitizeObject(value, depth + 1, maxDepth);
    }

    return sanitized;
}

/**
 * Check if a string contains sensitive data
 * @param {string} text - Text to check
 * @returns {boolean} True if sensitive data detected
 */
function containsSensitiveData(text) {
    if (typeof text !== 'string') {
        return false;
    }

    for (const { pattern } of SENSITIVE_PATTERNS) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
            return true;
        }
    }
    return false;
}

/**
 * Create a safe logger wrapper
 * @param {Object} logger - Winston or similar logger
 * @returns {Object} Wrapped logger with sanitization
 */
function createSafeLogger(logger) {
    const wrap = (level) => (...args) => {
        const sanitizedArgs = args.map(arg => {
            if (typeof arg === 'string') {
                return sanitizeString(arg);
            }
            if (typeof arg === 'object') {
                return sanitizeObject(arg);
            }
            return arg;
        });
        return logger[level](...sanitizedArgs);
    };

    return {
        error: wrap('error'),
        warn: wrap('warn'),
        info: wrap('info'),
        debug: wrap('debug'),
        verbose: wrap('verbose'),
        silly: wrap('silly'),
        log: wrap('log')
    };
}

/**
 * Sanitize error objects for logging
 * @param {Error} error - Error to sanitize
 * @returns {Object} Sanitized error info
 */
function sanitizeError(error) {
    return {
        name: error.name,
        message: sanitizeString(error.message),
        code: error.code,
        stack: sanitizeString(error.stack)
    };
}

/**
 * Sanitize message content before storage
 * @param {string} content - Message content
 * @returns {string} Sanitized content
 */
function sanitizeMessageContent(content) {
    // First apply pattern-based sanitization
    let sanitized = sanitizeString(content);

    // Truncate very long messages
    const MAX_LENGTH = 2000;
    if (sanitized.length > MAX_LENGTH) {
        sanitized = sanitized.substring(0, MAX_LENGTH) + '... [TRUNCATED]';
    }

    return sanitized;
}

module.exports = {
    sanitizeString,
    sanitizeObject,
    containsSensitiveData,
    createSafeLogger,
    sanitizeError,
    sanitizeMessageContent,
    SENSITIVE_PATTERNS,
    SENSITIVE_FIELDS
};
