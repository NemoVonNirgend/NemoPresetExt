/**
 * NemoPresetExt - Shared Observer Utilities
 * Centralized MutationObserver management with cleanup tracking
 */

import { CONSTANTS } from './constants.js';

/**
 * Options for waitForElement
 */
export interface WaitForElementOptions {
    /** Maximum time to wait in ms (default: 10000) */
    timeout?: number;
    /** Interval between checks in ms (default: 50) */
    interval?: number;
    /** Root element to search within (default: document) */
    root?: Element | Document;
}

/**
 * Options for element observation
 */
export interface ObserveOptions extends MutationObserverInit {
    /** Whether to auto-disconnect after first match */
    once?: boolean;
    /** Debounce delay in ms */
    debounce?: number;
}

/**
 * Observer entry in the registry
 */
interface ObserverEntry {
    observer: MutationObserver;
    target: Node;
    name: string;
    createdAt: number;
}

/**
 * Central registry for tracking and managing MutationObservers
 */
class ObserverRegistry {
    private observers: Map<string, ObserverEntry> = new Map();
    private counter = 0;

    /**
     * Register a new observer
     */
    register(name: string, observer: MutationObserver, target: Node): string {
        const id = name || `observer_${++this.counter}`;

        // Disconnect existing observer with same name
        if (this.observers.has(id)) {
            this.disconnect(id);
        }

        this.observers.set(id, {
            observer,
            target,
            name: id,
            createdAt: Date.now(),
        });

        return id;
    }

    /**
     * Disconnect and remove an observer by ID
     */
    disconnect(id: string): boolean {
        const entry = this.observers.get(id);
        if (entry) {
            entry.observer.disconnect();
            this.observers.delete(id);
            return true;
        }
        return false;
    }

    /**
     * Disconnect all observers
     */
    disconnectAll(): void {
        for (const [id] of this.observers) {
            this.disconnect(id);
        }
    }

    /**
     * Get count of active observers
     */
    get size(): number {
        return this.observers.size;
    }

    /**
     * Check if an observer exists
     */
    has(id: string): boolean {
        return this.observers.has(id);
    }

    /**
     * Get all observer IDs
     */
    getIds(): string[] {
        return Array.from(this.observers.keys());
    }
}

// Global registry instance
export const observerRegistry = new ObserverRegistry();

/**
 * Wait for an element to appear in the DOM
 * @param selector CSS selector to find
 * @param options Configuration options
 * @returns Promise that resolves with the element or rejects on timeout
 */
export function waitForElement<T extends Element = Element>(
    selector: string,
    options: WaitForElementOptions = {}
): Promise<T> {
    const {
        timeout = CONSTANTS.TIMEOUTS.NETWORK_REQUEST,
        interval = CONSTANTS.TIMEOUTS.PRESET_LOAD_POLL_INTERVAL,
        root = document,
    } = options;

    return new Promise((resolve, reject) => {
        // Check if element already exists
        const existing = root.querySelector<T>(selector);
        if (existing) {
            resolve(existing);
            return;
        }

        const startTime = Date.now();

        const checkElement = (): void => {
            const element = root.querySelector<T>(selector);
            if (element) {
                resolve(element);
                return;
            }

            if (Date.now() - startTime >= timeout) {
                reject(new Error(`Timeout waiting for element: ${selector}`));
                return;
            }

            setTimeout(checkElement, interval);
        };

        checkElement();
    });
}

/**
 * Wait for an element using MutationObserver (more efficient for long waits)
 * @param selector CSS selector to find
 * @param options Configuration options
 * @returns Promise that resolves with the element
 */
export function waitForElementObserver<T extends Element = Element>(
    selector: string,
    options: WaitForElementOptions = {}
): Promise<T> {
    const {
        timeout = CONSTANTS.TIMEOUTS.NETWORK_REQUEST,
        root = document,
    } = options;

    return new Promise((resolve, reject) => {
        // Check if element already exists
        const existing = (root as Document | Element).querySelector<T>(selector);
        if (existing) {
            resolve(existing);
            return;
        }

        // eslint-disable-next-line prefer-const -- assigned after observer callback is created
        let timeoutId: ReturnType<typeof setTimeout>;
        const observerTarget = root instanceof Document ? root.body : root;

        const observer = new MutationObserver(() => {
            const element = (root as Document | Element).querySelector<T>(selector);
            if (element) {
                clearTimeout(timeoutId);
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(observerTarget, { childList: true, subtree: true });

        timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for element: ${selector}`));
        }, timeout);
    });
}

/**
 * Create a debounced callback
 */
function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Create and register a MutationObserver
 * @param name Unique name for the observer (for tracking)
 * @param target Target node to observe
 * @param callback Callback function
 * @param options MutationObserver options plus custom options
 * @returns The observer ID for later cleanup
 */
export function observeElement(
    name: string,
    target: Node,
    callback: MutationCallback,
    options: ObserveOptions = {}
): string {
    const { once = false, debounce: debounceDelay, ...observerOptions } = options;

    // Apply debouncing if specified
    let wrappedCallback: MutationCallback = callback;
    if (debounceDelay && debounceDelay > 0) {
        const debouncedFn = debounce(
            (mutations: MutationRecord[], obs: MutationObserver) => callback(mutations, obs),
            debounceDelay
        );
        wrappedCallback = debouncedFn;
    }

    // Wrap for once behavior
    if (once) {
        const originalCallback = wrappedCallback;
        wrappedCallback = (mutations, obs) => {
            obs.disconnect();
            observerRegistry.disconnect(name);
            originalCallback(mutations, obs);
        };
    }

    const observer = new MutationObserver(wrappedCallback);

    // Default options if none specified
    const finalOptions: MutationObserverInit = {
        childList: true,
        subtree: true,
        ...observerOptions,
    };

    observer.observe(target, finalOptions);
    return observerRegistry.register(name, observer, target);
}

/**
 * Observe for a specific element appearing (one-time)
 * @param selector CSS selector to watch for
 * @param callback Callback when element appears
 * @param root Root element to observe
 * @returns Observer ID for cleanup
 */
export function observeOnce(
    selector: string,
    callback: (element: Element) => void,
    root: Element | Document = document
): string {
    // Check if already exists
    const existing = root.querySelector(selector);
    if (existing) {
        callback(existing);
        return '';
    }

    const observerTarget = root instanceof Document ? root.body : root;
    const name = `once_${selector}_${Date.now()}`;

    return observeElement(
        name,
        observerTarget,
        (mutations, obs) => {
            const element = root.querySelector(selector);
            if (element) {
                obs.disconnect();
                observerRegistry.disconnect(name);
                callback(element);
            }
        },
        { childList: true, subtree: true, once: false }
    );
}

/**
 * Observe attribute changes on an element
 * @param name Observer name
 * @param target Element to observe
 * @param callback Callback with attribute name and new value
 * @param attributes Optional list of attribute names to watch
 * @returns Observer ID
 */
export function observeAttributes(
    name: string,
    target: Element,
    callback: (attributeName: string, newValue: string | null, oldValue: string | null) => void,
    attributes?: string[]
): string {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName) {
                const newValue = (mutation.target as Element).getAttribute(mutation.attributeName);
                callback(mutation.attributeName, newValue, mutation.oldValue);
            }
        }
    });

    const options: MutationObserverInit = {
        attributes: true,
        attributeOldValue: true,
    };

    if (attributes && attributes.length > 0) {
        options.attributeFilter = attributes;
    }

    observer.observe(target, options);
    return observerRegistry.register(name, observer, target);
}

/**
 * Observe children being added/removed
 * @param name Observer name
 * @param target Parent element to observe
 * @param callback Callback with added and removed nodes
 * @param options Additional options
 * @returns Observer ID
 */
export function observeChildren(
    name: string,
    target: Node,
    callback: (added: Node[], removed: Node[]) => void,
    options: { deep?: boolean; debounce?: number } = {}
): string {
    const { deep = false, debounce: debounceDelay = 0 } = options;

    return observeElement(
        name,
        target,
        (mutations) => {
            const added: Node[] = [];
            const removed: Node[] = [];

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    added.push(...Array.from(mutation.addedNodes));
                    removed.push(...Array.from(mutation.removedNodes));
                }
            }

            if (added.length > 0 || removed.length > 0) {
                callback(added, removed);
            }
        },
        { childList: true, subtree: deep, debounce: debounceDelay }
    );
}

/**
 * Disconnect an observer by ID
 */
export function disconnectObserver(id: string): boolean {
    return observerRegistry.disconnect(id);
}

/**
 * Disconnect all registered observers
 */
export function disconnectAllObservers(): void {
    observerRegistry.disconnectAll();
}

/**
 * Get count of active observers
 */
export function getObserverCount(): number {
    return observerRegistry.size;
}

// Export default object for convenience
export default {
    waitForElement,
    waitForElementObserver,
    observeElement,
    observeOnce,
    observeAttributes,
    observeChildren,
    disconnectObserver,
    disconnectAllObservers,
    getObserverCount,
    registry: observerRegistry,
};
