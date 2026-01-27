// Auto-generated from TypeScript - do not edit directly
const CONSTANTS = {
  // Timing constants
  TIMEOUTS: {
    STATUS_MESSAGE: 4e3,
    DEBOUNCE_DELAY: 300,
    ANIMATION_DURATION: 200,
    NOTIFICATION_DISPLAY: 5e3,
    OBSERVER_INIT_DELAY: 500,
    UI_REFRESH_DELAY: 500,
    DOM_SETTLE_DELAY: 50,
    UI_UPDATE_DELAY: 100,
    PRESET_LOAD_WAIT: 200,
    TOGGLE_BATCH_DELAY: 50,
    FILE_INPUT_CLEANUP: 6e4,
    NETWORK_REQUEST: 1e4,
    PRESET_LOAD_MAX_WAIT: 2e3,
    PRESET_LOAD_POLL_INTERVAL: 50,
    TOAST_DURATION: 4e3,
    TOAST_FADE_OUT: 300
  },
  // DOM Selectors
  SELECTORS: {
    PROMPT_CONTAINER: "#completion_prompt_manager_list",
    PROMPT_EDITOR_POPUP: ".completion_prompt_manager_popup_entry",
    LEFT_NAV_PANEL: "#left-nav-panel",
    EXTENSIONS_SETTINGS: "#extensions_settings",
    WORLD_INFO: "#WorldInfo",
    WORLD_INFO_SELECT: "#world_info",
    WI_ACTIVATION_SETTINGS: "#wiActivationSettings",
    WORLD_EDITOR_SELECT: "#world_editor_select",
    WORLD_ENTRIES_LIST: "#world_popup_entries_list",
    NEMO_TOGGLE_BUTTON: "#nemo-world-info-toggle-left-panel",
    NEMO_CONTAINER: ".nemo-world-info-container",
    NEMO_LEFT_COLUMN: ".nemo-world-info-left-column",
    NEMO_RIGHT_COLUMN: ".nemo-world-info-right-column"
  },
  // CSS Classes
  CLASSES: {
    HIDDEN_PANEL: "left-panel-hidden",
    MOBILE_PANEL_VISIBLE: "mobile-left-panel-visible",
    ACTIVE_TAB: "active",
    SELECTED_ITEM: "selected",
    NEMO_INITIALIZED: "nemo-initialized",
    INLINE_DRAWER_OPEN: "open"
  },
  // Storage keys
  STORAGE_KEYS: {
    FOLDER_STATE: "nemo-wi-folder-state",
    PRESETS: "nemo-wi-presets",
    LEFT_PANEL_STATE: "nemo-wi-left-panel-state",
    EXTENSION_SETTINGS: "NemoPresetExt"
  },
  // UI Configuration
  UI: {
    LEFT_COLUMN_WIDTH: 300,
    MOBILE_BREAKPOINT: 768,
    SMALL_MOBILE_BREAKPOINT: 480,
    MIN_DRAWER_HEIGHT: 200,
    MAX_TOOLTIP_LENGTH: 100,
    GRID_ITEM_MIN_WIDTH: 250,
    PAGINATION_DEFAULT_SIZE: 60
  },
  // File patterns and extensions
  FILE: {
    SUPPORTED_IMAGES: [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    SUPPORTED_ARCHIVES: [".json"],
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    EXPORT_FILENAME_PREFIX: "nemo_export_"
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
    REQUEST_TIMEOUT: 1e4,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1e3
  },
  // Logging levels
  LOG_LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  },
  // Feature flags
  FEATURES: {
    ENABLE_DEBUG_MODE: false,
    ENABLE_PERFORMANCE_MONITORING: false,
    ENABLE_ADVANCED_LOGGING: false,
    ENABLE_EXPERIMENTAL_UI: false
  },
  // Version and compatibility
  VERSION: "3.4.0",
  MIN_SILLYTAVERN_VERSION: "1.12.0",
  // Regular expressions
  REGEX: {
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    SAFE_FILENAME: /^[a-zA-Z0-9._-]+$/,
    WHITESPACE_CLEANUP: /\s+/g
  },
  // Custom Nemo events
  EVENTS: {
    FAVORITES_UPDATED: "nemo_favorites_updated",
    PRESET_CHANGED: "nemo_preset_changed",
    UI_REFRESHED: "nemo_ui_refreshed"
  }
};
var constants_default = CONSTANTS;
export {
  CONSTANTS,
  constants_default as default
};
