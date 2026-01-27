/**
 * stBridge - Typed wrappers for SillyTavern APIs
 * Provides safe access to ST runtime globals with proper error handling
 */

import type { NemoSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const EXTENSION_NAME = 'NemoPresetExt';

// ============================================================
// Prompt Manager Bridge
// ============================================================

export interface PromptData {
    identifier: string;
    name: string;
    content: string;
    enabled: boolean;
    role?: string;
    system_prompt?: boolean;
}

/**
 * Get the prompt manager instance
 */
export function getPromptManager(): any | null {
    try {
        // Check window.promptManager first (exposed by NemoPresetExt)
        if ((window as any).promptManager) {
            return (window as any).promptManager;
        }
        // @ts-ignore - promptManager might be a global from SillyTavern
        if (typeof promptManager !== 'undefined') {
            return promptManager;
        }
    } catch (e) {
        console.warn('[stBridge] Could not access promptManager:', e);
    }
    return null;
}

/**
 * Get all prompts from the prompt manager
 */
export function getAllPrompts(): PromptData[] {
    const pm = getPromptManager();
    if (!pm?.serviceSettings?.prompts) {
        return [];
    }

    const activeCharacter = pm.activeCharacter || '';

    return pm.serviceSettings.prompts.map((prompt: any): PromptData => {
        const orderEntry = pm.getPromptOrderEntry?.(activeCharacter, prompt.identifier);
        const isDisabled = pm.isPromptDisabledForActiveCharacter?.(prompt.identifier) ?? false;

        return {
            identifier: prompt.identifier,
            name: prompt.name || '',
            content: prompt.content || '',
            enabled: orderEntry?.enabled ?? !isDisabled,
            role: prompt.role,
            system_prompt: prompt.system_prompt,
        };
    });
}

/**
 * Toggle a prompt's enabled state
 */
export async function togglePrompt(identifier: string, enabled: boolean): Promise<boolean> {
    const pm = getPromptManager();
    if (!pm) {
        console.error('[stBridge] No promptManager available');
        return false;
    }

    try {
        const activeCharacter = pm.activeCharacter || '';
        const orderEntry = pm.getPromptOrderEntry?.(activeCharacter, identifier);

        if (orderEntry) {
            orderEntry.enabled = enabled;
            await pm.saveServiceSettings?.();
            return true;
        }
    } catch (e) {
        console.error('[stBridge] Failed to toggle prompt:', e);
    }
    return false;
}

/**
 * Get token counts for prompts
 */
export function getTokenCounts(): Record<string, number | null> {
    const pm = getPromptManager();
    if (!pm?.tokenHandler?.getCounts) {
        return {};
    }
    return pm.tokenHandler.getCounts();
}

// ============================================================
// Settings Bridge
// ============================================================

/**
 * Get extension settings
 */
export function getExtensionSettings(): NemoSettings {
    try {
        // @ts-ignore - extension_settings is a global from SillyTavern
        if (typeof extension_settings !== 'undefined' && extension_settings[EXTENSION_NAME]) {
            return { ...DEFAULT_SETTINGS, ...extension_settings[EXTENSION_NAME] };
        }
    } catch (e) {
        console.warn('[stBridge] Could not access extension_settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * Update extension settings
 */
export function updateExtensionSettings(updates: Partial<NemoSettings>): void {
    try {
        // @ts-ignore - extension_settings is a global from SillyTavern
        if (typeof extension_settings !== 'undefined') {
            if (!extension_settings[EXTENSION_NAME]) {
                extension_settings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
            }
            Object.assign(extension_settings[EXTENSION_NAME], updates);
            saveSettings();
        }
    } catch (e) {
        console.error('[stBridge] Failed to update settings:', e);
    }
}

/**
 * Save settings to SillyTavern (debounced)
 */
export function saveSettings(): void {
    try {
        // @ts-ignore - saveSettingsDebounced is a global from SillyTavern
        if (typeof saveSettingsDebounced === 'function') {
            saveSettingsDebounced();
        }
    } catch (e) {
        console.error('[stBridge] Failed to save settings:', e);
    }
}

// ============================================================
// Event Bridge
// ============================================================

/**
 * Get the event source
 */
export function getEventSource(): any | null {
    try {
        // @ts-ignore - eventSource is a global from SillyTavern
        if (typeof eventSource !== 'undefined') {
            return eventSource;
        }
    } catch (e) {
        console.warn('[stBridge] Could not access eventSource:', e);
    }
    return null;
}

/**
 * Get event type string from event_types
 */
export function getEventType(name: string): string {
    try {
        // @ts-ignore - event_types is a global from SillyTavern
        if (typeof event_types !== 'undefined' && event_types[name]) {
            return event_types[name];
        }
    } catch (e) {
        // Fall through
    }
    return name;
}

/**
 * Subscribe to an event
 */
export function onEvent(eventName: string, callback: (...args: any[]) => void): () => void {
    const es = getEventSource();
    if (!es) {
        return () => {};
    }

    const eventString = getEventType(eventName);
    es.on(eventString, callback);

    // Return unsubscribe function
    return () => {
        es.off(eventString, callback);
    };
}

// ============================================================
// Toast / Notification Bridge
// ============================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Show a toast notification
 */
export function showToast(
    message: string,
    type: ToastType = 'info',
    title?: string
): void {
    try {
        // @ts-ignore - toastr is a global from SillyTavern
        if (typeof toastr !== 'undefined' && toastr[type]) {
            toastr[type](message, title);
            return;
        }
    } catch (e) {
        // Fall through to console
    }

    // Fallback to console
    console.log(`[Toast ${type}] ${title ? title + ': ' : ''}${message}`);
}

// ============================================================
// Popup Bridge
// ============================================================

export type PopupType = 'text' | 'confirm' | 'input';

/**
 * Show a generic popup
 */
export async function showPopup(
    content: string | HTMLElement,
    type: PopupType = 'text',
    defaultValue?: string
): Promise<string | boolean | null> {
    try {
        // @ts-ignore - callGenericPopup is a global from SillyTavern
        if (typeof callGenericPopup === 'function') {
            return await callGenericPopup(content, type, defaultValue);
        }
    } catch (e) {
        console.error('[stBridge] Failed to show popup:', e);
    }
    return null;
}

/**
 * Show a confirmation dialog
 */
export async function showConfirm(message: string): Promise<boolean> {
    const result = await showPopup(message, 'confirm');
    return result === true;
}

/**
 * Show an input dialog
 */
export async function showInput(message: string, defaultValue?: string): Promise<string | null> {
    const result = await showPopup(message, 'input', defaultValue);
    return typeof result === 'string' ? result : null;
}

// ============================================================
// DOM Helpers
// ============================================================

/**
 * Wait for an element to appear in the DOM
 */
export function waitForElement(
    selector: string,
    timeout: number = 5000
): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
        const existing = document.querySelector<HTMLElement>(selector);
        if (existing) {
            resolve(existing);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector<HTMLElement>(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Timeout
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

// ============================================================
// Utility Exports
// ============================================================

export const stBridge = {
    // Prompt Manager
    getPromptManager,
    getAllPrompts,
    togglePrompt,
    getTokenCounts,

    // Settings
    getExtensionSettings,
    updateExtensionSettings,
    saveSettings,

    // Events
    getEventSource,
    getEventType,
    onEvent,

    // UI
    showToast,
    showPopup,
    showConfirm,
    showInput,

    // DOM
    waitForElement,
};

export default stBridge;
