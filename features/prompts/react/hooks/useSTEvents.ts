/**
 * useSTEvents - Hook for subscribing to SillyTavern events
 * Automatically handles cleanup on unmount
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Common ST event names
 */
export const ST_EVENTS = {
    SETTINGS_UPDATED: 'SETTINGS_UPDATED',
    OAI_PRESET_CHANGED_AFTER: 'OAI_PRESET_CHANGED_AFTER',
    CHARACTER_MESSAGE_RENDERED: 'CHARACTER_MESSAGE_RENDERED',
    USER_MESSAGE_RENDERED: 'USER_MESSAGE_RENDERED',
    CHAT_CHANGED: 'CHAT_CHANGED',
    GENERATION_STARTED: 'GENERATION_STARTED',
    GENERATION_STOPPED: 'GENERATION_STOPPED',
    GENERATION_ENDED: 'GENERATION_ENDED',
    // Custom Nemo events for React/vanilla bridge
    NEMO_PROMPT_TOGGLED: 'NEMO_PROMPT_TOGGLED',
    NEMO_PROMPTS_REFRESHED: 'NEMO_PROMPTS_REFRESHED',
    NEMO_SECTION_STATE_CHANGED: 'NEMO_SECTION_STATE_CHANGED',
    NEMO_VIEW_MODE_CHANGED: 'NEMO_VIEW_MODE_CHANGED',
} as const;

// Custom event emitter for Nemo events (doesn't require ST's eventSource)
const nemoEventListeners = new Map<string, Set<(...args: any[]) => void>>();

/**
 * Emit a custom Nemo event
 * Can be called from vanilla JS via window.NemoReactUI.emitEvent
 */
export function emitNemoEvent(eventName: string, ...args: any[]): void {
    const listeners = nemoEventListeners.get(eventName);
    if (listeners) {
        listeners.forEach(cb => {
            try {
                cb(...args);
            } catch (e) {
                console.error(`[emitNemoEvent] Error in listener for ${eventName}:`, e);
            }
        });
    }
    // Also emit as a DOM custom event for broader compatibility
    window.dispatchEvent(new CustomEvent(eventName, { detail: args }));
}

/**
 * Subscribe to a custom Nemo event
 */
export function onNemoEvent(eventName: string, callback: (...args: any[]) => void): () => void {
    if (!nemoEventListeners.has(eventName)) {
        nemoEventListeners.set(eventName, new Set());
    }
    nemoEventListeners.get(eventName)!.add(callback);

    // Also listen for DOM custom events
    const domHandler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        callback(...(Array.isArray(detail) ? detail : [detail]));
    };
    window.addEventListener(eventName, domHandler);

    // Return cleanup function
    return () => {
        nemoEventListeners.get(eventName)?.delete(callback);
        window.removeEventListener(eventName, domHandler);
    };
}

export type STEventName = keyof typeof ST_EVENTS | string;

/**
 * Get the event source from SillyTavern globals
 */
function getEventSource(): {
    on: (event: string, cb: (...args: any[]) => void) => void;
    off: (event: string, cb: (...args: any[]) => void) => void;
} | null {
    try {
        // @ts-ignore - eventSource is a global from SillyTavern
        if (typeof eventSource !== 'undefined' && eventSource) {
            return eventSource;
        }
    } catch (e) {
        console.warn('[useSTEvents] Could not access eventSource:', e);
    }
    return null;
}

/**
 * Get the event type string from ST's event_types
 */
function getEventTypeString(eventName: STEventName): string {
    try {
        // @ts-ignore - event_types is a global from SillyTavern
        if (typeof event_types !== 'undefined' && event_types[eventName]) {
            return event_types[eventName];
        }
    } catch (e) {
        // Fall through to default
    }
    // If not found in event_types, use as-is
    return eventName;
}

/**
 * Subscribe to a SillyTavern event
 *
 * @param eventName - The event name (from ST_EVENTS or custom string)
 * @param callback - The callback to run when event fires
 * @param deps - Optional dependencies array for callback memoization
 *
 * @example
 * // Listen to settings changes
 * useSTEvent('SETTINGS_UPDATED', () => {
 *     console.log('Settings changed!');
 * });
 *
 * @example
 * // With dependencies
 * useSTEvent('CHAT_CHANGED', () => {
 *     refreshData();
 * }, [refreshData]);
 */
export function useSTEvent(
    eventName: STEventName,
    callback: (...args: any[]) => void,
    deps: React.DependencyList = []
): void {
    // Keep latest callback in ref to avoid re-subscribing
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback, ...deps]);

    useEffect(() => {
        const es = getEventSource();
        if (!es) {
            console.warn(`[useSTEvent] No eventSource available, cannot subscribe to ${eventName}`);
            return;
        }

        const eventString = getEventTypeString(eventName);

        // Wrapper that calls latest callback
        const handler = (...args: any[]) => {
            callbackRef.current(...args);
        };

        es.on(eventString, handler);

        // Cleanup on unmount
        return () => {
            es.off(eventString, handler);
        };
    }, [eventName]);
}

/**
 * Subscribe to multiple SillyTavern events with a single callback
 *
 * @param eventNames - Array of event names
 * @param callback - The callback to run when any event fires
 * @param deps - Optional dependencies array
 */
export function useSTEvents(
    eventNames: STEventName[],
    callback: (eventName: string, ...args: any[]) => void,
    deps: React.DependencyList = []
): void {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback, ...deps]);

    useEffect(() => {
        const es = getEventSource();
        if (!es) {
            console.warn('[useSTEvents] No eventSource available');
            return;
        }

        const handlers = new Map<string, (...args: any[]) => void>();

        eventNames.forEach(eventName => {
            const eventString = getEventTypeString(eventName);
            const handler = (...args: any[]) => {
                callbackRef.current(eventName, ...args);
            };
            handlers.set(eventString, handler);
            es.on(eventString, handler);
        });

        // Cleanup
        return () => {
            handlers.forEach((handler, eventString) => {
                es.off(eventString, handler);
            });
        };
    }, [eventNames.join(',')]);
}

/**
 * Hook to emit an event to SillyTavern
 * Returns a function that emits the event when called
 */
export function useSTEventEmitter(
    eventName: STEventName
): (...args: any[]) => void {
    return useCallback((...args: any[]) => {
        try {
            // @ts-ignore - eventSource is a global
            if (typeof eventSource !== 'undefined' && eventSource?.emit) {
                const eventString = getEventTypeString(eventName);
                eventSource.emit(eventString, ...args);
            }
        } catch (e) {
            console.error('[useSTEventEmitter] Failed to emit event:', e);
        }
    }, [eventName]);
}

export default useSTEvent;
