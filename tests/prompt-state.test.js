import test from 'node:test';
import assert from 'node:assert/strict';
import { readOrderedState, snapshotIds, planSnapshot, buildSectionIndex } from '../features/prompt-rendering/state-model.js';
import { installStateSnapshots } from '../features/prompt-rendering/state-snapshots.js';

const classify = name => {
    const text = name.trim();
    const sub = /^<\s*(.+?)\s*>$/.exec(text);
    if (sub) return { isDivider: true, isSubHeader: true, name: sub[1].trim() };
    const main = /^===\s*(.*?)\s*===$/.exec(text);
    return main ? { isDivider: true, isSubHeader: false, name: main[1] }
        : { isDivider: false, isSubHeader: false };
};
function manager(names = ['=== Main ===', 'First', '< Sub >', 'Second']) {
    const prompts = names.map((name, i) => ({ identifier: `id-${i}`, name,
        get content() { throw new Error('Prompt body must stay cold.'); } }));
    const order = prompts.map((p, i) => ({ identifier: p.identifier, enabled: i % 2 === 1 }));
    return { serviceSettings: { prompts }, activeCharacter: { id: 100001 }, order,
        getPromptOrderForCharacter(character) { assert.equal(character, this.activeCharacter); return this.order; },
        isPromptToggleAllowed(p) { return !classify(p.name).isDivider; } };
}
function snapshotHarness() {
    let pm = manager(), currentApi = 'openai', saved = ['existing'], states = null;
    const notices = [], errors = [], calls = [];
    const button = { disabled: true, setAttribute(k, v) { this[k] = v; } };
    const nemo = { showStatusMessage(...args) { notices.push(args); },
        takeSnapshot(...args) { calls.push(['take', this, args]); return 'native'; },
        capturePromptStates(...args) { calls.push(['capture', this, args]); return ['native']; },
        checkExistingSnapshot(...args) { calls.push(['check', this, args]); return 'checked'; },
        applySnapshot() { throw new Error('Mutation path must not be touched.'); } };
    const originals = { ...nemo };
    const storage = { getSnapshot(api) { assert.equal(api, 'openai'); return saved; },
        saveSnapshot(api, ids) { assert.equal(api, 'openai'); saved = ids; }, savePromptStates(ids) { states = ids; } };
    const adapter = installStateSnapshots({ manager: nemo, getManager: () => pm, getApi: () => currentApi, storage,
        document: { getElementById(id) { assert.equal(id, 'nemoApplySnapshotBtn'); return button; },
            querySelectorAll() { throw new Error('No row scan is allowed.'); } }, report: e => errors.push(e) });
    return { nemo, originals, adapter, storage, button, notices, errors, calls,
        get pm() { return pm; }, set pm(value) { pm = value; }, set api(value) { currentApi = value; },
        get saved() { return saved; }, set saved(value) { saved = value; }, get states() { return states; } };
}

test('ordered state comes from the active native profile, not prompt array order', () => {
    const pm = manager(); pm.order.reverse();
    assert.deepEqual(readOrderedState(pm).map(row => row.identifier), ['id-3', 'id-2', 'id-1', 'id-0']);
    assert.deepEqual(snapshotIds(readOrderedState(pm)), ['id-3', 'id-1']);
});
test('metadata snapshots contain no source, DOM, body or native entry references', () => {
    const pm = manager(), rows = readOrderedState(pm), before = JSON.stringify(rows);
    pm.serviceSettings.prompts[1].name = 'changed'; pm.order[1].enabled = false;
    assert.equal(JSON.stringify(rows), before);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['enabled', 'identifier', 'name', 'toggleAllowed']);
    assert.throws(() => { rows[0].name = 'mutated'; }, TypeError);
    assert.throws(() => rows.push({}), TypeError);
});
test('snapshot capture respects native toggle permissions, not system or marker guesses', () => {
    const pm = manager(); pm.order.forEach(e => { e.enabled = true; });
    pm.isPromptToggleAllowed = p => ['id-0', 'id-3'].includes(p.identifier);
    assert.deepEqual(snapshotIds(readOrderedState(pm)), ['id-0', 'id-3']);
});
test('unordered optional prompts do not appear in the active state', () => {
    const pm = manager(); pm.order.pop();
    assert.deepEqual(snapshotIds(readOrderedState(pm)), ['id-1']);
});
test('empty active order produces a valid empty snapshot', () => {
    const pm = manager(); pm.order = [];
    assert.deepEqual(snapshotIds(readOrderedState(pm)), []);
});
for (const [label, mutate] of [
    ['not ready', pm => { pm.activeCharacter = null; }],
    ['missing permission API', pm => { delete pm.isPromptToggleAllowed; }],
    ['duplicate source', pm => pm.serviceSettings.prompts.push(pm.serviceSettings.prompts[0])],
    ['duplicate order', pm => pm.order.push(pm.order[0])],
    ['missing source', pm => { pm.order[0].identifier = 'missing'; }],
    ['string boolean', pm => { pm.order[0].enabled = 'false'; }],
    ['invalid name', pm => { pm.serviceSettings.prompts[0].name = null; }],
    ['missing order', pm => { pm.order = undefined; }],
]) test(`invalid state fails explicitly: ${label}`, () => {
    const pm = manager(); mutate(pm); assert.throws(() => readOrderedState(pm), /Nemo prompt state/);
});
test('native permission errors propagate instead of silently omitting prompts', () => {
    const pm = manager(); pm.isPromptToggleAllowed = () => { throw new Error('permission error'); };
    assert.throws(() => readOrderedState(pm), /permission error/);
});
test('same IDs in two profiles always use the current enabled flags', () => {
    const pm = manager(); const first = snapshotIds(readOrderedState(pm));
    pm.activeCharacter = { id: 7 }; pm.order = pm.order.map(e => ({ ...e, enabled: false }));
    assert.deepEqual(first, ['id-1', 'id-3']); assert.deepEqual(snapshotIds(readOrderedState(pm)), []);
});
test('snapshot plan is non-mutating, preserves locked rows, and reports unknown saved IDs', () => {
    const rows = readOrderedState(manager()), before = JSON.stringify(rows);
    const result = planSnapshot(rows, ['id-0', 'id-3', 'obsolete', 'id-3']);
    assert.deepEqual(result.changes, [{ identifier: 'id-1', enabled: false }]);
    assert.deepEqual(result.missing, ['obsolete']); assert.deepEqual(result.locked, ['id-0']);
    assert.equal(JSON.stringify(rows), before);
});
test('empty snapshot plans disabling only currently enabled toggleable rows', () => {
    assert.deepEqual(planSnapshot(readOrderedState(manager()), []).changes,
        [{ identifier: 'id-1', enabled: false }, { identifier: 'id-3', enabled: false }]);
});
test('snapshot plans reject malformed data and do not partially apply changes', () => {
    for (const saved of [null, {}, [false], [''], [null]]) assert.throws(() => planSnapshot(readOrderedState(manager()), saved));
    assert.throws(() => snapshotIds([{ identifier: 'broken' }]));
});
test('section index retains root rows, direct members and nested children in native order', () => {
    const pm = manager(['Root', '=== Main ===', 'A', '< Sub >', 'B', '< Empty >', '=== Next ===', 'C']);
    pm.order.forEach(e => { e.enabled = true; });
    const index = buildSectionIndex(readOrderedState(pm), classify);
    assert.deepEqual(index.roots, ['id-0', 'id-1', 'id-6']);
    assert.deepEqual(index.getSection('id-1').directIds, ['id-2']);
    assert.deepEqual(index.getSection('id-1').children, ['id-3', 'id-5']);
    assert.deepEqual(index.getSection('id-1').memberIds, ['id-2', 'id-4']);
    assert.deepEqual(index.counts('id-1'), { enabled: 2, total: 2 });
    assert.deepEqual(index.counts('id-1', false), { enabled: 1, total: 1 });
    assert.deepEqual(index.counts('id-5'), { enabled: 0, total: 0 });
    assert.equal(index.parentOf('id-4'), 'id-3'); assert.equal(index.parentOf('id-3'), 'id-1');
    assert.equal(index.parentOf('id-0'), null); assert.equal(index.getSection('missing'), null);
    assert.throws(() => index.counts('missing'), /unknown section/);
});
test('orphan subheaders and duplicate display names remain distinct by stable ID', () => {
    const rows = readOrderedState(manager(['< Same >', 'A', '< Same >', 'B', '=== Same ===', 'C', '=== Same ===']));
    const index = buildSectionIndex(rows, classify);
    assert.deepEqual(index.roots, ['id-0', 'id-2', 'id-4', 'id-6']);
    assert.deepEqual(index.getSection('id-0').directIds, ['id-1']);
    assert.deepEqual(index.getSection('id-2').directIds, ['id-3']);
    assert.equal(index.getSection('id-6').total, 0);
});
test('caller supplied custom divider rules are authoritative', () => {
    const rows = readOrderedState(manager(['CUSTOM header', 'Plain']));
    const index = buildSectionIndex(rows, name => name.startsWith('CUSTOM')
        ? { isDivider: true, isSubHeader: false, name: 'Custom' } : { isDivider: false });
    assert.deepEqual(index.sectionIds, ['id-0']);
    assert.deepEqual(index.getSection('id-0').memberIds, ['id-1']);
});
test('section metadata is frozen and does not retain caller row objects', () => {
    const rows = readOrderedState(manager()).map(row => ({ ...row }));
    const index = buildSectionIndex(rows, classify); rows[1].name = 'new';
    assert.equal(index.getRow('id-1').name, 'First');
    assert.throws(() => index.getSection('id-0').memberIds.pop(), TypeError);
    assert.throws(() => { index.getRow('id-1').enabled = false; }, TypeError);
});
test('invalid classifier output is rejected without mutating rows', () => {
    const rows = readOrderedState(manager());
    for (const fn of [null, () => null, () => ({}), () => ({ isDivider: true })])
        assert.throws(() => buildSectionIndex(rows, fn));
});
test('hostile-looking identifiers are ordinary data, never object prototype keys', () => {
    const pm = manager(); pm.serviceSettings.prompts[1].identifier = '__proto__'; pm.order[1].identifier = '__proto__';
    const rows = readOrderedState(pm), index = buildSectionIndex(rows, classify);
    assert(snapshotIds(rows).includes('__proto__')); assert.equal(index.getRow('__proto__').name, 'First');
});
test('764-row synthetic preset: every ordinary member is represented with zero body reads', () => {
    const names = Array.from({ length: 764 }, (_, i) => i % 100 === 0 ? `=== Group ${i} ===`
        : i % 25 === 0 ? `< Sub ${i} >` : `Prompt ${i}`);
    const pm = manager(names), rows = readOrderedState(pm), index = buildSectionIndex(rows, classify);
    const members = index.sectionIds.flatMap(id => index.getSection(id).directIds);
    assert.equal(rows.length, 764);
    assert.equal(new Set(members).size, names.filter(name => !classify(name).isDivider).length);
    for (let i = 0; i < 100; i++) assert.deepEqual(snapshotIds(readOrderedState(pm)), snapshotIds(rows));
});
test('capture works without any prompt-list DOM and uses native flags over stale visuals', async () => {
    const h = snapshotHarness(); await h.nemo.takeSnapshot();
    assert.deepEqual(h.saved, ['id-1', 'id-3']); assert.equal(h.button.disabled, false);
    assert.equal(h.button['aria-disabled'], 'false'); assert.equal(h.calls.length, 0);
    assert.equal(h.adapter.getStats().captures, 1); h.adapter.dispose();
});
test('capturePromptStates preserves the legacy ID-array shape without row enumeration', async () => {
    const h = snapshotHarness(); assert.deepEqual(await h.nemo.capturePromptStates(), ['id-1', 'id-3']);
    assert.deepEqual(h.states, ['id-1', 'id-3']); h.adapter.dispose();
});
test('intentionally empty snapshots stay valid across button refresh', async () => {
    const h = snapshotHarness(); h.pm.order.forEach(e => { e.enabled = false; });
    await h.nemo.takeSnapshot(); assert.deepEqual(h.saved, []);
    h.nemo.checkExistingSnapshot(); assert.equal(h.button.disabled, false); h.adapter.dispose();
});
test('missing or malformed snapshots disable Apply, but a legacy nonempty snapshot remains valid', () => {
    const h = snapshotHarness();
    for (const value of [null, {}, [5], ['']]) { h.saved = value; h.nemo.checkExistingSnapshot(); assert(h.button.disabled); }
    h.saved = ['id-1']; h.nemo.checkExistingSnapshot(); assert.equal(h.button.disabled, false); h.adapter.dispose();
});
test('unavailable native state does not overwrite a good saved snapshot with visible rows', async () => {
    const h = snapshotHarness(); h.pm = null; await h.nemo.takeSnapshot();
    assert.deepEqual(h.saved, ['existing']); assert.equal(h.calls.length, 0); assert.equal(h.errors.length, 1); h.adapter.dispose();
});
test('storage refusal or throw never reports success', async () => {
    const h = snapshotHarness(); h.storage.saveSnapshot = () => false; await h.nemo.takeSnapshot();
    h.storage.savePromptStates = () => { throw new Error('storage down'); };
    assert.deepEqual(await h.nemo.capturePromptStates(), []);
    assert.equal(h.notices.some(([, level]) => level === 'success'), false); assert.equal(h.adapter.getStats().failures, 2); h.adapter.dispose();
});
test('preset switches during async storage do not update the new selection UI', async () => {
    const h = snapshotHarness(); let finish;
    h.storage.saveSnapshot = () => new Promise(resolve => { finish = resolve; });
    const work = h.nemo.takeSnapshot(); h.pm = manager(['different']); finish(); await work;
    assert.equal(h.notices.length, 0); assert.equal(h.button.disabled, true); h.adapter.dispose();
});
test('non-Chat-Completion APIs delegate unchanged with receiver, arguments and return value', async () => {
    const h = snapshotHarness(); h.api = 'textgenerationwebui';
    assert.equal(h.nemo.takeSnapshot('argument'), 'native');
    assert.deepEqual(h.nemo.capturePromptStates(7), ['native']);
    assert.equal(h.calls[0][1], h.nemo); assert.deepEqual(h.calls[0][2], ['argument']);
    assert.equal(h.adapter.getStats().nativeFallbacks, 2); h.adapter.dispose();
});
test('missing optional Apply button is safe', async () => {
    const h = snapshotHarness(); h.adapter.dispose();
    const adapter = installStateSnapshots({ manager: h.nemo, getManager: () => h.pm, getApi: () => 'openai', storage: h.storage, document: {} });
    await h.nemo.takeSnapshot(); h.nemo.checkExistingSnapshot(); assert.deepEqual(h.saved, ['id-1', 'id-3']); adapter.dispose();
});
test('teardown restores owned methods only; later wrappers remain usable and no writes follow stale calls', async () => {
    const h = snapshotHarness(), retained = h.nemo.takeSnapshot;
    const later = function (...args) { return retained.apply(this, args); }; h.nemo.takeSnapshot = later;
    h.adapter.dispose(); h.adapter.dispose();
    assert.equal(h.nemo.takeSnapshot, later); assert.equal(h.nemo.capturePromptStates, h.originals.capturePromptStates);
    assert.equal(await h.nemo.takeSnapshot(), 'native'); assert.deepEqual(h.saved, ['existing']);
    assert.equal(h.nemo.applySnapshot, h.originals.applySnapshot);
});
test('teardown during a pending save prevents stale success UI', async () => {
    const h = snapshotHarness(); let finish; h.storage.saveSnapshot = () => new Promise(r => { finish = r; });
    const work = h.nemo.takeSnapshot(); h.adapter.dispose(); finish(); await work;
    assert.equal(h.notices.length, 0);
});
