/**
 * NemoPresetExt - Application Constants
 * Centralized constants to eliminate magic numbers and strings
 */

export const CONSTANTS = {
    // Timing constants
    TIMEOUTS: {
        STATUS_MESSAGE: 4000,           // Status message display duration
        DEBOUNCE_DELAY: 300,           // Default debounce delay
        ANIMATION_DURATION: 200,       // CSS animation duration
        NOTIFICATION_DISPLAY: 5000,    // Notification display time
        OBSERVER_INIT_DELAY: 500,      // MutationObserver initialization delay
        UI_REFRESH_DELAY: 500          // UI refresh delay after changes
    },

    // DOM Selectors - centralized to avoid duplication
    SELECTORS: {
        // Main containers
        PROMPT_CONTAINER: '#completion_prompt_manager_list',
        PROMPT_EDITOR_POPUP: '.completion_prompt_manager_popup_entry',
        LEFT_NAV_PANEL: '#left-nav-panel',
        EXTENSIONS_SETTINGS: '#extensions_settings',
        WORLD_INFO: '#WorldInfo',
        
        // World Info specific
        WORLD_INFO_SELECT: '#world_info',
        WI_ACTIVATION_SETTINGS: '#wiActivationSettings',
        WORLD_EDITOR_SELECT: '#world_editor_select',
        WORLD_ENTRIES_LIST: '#world_popup_entries_list',
        
        // Extension specific
        NEMO_TOGGLE_BUTTON: '#nemo-world-info-toggle-left-panel',
        NEMO_CONTAINER: '.nemo-world-info-container',
        NEMO_LEFT_COLUMN: '.nemo-world-info-left-column',
        NEMO_RIGHT_COLUMN: '.nemo-world-info-right-column'
    },

    // CSS Classes
    CLASSES: {
        HIDDEN_PANEL: 'left-panel-hidden',
        MOBILE_PANEL_VISIBLE: 'mobile-left-panel-visible',
        ACTIVE_TAB: 'active',
        SELECTED_ITEM: 'selected',
        NEMO_INITIALIZED: 'nemo-initialized',
        INLINE_DRAWER_OPEN: 'open'
    },

    // Storage keys
    STORAGE_KEYS: {
        FOLDER_STATE: 'nemo-wi-folder-state',
        PRESETS: 'nemo-wi-presets',
        LEFT_PANEL_STATE: 'nemo-wi-left-panel-state',
        EXTENSION_SETTINGS: 'NemoPresetExt'
    },

    // UI Configuration
    UI: {
        LEFT_COLUMN_WIDTH: 300,        // Left column width in pixels
        MOBILE_BREAKPOINT: 768,        // Mobile breakpoint
        SMALL_MOBILE_BREAKPOINT: 480,  // Small mobile breakpoint
        MIN_DRAWER_HEIGHT: 200,        // Minimum drawer height
        MAX_TOOLTIP_LENGTH: 100,       // Maximum tooltip text length
        GRID_ITEM_MIN_WIDTH: 250,      // Minimum grid item width
        PAGINATION_DEFAULT_SIZE: 60     // Default pagination size
    },

    // File patterns and extensions
    FILE: {
        SUPPORTED_IMAGES: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
        SUPPORTED_ARCHIVES: ['.json'],
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB max file size
        EXPORT_FILENAME_PREFIX: 'nemo_export_'
    },

    // Validation limits
    VALIDATION: {
        MAX_NAME_LENGTH: 100,
        MIN_NAME_LENGTH: 1,
        MAX_DESCRIPTION_LENGTH: 500,
        MAX_TAGS: 20,
        MAX_TAG_LENGTH: 30
    },

    // API and networking
    NETWORK: {
        REQUEST_TIMEOUT: 10000,        // 10 second timeout
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    },

    // Logging levels
    LOG_LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },

    // Feature flags - can be used to toggle features during development
    FEATURES: {
        ENABLE_DEBUG_MODE: false,
        ENABLE_PERFORMANCE_MONITORING: false,
        ENABLE_ADVANCED_LOGGING: false,
        ENABLE_EXPERIMENTAL_UI: false
    },

    // Version and compatibility
    VERSION: '3.4.0',
    MIN_SILLYTAVERN_VERSION: '1.12.0',
    
    // Regular expressions
    REGEX: {
        UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        SAFE_FILENAME: /^[a-zA-Z0-9._-]+$/,
        WHITESPACE_CLEANUP: /\s+/g
    }
};

// Freeze the constants to prevent accidental modification
Object.freeze(CONSTANTS);
Object.freeze(CONSTANTS.TIMEOUTS);
Object.freeze(CONSTANTS.SELECTORS);
Object.freeze(CONSTANTS.CLASSES);
Object.freeze(CONSTANTS.STORAGE_KEYS);
Object.freeze(CONSTANTS.UI);
Object.freeze(CONSTANTS.FILE);
Object.freeze(CONSTANTS.VALIDATION);
Object.freeze(CONSTANTS.NETWORK);
Object.freeze(CONSTANTS.LOG_LEVELS);
Object.freeze(CONSTANTS.FEATURES);
Object.freeze(CONSTANTS.REGEX);

export default CONSTANTS;