import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPromptOrganizationState } from '../features/prompt-rendering/organization-state.js';
import { capturePromptLayout, getRememberedPromptLayout, promptLayoutSignature, releasePromptLayout, rememberPromptLayout, restorePromptLayoutSearch, samePromptLayout } from '../features/prompt-rendering/layout-preservation.js';
import { renderState } from '../features/prompt-rendering/model.js';
import { installIncrementalRendering } from '../features/prompt-rendering/incremental.js';
import { installStateActions } from '../features/prompt-rendering/state-actions.js';

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const turn = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const managerSource = readFileSync(new URL('../features/prompts/prompt-manager.js', import.meta.url), 'utf8');
function method(name) {
    const start = managerSource.indexOf(`    ${name}: `);
    assert(start >= 0, `Missing production method ${name}`);
    return managerSource.slice(start, managerSource.indexOf('\n    },', start) + 7);
}

// Use the production begin/end/defer/flush/native-paint methods. Only rendering
// and DOM lookup are injected, so a missing catch-up in endToggle fails here.
function managerHarness() {
    const state = createPromptOrganizationState(); state.activate();
    let list = { name: 'original', organized: true }, paints = 0;
    const initial = list;
    const names = ['deferPromptOrganization', 'flushPromptOrganization', 'isPromptOrganizationPaused',
        'beginToggle', 'endToggle', 'beginNativePromptPaint', 'endNativePromptPaint', 'isNativePromptPaintCurrent'];
    const document = { querySelector: () => list };
    const manager = new Function('promptOrganizationState', 'extension_settings', 'NEMO_EXTENSION_NAME', 'document', 'console',
        `const SELECTORS = { promptsContainer: '#completion_prompt_manager_list' }; const LOG_PREFIX = '[test]'; return ({${names.map(method).join('\n')}});`)(
        state, { NemoPresetExt: { enablePromptManager: true } }, 'NemoPresetExt', document, { log() {} });
    Object.assign(manager, {
        pauseListObserver() {}, resumeListObserver() {}, initialize() {},
        organizePrompts(force = false) {
            if (this.deferPromptOrganization(force)) return;
            list.organized = true; paints++;
        },
    });
    return { state, manager, initial, get list() { return list; }, get paints() { return paints; },
        replace() { list = { name: 'replacement', organized: false }; return list; } };
}

test('a request skipped during nested toggles repairs only the current live list after the outer end', () => {
    const h = managerHarness(), first = h.manager.beginToggle(), second = h.manager.beginToggle();
    h.replace(); h.manager.organizePrompts(true);
    h.manager.endToggle(second);
    assert.equal(h.paints, 0); assert.equal(h.list.organized, false);
    h.manager.endToggle(first);
    assert.equal(h.paints, 1); assert.equal(h.list.organized, true);
    h.manager.endToggle(first); assert.equal(h.paints, 1);
});

test('toggle completion without a skipped paint does not rebuild preserved rows or open trays', () => {
    const h = managerHarness();
    h.manager.endToggle(h.manager.beginToggle());
    assert.equal(h.paints, 0); assert.equal(h.list, h.initial);
});

test('native paint completion repairs a replacement even when the save has already finished', () => {
    const h = managerHarness(), toggle = h.manager.beginToggle();
    h.manager.endToggle(toggle);
    const native = h.manager.beginNativePromptPaint();
    h.manager.endNativePromptPaint(native, h.replace());
    assert.equal(h.paints, 1); assert.equal(h.list.organized, true);
});

test('native completion waits for a remaining nested native paint and toggle', () => {
    const h = managerHarness(), toggle = h.manager.beginToggle();
    const first = h.manager.beginNativePromptPaint(), second = h.manager.beginNativePromptPaint();
    h.manager.endNativePromptPaint(second, h.replace());
    h.manager.endToggle(toggle); assert.equal(h.paints, 0);
    h.manager.endNativePromptPaint(first);
    assert.equal(h.paints, 1);
});

test('stale toggle/native tokens cannot release or repaint a reinitialized manager', () => {
    const h = managerHarness(), oldToggle = h.manager.beginToggle(), oldPaint = h.manager.beginNativePromptPaint();
    h.manager.organizePrompts(); h.state.dispose(); h.state.activate();
    const newToggle = h.manager.beginToggle(); h.replace(); h.manager.organizePrompts();
    h.manager.endToggle(oldToggle); h.manager.endNativePromptPaint(oldPaint, h.list);
    assert.equal(h.paints, 0); assert.equal(h.state.paused, true);
    h.manager.endToggle(newToggle); assert.equal(h.paints, 1);
});

test('deferred force requests coalesce and disposal discards pending work', () => {
    const state = createPromptOrganizationState(); state.activate();
    const token = state.beginToggle();
    state.defer(false); state.defer(true); state.defer(false);
    assert.equal(state.take(), null); state.endToggle(token);
    assert.deepEqual(state.take(), { force: true }); assert.equal(state.take(), null);
    state.request(); state.dispose(); state.activate();
    assert.equal(state.take(), null);
});

for (const failSave of [false, true]) test(`actual state-action ${failSave ? 'rollback' : 'save'} restores skipped native organization`, async () => {
    const h = managerHarness(), save = deferred();
    const prompt = { identifier: 'one', name: 'One' }, entry = { identifier: 'one', enabled: true };
    const pm = {
        activeCharacter: { id: 1 }, serviceSettings: { prompts: [prompt] },
        getPromptOrderForCharacter: () => [entry], isPromptToggleAllowed: () => true,
        saveServiceSettings: () => save.promise,
        render() {
            const paint = h.manager.beginNativePromptPaint();
            h.manager.endNativePromptPaint(paint, h.replace());
        },
    };
    const actions = installStateActions({ manager: h.manager, getManager: () => pm, storage: {} });
    const pending = actions.applyChanges([{ identifier: 'one', enabled: false }]);
    await turn();
    assert.equal(h.paints, 0); assert.equal(h.list.organized, false);
    if (failSave) { save.reject(new Error('test save failure')); await assert.rejects(pending, /test save failure/); }
    else { save.resolve(); await pending; }
    assert.equal(h.list.organized, true); assert.equal(h.paints, 1);
    assert.equal(entry.enabled, failSave); actions.dispose();
});

function layoutFixture() {
    const controls = { nemoPresetSearchInput: { value: 'quiet moon' }, nemoSearchBodies: { checked: true } };
    const list = { ownerDocument: { getElementById: id => controls[id] }, rows: [] };
    let cleanups = 0;
    const tray = { _closeCleanup: () => cleanups++, _keyCleanup: () => cleanups++, remove() {} };
    const section = { open: true, isConnected: true, members: [], _nemoCategoryTray: tray };
    const header = { dataset: { pmIdentifier: 'heading' }, style: {}, parentElement: { tagName: 'SUMMARY' } };
    const row = { dataset: { pmIdentifier: 'one' }, style: { display: 'none' }, parentElement: { tagName: 'DIV' },
        remove() { list.rows = list.rows.filter(item => item !== this); section.members = []; } };
    section.members.push(row); list.rows = [header, row];
    section.querySelector = () => header;
    list.querySelectorAll = selector => selector.startsWith('details') ? [section] : list.rows;
    const signature = promptLayoutSignature({ owner: {}, context: 'character-1', topology: 'heading,one', frame: 'footer' }, 'tray');
    return { list, controls, section, header, row, tray, signature, get cleanups() { return cleanups; } };
}

test('temporary layout keeps open section/tray shells, hidden metadata and query, without ordinary row subtrees', () => {
    const h = layoutFixture(), snapshot = capturePromptLayout(h.list, h.signature);
    assert.equal(snapshot.sections.get('heading'), h.section);
    assert.equal(h.section._nemoCategoryTray, h.tray); assert.equal(h.section.open, true);
    assert.deepEqual(h.section.members, []); assert.deepEqual(h.list.rows, [h.header]);
    assert.equal(snapshot.displays.get('one'), 'none');
    h.controls.nemoPresetSearchInput.value = ''; h.controls.nemoSearchBodies.checked = false;
    restorePromptLayoutSearch(snapshot, h.list.ownerDocument);
    assert.equal(h.controls.nemoPresetSearchInput.value, 'quiet moon');
    assert.equal(h.controls.nemoSearchBodies.checked, true);
    releasePromptLayout(snapshot);
    assert.equal(h.cleanups, 0); assert.equal(h.section._nemoCategoryTray, h.tray);
    assert.equal(snapshot.sections.size, 0); assert.equal(snapshot.search, null);
});

test('discarded owner layout releases detached tray listeners and snapshot references', () => {
    const h = layoutFixture(), snapshot = capturePromptLayout(h.list, h.signature);
    h.section.isConnected = false; releasePromptLayout(snapshot);
    assert.equal(h.cleanups, 2); assert.equal(h.section._nemoCategoryTray, undefined);
    assert.equal(snapshot.signature, null); assert.equal(snapshot.displays.size, 0);
});

for (const [field, value] of [['owner', {}], ['context', 'character-2'], ['topology', 'renamed'], ['frame', 'new footer'], ['mode', 'accordion']]) {
    test(`layout preservation rejects a changed ${field}`, () => {
        const signature = layoutFixture().signature;
        assert.equal(samePromptLayout(signature, { ...signature }), true);
        assert.equal(samePromptLayout(signature, { ...signature, [field]: value }), false);
    });
}

function coldLayoutHarness() {
    const sources = [{ identifier: 'heading', name: '=== Group ===' }, { identifier: 'one', name: 'One' }];
    const order = sources.map(prompt => ({ identifier: prompt.identifier, enabled: true }));
    const rows = sources.map(prompt => ({ dataset: { pmIdentifier: prompt.identifier },
        querySelector: () => ({ dataset: { pmName: prompt.name } }) }));
    const list = { rows, querySelector: () => null, querySelectorAll() { return this.rows; } };
    const pm = {
        activeCharacter: { id: 1 }, serviceSettings: { prompts: sources },
        configuration: { prefix: 'completion_', promptOrder: { strategy: 'global' } },
        getPromptOrderForCharacter: () => order,
        isPromptDeletionAllowed: () => true, isPromptEditAllowed: () => true,
        isPromptToggleAllowed: () => true, isPromptInspectionAllowed: () => true,
        listElement: list, containerElement: { contains: target => target === pm.listElement },
        async renderPromptManager() { this.listElement = { ...list, rows: [] }; },
        async renderPromptManagerListItems() { this.listElement.rows = [...rows]; },
        updatePromptByIdentifier(id, content) { sources.find(prompt => prompt.identifier === id).content = content; },
    };
    let snapshot = null, captures = 0;
    const nemo = {
        captureNativePromptLayout(currentList, signature) {
            // Only the pre-existing organized list owns section/tray shells.
            // A new native list has none and must keep the pending snapshot.
            if (currentList === list) { captures++; snapshot = { signature }; }
            return snapshot;
        },
        clearNativePromptLayout(captured = snapshot) { if (captured === snapshot) snapshot = null; },
    };
    const listeners = new Map(); let mode = 'tray';
    const document = {
        addEventListener(type, handler) { listeners.set(type, handler); },
        removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    };
    const remember = () => rememberPromptLayout(list, renderState(pm), mode);
    const install = () => installIncrementalRendering({ pm, nemo, document, modeKey: () => mode, compatible: () => false });
    const changeMode = next => { mode = next; listeners.get('nemo-dropdown-style-changed')?.(); };
    return { pm, list, remember, install, changeMode, get captures() { return captures; }, get snapshot() { return snapshot; } };
}

test('the first wrapped frame and row paint preserve layout recorded before renderer attachment', async () => {
    const h = coldLayoutHarness(); h.remember();
    const renderer = h.install();
    assert.equal(renderer.getStats().fullLists, 0);
    await h.pm.renderPromptManager();
    assert.notEqual(h.pm.listElement, h.list);
    const captured = h.snapshot;
    await h.pm.renderPromptManagerListItems();
    assert.equal(h.captures, 1);
    assert.equal(h.snapshot, captured);
    assert.equal(h.snapshot.signature.owner, h.pm.serviceSettings.prompts);
    renderer.dispose();
});

test('a recorded cold layout remains identifiable after closed rows are virtualized', async () => {
    const h = coldLayoutHarness(); h.remember(); h.list.rows = h.list.rows.slice(0, 1);
    const renderer = h.install(); await h.pm.renderPromptManager();
    assert.equal(h.captures, 1); renderer.dispose();
});

for (const mode of ['tray', 'accordion']) {
    test(`a presentation-only ${mode} event keeps proven cold layout through the next native paint`, async () => {
        const h = coldLayoutHarness(); h.remember();
        const renderer = h.install(); h.changeMode(mode);
        await h.pm.renderPromptManager(); const captured = h.snapshot;
        await h.pm.renderPromptManagerListItems();
        assert.equal(h.captures, 1); assert.equal(h.snapshot, captured);
        assert.equal(h.snapshot.signature.mode, mode); renderer.dispose();
    });
}

test('first redraw cannot adopt a previous owner with the same row identifiers and names', async () => {
    const h = coldLayoutHarness(); h.remember();
    const renderer = h.install();
    h.pm.serviceSettings.prompts = h.pm.serviceSettings.prompts.map(prompt => ({ ...prompt }));
    h.changeMode('accordion');
    await h.pm.renderPromptManager();
    assert.equal(h.captures, 0); renderer.dispose();
});

test('body-only edit invalidation prevents a cold layout from reviving old tray closures', async () => {
    const h = coldLayoutHarness(); h.remember();
    const renderer = h.install();
    h.pm.updatePromptByIdentifier('one', 'New directives and content');
    assert.equal(getRememberedPromptLayout(h.list), null);
    h.changeMode('tray');
    await h.pm.renderPromptManager();
    assert.equal(h.captures, 0); renderer.dispose();
});

for (const mismatch of ['missing row', 'row order', 'native name']) {
    test(`completed organization cannot record ownership with a mismatched ${mismatch}`, () => {
        const h = coldLayoutHarness();
        assert(h.remember());
        if (mismatch === 'missing row') h.list.rows.pop();
        else if (mismatch === 'row order') h.list.rows.reverse();
        else h.list.rows[0].querySelector = () => ({ dataset: { pmName: 'Older preset header' } });
        assert.equal(h.remember(), null);
        assert.equal(getRememberedPromptLayout(h.list), null);
    });
}

for (const methodName of ['renderPromptManager', 'renderPromptManagerListItems']) {
    test(`a disposed ${methodName} rejection cannot clear a newer snapshot`, async () => {
        const gate = deferred(); let snapshot = null, failing = false, captures = 0;
        const prompt = { identifier: 'one', name: 'One', role: 'system' }, entry = { identifier: 'one', enabled: true };
        const row = { dataset: { pmIdentifier: 'one' } };
        const list = { querySelectorAll: () => [row], querySelector: () => null };
        const pm = {
            activeCharacter: { id: 1 }, serviceSettings: { prompts: [prompt] },
            configuration: { prefix: 'completion_', promptOrder: { strategy: 'global' } },
            getPromptOrderForCharacter: () => [entry],
            isPromptDeletionAllowed: () => true, isPromptEditAllowed: () => true,
            isPromptToggleAllowed: () => true, isPromptInspectionAllowed: () => true,
            listElement: list, containerElement: { contains: target => target === list },
            renderPromptManager: () => failing && methodName === 'renderPromptManager' ? gate.promise : Promise.resolve(),
            renderPromptManagerListItems: () => failing && methodName === 'renderPromptManagerListItems' ? gate.promise : Promise.resolve(),
        };
        const oldSnapshot = { owner: 'old controller' };
        const nemo = {
            captureNativePromptLayout() { captures++; snapshot = oldSnapshot; return snapshot; },
            clearNativePromptLayout(captured = snapshot) { if (captured === snapshot) snapshot = null; },
        };
        const document = { addEventListener() {}, removeEventListener() {} };
        const renderer = installIncrementalRendering({ pm, nemo, document, compatible: () => false });
        // A complete native paint establishes the metadata of the old layout.
        await pm.renderPromptManagerListItems();
        failing = true;
        const pending = pm[methodName]();
        assert.equal(captures, 1); assert.equal(snapshot, oldSnapshot);
        renderer.dispose(); assert.equal(snapshot, null);
        snapshot = { owner: 'new controller' }; gate.reject(new Error('stale render failed'));
        await assert.rejects(pending, /stale render failed/);
        assert.deepEqual(snapshot, { owner: 'new controller' });
    });
}

test('runtime reconciliation uses the first deadline despite continuing mutations', () => {
    const source = readFileSync(new URL('../features/prompt-tools/runtime.js', import.meta.url), 'utf8');
    const start = source.indexOf('function scheduleReconcile() {');
    const scheduleSource = source.slice(start, source.indexOf('\n}', start) + 2);
    const state = { initialized: true, reconcileTimer: null, generation: 1 }, timers = [];
    let reconciles = 0;
    const schedule = new Function('runtimeState', 'setTimeout', 'reconcileRuntime', 'logger', `${scheduleSource}; return scheduleReconcile;`)(
        state, callback => { timers.push(callback); return timers.length; }, async () => { reconciles++; }, { error() {} });
    for (let i = 0; i < 200; i++) schedule();
    assert.equal(timers.length, 1); timers[0](); assert.equal(reconciles, 1);
    schedule(); state.initialized = false; state.generation++;
    timers[1](); assert.equal(reconciles, 1);
});
