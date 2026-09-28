import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { installStateSnapshots } from '../features/prompt-rendering/state-snapshots.js';

function setup() {
    const listeners = new Map(); let captured, renderDisposals = 0;
    const take = () => { throw new Error('No legacy DOM enumeration on Chat Completion.'); };
    const apply = () => 'legacy apply', counts = () => 'legacy counts';
    const nemo = { takeSnapshot: take, capturePromptStates: take, checkExistingSnapshot() {},
        applySnapshot: apply, getAggregatedCounts: counts, createSearchAndStatusUI() {}, showStatusMessage() {} };
    const pm = { serviceSettings: { prompts: [{ identifier: 'hidden', name: 'Hidden',
        get content() { throw new Error('Do not hydrate source.'); } }] }, activeCharacter: { id: 100001 },
        renderPromptManagerListItems() {}, isPromptToggleAllowed() { return true; },
        getPromptOrderForCharacter() { return [{ identifier: 'hidden', enabled: true }]; } };
    const source = readFileSync(new URL('../features/prompt-rendering/runtime.js', import.meta.url), 'utf8')
        .replace(/^import .*;$/gm, '').replace(/^export /gm, '');
    const context = {
        eventSource: { on(k, fn) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(fn); },
            removeListener(k, fn) { listeners.get(k)?.delete(fn); } },
        event_types: { APP_READY: 'ready', OAI_PRESET_CHANGED_AFTER: 'preset', SETTINGS_UPDATED: 'settings' },
        extension_settings: { NemoPresetExt: {} }, promptManager: pm, NemoPresetManager: nemo,
        storage: { getDropdownStyle: () => 'accordion', saveSnapshot(api, ids) { assert.equal(api, 'openai'); captured = ids; },
            savePromptStates(ids) { captured = ids; }, getSnapshot: () => captured ?? null },
        installIncrementalRendering: () => ({ dispose() { renderDisposals++; }, getStats: () => ({ virtualized: false }), reset() {}, redraw() {} }),
        installStateSnapshots, getContext: () => ({ mainApi: 'openai' }), saveSettingsDebounced() {},
        console, setTimeout, clearTimeout,
        document: { getElementById: () => null, querySelectorAll: () => [] },
    };
    const api = new Script(source + '\n({ initializePromptRendering, cleanupPromptRendering })').runInNewContext(context);
    return { api, context, nemo, take, apply, counts, listeners, get captured() { return captured; },
        get renderDisposals() { return renderDisposals; } };
}
test('real rendering runtime installs state snapshots once and tears down only owned wrappers', async () => {
    const h = setup(); h.api.initializePromptRendering(); const wrapper = h.nemo.takeSnapshot;
    h.api.initializePromptRendering(); assert.equal(h.nemo.takeSnapshot, wrapper);
    await h.nemo.takeSnapshot(); assert.deepEqual(h.captured, ['hidden']);
    assert.equal(h.context.NemoPromptRendering.stage, '5B.1/5');
    assert.equal(h.context.NemoPromptRendering.getStats().snapshots.captures, 1);
    assert.equal(h.nemo.applySnapshot, h.apply); assert.equal(h.nemo.getAggregatedCounts, h.counts);
    h.api.cleanupPromptRendering(); h.api.cleanupPromptRendering();
    assert.equal(h.nemo.takeSnapshot, h.take); assert.equal(h.renderDisposals, 1);
    assert.equal([...h.listeners.values()].reduce((n, set) => n + set.size, 0), 0);
    assert.equal(h.context.NemoPromptRendering, undefined);
});
test('rendering opt-out leaves read-side snapshots correct without touching generation paths', async () => {
    const h = setup(); h.context.extension_settings.NemoPresetExt.enableIncrementalPromptRendering = false;
    h.api.initializePromptRendering(); await h.nemo.capturePromptStates();
    assert.deepEqual(h.captured, ['hidden']);
    assert.equal(h.context.promptManager.preparePrompt, undefined);
    assert.equal(h.context.promptManager.getPromptCollection, undefined);
    h.api.cleanupPromptRendering();
});
