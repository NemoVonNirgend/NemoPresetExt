/**
 * SillyTavern API Type Declarations
 * These types represent the runtime APIs available from SillyTavern
 */

// Event system
export interface STEventSource {
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    once(event: string, callback: (...args: any[]) => void): void;
}

// Event types enumeration
export interface STEventTypes {
    SETTINGS_UPDATED: string;
    OAI_PRESET_CHANGED_AFTER: string;
    CHARACTER_MESSAGE_RENDERED: string;
    USER_MESSAGE_RENDERED: string;
    CHAT_CHANGED: string;
    GENERATION_STARTED: string;
    GENERATION_STOPPED: string;
    GENERATION_ENDED: string;
    // Add more as needed
}

// Extension settings storage
export interface ExtensionSettings {
    [key: string]: any;
    NemoPresetExt?: NemoExtensionSettings;
}

// Nemo extension settings interface
export interface NemoExtensionSettings {
    enablePromptManager?: boolean;
    dropdownStyle?: 'tray' | 'accordion';
    enablePresetNavigator?: boolean;
    enableDirectives?: boolean;
    enableDirectiveAutocomplete?: boolean;
    enableAnimatedBackgrounds?: boolean;
    enableLorebookOverhaul?: boolean;
    enableReasoningSection?: boolean;
    enableLorebookManagement?: boolean;
    enableHTMLTrimming?: boolean;
    htmlTrimmingKeepCount?: number;
    enableTabOverhauls?: boolean;
    nemoEnableWidePanels?: boolean;
    enableMobileEnhancements?: boolean;
    nemoEnablePollinationsInterceptor?: boolean;
    nemoEnableExtensionsTabOverhaul?: boolean;
    dividerRegexPattern?: string;
}

// Save settings function
export type SaveSettingsDebounced = () => void;

// Toast notification system (toastr-like)
export interface STToastr {
    success(message: string, title?: string, options?: ToastrOptions): void;
    error(message: string, title?: string, options?: ToastrOptions): void;
    warning(message: string, title?: string, options?: ToastrOptions): void;
    info(message: string, title?: string, options?: ToastrOptions): void;
}

export interface ToastrOptions {
    timeOut?: number;
    extendedTimeOut?: number;
    closeButton?: boolean;
    progressBar?: boolean;
}

// Generic popup system
export type PopupType = 'text' | 'confirm' | 'input';

export interface CallGenericPopup {
    (
        content: string | HTMLElement,
        type?: PopupType,
        defaultValue?: string,
        options?: PopupOptions
    ): Promise<string | boolean | null>;
}

export interface PopupOptions {
    wide?: boolean;
    large?: boolean;
    okButton?: string;
    cancelButton?: string;
}

// Prompt Manager types (extends what's in prompts.ts)
export interface STPromptManager {
    serviceSettings: {
        prompts: STPrompt[];
    };
    activeCharacter: string;
    getPromptOrderEntry: (character: string, identifier: string) => STPromptOrderEntry | null;
    isPromptDisabledForActiveCharacter: (identifier: string) => boolean;
    saveServiceSettings: () => Promise<void>;
    tokenHandler?: {
        getCounts: () => Record<string, number | null>;
    };
}

export interface STPrompt {
    identifier: string;
    name: string;
    content: string;
    role?: string;
    system_prompt?: boolean;
}

export interface STPromptOrderEntry {
    enabled: boolean;
}

// Global window extensions
declare global {
    interface Window {
        _nemoTogglingPrompt?: boolean;
        NemoPresetManager?: any;
        PollinationsInterceptor?: any;
        ExtensionsTabOverhaul?: any;
    }

    // These are injected at runtime by SillyTavern
    const eventSource: STEventSource | undefined;
    const event_types: STEventTypes | undefined;
    const extension_settings: ExtensionSettings;
    const promptManager: STPromptManager | undefined;
    const saveSettingsDebounced: SaveSettingsDebounced;
    const toastr: STToastr | undefined;
    const callGenericPopup: CallGenericPopup | undefined;
}

export {};
