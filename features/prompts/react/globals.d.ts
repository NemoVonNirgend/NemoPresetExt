/**
 * Global type declarations for SillyTavern integration
 */

// SillyTavern's prompt manager (injected at runtime)
declare const promptManager: import('./types/prompts').STPromptManager | undefined;

// SillyTavern's event source
declare const eventSource: {
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    once(event: string, callback: (...args: any[]) => void): void;
} | undefined;

// SillyTavern event types - allows indexed access for dynamic event names
declare const event_types: {
    SETTINGS_UPDATED: string;
    OAI_PRESET_CHANGED_AFTER: string;
    [key: string]: string;
} | undefined;

// Window extensions
interface Window {
    _nemoTogglingPrompt: boolean;
}
