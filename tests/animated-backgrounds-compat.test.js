import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync(new URL('../features/backgrounds/animated-backgrounds-module.js', import.meta.url), 'utf8');
const legacySource = readFileSync(new URL('../features/backgrounds/animated-backgrounds.js', import.meta.url), 'utf8');
const uiSource = readFileSync(new URL('../features/backgrounds/background-ui-enhancements.js', import.meta.url), 'utf8');
const organizerSource = readFileSync(new URL('../features/backgrounds/background-organizer.js', import.meta.url), 'utf8');

const readmeSource = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const featuresSource = readFileSync(new URL('../FEATURES.md', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
test('animated backgrounds use supported SillyTavern events instead of private globals', () => {
    assert.match(moduleSource, /import \{ eventSource, event_types, saveSettingsDebounced \} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/script\.js'/);
    assert.match(moduleSource, /eventSource\.on\(event_types\.CHAT_CHANGED/);
    assert.match(moduleSource, /eventSource\.removeListener\(event_types\.CHAT_CHANGED/);
    assert.match(moduleSource, /eventSource\.on\(event_types\.FORCE_SET_BACKGROUND/);

    for (const unsupportedGlobal of [
        'window.setBackground',
        'window.getMediaType',
        'window.chat_metadata',
        'window.saveMetadataDebounced',
        'window.getChatBackgroundsList',
        'window.getRequestHeaders',
        'window.getBackgrounds',
        'window.videoBackgroundStorage',
    ]) {
        assert.doesNotMatch(moduleSource, new RegExp(unsupportedGlobal.replace('.', '\\.')));
    }
});

test('legacy entry point no longer self-initializes or patches SillyTavern', () => {
    assert.match(legacySource, /export \{ AnimatedBackgroundsModule, animatedBackgrounds \}/);
    assert.doesNotMatch(legacySource, /\(function\s*\(/);
    assert.doesNotMatch(legacySource, /window\.setBackground/);
});

test('background integrations are idempotent and fully disposable', () => {
    assert.match(moduleSource, /async initialize\(\)[\s\S]*if \(this\.isInitialized\)/);
    assert.match(moduleSource, /destroy\(\)[\s\S]*this\.isInitialized = false/);
    assert.match(moduleSource, /new MutationObserver/);
    assert.match(moduleSource, /this\.nativeBackgroundObserver\?\.disconnect\(\)/);
    assert.match(moduleSource, /this\.restoreNativeBackground\(\)/);

    assert.match(uiSource, /destroy\(\)[\s\S]*this\.isInitialized = false/);
    assert.match(organizerSource, /destroy\(\)[\s\S]*this\.isInitialized = false/);
});

test('uploads delegate to staging and UI construction avoids HTML injection', () => {
    assert.doesNotMatch(moduleSource, /\.onchange\s*=/);
    assert.doesNotMatch(moduleSource, /insertAdjacentHTML/);
    assert.doesNotMatch(uiSource, /\.innerHTML\s*=/);
    assert.doesNotMatch(organizerSource, /\.innerHTML\s*=/);
    assert.match(uiSource, /fileInput\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
});

test('organizer defers to staging native folders and sort options', () => {
    assert.doesNotMatch(organizerSource, /option\[value="bytype"\]/);
    assert.doesNotMatch(organizerSource, /bg-folder-group/);
    assert.match(organizerSource, /native folder/i);
});

test.skip('video upload guidance reflects the optional staging converter', () => {
    assert.match(uiSource, /typeof globalThis\.convertVideoToAnimatedWebp === 'function'/);
    assert.match(uiSource, /Video Background Loader add-on/);

    for (const documentation of [readmeSource, featuresSource, settingsSource]) {
        assert.match(documentation, /Video Background Loader/);
        assert.match(documentation, /YouTube/);
    }
});

test('animated background documentation only promises implemented UI', () => {
    assert.doesNotMatch(featuresSource, /showControls/);
    assert.doesNotMatch(readmeSource, /optional native controls/i);
    assert.doesNotMatch(readmeSource, /Favorites and Playlist|playlist items/i);
    assert.doesNotMatch(featuresSource, /Favorites and Playlist/i);
});
