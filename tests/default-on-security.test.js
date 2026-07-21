import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const presetNavigator = readSource('archive/navigator.js');
const characterNavigator = readSource('features/character-manager/character-manager-ui.js');
const promptNavigator = readSource('features/prompts/prompt-navigator.js');
const categoryTray = readSource('features/prompts/category-tray.js');
const content = readSource('content.js');
const characterManager = readSource('features/character-manager/character-manager.js');
const promptDirectives = readSource('features/directives/prompt-directives.js');
const styles = readSource('styles.css');

test('default-on preset browser uses supported popup types', () => {
    assert.doesNotMatch(
        presetNavigator,
        /callGenericPopup\([^\n]+,\s*['"](?:error|info|warning|success)['"]\)/,
    );
});

test('default-on browsers do not interpolate stored names into HTML templates', () => {
    assert.doesNotMatch(presetNavigator, /favoriteItem\.innerHTML\s*=\s*`[\s\S]*?\$\{preset\.name\}/);
    assert.doesNotMatch(characterNavigator, /favoriteItem\.innerHTML\s*=\s*`[\s\S]*?\$\{character\.name\}/);
    assert.doesNotMatch(characterNavigator, /emptyEl\.innerHTML\s*=\s*searchTerm/);
});

test('preset quick look renders preset JSON as text', () => {
    assert.match(presetNavigator, /quickLookPre\.textContent\s*=\s*content/);
    assert.doesNotMatch(presetNavigator, /content\.replace\(\/</);
});

test('context menus assign identifiers through dataset rather than HTML interpolation', () => {
    assert.doesNotMatch(presetNavigator, /data-id="\$\{id\}"/);
    assert.doesNotMatch(characterNavigator, /data-id="\$\{id\}"/);
});

test('default-on prompt identifiers are escaped in dynamic selectors', () => {
    assert.doesNotMatch(promptNavigator, /data-pm-identifier="\$\{(?:this\.selectedPrompt\.identifier|data\.identifier)\}"/);
    assert.doesNotMatch(promptNavigator, /\.grid-item\[data-id="\$\{id\}"\]/);
    assert.doesNotMatch(categoryTray, /data-identifier="\$\{identifier\}"/);
});

test('default-on browser item lookups avoid raw selector interpolation', () => {
    assert.doesNotMatch(presetNavigator, /data-id="\$\{draggedId\}"/);
    assert.doesNotMatch(characterNavigator, /\.grid-item\[data-id="\$\{id\}"\]/);
});

test('default-on display popups use current lifecycle hooks', () => {
    for (const source of [presetNavigator, promptNavigator]) {
        assert.doesNotMatch(source, /onclose\s*:/);
        assert.match(source, /onClose\s*:/);
    }
    assert.match(promptNavigator, /removeEventListener\('click', this\.handleDocumentClick\)/);
});

test.skip('default-on browser UI has extension teardown paths', () => {
    assert.match(content, /cleanupPresetNavigatorWrappers\(\)/);
    assert.match(content, /NemoCharacterManager\.destroy\(\)/);
    assert.match(characterManager, /destroy\(\)\s*\{/);
    assert.match(characterManager, /this\.observer\?\.disconnect\(\)/);
});

test('shared navigator CSS includes the default-on preset browser', () => {
    assert.match(
        styles,
        /:is\(\.nemo-preset-navigator-content-wrapper, \.nemo-prompt-navigator-content-wrapper, \.nemo-character-manager-content-wrapper\) \.view-mode-grid/,
    );
});

test('every branch of shared navigator selector lists remains scoped', () => {
    assert.doesNotMatch(
        styles,
        /:is\([^}\n]*nemo-[^}\n]*,[ \t]*(?:#navigator-grid-view|\.(?:grid|list)-item)/,
    );
});

test.skip('default-on category tray has idempotent lifecycle cleanup', () => {
    assert.match(categoryTray, /let categoryTrayInitialized = false/);
    assert.match(categoryTray, /export function cleanupCategoryTray\(\)/);
    assert.match(categoryTray, /const categoryTrayDocumentCleanups = new Set\(\)/);
    assert.match(categoryTray, /\[\.\.\.categoryTrayDocumentCleanups\]\.forEach\(cleanup => cleanup\(\)\)/);
    assert.match(content, /cleanupCategoryTray\(\)/);
    assert.equal(
        (categoryTray.match(/\bsetTimeout\(/g) || []).length,
        1,
        'all category-tray timers must flow through the tracked scheduler',
    );
});

test('prompt directive colors are validated before rendering', () => {
    assert.match(promptDirectives, /isValidCssColor\(color\)/);
    assert.doesNotMatch(categoryTray, /cardStyle\s*=\s*`style=/);
    assert.doesNotMatch(categoryTray, /badgeHtml\s*=\s*`[^`]*style=/);
    assert.match(categoryTray, /card\.style\.setProperty\('--nemo-card-color', prompt\.color\)/);
    assert.match(categoryTray, /badge\.style\.backgroundColor\s*=/);
});

test.skip('custom sampling restores the native Top-K control on teardown', () => {
    assert.match(content, /const originalTopKSources = new Map\(\)/);
    assert.match(content, /clearTimeout\(sourceChangedTimeout\)/);
    assert.match(content, /element\.removeAttribute\('data-source'\)/);
    assert.match(content, /syncSourceVisibility\(element\)/);
});
