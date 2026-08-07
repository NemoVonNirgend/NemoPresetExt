import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const settings = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');

test('prompt workstation settings are presented before dividers and directives', () => {
    const promptMode = settings.indexOf('id="nemoPromptUiMode"');
    const dividers = settings.indexOf('id="nemoDividerRegexPattern"');
    const directives = settings.indexOf('id="nemoEnableDirectives"');
    assert.ok(promptMode >= 0);
    assert.ok(dividers > promptMode);
    assert.ok(directives > dividers);
});

test('settings expose every merged prompt gate and all three interface modes', () => {
    for (const id of [
        'nemoEnablePromptManager',
        'nemoPromptUiMode',
        'nemoEnablePresetNavigator',
        'nemoEnableCharacterNavigator',
        'nemoEnableReasoningCapture',
        'nemoEnableReasoningSection',
        'nemoDividerRegexPattern',
        'nemoEnableDirectives',
        'nemoEnableDirectiveAutocomplete',
        'nemoEnableNemoEngineInstaller',
        'nemoExtensionHubCatalog',
    ]) {
        assert.match(settings, new RegExp(`id="${id}"`));
    }
    for (const mode of ['classic', 'modern', 'classicPlus']) {
        assert.match(settings, new RegExp(`value="${mode}"`));
    }
});

test('settings continue to exclude broader UI and composer features', () => {
    for (const extracted of ['nemoEnableEmojiPicker', 'nemoEnableModelSelector', 'nemoEnableAnimatedBackgrounds']) {
        assert.doesNotMatch(settings, new RegExp(`id="${extracted}"`));
    }
});

test('NemoEngine installer mount stays inside the NemoPresetExt drawer', () => {
    const settingsRoot = settings.indexOf('id="nemo-preset-ext-settings"');
    const drawerContent = settings.indexOf('<div class="inline-drawer-content">');
    const engineHeading = settings.indexOf('<h4>NemoEngine</h4>');
    const installerMount = settings.indexOf('id="nemo-engine-installer-mount"');
    const hubHeading = settings.indexOf('<h4>Nemo Hub</h4>');
    assert.ok(settingsRoot >= 0);
    assert.ok(drawerContent > settingsRoot);
    assert.ok(engineHeading > drawerContent);
    assert.ok(installerMount > engineHeading);
    assert.ok(hubHeading > installerMount);
});
