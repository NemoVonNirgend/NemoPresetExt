import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    FEATURE_DEFAULTS,
    SETTINGS_SCHEMA_VERSION,
    applySettingsSchema,
    isFeatureEnabled,
} from '../core/feature-settings.js';

const DEFAULT_ENABLED_FEATURES = [
    'enableCharacterNavigator',
    'enableDirectiveAutocomplete',
    'enableDirectives',
    'enablePresetNavigator',
    'enablePromptManager',
    'enableReasoningCapture',
];
const FEATURE_CONTROL_IDS = {
    enablePromptManager: 'nemoEnablePromptManager',
    enablePresetNavigator: 'nemoEnablePresetNavigator',
    enableCharacterNavigator: 'nemoEnableCharacterNavigator',
    enableReasoningCapture: 'nemoEnableReasoningCapture',
    enableDirectives: 'nemoEnableDirectives',
    enableDirectiveAutocomplete: 'nemoEnableDirectiveAutocomplete',
    enableAnimatedBackgrounds: 'nemoEnableAnimatedBackgrounds',
    enableTabOverhauls: 'nemoEnableTabOverhauls',
    enableConnectionPanelOverhaul: 'nemoEnableConnectionPanelOverhaul',
    nemoEnableExtensionsTabOverhaul: 'nemoEnableExtensionsTabOverhaul',
    enableLorebookOverhaul: 'nemoEnableLorebookOverhaul',
    enableReasoningSection: 'nemoEnableReasoningSection',
    enableLorebookManagement: 'nemoEnableLorebookManagement',
    enableHTMLTrimming: 'nemoEnableHTMLTrimming',
    nemoEnableWidePanels: 'nemoEnableWidePanels',
    enableMobileEnhancements: 'nemoEnableMobileEnhancements',
    enableModelSelector: 'nemoEnableModelSelector',
    nemoEnablePollinationsInterceptor: 'nemoEnablePollinationsInterceptor',
    nemoPollinationsPromptBestPractices: 'nemoPollinationsPromptBestPractices',
    enableEmojiPicker: 'nemoEnableEmojiPicker',
    enableMarketplace: 'nemoEnableMarketplace',
    enablePersonaEnhancements: 'nemoEnablePersonaEnhancements',
    enableNemoLore: 'nemoEnableNemoLore',
    enableRewrite: 'nemoEnableRewrite',
    enableTutorials: 'nemoEnableTutorials',
    enableNemoEngineInstaller: 'nemoEnableNemoEngineInstaller',
    enableItalicDialogueRenderer: 'nemoEnableItalicDialogueRenderer',
    enableApiRouter: 'nemoEnableApiRouter',
};

const SETTINGS_TEMPLATE = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
const FEATURES_DOC = readFileSync(new URL('../FEATURES.md', import.meta.url), 'utf8');
const CONTENT_SOURCE = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const PROMPT_MANAGER_SOURCE = readFileSync(new URL('../features/prompts/prompt-manager.js', import.meta.url), 'utf8');


test('new users only receive the approved enabled feature allowlist', () => {
    const enabledFeatures = Object.entries(FEATURE_DEFAULTS)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
        .sort();

    assert.deepEqual(enabledFeatures, DEFAULT_ENABLED_FEATURES);
});

test.skip('the default-on prompt dropdown bundle includes its search and related tools', () => {
    assert.equal(FEATURE_DEFAULTS.enablePromptManager, true);

    for (const elementId of [
        'nemoPresetSearchInput',
        'nemoPresetSearchClear',
        'nemoToggleSectionsBtn',
        'nemoViewModeBtn',
        'nemoPromptNavigatorBtn',
        'nemoArchiveNavigatorBtn',
        'nemoTakeSnapshotBtn',
        'nemoApplySnapshotBtn',
    ]) {
        assert.match(PROMPT_MANAGER_SOURCE, new RegExp(`id=["']${elementId}["']`));
    }

    assert.match(
        PROMPT_MANAGER_SOURCE,
        /initialize:\s*function\(container\)[\s\S]*?this\.createSearchAndStatusUI\(container\);[\s\S]*?this\.setupEventListeners\(\);/,
    );
    assert.match(
        CONTENT_SOURCE,
        /if \(featureEnabled\('enablePromptManager'\)\) \{\s*initCategoryTray\(\);\s*\}/,
    );
    assert.match(
        CONTENT_SOURCE,
        /if \(promptManagerEnabled\) \{[\s\S]*?NemoPresetManager\.initialize\(promptList\);[\s\S]*?\n\s*\}/,
    );
});

test('feature documentation matches the new-install schema defaults', () => {
    for (const [key, enabled] of Object.entries(FEATURE_DEFAULTS)) {
        const row = `| \`${key}\` | bool | \`${enabled}\` |`;
        assert.ok(FEATURES_DOC.includes(row), `Missing or stale FEATURES.md row for ${key}`);
    }
});



test('an empty namespace receives opt-in defaults', () => {
    const settings = {};

    applySettingsSchema(settings);

    assert.equal(settings._settingsSchemaVersion, SETTINGS_SCHEMA_VERSION);
    assert.equal(settings.enablePromptManager, true);

    assert.equal(settings.enablePresetNavigator, true);
    assert.equal(settings.enableCharacterNavigator, true);
    assert.equal(settings.enableDirectives, true);
    assert.equal(settings.enableDirectiveAutocomplete, true);
    assert.equal(settings.enableReasoningCapture, true);
    assert.equal(settings.enableConnectionPanelOverhaul, false);
    assert.equal(settings.enableTabOverhauls, false);
    assert.equal(settings.nemoEnableExtensionsTabOverhaul, false);
    assert.equal(settings.enableMarketplace, false);
    assert.equal(settings.enablePersonaEnhancements, false);
    assert.equal(settings.enableRewrite, false);
    assert.equal(settings.enableNemoLore, false);
    assert.equal(settings.enableTutorials, false);
    assert.equal(settings.enableNemoEngineInstaller, false);
    assert.equal(settings.enableItalicDialogueRenderer, false);
    assert.equal(settings.uiTheme, 'none');
    assert.equal(settings.messageTheme, 'default');
});

test.skip('every feature flag has a settings control', () => {
    assert.deepEqual(Object.keys(FEATURE_CONTROL_IDS).sort(), Object.keys(FEATURE_DEFAULTS).sort());

    for (const [settingKey, elementId] of Object.entries(FEATURE_CONTROL_IDS)) {
        assert.match(
            SETTINGS_TEMPLATE,
            new RegExp(`id=["']${elementId}["']`),
            `Missing settings control for ${settingKey}`,
        );
    }
});

test('the template does not override schema defaults with checked markup', () => {
    const checkboxTags = SETTINGS_TEMPLATE.match(/<input\b[^>]*type=["']checkbox["'][^>]*>/gi) || [];
    assert.equal(checkboxTags.some((tag) => /\schecked(?:\s|=|>)/i.test(tag)), false);
});

test('legacy namespaces retain historical implicit behavior', () => {
    const settings = { promptSnapshots: {} };

    applySettingsSchema(settings);

    assert.equal(settings.enableConnectionPanelOverhaul, true);
    assert.equal(settings.enableTabOverhauls, true);
    assert.equal(settings.nemoEnableExtensionsTabOverhaul, true);
    assert.equal(settings.enableMarketplace, true);
    assert.equal(settings.enablePersonaEnhancements, true);
    assert.equal(settings.enableRewrite, true);
    assert.equal(settings.enableTutorials, true);
});

test('explicit legacy choices are never overwritten', () => {
    const settings = {
        promptSnapshots: {},
        enableConnectionPanelOverhaul: false,
        enableMarketplace: false,
        enablePromptManager: false,
    };

    applySettingsSchema(settings);

    assert.equal(settings.enableConnectionPanelOverhaul, false);
    assert.equal(settings.enableMarketplace, false);
    assert.equal(settings.enablePromptManager, false);
});

test('current-schema namespaces use opt-in defaults for newly missing keys', () => {
    const settings = { _settingsSchemaVersion: SETTINGS_SCHEMA_VERSION };

    applySettingsSchema(settings);

    assert.equal(settings.enableMarketplace, false);
    assert.equal(settings.enableCharacterNavigator, true);
});

test('feature checks require a strict boolean true', () => {
    assert.equal(isFeatureEnabled({ feature: true }, 'feature'), true);
    assert.equal(isFeatureEnabled({ feature: 1 }, 'feature'), false);
    assert.equal(isFeatureEnabled({ feature: 'true' }, 'feature'), false);
    assert.equal(isFeatureEnabled({}, 'feature'), false);
});

test('schema application is idempotent', () => {
    const settings = {};
    applySettingsSchema(settings);
    const firstPass = structuredClone(settings);

    applySettingsSchema(settings);

    assert.deepEqual(settings, firstPass);
});
