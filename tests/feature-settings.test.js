import assert from 'node:assert/strict';
import test from 'node:test';
import {
    FEATURE_DEFAULTS,
    PROMPT_UI_MODES,
    SETTINGS_SCHEMA_VERSION,
    applySettingsSchema,
    isFeatureEnabled,
    migratePromptToolsSettings,
} from '../core/feature-settings.js';

const EXPECTED_DEFAULTS = {
    enablePromptManager: true,
    enablePresetNavigator: true,
    enableCharacterNavigator: true,
    enableReasoningCapture: true,
    enableDirectives: true,
    enableDirectiveAutocomplete: true,
    enableNemoEngineInstaller: true,
    enableReasoningSection: true,
    enableLorebookManagement: false,
};

test('schema contains the merged prompt workstation and retained core gates', () => {
    assert.deepEqual(FEATURE_DEFAULTS, EXPECTED_DEFAULTS);
});

test('new namespaces receive Classic+ and prompt workstation defaults', () => {
    const settings = {};
    applySettingsSchema(settings);
    assert.equal(settings._settingsSchemaVersion, SETTINGS_SCHEMA_VERSION);
    assert.equal(settings.promptUiMode, PROMPT_UI_MODES.CLASSIC_PLUS);
    assert.equal(settings.enablePromptManager, true);
    assert.equal(settings.enableDirectives, true);
    assert.equal(settings.dividerRegexPattern, '');
});

test('empty standalone namespaces do not change a fresh installation into Modern mode', () => {
    const settings = {};
    assert.equal(migratePromptToolsSettings(settings, {}), false);
    applySettingsSchema(settings);
    assert.equal(settings.promptUiMode, PROMPT_UI_MODES.CLASSIC_PLUS);
    assert.equal(settings._promptToolsMerged, undefined);
});

test('standalone PromptTools choices migrate once and preserve the modern appearance', () => {
    const settings = { enableDirectives: false };
    const standalone = {
        promptManager: false,
        presetNavigator: true,
        characterNavigator: false,
        reasoningCapture: true,
        promptLibrary: [{ title: 'Migrated' }],
    };
    assert.equal(migratePromptToolsSettings(settings, standalone), true);
    applySettingsSchema(settings);
    assert.equal(settings.enablePromptManager, false);
    assert.equal(settings.enablePresetNavigator, true);
    assert.equal(settings.enableCharacterNavigator, false);
    assert.equal(settings.enableReasoningCapture, true);
    assert.equal(settings.promptUiMode, PROMPT_UI_MODES.MODERN);
    assert.deepEqual(settings.promptLibrary, [{ title: 'Migrated' }]);
    assert.equal(settings.enableDirectives, false);
    assert.equal(migratePromptToolsSettings(settings, { promptManager: true }), false);
});

test('existing NemoPresetExt choices win over standalone values', () => {
    const settings = { enablePromptManager: true, promptUiMode: PROMPT_UI_MODES.CLASSIC };
    migratePromptToolsSettings(settings, { promptManager: false });
    applySettingsSchema(settings);
    assert.equal(settings.enablePromptManager, true);
    assert.equal(settings.promptUiMode, PROMPT_UI_MODES.CLASSIC);
});

test('feature checks require strict boolean true', () => {
    assert.equal(isFeatureEnabled({ feature: true }, 'feature'), true);
    assert.equal(isFeatureEnabled({ feature: 1 }, 'feature'), false);
    assert.equal(isFeatureEnabled({ feature: 'true' }, 'feature'), false);
});

test('schema application is idempotent', () => {
    const settings = {};
    applySettingsSchema(settings);
    const first = structuredClone(settings);
    applySettingsSchema(settings);
    assert.deepEqual(settings, first);
});
