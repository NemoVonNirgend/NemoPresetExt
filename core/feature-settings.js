export const SETTINGS_SCHEMA_VERSION = 3;

export const FEATURE_DEFAULTS = Object.freeze({
    enableDirectives: true,
    enableDirectiveAutocomplete: true,
    enableNemoEngineInstaller: true,
});

export const SETTINGS_DEFAULTS = Object.freeze({
    ...FEATURE_DEFAULTS,
    dividerRegexPattern: '',
});

export function applySettingsSchema(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new TypeError('NemoPresetExt settings must be an object');
    }
    for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
        settings[key] ??= value;
    }
    settings._settingsSchemaVersion = SETTINGS_SCHEMA_VERSION;
    return settings;
}

export function isFeatureEnabled(settings, key) {
    return settings?.[key] === true;
}
