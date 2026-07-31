import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const settings = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');

test('core settings expose dividers before other feature controls', () => {
    const dividers = settings.indexOf('id="nemoDividerRegexPattern"');
    const directives = settings.indexOf('id="nemoEnableDirectives"');
    assert.ok(dividers >= 0);
    assert.ok(directives > dividers);
});

test('core settings expose only core runtime controls plus Nemo Hub', () => {
    for (const id of ['nemoDividerRegexPattern', 'nemoEnableDirectives', 'nemoEnableDirectiveAutocomplete', 'nemoEnableNemoEngineInstaller', 'nemoExtensionHubCatalog']) {
        assert.match(settings, new RegExp(`id="${id}"`));
    }
    for (const extracted of ['nemoEnableEmojiPicker', 'nemoEnableModelSelector', 'nemoEnableAnimatedBackgrounds', 'nemoEnableCharacterNavigator']) {
        assert.doesNotMatch(settings, new RegExp(`id="${extracted}"`));
    }
});

test('NemoEngine installer mount stays inside the NemoPresetExt drawer', () => {
    const drawerContent = settings.indexOf('<div class="inline-drawer-content">');
    const engineHeading = settings.indexOf('<h4>NemoEngine</h4>');
    const installerMount = settings.indexOf('id="nemo-preset-ext-settings"');
    const hubHeading = settings.indexOf('<h4>Nemo Hub</h4>');

    assert.ok(drawerContent >= 0);
    assert.ok(engineHeading > drawerContent);
    assert.ok(installerMount > engineHeading);
    assert.ok(hubHeading > installerMount);
    assert.doesNotMatch(settings.slice(0, drawerContent), /id="nemo-preset-ext-settings"/);
});
