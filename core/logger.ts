/**
 * NemoPresetExt - Centralized Logging Utility
 * Provides structured logging with levels and formatting
 */

import { CONSTANTS } from './constants.js';

export type LogLevel = 0 | 1 | 2 | 3;

export class Logger {
    private prefix: string;
    private level: LogLevel;
    private startTime: number;

    constructor(prefix = 'NemoPresetExt', level: LogLevel = CONSTANTS.LOG_LEVELS.INFO as LogLevel) {
        this.prefix = prefix;
        this.level = level;
        this.startTime = Date.now();
    }

    /**
     * Set the logging level
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Enable or disable debug mode
     */
    setDebugMode(enabled: boolean): void {
        this.level = enabled ? (CONSTANTS.LOG_LEVELS.DEBUG as LogLevel) : (CONSTANTS.LOG_LEVELS.INFO as LogLevel);
    }

    /**
     * Format log message with timestamp and prefix
     */
    private formatMessage(level: string, message: string, data?: unknown): unknown[] {
        const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
        const prefix = `[${timestamp}] [${this.prefix}] [${level}]`;

        if (data !== undefined) {
            return [prefix, message, data];
        }
        return [prefix, message];
    }

    /**
     * Debug level logging - only shown in debug mode
     */
    debug(message: string, data?: unknown): void {
        if (this.level <= CONSTANTS.LOG_LEVELS.DEBUG) {
            const args = this.formatMessage('DEBUG', message, data);
            console.log(...args);
        }
    }

    /**
     * Info level logging - general information
     */
    info(message: string, data?: unknown): void {
        if (this.level <= CONSTANTS.LOG_LEVELS.INFO) {
            const args = this.formatMessage('INFO', message, data);
            console.log(...args);
        }
    }

    /**
     * Warning level logging - potential issues
     */
    warn(message: string, data?: unknown): void {
        if (this.level <= CONSTANTS.LOG_LEVELS.WARN) {
            const args = this.formatMessage('WARN', message, data);
            console.warn(...args);
        }
    }

    /**
     * Error level logging - actual errors
     */
    error(message: string, error?: unknown): void {
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
     */
    async performance<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
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
     */
    group(label: string, fn: () => void): void {
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
     */
    table(data: unknown, label = 'Data'): void {
        if (this.level <= CONSTANTS.LOG_LEVELS.DEBUG) {
            this.debug(`${label}:`);
            console.table(data);
        }
    }

    /**
     * Create a child logger with a specific module prefix
     */
    module(moduleName: string): Logger {
        return new Logger(`${this.prefix}:${moduleName}`, this.level);
    }
}

// Create default logger instance
const logger = new Logger();

// Enable debug mode if feature flag is set
if (CONSTANTS.FEATURES.ENABLE_DEBUG_MODE) {
    logger.setDebugMode(true);
}

export default logger;
