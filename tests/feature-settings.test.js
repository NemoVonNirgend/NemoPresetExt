import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURE_DEFAULTS, SETTINGS_SCHEMA_VERSION, applySettingsSchema, isFeatureEnabled } from '../core/feature-settings.js';

const CORE_DEFAULTS = {
    enableDirectives: true,
    enableDirectiveAutocomplete: true,
    enableNemoEngineInstaller: true,
};

test('schema contains only core feature gates', () => {
    assert.deepEqual(FEATURE_DEFAULTS, CORE_DEFAULTS);
});

test('new and legacy namespaces receive missing core defaults without losing migration data', () => {
    const settings = { enableDirectives: false, enablePromptManager: false };
    applySettingsSchema(settings);
    assert.equal(settings._settingsSchemaVersion, SETTINGS_SCHEMA_VERSION);
    assert.equal(settings.enableDirectives, false);
    assert.equal(settings.enableDirectiveAutocomplete, true);
    assert.equal(settings.enableNemoEngineInstaller, true);
    assert.equal(settings.enablePromptManager, false);
    assert.equal(settings.dividerRegexPattern, '');
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
