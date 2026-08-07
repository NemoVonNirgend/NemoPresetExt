export const SETTINGS_SCHEMA_VERSION = 4;

export const PROMPT_UI_MODES = Object.freeze({
    CLASSIC: 'classic',
    MODERN: 'modern',
    CLASSIC_PLUS: 'classicPlus',
});

export const FEATURE_DEFAULTS = Object.freeze({
    enablePromptManager: true,
    enablePresetNavigator: true,
    enableCharacterNavigator: true,
    enableReasoningCapture: true,
    enableDirectives: true,
    enableDirectiveAutocomplete: true,
    enableNemoEngineInstaller: true,
    enableReasoningSection: true,
    enableLorebookManagement: false,
});

const NON_FEATURE_DEFAULTS = Object.freeze({
    dividerRegexPattern: '',
    promptUiMode: PROMPT_UI_MODES.CLASSIC,
    dropdownStyle: 'tray',
    dropdownTheme: 'st',
});

export const SETTINGS_DEFAULTS = Object.freeze({
    ...FEATURE_DEFAULTS,
    ...NON_FEATURE_DEFAULTS,
});

const PROMPT_TOOLS_FEATURE_MAP = Object.freeze({
    promptManager: 'enablePromptManager',
    presetNavigator: 'enablePresetNavigator',
    characterNavigator: 'enableCharacterNavigator',
    reasoningCapture: 'enableReasoningCapture',
});

export const PROMPT_TOOLS_DATA_KEYS = Object.freeze([
    'promptArchives',
    'promptSnapshots',
    'promptLibrary',
    'navigatorMetadata',
    'sectionsEnabled',
    'favoritePresets',
    'favoriteCharacters',
    'promptStates',
    'openSectionStates',
    'compactTraySections',
    'dropdownStyle',
    'dropdownTheme',
]);

export function normalizePromptUiMode(value) {
    return Object.values(PROMPT_UI_MODES).includes(value)
        ? value
        : PROMPT_UI_MODES.CLASSIC;
}

/**
 * Copy the standalone NemoPromptTools namespace into NemoPresetExt once.
 * The source namespace is preserved so downgrades remain reversible.
 * Existing NemoPresetExt choices always win over migrated values.
 */
export function migratePromptToolsSettings(settings, promptToolsSettings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new TypeError('NemoPresetExt settings must be an object');
    }
    if (!promptToolsSettings || typeof promptToolsSettings !== 'object' || Array.isArray(promptToolsSettings)) {
        return false;
    }
    if (settings._promptToolsMerged === true) return false;

    const knownKeys = [
        ...Object.keys(PROMPT_TOOLS_FEATURE_MAP),
        ...PROMPT_TOOLS_DATA_KEYS,
        '_settingsSchemaVersion',
    ];
    const hasStandaloneState = knownKeys.some(key => promptToolsSettings[key] !== undefined);
    if (!hasStandaloneState) return false;

    for (const [legacyKey, coreKey] of Object.entries(PROMPT_TOOLS_FEATURE_MAP)) {
        if (settings[coreKey] === undefined && typeof promptToolsSettings[legacyKey] === 'boolean') {
            settings[coreKey] = promptToolsSettings[legacyKey];
        }
    }

    for (const key of PROMPT_TOOLS_DATA_KEYS) {
        if (settings[key] === undefined && promptToolsSettings[key] !== undefined) {
            settings[key] = structuredCloneSafe(promptToolsSettings[key]);
        }
    }

    // Standalone PromptTools users retain the appearance they had before the merge.
    if (settings.promptUiMode === undefined) {
        settings.promptUiMode = PROMPT_UI_MODES.MODERN;
    }

    settings._promptToolsMerged = true;
    settings._promptToolsMergedAt = new Date().toISOString();
    return true;
}

function structuredCloneSafe(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch {
            // Fall through to JSON-safe cloning.
        }
    }
    if (value === undefined || value === null || typeof value !== 'object') return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

export function applySettingsSchema(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new TypeError('NemoPresetExt settings must be an object');
    }

    for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
        settings[key] ??= value;
    }
    settings.promptUiMode = normalizePromptUiMode(settings.promptUiMode);
    settings._settingsSchemaVersion = SETTINGS_SCHEMA_VERSION;
    return settings;
}

export function isFeatureEnabled(settings, key) {
    return settings?.[key] === true;
}
