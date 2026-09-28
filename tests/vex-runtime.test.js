import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, execute, truthy } from '../features/vex-runtime/program.js';
import { BANKS, KEY, RESET, RESOLVE, ASSEMBLE, parseBank, dependencies, planExtraction, validatePrograms, loader, digest, blockSerialization, checkOrder, selectorValue } from '../features/vex-runtime/format.js';
import { VexStore, checkedPath } from '../features/vex-runtime/store.js';
import { createVexRuntime } from '../features/vex-runtime/controller.js';

import { fixture, server, harness } from './vex-fixture.mjs';
const s = (key, value) => `{{setvar::${key}::${value}}}`;

for (const value of ['', '0', 'false', 'off', 'no']) test(`preflight preserves native false value ${JSON.stringify(value)}`, () => assert.equal(truthy(value), false));
test('restricted program handles nested dynamic names, comparisons, scoped setters and branch order', () => {
    const state = {};
    execute(compile(s('n', '2') + s('v2', 'first') + '{{#if {{.n > 1}}}}' + '{{#setvar::result}} {{getvar::v{{getvar::n}}}}\n{{/setvar}}{{else}}bad{{/if}}'), state);
    assert.equal(state.result, ' first\n');
});
for (const source of ['{{evil::x}}', '{{#if 1}}x', '{{/if}}', '{{.x = 2}}', '{{setvar::x}}']) test(`rejects unsupported preflight syntax ${source}`, () => assert.throws(() => compile(source)));
test('preflight never mutates an external variables object', () => {
    const external = { counter: 9 }; const local = { ...external };
    execute(compile('{{addvar::counter::1}}'), local);
    assert.equal(external.counter, 9); assert.equal(local.counter, '10');
});
test('literal parser preserves exact scoped bytes, Unicode and blank inline entries', () => {
    const p = { identifier: BANKS[3], content: '{{// a }}{{#setvar::NVCL1_text_a}}\n  café 🧩\n{{/setvar}}{{setvar::NVCL1_empty::}}' };
    const e = parseBank(p); assert.equal(e[0].value, '\n  café 🧩\n'); assert.equal(e[1].value, ''); assert.equal(e[0].statement, p.content.slice(e[0].start, e[0].end));
});
for (const content of ['{{setvar::NVCL1_x::{{char}}}}', '{{setvar::Other::1}}', '{{setvar::NVCL1_x::1}}{{setvar::NVCL1_x::2}}', '{{#if 1}}x{{/if}}']) test(`rejects nonliteral or duplicate library ${content}`, () => assert.throws(() => parseBank({ identifier: BANKS[0], content })));
test('unknown program fingerprints cannot be optimized', async () => assert.rejects(validatePrograms(fixture().preset), /unsupported or edited/));
test('unknown selector syntax is not interpreted as a selection', () => assert.throws(() => selectorValue('{{addvar::NVCR1_raw_x::1}}')));
test('disabled and misordered library slots are rejected', () => {
    const f = fixture(); const order = structuredClone(f.preset.prompt_order[0].order); order[1].enabled = false;
    assert.throws(() => checkOrder(f.preset, order, f.contract.selectors));
});
test('family membership selects different data without changing the canonical program', () => {
    const f = fixture(), before = structuredClone(f.contract.programs);
    const a = dependencies(f.preset, f.preset.prompt_order[0].order, f.contract, f.plan);
    f.preset.prompt_order[0].order.find(e => e.identifier.includes('cozy')).enabled = true;
    const b = dependencies(f.preset, f.preset.prompt_order[0].order, f.contract, f.plan);
    assert(a.reads.has('NVCL1_text_one')); assert(b.reads.has('NVCL1_text_master')); assert(!b.reads.has('NVCL1_text_one'));
    assert.deepEqual(f.contract.programs, before);
});
test('durable extraction changes only bank contents and runtime metadata; export is exact', async () => {
    const f = fixture(), d = server(), before = structuredClone(f.preset);
    const compact = await d.store.extract(f.preset, f.plan);
    assert.deepEqual(f.preset, before);
    const fresh = new VexStore({ fetchFn: d.fetchFn });
    assert.deepEqual(await fresh.restore(compact), before);
    assert.deepEqual(compact.prompt_order, before.prompt_order); assert.deepEqual(compact.extensions.regex_scripts, before.extensions.regex_scripts);
});
test('identical imports deduplicate all durable writes', async () => {
    const f = fixture(), d = server(); await d.store.extract(f.preset, f.plan);
    const writes = d.calls.filter(c => c.url === '/api/files/upload').length;
    await d.store.extract(f.preset, f.plan);
    assert.equal(d.calls.filter(c => c.url === '/api/files/upload').length, writes);
});
test('a modified literal is preserved and not replaced by a bundled version', async () => {
    const f = fixture(), d = server(); f.plan.banks[3].content = f.plan.banks[3].content.replace('Original one.', 'User changed.');
    const compact = await d.store.extract(f.preset, f.plan);
    assert.equal((await d.store.restore(compact)).prompts.find(p => p.identifier === BANKS[3]).content, f.plan.banks[3].content);
});
test('fresh runtime loads the manifest and selected banks, retaining only selected setters', async () => {
    const f = fixture(), d = server(), compact = await d.store.extract(f.preset, f.plan);
    const m = await d.store.manifest(compact), selection = dependencies(compact, compact.prompt_order[0].order, f.contract, m);
    d.calls.length = 0;
    const loaded = await d.store.selected(m, selection.reads);
    assert.equal(d.calls.length, 2);
    assert(!Object.values(loaded.bodies).join('').includes('Original two.'));
    assert(!Object.values(loaded.bodies).join('').includes('Family master.'));
});
test('native preparation receives original selected setters and the unchanged resolver/assembler', async () => {
    const f = fixture(), d = server(), h = harness(f, d);
    await h.runtime.importReady({ data: f.preset }); await h.runtime.ready(); h.generate();
    assert.equal(h.state.VexPersona, 'Original one.');
    assert.equal(h.state.NVCL1_text_two, undefined);
    assert(h.prepared.includes(f.preset.prompts.find(p => p.identifier === RESOLVE).content));
    assert(h.prepared.includes(f.preset.prompts.find(p => p.identifier === ASSEMBLE).content));
    assert.equal(h.stops(), 0); h.runtime.dispose();
});
test('warm readiness reuses one route without new reads', async () => {
    const f = fixture(), d = server(), h = harness(f, d); await h.runtime.importReady({ data: f.preset }); await h.runtime.ready();
    const reads = d.calls.length; await h.runtime.ready(); assert.equal(d.calls.length, reads); assert.equal(h.runtime.getStats().cachedRoutes, 1); h.runtime.dispose();
});
test('selection changes drop old text and remove stale raw library values', async () => {
    const f = fixture(), d = server(), h = harness(f, d); await h.runtime.importReady({ data: f.preset }); await h.runtime.ready(); h.generate();
    f.preset.prompt_order[0].order.find(e => e.identifier.includes('cozy')).enabled = true;
    await h.runtime.ready(); h.generate();
    assert.equal(h.state.VexPersona, 'Family master.'); assert.equal(h.state.NVCL1_text_one, undefined); h.runtime.dispose();
});
test('late toggle cannot use an old selection', async () => {
    const f = fixture(), d = server(), h = harness(f, d); await h.runtime.importReady({ data: f.preset }); await h.runtime.ready();
    f.preset.prompt_order[0].order.find(e => e.identifier.includes('cozy')).enabled = true;
    assert.throws(() => h.generate(), /not ready/); assert(h.stops() > 0); h.runtime.dispose();
});
test('a native variable divergence blocks final serialization, even if events swallow errors', async () => {
    const f = fixture(), d = server(), h = harness(f, d); await h.runtime.importReady({ data: f.preset }); await h.runtime.ready();
    for (const e of f.preset.prompt_order[0].order) {
        if (e.identifier === RESOLVE) break;
        if (e.enabled) h.manager.preparePrompt(f.preset.prompts.find(p => p.identifier === e.identifier));
    }
    h.state.NVCR1_raw_cozy = '1';
    assert.throws(() => h.manager.preparePrompt(f.preset.prompts.find(p => p.identifier === RESOLVE)), /selector state/);
    const request = {}; await h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.throws(() => JSON.stringify(request)); h.runtime.dispose();
});
test('missing storage blocks dry run and real preflight', async () => {
    const f = fixture(), d = server(), h = harness(f, d); await h.runtime.importReady({ data: f.preset }); d.disk.clear();
    assert.equal(await h.manager.tryGenerate(), undefined);
    let aborted = false; assert.equal(await h.runtime.preflight([], 0, () => { aborted = true; }, 'normal'), false);
    assert(aborted); h.runtime.dispose();
});
test('corrupt storage blocks export without producing a partial portable file', async () => {
    const f = fixture(), d = server(), h = harness(f, d); await h.runtime.importReady({ data: f.preset });
    d.disk.set(f.preset.extensions[KEY].manifest.path, '{}');
    const copy = structuredClone(f.preset); await h.events.emit(h.types.OAI_PRESET_EXPORT_READY, copy);
    assert.throws(() => JSON.stringify(copy), /checksum/); h.runtime.dispose();
});
test('failed read-back keeps imported source complete and stops serialization', async () => {
    const f = fixture(), d = server(), h = harness(f, d), original = structuredClone(f.preset);
    d.store.write = async () => { throw new Error('disk full'); };
    await assert.rejects(h.runtime.importReady({ data: f.preset }), /disk full/);
    assert.deepEqual(f.preset.prompts, original.prompts); assert.throws(() => JSON.stringify(f.preset)); h.runtime.dispose();
});
test('partial exports restore included data without inflating the active copy', async () => {
    const f = fixture(), d = server(), h = harness(f, d), original = f.plan.banks[0].content;
    await h.runtime.importReady({ data: f.preset });
    const data = await h.manager.export({ prompts: [f.preset.prompts.find(p => p.identifier === BANKS[0])], prompt_order: [] });
    assert.equal(data.prompts[0].content, original); assert.equal(f.preset.prompts.find(p => p.identifier === BANKS[0]).content, loader(BANKS[0])); h.runtime.dispose();
});
test('partial library import cannot bypass durable extraction', async () => {
    const f = fixture(), d = server(), h = harness(f, d);
    assert.equal(h.manager.import({ data: { prompts: f.plan.banks } }), undefined); h.runtime.dispose();
});
test('edited loader cannot silently execute or export', async () => {
    const f = fixture(), d = server(), h = harness(f, d); await h.runtime.importReady({ data: f.preset }); f.preset.prompts.find(p => p.identifier === BANKS[0]).content = 'edited';
    await assert.rejects(h.runtime.ready(), /loader changed/); await assert.rejects(d.store.restore(f.preset), /loader edited/); h.runtime.dispose();
});
for (const path of ['https://evil.example/file', '/files/../x', '//evil.example/file', '/api/settings/get']) test(`storage path rejected: ${path}`, () => assert.throws(() => checkedPath({ path, sha256: 'a'.repeat(64) })));
test('storage uses same-origin authenticated requests and rejects redirects', async () => {
    const d = server(); await d.store.write({ example: 'data' });
    for (const call of d.calls) { assert.equal(call.options.credentials, 'same-origin'); assert.equal(call.options.redirect, 'error'); }
    assert.equal(d.calls.find(c => c.url === '/api/files/upload').options.headers['X-CSRF-Token'], 'fixture');
});
test('late async results cannot revive a disposed runtime', async () => {
    const f = fixture(), d = server(), h = harness(f, d); await h.runtime.importReady({ data: f.preset });
    const pending = h.runtime.ready(); h.runtime.dispose(); await assert.rejects(pending); assert.equal(h.runtime.getStats().cachedRoutes, 0);
});
test('cleanup restores owned methods and removes listeners, preserving later wrappers', () => {
    const f = fixture(), d = server(), h = harness(f, d); const later = () => 'later'; h.manager.preparePrompt = later;
    h.runtime.dispose(); assert.equal(h.manager.preparePrompt, later); assert.equal([...h.events.listeners.values()].flat().length, 0);
});
test('Lite and unrelated imports are unchanged', async () => {
    const f = fixture(), d = server(), h = harness(f, d), lite = { prompts: [{ identifier: 'normal', content: 'keep' }], extensions: {} }, before = structuredClone(lite);
    await h.runtime.importReady({ data: lite }); assert.deepEqual(lite, before); h.runtime.dispose();
});
test('serialization barrier is nonenumerable and stops nested requests', () => {
    const p = { keep: 1 }; blockSerialization(p, new Error('stop')); assert.deepEqual(Object.keys(p), ['keep']); assert.throws(() => JSON.stringify({ preset: p }), /stop/);
});
test('digest preserves exact Unicode and whitespace', async () => assert.notEqual(await digest('é\n'), await digest('é')));

// A content hash confirms bytes, not the authority to delete unrelated variables.
test('an imported manifest cannot authorize deletion outside the Vex namespace', async () => {
    const f = fixture(), d = server(), compact = await d.store.extract(f.preset, f.plan);
    const manifest = await d.store.manifest(compact);
    manifest.locations.personalSecret = [0, 0, 1]; manifest.probes.personalSecret = '1';
    compact.extensions[KEY].manifest = await d.store.write(manifest); compact.extensions[KEY].entries++;
    await assert.rejects(d.store.manifest(compact), /namespace/);
});
test('extra unbacked dependency probes are rejected', async () => {
    const f = fixture(), d = server(), compact = await d.store.extract(f.preset, f.plan);
    const manifest = await d.store.manifest(compact); manifest.probes.NVCL1_extra = '1';
    compact.extensions[KEY].manifest = await d.store.write(manifest);
    await assert.rejects(d.store.manifest(compact), /count mismatch/);
});
