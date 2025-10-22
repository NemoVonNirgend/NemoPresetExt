/**
 * NemoPresetExt - DOM Element Caching Utility
 * Provides efficient DOM element caching and batch operations
 */

import logger from '../core/logger.js';
import { CONSTANTS } from '../core/constants.js';

class DOMCache {
    constructor() {
        this.cache = new Map();
        this.observers = new Map();
        this.batchOperations = [];
        this.rafId = null;
    }

    /**
     * Get cached element or query and cache it
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element (default: document)
     * @returns {Element|null} Found element or null
     */
    get(selector, context = document) {
        const key = this.getCacheKey(selector, context);
        
        if (this.cache.has(key)) {
            const element = this.cache.get(key);
            // Verify element is still in DOM
            if (element && element.isConnected) {
                return element;
            } else {
                // Remove stale cache entry
                this.cache.delete(key);
                logger.debug(`Removed stale cache entry: ${selector}`);
            }
        }

        // Query and cache the element
        const element = context.querySelector(selector);
        if (element) {
            this.cache.set(key, element);
            logger.debug(`Cached element: ${selector}`);
        }
        
        return element;
    }

    /**
     * Get all matching cached elements or query and cache them
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element (default: document)
     * @returns {NodeList} Found elements
     */
    getAll(selector, context = document) {
        const key = this.getCacheKey(selector + '_all', context);
        
        if (this.cache.has(key)) {
            const elements = this.cache.get(key);
            // Verify elements are still in DOM
            const connected = Array.from(elements).filter(el => el.isConnected);
            if (connected.length === elements.length) {
                return elements;
            } else {
                this.cache.delete(key);
            }
        }

        const elements = context.querySelectorAll(selector);
        this.cache.set(key, elements);
        return elements;
    }

    /**
     * Safe element getter with error handling
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element
     * @param {boolean} required - Whether element is required
     * @returns {Element|null} Found element or null
     */
    safeGet(selector, context = document, required = false) {
        try {
            const element = this.get(selector, context);
            if (required && !element) {
                logger.warn(`Required element not found: ${selector}`);
            }
            return element;
        } catch (error) {
            logger.error(`Error querying selector: ${selector}`, error);
            return null;
        }
    }

    /**
     * Get element with timeout and retry
     * @param {string} selector - CSS selector
     * @param {number} timeout - Timeout in milliseconds
     * @param {number} interval - Check interval in milliseconds
     * @returns {Promise<Element|null>} Found element or null
     */
    async waitFor(selector, timeout = 5000, interval = 100) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = this.get(selector);
            if (element) {
                return element;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        logger.warn(`Element not found within timeout: ${selector}`);
        return null;
    }

    /**
     * Create cache key for selector and context
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element
     * @returns {string} Cache key
     */
    getCacheKey(selector, context) {
        if (context === document) {
            return selector;
        }
        // Use element's unique identifier if available
        const contextId = context.id || context.className || 'unknown';
        return `${contextId}::${selector}`;
    }

    /**
     * Batch DOM operations for better performance
     * @param {Function} operation - DOM operation function
     */
    batch(operation) {
        this.batchOperations.push(operation);
        
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                this.executeBatch();
            });
        }
    }

    /**
     * Execute all batched operations
     */
    executeBatch() {
        if (this.batchOperations.length === 0) {
            this.rafId = null;
            return;
        }

        logger.debug(`Executing ${this.batchOperations.length} batched DOM operations`);
        
        // Execute all operations
        this.batchOperations.forEach(operation => {
            try {
                operation();
            } catch (error) {
                logger.error('Error in batched DOM operation', error);
            }
        });

        // Clear batch and reset RAF ID
        this.batchOperations = [];
        this.rafId = null;
    }

    /**
     * Clear cache for specific selector or all cache
     * @param {string} selector - Specific selector to clear (optional)
     */
    clear(selector = null) {
        if (selector) {
            // Clear specific selector from all contexts
            const keysToDelete = Array.from(this.cache.keys())
                .filter(key => key.includes(selector));
            keysToDelete.forEach(key => this.cache.delete(key));
            logger.debug(`Cleared cache for selector: ${selector}`);
        } else {
            // Clear entire cache
            this.cache.clear();
            logger.debug('Cleared entire DOM cache');
        }
    }

    /**
     * Watch for changes to cached elements
     * @param {string} selector - CSS selector to watch
     * @param {Function} callback - Callback when changes occur
     */
    watch(selector, callback) {
        const element = this.get(selector);
        if (!element) {
            logger.warn(`Cannot watch non-existent element: ${selector}`);
            return null;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(callback);
        });

        observer.observe(element, {
            childList: true,
            attributes: true,
            subtree: true
        });

        this.observers.set(selector, observer);
        logger.debug(`Started watching element: ${selector}`);
        
        return observer;
    }

    /**
     * Stop watching an element
     * @param {string} selector - CSS selector to stop watching
     */
    unwatch(selector) {
        const observer = this.observers.get(selector);
        if (observer) {
            observer.disconnect();
            this.observers.delete(selector);
            logger.debug(`Stopped watching element: ${selector}`);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            observers: this.observers.size,
            batchQueueSize: this.batchOperations.length,
            hasActiveRAF: this.rafId !== null
        };
    }

    /**
     * Cleanup all cache and observers
     */
    destroy() {
        // Clear all observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();

        // Clear cache
        this.cache.clear();

        // Cancel pending RAF
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Clear batch operations
        this.batchOperations = [];
        
        logger.debug('DOM cache destroyed');
    }
}

// Create singleton instance
const domCache = new DOMCache();

// Utility functions for common operations
export const DOMUtils = {
    /**
     * Safe element getter with automatic caching
     */
    $(selector, context = document) {
        return domCache.safeGet(selector, context);
    },

    /**
     * Get multiple elements with automatic caching
     */
    $$(selector, context = document) {
        return domCache.getAll(selector, context);
    },

    /**
     * Wait for element to appear
     */
    waitFor(selector, timeout = 5000) {
        return domCache.waitFor(selector, timeout);
    },

    /**
     * Add event listener with automatic cleanup
     */
    on(selector, event, handler, options = {}) {
        const element = domCache.get(selector);
        if (element) {
            element.addEventListener(event, handler, options);
            return () => element.removeEventListener(event, handler, options);
        }
        return null;
    },

    /**
     * Batch DOM operations
     */
    batch(operation) {
        domCache.batch(operation);
    },

    /**
     * Clear specific cache entries
     */
    clearCache(selector) {
        domCache.clear(selector);
    }
};

export { DOMCache };
export default domCache;