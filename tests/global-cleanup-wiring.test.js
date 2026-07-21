import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');

test.skip('background teardown runs in reverse integration order', () => {
    const organizer = content.indexOf('backgroundOrganizer.destroy()');
    const enhancements = content.indexOf('backgroundUIEnhancements.destroy()');
    const backgrounds = content.indexOf('animatedBackgrounds.destroy()');

    assert.ok(organizer >= 0, 'background organizer cleanup must be wired');
    assert.ok(enhancements > organizer, 'UI enhancements must clean up after the organizer');
    assert.ok(backgrounds > enhancements, 'animated backgrounds must clean up last');
});

test.skip('world-info teardown restores native UI before the extensions overhaul cleanup', () => {
    const worldInfo = content.indexOf('NemoWorldInfoUI.destroy()');
    const extensions = content.indexOf('ExtensionsTabOverhaul.cleanup()');

    assert.ok(worldInfo >= 0, 'World Info cleanup must be wired');
    assert.ok(extensions > worldInfo, 'World Info must restore before extensions cleanup');
});

test.skip('initialization lifecycle uses one retry-safe teardown path', () => {
    const cleanupDefinition = content.indexOf('function cleanupExtension()');
    const initializationDefinition = content.indexOf('async function initializeExtension()');

    assert.ok(cleanupDefinition >= 0, 'the shared teardown helper must be defined');
    assert.ok(cleanupDefinition < initializationDefinition, 'teardown must exist before initialization can fail');
    assert.match(content, /window\.NemoPresetExtCleanup\s*=\s*cleanupExtension;/);
    assert.doesNotMatch(content, /window\.NemoPresetExtCleanup\s*=\s*\(\)\s*=>/);
    assert.match(content, /catch \(error\) \{[\s\S]*?Critical failure during initialization[\s\S]*?cleanupExtension\(\);[\s\S]*?\n\s*\}/);
    assert.match(content, /function cleanupExtension\(\) \{[\s\S]*?finally \{[\s\S]*?extensionInitialized = false;[\s\S]*?\}/);
});

test.skip('lifecycle teardown cancels every deferred initialization callback', () => {
    for (const timeout of [
        'directiveCacheTimeout',
        'settingsUpdateTimeout',
        'modelSelectorTimeout',
        'chatCompletionRefreshTimeout',
    ]) {
        assert.match(content, new RegExp(`clearTimeout\\(${timeout}\\)`), `${timeout} must be cancelled`);
    }
});

test.skip('lifecycle teardown restores global styles, tabs, and directive state', () => {
    const cleanupStart = content.indexOf('function cleanupExtension()');
    const cleanupEnd = content.indexOf('window.NemoPresetExtCleanup = cleanupExtension;');
    const cleanup = content.slice(cleanupStart, cleanupEnd);

    assert.match(cleanup, /clearDirectiveCache\(\)/);
    assert.match(cleanup, /removeWidePanelsStyles\(\)/);
    assert.match(cleanup, /UserSettingsTabs\.restoreOriginalLayout\(\)/);
    assert.match(cleanup, /UserSettingsTabs\.cleanup\(\)/);
    assert.match(cleanup, /'nemo-mobile-enhanced'/);
});

test.skip('user settings teardown restores layout before cancelling its lifecycle', () => {
    const tabs = readFileSync(new URL('../ui/user-settings-tabs.js', import.meta.url), 'utf8');
    const restore = content.indexOf('UserSettingsTabs.restoreOriginalLayout()');
    const cleanup = content.indexOf('UserSettingsTabs.cleanup()');

    assert.ok(restore >= 0 && cleanup > restore);
    assert.match(tabs, /clearInterval\(this\._pollForContentInterval\)/);
    assert.match(tabs, /clearTimeout\(this\._initializeTimeout\)/);
    assert.match(tabs, /cleanup: function\(\) \{[\s\S]*?this\.initialized = false;/);
});
