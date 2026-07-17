import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../ui/extensions-tab-overhaul.js', import.meta.url), 'utf8');
const globalUi = readFileSync(new URL('../ui/global-ui.js', import.meta.url), 'utf8');
const settingsUi = readFileSync(new URL('../ui/settings-ui.js', import.meta.url), 'utf8');

test('NemoPresetExt settings mount inside a native extension column', () => {
    assert.match(settingsUi, /document\.getElementById\('extensions_settings'\)/);
    assert.match(settingsUi, /host\.className = 'extension_container nemo-settings-host wide100p'/);
    assert.match(settingsUi, /host\.dataset\.nemoExtensionId = 'nemo-preset-ext-settings'/);
    assert.doesNotMatch(settingsUi, /extensionsBlock\.insertBefore\(host/);
});

test('Nemo settings share one ownership contract across both extension layouts', () => {
    assert.match(globalUi, /document\.getElementById\('nemo-preset-ext-settings-host'\)/);
    assert.match(globalUi, /nemoSuiteContent\.appendChild\(nemoPresetSettings\)/);
    assert.match(source, /#nemo-suite-drawer > \.inline-drawer-content > \*/);
    assert.match(source, /container\.dataset\.nemoExtensionId === 'nemo-preset-ext-settings'/);
    assert.match(source, /id = 'nemo-preset-ext-settings'/);
});

test('global UI avoids selector-list features that can abort extension initialization', () => {
    assert.doesNotMatch(globalUi, /querySelector(?:All)?\([^)]*:has\(/);
    assert.match(globalUi, /findTargetWithDescendant/);
    assert.match(globalUi, /findInlineDrawerByHeading/);
});

test('extension settings enhancements record native DOM changes', () => {
    assert.match(source, /recordElementMove: function\(element\)/);
    assert.match(source, /recordElementRemoval: function\(element\)/);
    assert.match(source, /recordPresentationMutation: function\(element\)/);
    assert.match(source, /this\.recordElementMove\(element\)/);
});

test('cleanup restores enhanced extension settings before removing owned UI', () => {
    assert.match(source, /restoreEnhancedSettingsDom: function\(\)/);
    assert.match(source, /this\._movedElements\.slice\(\)\.reverse\(\)/);
    assert.match(source, /this\._removedElements\.slice\(\)\.reverse\(\)/);
    assert.match(source, /this\.restoreEnhancedSettingsDom\(\);[\s\S]*nemo-tab-extension-overlay/);
    assert.match(source, /this\.restoreEnhancedSettingsDom\(\);[\s\S]*this\.originalExtensions\.forEach[\s\S]*this\.hiddenCompanionExtensions\.forEach/);
});
