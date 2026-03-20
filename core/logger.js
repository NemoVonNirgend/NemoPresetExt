/**
 * NemoPresetExt - Centralized Logging Utility
 * Provides structured logging with levels and formatting
 */

import { CONSTANTS } from './constants.js';

class Logger {
    constructor(prefix = 'NemoPresetExt', level = CONSTANTS.LOG_LEVELS.INFO) {
        this.prefix = prefix;
        this.level = level;
        this.startTime = Date.now();
    }

    /**
     * Set the logging level
     * @param {number} level - Log level from CONSTANTS.LOG_LEVELS
     */
    setLevel(level) {
        this.level = level;
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether debug mode is enabled
     */
    setDebugMode(enabled) {
        this.level = enabled ? CONSTANTS.LOG_LEVELS.DEBUG : CONSTANTS.LOG_LEVELS.INFO;
    }

    /**
     * Format log message with timestamp and prefix
     * @param {string} level - Log level string
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     * @returns {Array} Formatted message parts
     */
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
        const prefix = `[${timestamp}] [${this.prefix}] [${level}]`;
        
        if (data !== undefined) {
            return [prefix, message, data];
        }
        return [prefix, message];
    }

    /**
     * Debug level logging - only shown in debug mode
     * @param {string} message - Debug message
     * @param {*} data - Optional data to log
     */
    debug(message, data) {
        if (this.level <= CONSTANTS.LOG_LEVELS.DEBUG) {
            const args = this.formatMessage('DEBUG', message, data);
            console.log(...args);
        }
    }

    /**
     * Info level logging - general information
     * @param {string} message - Info message
     * @param {*} data - Optional data to log
     */
    info(message, data) {
        if (this.level <= CONSTANTS.LOG_LEVELS.INFO) {
            const args = this.formatMessage('INFO', message, data);
            console.log(...args);
        }
    }

    /**
     * Warning level logging - potential issues
     * @param {string} message - Warning message
     * @param {*} data - Optional data to log
     */
    warn(message, data) {
        if (this.level <= CONSTANTS.LOG_LEVELS.WARN) {
            const args = this.formatMessage('WARN', message, data);
            console.warn(...args);
        }
    }

    /**
     * Error level logging - actual errors
     * @param {string} message - Error message
     * @param {*} error - Error object or additional data
     */
    error(message, error) {
        if (this.level <= CONSTANTS.LOG_LEVELS.ERROR) {
            const args = this.formatMessage('ERROR', message, error);
            console.error(...args);
            
            // Stack trace for actual Error objects
            if (error instanceof Error && error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }
    }

    /**
     * Performance logging - measure execution time
     * @param {string} label - Performance label
     * @param {Function} fn - Function to measure
     * @returns {*} Function result
     */
    async performance(label, fn) {
        if (!CONSTANTS.FEATURES.ENABLE_PERFORMANCE_MONITORING) {
            return await fn();
        }

        const start = performance.now();
        try {
            const result = await fn();
            const end = performance.now();
            this.debug(`Performance: ${label} took ${(end - start).toFixed(2)}ms`);
            return result;
        } catch (error) {
            const end = performance.now();
            this.error(`Performance: ${label} failed after ${(end - start).toFixed(2)}ms`, error);
            throw error;
        }
    }

    /**
     * Group related log messages
     * @param {string} label - Group label
     * @param {Function} fn - Function containing grouped logs
     */
    group(label, fn) {
        if (this.level <= CONSTANTS.LOG_LEVELS.DEBUG) {
            console.group(`[${this.prefix}] ${label}`);
            try {
                fn();
            } finally {
                console.groupEnd();
            }
        } else {
            fn();
        }
    }

    /**
     * Log table data (useful for arrays/objects)
     * @param {*} data - Data to display as table
     * @param {string} label - Optional label
     */
    table(data, label = 'Data') {
        if (this.level <= CONSTANTS.LOG_LEVELS.DEBUG) {
            this.debug(`${label}:`);
            console.table(data);
        }
    }

    /**
     * Create a child logger with a specific module prefix
     * @param {string} moduleName - Module name to append to prefix
     * @returns {Logger} Child logger instance
     */
    module(moduleName) {
        return new Logger(`${this.prefix}:${moduleName}`, this.level);
    }
}

// Create default logger instance
const logger = new Logger();

// Check for debug mode from multiple sources (CACHED AT MODULE LOAD):
// This function runs ONCE at module initialization, and the result is stored in logger.level
// Subsequent log calls just check this.level, avoiding repeated URL/localStorage parsing
//
// Sources checked (in order):
// 1. Feature flag in constants (CONSTANTS.FEATURES.ENABLE_DEBUG_MODE)
// 2. localStorage setting (localStorage.setItem('nemoPresetExtDebug', 'true'))
// 3. URL parameter (?nemoDebug=true)
const isDebugEnabled = () => {
    // Check feature flag
    if (CONSTANTS.FEATURES.ENABLE_DEBUG_MODE) return true;

    // Check localStorage (can be set via console: localStorage.setItem('nemoPresetExtDebug', 'true'))
    try {
        if (localStorage.getItem('nemoPresetExtDebug') === 'true') return true;
    } catch (e) {
        // localStorage might not be available in some contexts
    }

    // Check URL parameter
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('nemoDebug') === 'true') return true;
    } catch (e) {
        // URL parsing might fail in some contexts
    }

    return false;
};

// Enable debug mode if any source indicates it should be enabled
if (isDebugEnabled()) {
    logger.setDebugMode(true);
    console.log('[NemoPresetExt] Debug mode enabled');
}

// Export utility to toggle debug mode at runtime
// Usage: window.NemoPresetExtLogger.enableDebug() or .disableDebug()
if (typeof window !== 'undefined') {
    window.NemoPresetExtLogger = {
        enableDebug: () => {
            logger.setDebugMode(true);
            try { localStorage.setItem('nemoPresetExtDebug', 'true'); } catch (e) {}
            console.log('[NemoPresetExt] Debug mode enabled (persisted to localStorage)');
        },
        disableDebug: () => {
            logger.setDebugMode(false);
            try { localStorage.removeItem('nemoPresetExtDebug'); } catch (e) {}
            console.log('[NemoPresetExt] Debug mode disabled');
        },
        getLogger: () => logger
    };
}

// Export both the class and a default instance
export { Logger };
export default logger;