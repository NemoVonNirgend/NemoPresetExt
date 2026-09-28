import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { installStateSnapshots } from '../features/prompt-rendering/state-snapshots.js';
import { installStateActions } from '../features/prompt-rendering/state-actions.js';

function setup() {
    const listeners = new Map(); let captured, renderDisposals = 0, saves = 0;
    const take = () => { throw new Error('No legacy DOM enumeration on Chat Completion.'); };
    const apply = () => 'legacy apply', counts = () => 'legacy counts';
    const nemo = { takeSnapshot: take, capturePromptStates: take, checkExistingSnapshot() {},
        applySnapshot: apply, restorePromptStates() { return 'legacy restore'; },
        getSectionDirectCounts: counts, getAggregatedCounts: counts,
        handleContainerClick() { return 'legacy click'; }, getDividerInfo() { return { isDivider: false, isSubHeader: false }; },
        beginToggle() {}, endToggle() {}, updateSectionCount() {},
        createSearchAndStatusUI() {}, showStatusMessage() {}, showPromptRestorationNotification() {} };
    const prompt = { identifier: 'hidden', name: 'Hidden', get content() { throw new Error('Do not hydrate source.'); } };
    const order = [{ identifier: 'hidden', enabled: true }];
    const pm = { serviceSettings: { prompts: [prompt] }, activeCharacter: { id: 100001 },
        renderPromptManagerListItems() {}, render() {}, async saveServiceSettings() { saves++; },
        isPromptToggleAllowed() { return true; }, getPromptOrderForCharacter() { return order; },
        tokenHandler: { getCounts() { return {}; } } };
    const source = readFileSync(new URL('../features/prompt-rendering/runtime.js', import.meta.url), 'utf8')
        .replace(/^import .*;$/gm, '').replace(/^export /gm, '');
    const context = {
        eventSource: { on(k, fn) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(fn); },
            removeListener(k, fn) { listeners.get(k)?.delete(fn); } },
        event_types: { APP_READY: 'ready', OAI_PRESET_CHANGED_AFTER: 'preset', SETTINGS_UPDATED: 'settings' },
        extension_settings: { NemoPresetExt: { enableDirectives: false } }, promptManager: pm, NemoPresetManager: nemo,
        NEMO_EXTENSION_NAME: 'NemoPresetExt', isFeatureEnabled: (settings, key) => settings?.[key] === true,
        getAllPromptsWithState: () => [], parsePromptDirectives: () => ({}), validatePromptActivation: () => [], showConflictToast() {},
        storage: { getDropdownStyle: () => 'accordion', saveSnapshot(api, ids) { assert.equal(api, 'openai'); captured = ids; },
            savePromptStates(ids) { captured = ids; }, getSnapshot: () => captured ?? ['hidden'], getPromptStates: () => ['hidden'] },
        installIncrementalRendering: () => ({ dispose() { renderDisposals++; }, getStats: () => ({ virtualized: false }), reset() {}, redraw() {} }),
        installStateSnapshots, installStateActions, getContext: () => ({ mainApi: 'openai' }), saveSettingsDebounced() {},
        console, setTimeout, clearTimeout,
        document: { getElementById: () => null, querySelectorAll: () => [] },
    };
    const api = new Script(source + '\n({ initializePromptRendering, cleanupPromptRendering })').runInNewContext(context);
    return { api, context, nemo, take, apply, counts, listeners, get captured() { return captured; },
        get renderDisposals() { return renderDisposals; }, get saves() { return saves; }, order };
}

test('real rendering runtime installs read and mutation adapters once and tears down only owned wrappers', async () => {
    const h = setup(); h.api.initializePromptRendering();
    const snapshotWrapper = h.nemo.takeSnapshot, actionWrapper = h.nemo.applySnapshot;
    h.api.initializePromptRendering(); assert.equal(h.nemo.takeSnapshot, snapshotWrapper); assert.equal(h.nemo.applySnapshot, actionWrapper);
    await h.nemo.takeSnapshot(); assert.deepEqual(h.captured, ['hidden']);
    await h.nemo.applySnapshot(); assert.equal(h.saves, 0);
    assert.equal(h.context.NemoPromptRendering.stage, '5B.2A/5');
    assert.equal(h.context.NemoPromptRendering.getStats().snapshots.captures, 1);
    assert.equal(h.context.NemoPromptRendering.getStats().actions.stage, '5B.2A/5');
    assert.notEqual(h.nemo.applySnapshot, h.apply); assert.notEqual(h.nemo.getAggregatedCounts, h.counts);
    h.api.cleanupPromptRendering(); h.api.cleanupPromptRendering();
    assert.equal(h.nemo.takeSnapshot, h.take); assert.equal(h.nemo.applySnapshot, h.apply); assert.equal(h.nemo.getAggregatedCounts, h.counts);
    assert.equal(h.renderDisposals, 1);
    assert.equal([...h.listeners.values()].reduce((n, set) => n + set.size, 0), 0);
    assert.equal(h.context.NemoPromptRendering, undefined);
});

test('rendering opt-out leaves state snapshots and actions installed without touching generation paths', async () => {
    const h = setup(); h.context.extension_settings.NemoPresetExt.enableIncrementalPromptRendering = false;
    h.api.initializePromptRendering(); await h.nemo.capturePromptStates();
    assert.deepEqual(h.captured, ['hidden']);
    assert.notEqual(h.nemo.applySnapshot, h.apply);
    assert.equal(h.context.promptManager.preparePrompt, undefined);
    assert.equal(h.context.promptManager.getPromptCollection, undefined);
    h.api.cleanupPromptRendering();
});
