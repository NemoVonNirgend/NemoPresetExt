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
