/**
 * Core Event System
 * RECOVERY VERSION - Custom event management for NemoLore
 */

/**
 * Custom Event System for NemoLore
 * Provides event management with proper cleanup and error handling
 */
export class EventSystem {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
        this.isInitialized = false;
        this.maxListeners = 100;
        
        // Event queue for deferred events
        this.eventQueue = [];
        this.isProcessingQueue = false;
        
        console.log('[NemoLore Event System] Constructor completed');
    }

    /**
     * Initialize the event system
     */
    initialize() {
        if (this.isInitialized) return;
        
        console.log('[NemoLore Event System] Initializing...');
        
        this.isInitialized = true;
        this.processEventQueue();
        
        console.log('[NemoLore Event System] ✅ Initialized successfully');
    }

    /**
     * Add event listener
     */
    on(event, callback, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        
        const listeners = this.listeners.get(event);
        
        // Check max listeners limit
        if (listeners.length >= this.maxListeners) {
            console.warn(`[NemoLore Event System] Max listeners (${this.maxListeners}) reached for event: ${event}`);
            return false;
        }
        
        const listenerInfo = {
            callback,
            context,
            id: this.generateListenerId()
        };
        
        listeners.push(listenerInfo);
        
        return listenerInfo.id;
    }

    /**
     * Add one-time event listener
     */
    once(event, callback, context = null) {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, []);
        }
        
        const listenerInfo = {
            callback,
            context,
            id: this.generateListenerId()
        };
        
        this.onceListeners.get(event).push(listenerInfo);
        
        return listenerInfo.id;
    }

    /**
     * Remove event listener
     */
    off(event, callbackOrId) {
        let removed = false;
        
        // Remove from regular listeners
        if (this.listeners.has(event)) {
            const listeners = this.listeners.get(event);
            const filteredListeners = listeners.filter(listener => {
                const match = typeof callbackOrId === 'function' 
                    ? listener.callback === callbackOrId
                    : listener.id === callbackOrId;
                if (match) removed = true;
                return !match;
            });
            
            if (filteredListeners.length === 0) {
                this.listeners.delete(event);
            } else {
                this.listeners.set(event, filteredListeners);
            }
        }
        
        // Remove from once listeners
        if (this.onceListeners.has(event)) {
            const listeners = this.onceListeners.get(event);
            const filteredListeners = listeners.filter(listener => {
                const match = typeof callbackOrId === 'function'
                    ? listener.callback === callbackOrId
                    : listener.id === callbackOrId;
                if (match) removed = true;
                return !match;
            });
            
            if (filteredListeners.length === 0) {
                this.onceListeners.delete(event);
            } else {
                this.onceListeners.set(event, filteredListeners);
            }
        }
        
        return removed;
    }

    /**
     * Remove all listeners for an event
     */
    removeAllListeners(event) {
        let removed = false;
        
        if (this.listeners.has(event)) {
            this.listeners.delete(event);
            removed = true;
        }
        
        if (this.onceListeners.has(event)) {
            this.onceListeners.delete(event);
            removed = true;
        }
        
        return removed;
    }

    /**
     * Emit event to all listeners
     */
    emit(event, ...args) {
        if (!this.isInitialized) {
            // Queue event for later processing
            this.eventQueue.push({ event, args });
            return false;
        }
        
        let handled = false;
        const errors = [];
        
        // Call regular listeners
        if (this.listeners.has(event)) {
            const listeners = this.listeners.get(event);
            for (const listener of listeners) {
                try {
                    if (listener.context) {
                        listener.callback.call(listener.context, ...args);
                    } else {
                        listener.callback(...args);
                    }
                    handled = true;
                } catch (error) {
                    console.error(`[NemoLore Event System] Error in listener for ${event}:`, error);
                    errors.push(error);
                }
            }
        }
        
        // Call once listeners and remove them
        if (this.onceListeners.has(event)) {
            const listeners = this.onceListeners.get(event);
            this.onceListeners.delete(event); // Remove all once listeners
            
            for (const listener of listeners) {
                try {
                    if (listener.context) {
                        listener.callback.call(listener.context, ...args);
                    } else {
                        listener.callback(...args);
                    }
                    handled = true;
                } catch (error) {
                    console.error(`[NemoLore Event System] Error in once listener for ${event}:`, error);
                    errors.push(error);
                }
            }
        }
        
        // Emit error events if there were errors
        if (errors.length > 0 && event !== 'error') {
            this.emit('error', { event, errors });
        }
        
        return handled;
    }

    /**
     * Emit event asynchronously
     */
    async emitAsync(event, ...args) {
        if (!this.isInitialized) {
            this.eventQueue.push({ event, args });
            return false;
        }
        
        let handled = false;
        const errors = [];
        
        // Call regular listeners
        if (this.listeners.has(event)) {
            const listeners = this.listeners.get(event);
            for (const listener of listeners) {
                try {
                    let result;
                    if (listener.context) {
                        result = listener.callback.call(listener.context, ...args);
                    } else {
                        result = listener.callback(...args);
                    }
                    
                    // Handle async callbacks
                    if (result instanceof Promise) {
                        await result;
                    }
                    
                    handled = true;
                } catch (error) {
                    console.error(`[NemoLore Event System] Error in async listener for ${event}:`, error);
                    errors.push(error);
                }
            }
        }
        
        // Call once listeners and remove them
        if (this.onceListeners.has(event)) {
            const listeners = this.onceListeners.get(event);
            this.onceListeners.delete(event);
            
            for (const listener of listeners) {
                try {
                    let result;
                    if (listener.context) {
                        result = listener.callback.call(listener.context, ...args);
                    } else {
                        result = listener.callback(...args);
                    }
                    
                    if (result instanceof Promise) {
                        await result;
                    }
                    
                    handled = true;
                } catch (error) {
                    console.error(`[NemoLore Event System] Error in async once listener for ${event}:`, error);
                    errors.push(error);
                }
            }
        }
        
        if (errors.length > 0 && event !== 'error') {
            this.emit('error', { event, errors });
        }
        
        return handled;
    }

    /**
     * Process queued events
     */
    async processEventQueue() {
        if (this.isProcessingQueue || this.eventQueue.length === 0) return;
        
        this.isProcessingQueue = true;
        
        while (this.eventQueue.length > 0) {
            const { event, args } = this.eventQueue.shift();
            try {
                await this.emitAsync(event, ...args);
            } catch (error) {
                console.error(`[NemoLore Event System] Error processing queued event ${event}:`, error);
            }
        }
        
        this.isProcessingQueue = false;
    }

    /**
     * Generate unique listener ID
     */
    generateListenerId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get listener count for an event
     */
    listenerCount(event) {
        const regularCount = this.listeners.has(event) ? this.listeners.get(event).length : 0;
        const onceCount = this.onceListeners.has(event) ? this.onceListeners.get(event).length : 0;
        return regularCount + onceCount;
    }

    /**
     * Get all event names that have listeners
     */
    eventNames() {
        const events = new Set();
        
        for (const event of this.listeners.keys()) {
            events.add(event);
        }
        
        for (const event of this.onceListeners.keys()) {
            events.add(event);
        }
        
        return Array.from(events);
    }

    /**
     * Get system statistics
     */
    getStats() {
        const totalListeners = Array.from(this.listeners.values())
            .reduce((sum, listeners) => sum + listeners.length, 0);
        
        const totalOnceListeners = Array.from(this.onceListeners.values())
            .reduce((sum, listeners) => sum + listeners.length, 0);
        
        return {
            totalEvents: this.eventNames().length,
            totalListeners: totalListeners + totalOnceListeners,
            regularListeners: totalListeners,
            onceListeners: totalOnceListeners,
            queuedEvents: this.eventQueue.length,
            isProcessingQueue: this.isProcessingQueue,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Create event namespace for modular components
     */
    createNamespace(namespace) {
        return new EventNamespace(this, namespace);
    }

    /**
     * Shutdown the event system
     */
    shutdown() {
        console.log('[NemoLore Event System] Shutting down...');
        
        // Clear all listeners
        this.listeners.clear();
        this.onceListeners.clear();
        
        // Clear event queue
        this.eventQueue = [];
        this.isProcessingQueue = false;
        
        this.isInitialized = false;
        console.log('[NemoLore Event System] ✅ Shutdown completed');
    }
}

/**
 * Event Namespace for modular components
 */
class EventNamespace {
    constructor(eventSystem, namespace) {
        this.eventSystem = eventSystem;
        this.namespace = namespace;
        this.listenerIds = new Set();
    }

    /**
     * Add namespaced event listener
     */
    on(event, callback, context = null) {
        const namespacedEvent = `${this.namespace}:${event}`;
        const id = this.eventSystem.on(namespacedEvent, callback, context);
        if (id) {
            this.listenerIds.add(id);
        }
        return id;
    }

    /**
     * Add namespaced once listener
     */
    once(event, callback, context = null) {
        const namespacedEvent = `${this.namespace}:${event}`;
        const id = this.eventSystem.once(namespacedEvent, callback, context);
        if (id) {
            this.listenerIds.add(id);
        }
        return id;
    }

    /**
     * Remove namespaced event listener
     */
    off(event, callbackOrId) {
        const namespacedEvent = `${this.namespace}:${event}`;
        const removed = this.eventSystem.off(namespacedEvent, callbackOrId);
        
        if (removed && typeof callbackOrId !== 'function') {
            this.listenerIds.delete(callbackOrId);
        }
        
        return removed;
    }

    /**
     * Emit namespaced event
     */
    emit(event, ...args) {
        const namespacedEvent = `${this.namespace}:${event}`;
        return this.eventSystem.emit(namespacedEvent, ...args);
    }

    /**
     * Emit namespaced event asynchronously
     */
    async emitAsync(event, ...args) {
        const namespacedEvent = `${this.namespace}:${event}`;
        return await this.eventSystem.emitAsync(namespacedEvent, ...args);
    }

    /**
     * Remove all listeners in this namespace
     */
    removeAllListeners() {
        for (const id of this.listenerIds) {
            // Remove by ID across all events
            for (const event of this.eventSystem.eventNames()) {
                if (event.startsWith(`${this.namespace}:`)) {
                    this.eventSystem.off(event, id);
                }
            }
        }
        this.listenerIds.clear();
    }

    /**
     * Get listener count for namespaced event
     */
    listenerCount(event) {
        const namespacedEvent = `${this.namespace}:${event}`;
        return this.eventSystem.listenerCount(namespacedEvent);
    }

    /**
     * Get all events in this namespace
     */
    eventNames() {
        return this.eventSystem.eventNames()
            .filter(event => event.startsWith(`${this.namespace}:`))
            .map(event => event.substring(this.namespace.length + 1));
    }
}

// Export singleton instance
export const eventSystem = new EventSystem();

// Common NemoLore events
export const NEMOLORE_EVENTS = {
    // System events
    SYSTEM_READY: 'system:ready',
    SYSTEM_SHUTDOWN: 'system:shutdown',
    SYSTEM_ERROR: 'system:error',
    
    // Settings events
    SETTINGS_CHANGED: 'settings:changed',
    SETTINGS_LOADED: 'settings:loaded',
    SETTINGS_SAVED: 'settings:saved',
    
    // Context events
    CONTEXT_INTERCEPTED: 'context:intercepted',
    CONTEXT_PROCESSED: 'context:processed',
    MESSAGES_HIDDEN: 'context:messages_hidden',
    SUMMARY_GENERATED: 'context:summary_generated',
    
    // Vectorization events
    VECTOR_STORED: 'vector:stored',
    VECTOR_SEARCH: 'vector:search',
    VECTOR_CACHE_HIT: 'vector:cache_hit',
    VECTOR_CACHE_MISS: 'vector:cache_miss',
    
    // Lorebook events
    LOREBOOK_ENTRY_CREATED: 'lorebook:entry_created',
    LOREBOOK_ENTRY_UPDATED: 'lorebook:entry_updated',
    LOREBOOK_SCAN_COMPLETE: 'lorebook:scan_complete',
    
    // UI events
    DASHBOARD_OPENED: 'ui:dashboard_opened',
    DASHBOARD_CLOSED: 'ui:dashboard_closed',
    NOTIFICATION_SHOWN: 'ui:notification_shown',
    
    // Performance events
    PERFORMANCE_METRIC: 'performance:metric',
    PERFORMANCE_WARNING: 'performance:warning',
    MEMORY_CLEANUP: 'performance:memory_cleanup'
};

console.log('[NemoLore Event System] Module loaded - Custom event management ready');