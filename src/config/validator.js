// src/config/validator.js
/**
 * Environment Variable Validator
 * Validates required environment variables at startup
 * Prevents runtime errors from missing configuration
 */

const winston = require('winston');

// Configure simple logger for validation
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
    ),
    transports: [new winston.transports.Console()]
});

/**
 * Environment variable schema
 * Each entry specifies: name, type, required status, and default value
 */
const ENV_SCHEMA = {
    // Required variables
    DISCORD_TOKEN: {
        required: true,
        type: 'string',
        description: 'Discord bot token from Discord Developer Portal'
    },
    ANTHROPIC_API_KEY: {
        required: true,
        type: 'string',
        description: 'Anthropic API key for Claude AI'
    },
    
    // Optional but recommended variables
    MONGODB_URI: {
        required: false,
        type: 'string',
        description: 'MongoDB connection string (bot will run without persistence if missing)',
        default: null
    },
    DEBUG_CHANNEL_ID: {
        required: false,
        type: 'string',
        description: 'Discord channel ID for debug logs',
        default: null
    },
    
    // Configuration variables with defaults
    LOG_LEVEL: {
        required: false,
        type: 'string',
        description: 'Logging level (error, warn, info, debug)',
        default: 'info',
        validate: (value) => ['error', 'warn', 'info', 'debug'].includes(value.toLowerCase())
    },
    PORT: {
        required: false,
        type: 'number',
        description: 'HTTP server port for health checks',
        default: 3000
    },
    NODE_ENV: {
        required: false,
        type: 'string',
        description: 'Node environment (development, production)',
        default: 'development',
        validate: (value) => ['development', 'production', 'test'].includes(value.toLowerCase())
    },
    
    // Feature flags
    ENABLE_AUTOMOD: {
        required: false,
        type: 'boolean',
        description: 'Enable autonomous moderation features',
        default: true
    },
    ENABLE_DEBUG_LOGGING: {
        required: false,
        type: 'boolean',
        description: 'Enable debug logging to Discord channel',
        default: false
    }
};

/**
 * Type conversion helpers
 */
function convertType(value, type) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    
    switch (type) {
        case 'string':
            return String(value);
        case 'number':
            const num = Number(value);
            if (isNaN(num)) {
                throw new Error(`Cannot convert "${value}" to number`);
            }
            return num;
        case 'boolean':
            if (typeof value === 'boolean') return value;
            const lower = String(value).toLowerCase();
            if (lower === 'true' || lower === '1') return true;
            if (lower === 'false' || lower === '0') return false;
            throw new Error(`Cannot convert "${value}" to boolean`);
        default:
            return value;
    }
}

/**
 * Validate a single environment variable
 */
function validateVariable(name, schema) {
    const value = process.env[name];
    const errors = [];
    const warnings = [];
    
    // Check if required variable is missing
    if (schema.required && !value) {
        errors.push({
            variable: name,
            message: `Required environment variable missing: ${name}`,
            description: schema.description
        });
        return { errors, warnings, value: null };
    }
    
    // Use default if value is missing
    if (!value) {
        if (schema.default !== undefined) {
            return { errors, warnings, value: schema.default };
        }
        warnings.push({
            variable: name,
            message: `Optional variable not set: ${name}`,
            description: schema.description
        });
        return { errors, warnings, value: null };
    }
    
    // Type conversion
    let convertedValue;
    try {
        convertedValue = convertType(value, schema.type);
    } catch (error) {
        errors.push({
            variable: name,
            message: `Invalid type for ${name}: ${error.message}`,
            description: schema.description
        });
        return { errors, warnings, value: null };
    }
    
    // Custom validation
    if (schema.validate && !schema.validate(convertedValue)) {
        errors.push({
            variable: name,
            message: `Validation failed for ${name}: "${convertedValue}" is not valid`,
            description: schema.description
        });
        return { errors, warnings, value: null };
    }
    
    return { errors, warnings, value: convertedValue };
}

/**
 * Validate all environment variables
 * @returns {Object} Validation result with errors, warnings, and sanitized config
 */
function validateEnvironment() {
    const errors = [];
    const warnings = [];
    const config = {};
    
    logger.info('🔍 Validating environment variables...');
    
    // Validate each variable in schema
    for (const [name, schema] of Object.entries(ENV_SCHEMA)) {
        const result = validateVariable(name, schema);
        
        errors.push(...result.errors);
        warnings.push(...result.warnings);
        
        if (result.value !== null) {
            config[name] = result.value;
        }
    }
    
    // Check for extra variables (potential typos)
    const knownVars = new Set(Object.keys(ENV_SCHEMA));
    const extraVars = Object.keys(process.env).filter(key => {
        // Ignore system variables
        if (key.startsWith('npm_') || key.startsWith('NODE_') || key === 'PATH') {
            return false;
        }
        return !knownVars.has(key);
    });
    
    if (extraVars.length > 0) {
        warnings.push({
            variable: 'EXTRA_VARIABLES',
            message: `Unknown environment variables detected (possible typos): ${extraVars.join(', ')}`
        });
    }
    
    // Log results
    if (errors.length > 0) {
        logger.error(`\n❌ Environment validation failed with ${errors.length} error(s):`);
        errors.forEach(err => {
            logger.error(`   • ${err.message}`);
            if (err.description) {
                logger.error(`     ${err.description}`);
            }
        });
    }
    
    if (warnings.length > 0) {
        logger.warn(`\n⚠️  Environment validation warnings (${warnings.length}):`);
        warnings.forEach(warn => {
            logger.warn(`   • ${warn.message}`);
            if (warn.description) {
                logger.warn(`     ${warn.description}`);
            }
        });
    }
    
    if (errors.length === 0) {
        logger.info(`✅ Environment validation passed`);
        logger.info(`   Required: ${Object.values(ENV_SCHEMA).filter(s => s.required).length} variables OK`);
        logger.info(`   Optional: ${Object.values(ENV_SCHEMA).filter(s => !s.required).length} variables checked`);
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        config
    };
}

/**
 * Print help for missing variables
 */
function printHelp(errors) {
    logger.info('\n📝 Configuration Help:');
    logger.info('   1. Copy config/.env.example to config/.env');
    logger.info('   2. Fill in the following required variables:\n');
    
    errors.forEach(err => {
        if (err.variable && err.description) {
            logger.info(`   ${err.variable}:`);
            logger.info(`      ${err.description}\n`);
        }
    });
    
    logger.info('   For more information, see README.md\n');
}

/**
 * Validate environment and exit if invalid
 * Call this at the very start of your application
 */
function validateOrExit() {
    const result = validateEnvironment();
    
    if (!result.valid) {
        printHelp(result.errors);
        logger.error('❌ Cannot start bot with invalid configuration');
        process.exit(1);
    }
    
    // Return sanitized config
    return result.config;
}

module.exports = {
    validateEnvironment,
    validateOrExit,
    ENV_SCHEMA
};
