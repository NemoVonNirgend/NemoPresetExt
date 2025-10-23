import { LOG_PREFIX } from './constants.js';

/**
 * Centralized error handling utility for ProsePolisher
 */
export class ErrorHandler {
    /**
     * Logs an error with consistent formatting
     */
    static logError(context, error, details = {}) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : '';

        console.error(`${LOG_PREFIX} Error in ${context}:`, {
            message: errorMessage,
            details,
            stack
        });
    }

    /**
     * Logs a warning with consistent formatting
     */
    static logWarning(context, message, details = {}) {
        console.warn(`${LOG_PREFIX} Warning in ${context}:`, message, details);
    }

    /**
     * Shows a user-friendly error notification
     */
    static showUserError(message, details = '') {
        if (window.toastr) {
            window.toastr.error(`${message}${details ? ': ' + details : ''}`, 'ProsePolisher Error');
        } else {
            console.error(`${LOG_PREFIX} User Error: ${message}`, details);
        }
    }

    /**
     * Shows a user-friendly warning notification
     */
    static showUserWarning(message, details = '') {
        if (window.toastr) {
            window.toastr.warning(`${message}${details ? ': ' + details : ''}`, 'ProsePolisher Warning');
        } else {
            console.warn(`${LOG_PREFIX} User Warning: ${message}`, details);
        }
    }

    /**
     * Wraps an async function with error handling
     */
    static async withErrorHandling(context, fn, options = {}) {
        const { showUser = true, rethrow = false } = options;

        try {
            return await fn();
        } catch (error) {
            this.logError(context, error);

            if (showUser) {
                this.showUserError('An error occurred', context);
            }

            if (rethrow) {
                throw error;
            }

            return null;
        }
    }

    /**
     * Validates that required dependencies are available
     */
    static validateDependencies(dependencies, context) {
        const missing = [];

        for (const [name, value] of Object.entries(dependencies)) {
            if (value === undefined || value === null) {
                missing.push(name);
            }
        }

        if (missing.length > 0) {
            const error = new Error(`Missing dependencies: ${missing.join(', ')}`);
            this.logError(context, error);
            return false;
        }

        return true;
    }

    /**
     * Safely calls a function that might not exist
     */
    static safeCall(fn, ...args) {
        if (typeof fn === 'function') {
            try {
                return fn(...args);
            } catch (error) {
                this.logError('safeCall', error, { functionName: fn.name });
                return null;
            }
        }
        return null;
    }
}