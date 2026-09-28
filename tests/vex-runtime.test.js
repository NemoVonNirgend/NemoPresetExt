import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, server, harness, TYPES } from './vex-runtime-fixture.mjs';
import { BANKS, RESET, RESOLVE, ASSEMBLE, KEY, SCHEMA, loader, dependencies, validatePrograms,
    planExtraction, selectorValue, blockSerialization, parseBank } from '../features/vex-runtime/format.js';
import { compile, execute } from '../features/vex-runtime/program.js';
import { VexStore } from '../features/vex-runtime/store.js';
const cosy = 'v11-317-vex-cozy-vex';
const choose = (h, enabled) => { h.manager.getPromptOrderForCharacter().find(e => e.identifier === cosy).enabled = enabled; };

test('production validation refuses unknown control programs before storage', async () => {
    const f = fixture(); await assert.rejects(validatePrograms(f.preset), /unsupported or edited/);
    await assert.rejects(planExtraction(f.preset), /unsupported or edited/);
});
for (const content of ['{{incvar::x}}', '{{setvar::NVCR1_raw_bubbly::0}}', '{{setvar::NVCR1_raw_bubbly::{{random::0::1}}}}']) {
    test(`unsupported selector is rejected: ${content}`, () => assert.throws(() => selectorValue(content)));
}
test('restricted interpreter has no JavaScript, dice or unrelated macro execution', () => {
    for (const text of ['{{roll::1d20}}', '{{eval::foo}}', '{{random::a::b}}', '{{/if}}', '{{#if 1}}']) assert.throws(() => compile(text));
    assert.throws(() => execute(compile('hello'), {}, {}, new Set(), { maxSteps: 0 }), /budget/);
});
test('import uses Stage 4A source packs and leaves exact full/partial portable exports', async () => {
    const h = harness(), before = structuredClone(h.f.preset);
    await h.import();
    assert.equal(h.f.preset.extensions[KEY].schema, SCHEMA);
    assert.equal(h.io.disk.size, 7); // Five banks, source index, small runtime catalog.
    assert.deepEqual(h.f.preset.prompt_order, before.prompt_order);
    const optimized = JSON.stringify(h.f.preset);
    const exported = await h.io.store.restore(h.f.preset);
    assert.deepEqual(exported, before);
    assert.equal(JSON.stringify(h.f.preset), optimized);
    const partial = await h.manager.export({ prompts: h.f.preset.prompts.filter(p => p.identifier === BANKS[3]) });
    assert.deepEqual(partial.prompts, before.prompts.filter(p => p.identifier === BANKS[3]));
    h.runtime.dispose();
});
test('original setters, native output, source identity and unrelated variables are preserved', async () => {
    const h = harness(), raw = structuredClone(h.f.preset);
    h.state.secret = 'untouched'; h.state.NVCL1_text_2 = 'obsolete';
    await h.import(); h.generate();
    assert.equal(h.state.VexPersona, 'First 🧩 original.'); assert.equal(h.state.secret, 'untouched');
    assert.equal(h.state.NVCL1_text_2, undefined);
    for (const p of h.seen.filter(p => BANKS.includes(p.identifier))) {
        if (p.content === '{{trim}}') continue;
        const originals = new Map(parseBank(raw.prompts.find(x => x.identifier === p.identifier)).map(e => [e.name, e.statement]));
        for (const e of parseBank(p)) assert.equal(e.statement, originals.get(e.name));
    }
    assert.equal(h.runtime.getStats().cachedRoutes, 1); h.runtime.dispose();
});
test('a second same-family selection resolves through the unchanged native program', async () => {
    const h = harness(); await h.import(); h.generate(); choose(h, true); await h.runtime.ready(); h.generate();
    assert.equal(h.state.VexPersona, 'Family master.'); assert.equal(h.runtime.getStats().cachedRoutes, 1);
    assert.equal(h.runtime.getStats().loads, 2); h.runtime.dispose();
});
test('repeat preflight is a cache hit without bank fetches or native variable side effects', async () => {
    const h = harness(); await h.import(); h.state.turn = '15'; const requests = h.io.calls.length;
    await h.runtime.ready(); await h.runtime.ready();
    assert.equal(h.io.calls.length, requests); assert.deepEqual({ ...h.state }, { turn: '15' });
    assert.equal(h.runtime.getStats().cacheHits, 2); h.runtime.dispose();
});
test('changing presets drops old selected strings and does not reuse identical IDs', async () => {
    const h = harness(); await h.import();
    await h.events.emit(TYPES.OAI_PRESET_CHANGED_BEFORE, { preset: { prompts: [], prompt_order: [] } });
    h.manager.serviceSettings = { prompts: [], prompt_order: [] };
    await h.events.emit(TYPES.OAI_PRESET_CHANGED_AFTER);
    assert.equal(h.runtime.getStats().cachedRoutes, 0); h.runtime.dispose();
});
test('missing source fails before mutation and native emitter swallowing cannot save it', async () => {
    const h = harness(); h.io.store.extract = async () => { throw new Error('disk unavailable'); };
    await h.events.emit(TYPES.OAI_PRESET_IMPORT_READY, { data: h.f.preset });
    assert.ok(h.f.preset.prompts[1].content.includes('setvar'));
    assert.throws(() => JSON.stringify(h.f.preset), /disk unavailable/); h.runtime.dispose();
});
test('edited loader cannot silently export or generate', async () => {
    const h = harness(); await h.import(); h.f.preset.prompts.find(p => p.identifier === BANKS[0]).content = 'edited stub';
    await assert.rejects(h.runtime.ready(), /loader was edited/);
    const copy = structuredClone(h.f.preset); await h.events.emit(TYPES.OAI_PRESET_EXPORT_READY, copy);
    assert.throws(() => JSON.stringify(copy), /unacknowledged edit/); h.runtime.dispose();
});
test('native skipped data slot and route divergence block the final serialized request', async () => {
    const h = harness(); await h.import(); h.generate(); h.state.NVCR1_code = 'wrong';
    assert.throws(() => h.manager.preparePrompt(h.f.preset.prompts.find(p => p.identifier === ASSEMBLE)), /diverged/);
    const request = { messages: ['must not send'] }; await h.events.emit(TYPES.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.throws(() => JSON.stringify(request), /diverged/);
    assert.ok(h.stops() > 0); h.runtime.dispose();
});
test('native selector divergence is detected before resolving', async () => {
    const h = harness(); await h.import();
    for (const p of h.f.preset.prompts) { if (p.identifier === RESOLVE) break; if (p.identifier !== cosy) h.manager.preparePrompt(p); }
    h.state.NVCR1_raw_cozy = '1';
    assert.throws(() => h.manager.preparePrompt(h.f.preset.prompts.find(p => p.identifier === RESOLVE)), /selection diverged/);
    h.runtime.dispose();
});
test('data slots cannot be skipped even when previous variables look valid', async () => {
    const h = harness(); await h.import(); h.generate();
    h.manager.preparePrompt(h.f.preset.prompts.find(p => p.identifier === RESET));
    assert.throws(() => h.manager.preparePrompt(h.f.preset.prompts.find(p => p.identifier === RESOLVE)), /skipped or reordered/);
    h.runtime.dispose();
});
test('missing selected bank prevents dry run and preflight; no fallback text', async () => {
    const h = harness(); await h.import(); const m = await h.io.store.manifest(h.f.preset);
    h.io.disk.delete(m.sourceIndex.banks[4].path); choose(h, true);
    assert.equal(await h.manager.tryGenerate(), undefined);
    let aborted = false; assert.equal(await h.runtime.preflight([], 1, () => { aborted = true; }, 'normal'), false);
    assert.equal(aborted, true); h.runtime.dispose();
});
test('missing unselected bank still blocks portable export from a fresh store', async () => {
    const h = harness(); await h.import(); const m = await h.io.store.manifest(h.f.preset);
    h.io.disk.delete(m.sourceIndex.banks[2].path);
    await assert.rejects(new VexStore({ fetchFn: h.io.fetchFn }).restore(h.f.preset), /unavailable/); h.runtime.dispose();
});
test('rehashed probe corruption is checked against selected source', async () => {
    const h = harness(); await h.import(); const descriptor = h.f.preset.extensions[KEY];
    const m = await h.io.store.sources.read(descriptor.manifest); m.probes.NVCR1_map_happy_10 = '3';
    descriptor.manifest = await h.io.store.sources.write(m);
    await assert.rejects(h.runtime.ready(), /probe mismatch/); h.runtime.dispose();
});
test('catalog count, schema and control fingerprint corruptions are rejected', async () => {
    const h = harness(); await h.import(); const good = structuredClone(h.f.preset.extensions[KEY]);
    for (const modify of [d => d.schema = 'future', d => d.entries++, d => d.manifest.path = '/api/settings/get']) {
        const d = structuredClone(good); modify(d); h.f.preset.extensions[KEY] = d;
        await assert.rejects(h.runtime.ready());
    }
    h.runtime.dispose();
});
test('partial raw/optimized library import is rejected without touching native state', async () => {
    const h = harness(); const raw = structuredClone(h.f.preset.prompts[1]); await h.import();
    assert.equal(h.manager.import({ data: { prompts: [raw] } }), undefined);
    assert.equal(h.manager.import({ data: { prompts: [h.f.preset.prompts[1]] } }), undefined);
    assert.equal(h.notices.filter(([, l]) => l === 'error').length, 2); h.runtime.dispose();
});
test('runtime still services stored references when automatic conversion is disabled', async () => {
    const f = fixture(), io = server(); f.preset = await io.store.extract(f.preset, await f.planImport(f.preset));
    const h = harness(f, io, { autoExtract: () => false }); await h.runtime.ready(); h.generate();
    assert.equal(h.state.VexPersona, 'First 🧩 original.'); h.runtime.dispose();
});
test('Lite/unrelated imports are unchanged and make no writes', async () => {
    const h = harness(), lite = { preset_name: 'Lite', prompts: [], prompt_order: [] }; const before = JSON.stringify(lite);
    await h.runtime.importReady({ data: lite }); assert.equal(JSON.stringify(lite), before);
    assert.equal(h.io.calls.length, 0); h.runtime.dispose();
});
test('missing native APIs refuse optimized import without changing source', async () => {
    const h = harness(); delete h.context.variables.local.del;
    await assert.rejects(h.runtime.importReady({ data: h.f.preset }), /API unavailable/);
    assert.equal(h.io.calls.length, 0); assert.ok(h.f.preset.prompts[1].content.includes('setvar')); h.runtime.dispose();
});
for (const id of [RESET, ...BANKS, RESOLVE, ASSEMBLE, cosy]) test(`non-native injection placement rejected: ${id}`, async () => {
    const h = harness(); await h.import();
    h.f.preset.prompts.find(p => p.identifier === id).injection_position = 1;
    if (id === cosy) choose(h, true);
    await assert.rejects(h.runtime.ready(), /unsupported Vex slot|boundary/); h.runtime.dispose();
});
test('in-flight selection edits never publish an obsolete route', async () => {
    const h = harness(); await h.import(); choose(h, true);
    const original = h.io.store.selected.bind(h.io.store); let release;
    h.io.store.selected = async (...args) => { await new Promise(resolve => { release = resolve; }); return original(...args); };
    const work = h.runtime.ready(); while (!release) await new Promise(resolve => setTimeout(resolve, 0));
    choose(h, false); release(); await assert.rejects(work, /changed during loading/);
    assert.equal(h.runtime.getStats().rejectedStale, 1); h.runtime.dispose();
});
test('mutating imported source during upload cannot discard the newer text', async () => {
    const h = harness(), original = h.io.store.extract.bind(h.io.store);
    h.io.store.extract = async (...args) => { const compact = await original(...args); h.f.preset.prompts[1].content += 'new edit'; return compact; };
    await assert.rejects(h.runtime.importReady({ data: h.f.preset }), /preset changed/);
    assert.ok(h.f.preset.prompts[1].content.endsWith('new edit')); h.runtime.dispose();
});
test('disposal rejects in-flight loads and restores only owned methods/listeners', async () => {
    const h = harness(); await h.import(); const wrapped = h.manager.preparePrompt;
    h.manager.preparePrompt = (...args) => wrapped.apply(h.manager, args);
    h.runtime.dispose(); assert.notEqual(h.manager.preparePrompt, h.original.preparePrompt);
    assert.equal(h.manager.tryGenerate, h.original.tryGenerate);
    assert.equal([...h.events.listeners.values()].flat().length, 0);
    await assert.rejects(h.runtime.ready(), /stopped/);
});
test('text completion does not preload inactive Chat Completion libraries', async () => {
    const h = harness(); h.context.mainApi = 'textgenerationwebui';
    assert.equal(await h.runtime.preflight([], 1, () => assert.fail(), 'normal'), true);
    assert.equal(h.io.calls.length, 0); h.runtime.dispose();
});
test('swipe trigger preparation respects generation type without touching story counters', async () => {
    const h = harness(); await h.import();
    h.f.preset.prompts.find(p => p.identifier === cosy).injection_trigger = ['swipe']; choose(h, true);
    await h.runtime.preflight([], 1, () => assert.fail(), 'swipe'); h.generate('swipe');
    assert.equal(h.state.VexPersona, 'Family master.');
    await h.runtime.preflight([], 1, () => assert.fail(), 'normal'); h.generate();
    assert.equal(h.state.VexPersona, 'First 🧩 original.'); h.runtime.dispose();
});
test('disable both Vex controls contributes no selected setter payload', async () => {
    const h = harness(); await h.import();
    for (const e of h.manager.getPromptOrderForCharacter()) if ([RESOLVE, ASSEMBLE].includes(e.identifier)) e.enabled = false;
    await h.runtime.ready(); h.generate(); assert.equal(h.runtime.getStats().selectedAssignments, 0);
    const req = {}; await h.events.emit(TYPES.CHAT_COMPLETION_SETTINGS_READY, req); assert.equal(JSON.stringify(req), '{}'); h.runtime.dispose();
});
test('export preserves reordered prompts, renamed banks and unrelated post-import edits', async () => {
    const h = harness(); await h.import(); h.f.preset.prompts.reverse();
    h.f.preset.prompts.find(p => p.identifier === BANKS[0]).name = 'My maps';
    const exported = await h.io.store.restore(h.f.preset);
    assert.deepEqual(exported.prompts.map(p => p.identifier), h.f.preset.prompts.map(p => p.identifier));
    assert.equal(exported.prompts.find(p => p.identifier === BANKS[0]).name, 'My maps'); h.runtime.dispose();
});
test('serialization failure is non-enumerable and cannot be swallowed into JSON', () => {
    const p = { x: 1 }; blockSerialization(p, new Error('blocked'));
    assert.deepEqual(Object.keys(p), ['x']); assert.throws(() => JSON.stringify({ p }), /blocked/);
});

test('unrelated raw helper requests do not require a Vex assembly pass', async () => {
    const h = harness(); await h.import();
    const rawRequest = { messages: [{ role: 'user', content: 'utility' }] };
    await h.events.emit(TYPES.CHAT_COMPLETION_SETTINGS_READY, rawRequest);
    assert.doesNotThrow(() => JSON.stringify(rawRequest)); h.runtime.dispose();
});
test('a tracked real generation cannot bypass the native Vex pass entirely', async () => {
    const h = harness(); await h.import();
    await h.events.emit(TYPES.GENERATION_STARTED, 'normal', {}, false);
    const req = {}; await h.events.emit(TYPES.CHAT_COMPLETION_SETTINGS_READY, req);
    assert.throws(() => JSON.stringify(req), /did not finish/); h.runtime.dispose();
});
test('native request validation resets on generation end, leaving helper calls usable', async () => {
    const h = harness(); await h.import(); h.generate();
    await h.events.emit(TYPES.GENERATION_ENDED); choose(h, true);
    const req = {}; await h.events.emit(TYPES.CHAT_COMPLETION_SETTINGS_READY, req);
    assert.equal(JSON.stringify(req), '{}'); h.runtime.dispose();
});
