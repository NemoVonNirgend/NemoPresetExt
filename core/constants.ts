/**
 * NemoPresetExt - Application Constants
 * Centralized constants to eliminate magic numbers and strings
 */

export interface TimeoutConstants {
    readonly STATUS_MESSAGE: number;
    readonly DEBOUNCE_DELAY: number;
    readonly ANIMATION_DURATION: number;
    readonly NOTIFICATION_DISPLAY: number;
    readonly OBSERVER_INIT_DELAY: number;
    readonly UI_REFRESH_DELAY: number;
    readonly DOM_SETTLE_DELAY: number;
    readonly UI_UPDATE_DELAY: number;
    readonly PRESET_LOAD_WAIT: number;
    readonly TOGGLE_BATCH_DELAY: number;
    readonly FILE_INPUT_CLEANUP: number;
    readonly NETWORK_REQUEST: number;
    readonly PRESET_LOAD_MAX_WAIT: number;
    readonly PRESET_LOAD_POLL_INTERVAL: number;
    readonly TOAST_DURATION: number;
    readonly TOAST_FADE_OUT: number;
}

export interface SelectorConstants {
    readonly PROMPT_CONTAINER: string;
    readonly PROMPT_EDITOR_POPUP: string;
    readonly LEFT_NAV_PANEL: string;
    readonly EXTENSIONS_SETTINGS: string;
    readonly WORLD_INFO: string;
    readonly WORLD_INFO_SELECT: string;
    readonly WI_ACTIVATION_SETTINGS: string;
    readonly WORLD_EDITOR_SELECT: string;
    readonly WORLD_ENTRIES_LIST: string;
    readonly NEMO_TOGGLE_BUTTON: string;
    readonly NEMO_CONTAINER: string;
    readonly NEMO_LEFT_COLUMN: string;
    readonly NEMO_RIGHT_COLUMN: string;
}

export interface ClassConstants {
    readonly HIDDEN_PANEL: string;
    readonly MOBILE_PANEL_VISIBLE: string;
    readonly ACTIVE_TAB: string;
    readonly SELECTED_ITEM: string;
    readonly NEMO_INITIALIZED: string;
    readonly INLINE_DRAWER_OPEN: string;
}

export interface StorageKeyConstants {
    readonly FOLDER_STATE: string;
    readonly PRESETS: string;
    readonly LEFT_PANEL_STATE: string;
    readonly EXTENSION_SETTINGS: string;
}

export interface UIConstants {
    readonly LEFT_COLUMN_WIDTH: number;
    readonly MOBILE_BREAKPOINT: number;
    readonly SMALL_MOBILE_BREAKPOINT: number;
    readonly MIN_DRAWER_HEIGHT: number;
    readonly MAX_TOOLTIP_LENGTH: number;
    readonly GRID_ITEM_MIN_WIDTH: number;
    readonly PAGINATION_DEFAULT_SIZE: number;
}

export interface FileConstants {
    readonly SUPPORTED_IMAGES: readonly string[];
    readonly SUPPORTED_ARCHIVES: readonly string[];
    readonly MAX_FILE_SIZE: number;
    readonly EXPORT_FILENAME_PREFIX: string;
}

export interface ValidationConstants {
    readonly MAX_NAME_LENGTH: number;
    readonly MIN_NAME_LENGTH: number;
    readonly MAX_DESCRIPTION_LENGTH: number;
    readonly MAX_TAGS: number;
    readonly MAX_TAG_LENGTH: number;
}

export interface NetworkConstants {
    readonly REQUEST_TIMEOUT: number;
    readonly RETRY_ATTEMPTS: number;
    readonly RETRY_DELAY: number;
}

export interface LogLevelConstants {
    readonly DEBUG: number;
    readonly INFO: number;
    readonly WARN: number;
    readonly ERROR: number;
}

export interface FeatureFlags {
    readonly ENABLE_DEBUG_MODE: boolean;
    readonly ENABLE_PERFORMANCE_MONITORING: boolean;
    readonly ENABLE_ADVANCED_LOGGING: boolean;
    readonly ENABLE_EXPERIMENTAL_UI: boolean;
}

export interface RegexPatterns {
    readonly UUID: RegExp;
    readonly SAFE_FILENAME: RegExp;
    readonly WHITESPACE_CLEANUP: RegExp;
}

export interface EventConstants {
    readonly FAVORITES_UPDATED: string;
    readonly PRESET_CHANGED: string;
    readonly UI_REFRESHED: string;
}

export interface NemoConstants {
    readonly TIMEOUTS: TimeoutConstants;
    readonly SELECTORS: SelectorConstants;
    readonly CLASSES: ClassConstants;
    readonly STORAGE_KEYS: StorageKeyConstants;
    readonly UI: UIConstants;
    readonly FILE: FileConstants;
    readonly VALIDATION: ValidationConstants;
    readonly NETWORK: NetworkConstants;
    readonly LOG_LEVELS: LogLevelConstants;
    readonly FEATURES: FeatureFlags;
    readonly VERSION: string;
    readonly MIN_SILLYTAVERN_VERSION: string;
    readonly REGEX: RegexPatterns;
    readonly EVENTS: EventConstants;
}

export const CONSTANTS: NemoConstants = {
    // Timing constants
    TIMEOUTS: {
        STATUS_MESSAGE: 4000,
        DEBOUNCE_DELAY: 300,
        ANIMATION_DURATION: 200,
        NOTIFICATION_DISPLAY: 5000,
        OBSERVER_INIT_DELAY: 500,
        UI_REFRESH_DELAY: 500,
        DOM_SETTLE_DELAY: 50,
        UI_UPDATE_DELAY: 100,
        PRESET_LOAD_WAIT: 200,
        TOGGLE_BATCH_DELAY: 50,
        FILE_INPUT_CLEANUP: 60000,
        NETWORK_REQUEST: 10000,
        PRESET_LOAD_MAX_WAIT: 2000,
        PRESET_LOAD_POLL_INTERVAL: 50,
        TOAST_DURATION: 4000,
        TOAST_FADE_OUT: 300,
    },

    // DOM Selectors
    SELECTORS: {
        PROMPT_CONTAINER: '#completion_prompt_manager_list',
        PROMPT_EDITOR_POPUP: '.completion_prompt_manager_popup_entry',
        LEFT_NAV_PANEL: '#left-nav-panel',
        EXTENSIONS_SETTINGS: '#extensions_settings',
        WORLD_INFO: '#WorldInfo',
        WORLD_INFO_SELECT: '#world_info',
        WI_ACTIVATION_SETTINGS: '#wiActivationSettings',
        WORLD_EDITOR_SELECT: '#world_editor_select',
        WORLD_ENTRIES_LIST: '#world_popup_entries_list',
        NEMO_TOGGLE_BUTTON: '#nemo-world-info-toggle-left-panel',
        NEMO_CONTAINER: '.nemo-world-info-container',
        NEMO_LEFT_COLUMN: '.nemo-world-info-left-column',
        NEMO_RIGHT_COLUMN: '.nemo-world-info-right-column',
    },

    // CSS Classes
    CLASSES: {
        HIDDEN_PANEL: 'left-panel-hidden',
        MOBILE_PANEL_VISIBLE: 'mobile-left-panel-visible',
        ACTIVE_TAB: 'active',
        SELECTED_ITEM: 'selected',
        NEMO_INITIALIZED: 'nemo-initialized',
        INLINE_DRAWER_OPEN: 'open',
    },

    // Storage keys
    STORAGE_KEYS: {
        FOLDER_STATE: 'nemo-wi-folder-state',
        PRESETS: 'nemo-wi-presets',
        LEFT_PANEL_STATE: 'nemo-wi-left-panel-state',
        EXTENSION_SETTINGS: 'NemoPresetExt',
    },

    // UI Configuration
    UI: {
        LEFT_COLUMN_WIDTH: 300,
        MOBILE_BREAKPOINT: 768,
        SMALL_MOBILE_BREAKPOINT: 480,
        MIN_DRAWER_HEIGHT: 200,
        MAX_TOOLTIP_LENGTH: 100,
        GRID_ITEM_MIN_WIDTH: 250,
        PAGINATION_DEFAULT_SIZE: 60,
    },

    // File patterns and extensions
    FILE: {
        SUPPORTED_IMAGES: ['.png', '.jpg', '.jpeg', '.gif', '.webp'] as const,
        SUPPORTED_ARCHIVES: ['.json'] as const,
        MAX_FILE_SIZE: 10 * 1024 * 1024,
        EXPORT_FILENAME_PREFIX: 'nemo_export_',
    },

    // Validation limits
    VALIDATION: {
        MAX_NAME_LENGTH: 100,
        MIN_NAME_LENGTH: 1,
        MAX_DESCRIPTION_LENGTH: 500,
        MAX_TAGS: 20,
        MAX_TAG_LENGTH: 30,
    },

    // API and networking
    NETWORK: {
        REQUEST_TIMEOUT: 10000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
    },

    // Logging levels
    LOG_LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
    },

    // Feature flags
    FEATURES: {
        ENABLE_DEBUG_MODE: false,
        ENABLE_PERFORMANCE_MONITORING: false,
        ENABLE_ADVANCED_LOGGING: false,
        ENABLE_EXPERIMENTAL_UI: false,
    },

    // Version and compatibility
    VERSION: '3.4.0',
    MIN_SILLYTAVERN_VERSION: '1.12.0',

    // Regular expressions
    REGEX: {
        UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        SAFE_FILENAME: /^[a-zA-Z0-9._-]+$/,
        WHITESPACE_CLEANUP: /\s+/g,
    },

    // Custom Nemo events
    EVENTS: {
        FAVORITES_UPDATED: 'nemo_favorites_updated',
        PRESET_CHANGED: 'nemo_preset_changed',
        UI_REFRESHED: 'nemo_ui_refreshed',
    },
} as const;

export default CONSTANTS;
