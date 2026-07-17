export const SETTINGS_SCHEMA_VERSION = 2;

export const DEFAULT_POLLINATIONS_PROMPT_BEST_PRACTICES = [
    'clear focal subject',
    'coherent composition',
    'consistent character design across panels',
    'accurate anatomy and hands',
    'expressive faces',
    'clean readable silhouettes',
    'consistent lighting and perspective',
    'background matches the scene',
    'polished finished illustration',
].join(', ');

export const DEFAULT_POLLINATIONS_NEGATIVE_BEST_PRACTICES = [
    'inconsistent character design',
    'off-model character',
    'bad anatomy',
    'bad hands',
    'extra fingers',
    'missing fingers',
    'warped face',
    'confusing composition',
    'unreadable panel',
    'unwanted text',
    'garbled lettering',
    'watermark',
    'logo',
    'signature',
].join(', ');

export const FEATURE_DEFAULTS = Object.freeze({
    enablePromptManager: true,
    enablePresetNavigator: true,
    enableCharacterNavigator: true,
    enableReasoningCapture: true,
    enableDirectives: true,
    enableDirectiveAutocomplete: true,
    enableAnimatedBackgrounds: false,
    enableTabOverhauls: false,
    enableConnectionPanelOverhaul: false,
    nemoEnableExtensionsTabOverhaul: false,
    enableLorebookOverhaul: false,
    enableReasoningSection: false,
    enableLorebookManagement: false,
    enableHTMLTrimming: false,
    nemoEnableWidePanels: false,
    enableMobileEnhancements: false,
    enableModelSelector: false,
    nemoEnablePollinationsInterceptor: false,
    nemoPollinationsPromptBestPractices: false,
    enableEmojiPicker: false,
    enableMarketplace: false,
    enablePersonaEnhancements: false,
    enableNemoLore: false,
    enableRewrite: false,
    enableTutorials: false,
    enableNemoEngineInstaller: false,
    enableItalicDialogueRenderer: false,
    enableApiRouter: false,
});

const LEGACY_FEATURE_DEFAULTS = Object.freeze({
    ...FEATURE_DEFAULTS,
    enableDirectives: true,
    enableDirectiveAutocomplete: true,
    enableAnimatedBackgrounds: true,
    enableTabOverhauls: true,
    enableConnectionPanelOverhaul: true,
    nemoEnableExtensionsTabOverhaul: true,
    enableLorebookOverhaul: true,
    enableReasoningSection: true,
    enableLorebookManagement: true,
    enableMobileEnhancements: true,
    enableModelSelector: true,
    nemoPollinationsPromptBestPractices: true,
    enableEmojiPicker: true,
    enableMarketplace: true,
    enablePersonaEnhancements: true,
    enableNemoLore: true,
    enableRewrite: true,
    enableTutorials: true,
    enableNemoEngineInstaller: true,
    enableItalicDialogueRenderer: true,
    enableApiRouter: true,
});

const NON_FEATURE_DEFAULTS = Object.freeze({
    dropdownStyle: 'tray',
    dropdownTheme: 'st',
    htmlTrimmingKeepCount: 0,
    dividerRegexPattern: '',
    uiTheme: 'none',
    messageTheme: 'default',
    nemoPollinationsStylePreset: 'none',
    nemoPollinationsBestPracticesPrompt: DEFAULT_POLLINATIONS_PROMPT_BEST_PRACTICES,
    nemoPollinationsNegativeBestPracticesPrompt: DEFAULT_POLLINATIONS_NEGATIVE_BEST_PRACTICES,
});

export const SETTINGS_DEFAULTS = Object.freeze({
    ...FEATURE_DEFAULTS,
    ...NON_FEATURE_DEFAULTS,
});

const LEGACY_SETTINGS_DEFAULTS = Object.freeze({
    ...LEGACY_FEATURE_DEFAULTS,
    ...NON_FEATURE_DEFAULTS,
});

/**
 * Apply the canonical schema without overwriting any explicit user choice.
 * Empty namespaces are new installs; populated pre-schema namespaces retain
 * the behavior that was historically implicit.
 *
 * @param {Record<string, unknown>} settings
 * @returns {Record<string, unknown>}
 */
export function applySettingsSchema(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new TypeError('NemoPresetExt settings must be an object');
    }

    const isLegacyNamespace = settings._settingsSchemaVersion === undefined
        && Object.keys(settings).length > 0;
    const defaults = isLegacyNamespace ? LEGACY_SETTINGS_DEFAULTS : SETTINGS_DEFAULTS;

    for (const [key, value] of Object.entries(defaults)) {
        if (settings[key] === undefined) {
            settings[key] = value;
        }
    }

    settings._settingsSchemaVersion = SETTINGS_SCHEMA_VERSION;
    return settings;
}

/**
 * Feature gates are intentionally strict so truthy legacy strings/numbers do
 * not silently activate UI-changing behavior.
 *
 * @param {Record<string, unknown> | undefined} settings
 * @param {keyof typeof FEATURE_DEFAULTS | string} key
 * @returns {boolean}
 */
export function isFeatureEnabled(settings, key) {
    return settings?.[key] === true;
}
