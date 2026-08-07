/**
 * Shared Event Bus for Cross-System Communication
 * Enables NemoLore and ProsePolisher to communicate without tight coupling
 */

/**
 * Event Types Documentation:
 *
 * NemoLore Events:
 * - nemolore:summary_created - { messageIndices: number[], summary: string, type: string, quality: object }
 * - nemolore:core_memory_detected - { messageIndex: number, summary: string, keyPhrases: array }
 * - nemolore:lorebook_entry_created - { entry: object, coreMemory: object }
 * - nemolore:summary_regenerated - { messageIndex: number, oldSummary: string, newSummary: string }
 * - nemolore:chat_initialized - { chatId: string, hasLorebook: boolean }
 *
 * ProsePolisher Events:
 * - prosepolisher:high_slop_detected - { messageIndex: number, slopScore: number, topPhrases: array }
 * - prosepolisher:pattern_detected - { pattern: string, score: number, type: string }
 * - prosepolisher:regex_rule_generated - { rule: object, pattern: string }
 * - prosepolisher:analysis_complete - { messageIndex: number, metrics: object }
 */

class NemoPresetEventBus {
    constructor() {
        /** @type {Map<string, Function[]>} */
        this.listeners = new Map();

        /** @type {Array<{event: string, data: any, timestamp: number}>} */
        this.eventHistory = [];

        this.maxHistorySize = 100;
        this.debugMode = false;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} callback - Function to call when event fires
     * @param {Object} options - Optional configuration
     * @returns {Function} Unsubscribe function
     */
    on(eventName, callback, options = {}) {
        if (typeof callback !== 'function') {
            console.error('[EventBus] Callback must be a function');
            return () => {};
        }

        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        const listener = {
            callback,
            once: options.once || false,
            priority: options.priority || 0,
            id: this._generateListenerId()
        };

        this.listeners.get(eventName).push(listener);

        // Sort by priority (higher priority = called first)
        this.listeners.get(eventName).sort((a, b) => b.priority - a.priority);

        if (this.debugMode) {
            console.log(`[EventBus] Registered listener for "${eventName}" (ID: ${listener.id}, Priority: ${listener.priority})`);
        }

        // Return unsubscribe function
        return () => this.off(eventName, listener.id);
    }

    /**
     * Subscribe to an event once (auto-unsubscribes after first call)
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Function to call
     * @returns {Function} Unsubscribe function
     */
    once(eventName, callback) {
        return this.on(eventName, callback, { once: true });
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - Name of the event
     * @param {string} listenerId - ID of the listener to remove
     */
    off(eventName, listenerId) {
        if (!this.listeners.has(eventName)) {
            return;
        }

        const listeners = this.listeners.get(eventName);
        const index = listeners.findIndex(l => l.id === listenerId);

        if (index !== -1) {
            listeners.splice(index, 1);
            if (this.debugMode) {
                console.log(`[EventBus] Unregistered listener for "${eventName}" (ID: ${listenerId})`);
            }
        }

        // Clean up empty event arrays
        if (listeners.length === 0) {
            this.listeners.delete(eventName);
        }
    }

    /**
     * Emit an event to all subscribers
     * @param {string} eventName - Name of the event
     * @param {any} data - Data to pass to listeners
     * @param {Object} options - Optional configuration
     */
    emit(eventName, data, options = {}) {
        const timestamp = Date.now();

        // Add to history
        this.eventHistory.push({ event: eventName, data, timestamp });
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        if (this.debugMode) {
            console.log(`[EventBus] Emitting "${eventName}"`, data);
        }

        const listeners = this.listeners.get(eventName);
        if (!listeners || listeners.length === 0) {
            if (this.debugMode) {
                console.log(`[EventBus] No listeners for "${eventName}"`);
            }
            return;
        }

        // Create a copy to avoid issues if listeners modify the array
        const listenersCopy = [...listeners];

        for (const listener of listenersCopy) {
            try {
                listener.callback(data, { eventName, timestamp });

                // Remove one-time listeners
                if (listener.once) {
                    this.off(eventName, listener.id);
                }
            } catch (error) {
                console.error(`[EventBus] Error in listener for "${eventName}":`, error);

                // Optionally emit an error event
                if (!options.suppressErrors) {
                    this.emit('eventbus:error', {
                        originalEvent: eventName,
                        error: error.message,
                        stack: error.stack
                    });
                }
            }
        }
    }

    /**
     * Emit an event asynchronously (doesn't block)
     * @param {string} eventName - Name of the event
     * @param {any} data - Data to pass to listeners
     */
    emitAsync(eventName, data) {
        setTimeout(() => this.emit(eventName, data), 0);
    }

    /**
     * Wait for an event to fire (returns Promise)
     * @param {string} eventName - Name of the event to wait for
     * @param {number} timeout - Optional timeout in milliseconds
     * @returns {Promise<any>} Promise that resolves with event data
     */
    waitFor(eventName, timeout = null) {
        return new Promise((resolve, reject) => {
            let timeoutId = null;

            const unsubscribe = this.once(eventName, (data) => {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(data);
            });

            if (timeout) {
                timeoutId = setTimeout(() => {
                    unsubscribe();
                    reject(new Error(`Timeout waiting for event "${eventName}"`));
                }, timeout);
            }
        });
    }

    /**
     * Get all listeners for an event
     * @param {string} eventName - Name of the event
     * @returns {number} Number of listeners
     */
    listenerCount(eventName) {
        const listeners = this.listeners.get(eventName);
        return listeners ? listeners.length : 0;
    }

    /**
     * Get all registered events
     * @returns {string[]} Array of event names
     */
    getEventNames() {
        return Array.from(this.listeners.keys());
    }

    /**
     * Get recent event history
     * @param {string} eventName - Optional filter by event name
     * @param {number} limit - Max number of events to return
     * @returns {Array} Event history
     */
    getHistory(eventName = null, limit = 20) {
        let history = this.eventHistory;

        if (eventName) {
            history = history.filter(e => e.event === eventName);
        }

        return history.slice(-limit);
    }

    /**
     * Clear all listeners (useful for cleanup)
     */
    clear() {
        this.listeners.clear();
        console.log('[EventBus] Cleared all listeners');
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug logging
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`[EventBus] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get statistics about the event bus
     * @returns {Object} Statistics object
     */
    getStats() {
        const eventCounts = {};
        for (const [eventName, listeners] of this.listeners) {
            eventCounts[eventName] = listeners.length;
        }

        return {
            totalEvents: this.listeners.size,
            totalListeners: Array.from(this.listeners.values()).reduce((sum, l) => sum + l.length, 0),
            eventCounts,
            historySize: this.eventHistory.length,
            recentEvents: this.getHistory(null, 10).map(e => ({
                event: e.event,
                timestamp: new Date(e.timestamp).toISOString()
            }))
        };
    }

    /**
     * Generate a unique listener ID
     * @private
     */
    _generateListenerId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
}

// Create global singleton instance
const eventBus = new NemoPresetEventBus();

// Make it available globally for both NemoLore and ProsePolisher
if (typeof window !== 'undefined') {
    window.nemoPresetEventBus = eventBus;
}

// Export for module use
export default eventBus;

// Log initialization
console.log('[EventBus] ✅ Shared event bus initialized and ready');

// Set up error event listener for debugging
eventBus.on('eventbus:error', (error) => {
    console.error('[EventBus] Event handler error:', error);
}, { priority: 1000 }); // High priority for error logging
