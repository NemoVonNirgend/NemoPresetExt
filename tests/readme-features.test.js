import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FEATURE_DEFAULTS } from '../core/feature-settings.js';

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const MANIFEST = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

const FEATURE_HEADINGS = {
    enablePromptManager: 'Prompt Dropdowns & Tools',
    enablePresetNavigator: 'Preset Navigator',
    enableCharacterNavigator: 'Character Card Navigator',
    enableReasoningCapture: 'Improved Reasoning Capture',
    enableDirectives: 'Prompt Directives',
    enableDirectiveAutocomplete: 'Directive Autocomplete',
    enableAnimatedBackgrounds: 'Animated Backgrounds',
    enableTabOverhauls: 'Settings Tab Overhauls',
    enableConnectionPanelOverhaul: 'Connection Panel Organization',
    nemoEnableExtensionsTabOverhaul: 'Extensions Tab Overhaul',
    enableLorebookOverhaul: 'Lorebook UI Overhaul',
    enableReasoningSection: 'Unified Reasoning Section',
    enableLorebookManagement: 'Quick Lorebook Access',
    enableHTMLTrimming: 'HTML Trimmer',
    nemoEnableWidePanels: 'Wide Navigation Panels',
    enableMobileEnhancements: 'Mobile UI Enhancements',
    enableModelSelector: 'Enhanced Model Selector',
    nemoEnablePollinationsInterceptor: 'Pollinations Image Interceptor',
    nemoPollinationsPromptBestPractices: 'Image Prompt Consistency Boost',
    enableEmojiPicker: 'Emoji Picker',
    enableMarketplace: 'Nemo Marketplace',
    enablePersonaEnhancements: 'Persona UI Enhancements',
    enableNemoLore: 'NemoLore',
    enableRewrite: 'Nemo Rewrite',
    enableTutorials: 'Tutorials and Welcome Guide',
    enableNemoEngineInstaller: 'NemoEngine Installer',
    enableItalicDialogueRenderer: 'Italic Dialogue Rendering',
    enableApiRouter: 'API Router and Model Pipeline',
};

test('README version follows the extension manifest', () => {
    assert.ok(README.includes(`**Version:** ${MANIFEST.version}`));
});

test('README documents every feature flag with its new-install default', () => {
    assert.deepEqual(Object.keys(FEATURE_HEADINGS).sort(), Object.keys(FEATURE_DEFAULTS).sort());

    for (const [key, enabled] of Object.entries(FEATURE_DEFAULTS)) {
        const row = `| \`${key}\` | ${enabled ? '**On**' : 'Off'} |`;
        assert.ok(README.includes(row), `Missing or stale settings row for ${key}`);
        assert.ok(README.includes(`### ${FEATURE_HEADINGS[key]}`), `Missing feature guide for ${key}`);
    }
});

test('README does not advertise the tutorial runtime as fresh-install behavior', () => {
    assert.ok(README.includes('The welcome guide does not auto-start on a default new installation'));
    assert.ok(!README.includes('NemoEngine 7.6'));
});