import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const content = read('../content.js');
const globalUi = read('../ui/global-ui.js');
const pollinations = read('../features/pollinations-interceptor.js');
const marketplace = read('../features/marketplace/marketplace.js');
const emojiPicker = read('../features/emoji-picker/emoji-picker.js');
const persona = read('../features/persona/persona-ui.js');
const tutorialManager = read('../features/onboarding/tutorial-manager.js');
const tutorialLauncher = read('../features/onboarding/tutorial-launcher.js');
const vnDialog = read('../features/onboarding/vn-dialog.js');

test('shared teardown owns every optional module lifecycle', () => {
    const cleanup = content.slice(
        content.indexOf('function cleanupExtension()'),
        content.indexOf('window.NemoPresetExtCleanup = cleanupExtension;'),
    );

    for (const call of [
        'NemoMarketplace.destroy()',
        'NemoGlobalUI.destroy()',
        'PollinationsInterceptor.destroy()',
        'EmojiPicker.destroy()',
        'NemoPersonaUI.destroy()',
        'tutorialLauncher.destroy()',
        'tutorialManager.destroy()',
    ]) {
        assert.ok(cleanup.includes(call), `${call} must be wired into shared teardown`);
    }
});

test('global UI teardown disconnects observers, handlers, and moved DOM', () => {
    assert.match(globalUi, /destroy: function \(\)/);
    assert.match(globalUi, /eventSource\.removeListener/);
    assert.match(globalUi, /observer\.disconnect\(\)/);
    assert.match(globalUi, /_restoreMoves/);
    assert.match(globalUi, /_initialized = false/);
});

test('Pollinations teardown removes all event and streaming side effects', () => {
    assert.match(pollinations, /export function destroyPollinationsInterceptor\(\)/);
    assert.match(pollinations, /eventSource\.removeListener/);
    assert.match(pollinations, /streamingObserver\.disconnect\(\)/);
    assert.match(pollinations, /pendingStreamingImageTimers\.values\(\)/);
    assert.match(pollinations, /pollinationsListenerAbortController\.abort\(\)/);
    assert.match(pollinations, /nemo-pollinations-interceptor-styles/);
    assert.match(pollinations, /pollinationsLifecycleEpoch\+\+/);
    assert.match(pollinations, /activeImagePresentations/);
    assert.match(pollinations, /isCurrentPollinationsLifecycle\(epoch\)/);
    assert.match(pollinations, /signal:\s*this\._abortController|signal,/);
});

test('emoji and persona teardown cancel browser listeners, observers, and timers', () => {
    assert.match(emojiPicker, /destroy\(\)/);
    assert.match(emojiPicker, /eventAbortController\?\.abort\(\)/);
    assert.match(emojiPicker, /observer\?\.disconnect\(\)/);
    assert.match(emojiPicker, /clearTimeout\(searchTimeout\)/);
    assert.match(emojiPicker, /isInitialized = false/);

    assert.match(persona, /destroy: function \(\)/);
    assert.match(persona, /this\._observers[\s\S]*?disconnect\(\)/);
    assert.match(persona, /this\._abortController\?\.abort\(\)/);
    assert.match(persona, /clearTimeout/);
    assert.match(persona, /this\._initialized = false/);
});

test('tutorial teardown removes owned UI and cancels delayed work', () => {
    assert.match(tutorialManager, /destroy\(\)[\s\S]*?this\.initialized = false/);
    assert.match(tutorialLauncher, /destroy\(\)[\s\S]*?clearInterval\(this\._settingsInterval\)/);
    assert.match(tutorialLauncher, /clearTimeout\(this\._welcomeTimeout\)/);
    assert.match(tutorialLauncher, /vnDialog\.destroy\(\)/);
    assert.match(vnDialog, /destroy\(\)[\s\S]*?clearTimeout/);
    assert.match(vnDialog, /this\._showAbortController\?\.abort\(\)/);
    assert.match(vnDialog, /showEpoch !== this\._showEpoch/);
    assert.match(vnDialog, /onBeforeHighlight\(\{ signal: controller\.signal \}\)/);
});

test('marketplace teardown cancels async work and restores moved native UI', () => {
    assert.match(marketplace, /destroy: function \(\)/);
    assert.match(marketplace, /this\._abortController\?\.abort\(\)/);
    assert.match(marketplace, /clearTimeout\(this\._injectionTimer\)/);
    assert.match(marketplace, /cancelAnimationFrame\(this\._focusFrame\)/);
    assert.match(marketplace, /move\.parent\.insertBefore\(move\.element, move\.nextSibling\)/);
    assert.match(marketplace, /document\.getElementById\('nemo-marketplace-button'\)\?\.remove\(\)/);
    assert.match(marketplace, /this\._isCurrentLifecycle\(epoch\)/);
});
