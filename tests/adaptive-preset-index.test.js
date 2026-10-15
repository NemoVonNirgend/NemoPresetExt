import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPresetIndex } from '../features/preset-index/discovery.js';
import { compile } from '../features/vex-runtime/program.js';
import { programShape } from '../features/vex-runtime/program-shape.js';
import { validatePrograms, planExtraction as planVex, RESET, ASSEMBLE, KEY as VEX_KEY } from '../features/vex-runtime/format.js';
import { createVexRuntime } from '../features/vex-runtime/controller.js';
import { RecipeStore } from '../features/recipe-runtime/store.js';
import { planExtraction, selectedKey, RESOLVER_TEXT, GUARD_TEXT, RUNTIME_KEY } from '../features/recipe-runtime/format.js';
import { createRecipeRuntime } from '../features/recipe-runtime/controller.js';
import { getNemoEnginePreset, getNemoEngineAssetPaths } from '../features/preset-installer/presets.js';
import { fixture as vexFixture, harness as vexHarness, Events, TYPES, server } from './vex-runtime-fixture.mjs';

const prompt = (identifier, content, name = identifier) => ({ identifier, name, content, injection_position: 0 });
function recipeFixture() {
    const prompts = [
        prompt('nc-selection-init', '{{setvar::NCGenreId::slice_of_life}}{{setvar::NCAuthorId::nemo_manuscript}}{{setvar::NCStyleId::modern_literature}}'),
        prompt('new-genre-uuid', '{{setvar::NCGenreId::comedy}}{{setvar::GenreName::Comedy}}', 'Comedy'),
        prompt('nemo-init-recipe-index', '{{setvar::NG_slice_of_life::aa}}{{setvar::NG_comedy::ab}}{{setvar::NA_nemo_manuscript::aa}}{{setvar::NS_modern_literature::aa}}'),
        prompt('nemo-recipe-selection-sanitize', GUARD_TEXT),
        prompt('new-bank-uuid-1', '{{#if {{.NCGenreId == slice_of_life}}}}{{setvar::NPaaaaaa::original default}}{{/if}}'),
        prompt('new-bank-uuid-2', '{{#if {{.NCGenreId == comedy}}}}{{setvar::NPabaaaa::original comedy}}{{/if}}'),
        prompt('nc-writing-resolver', RESOLVER_TEXT),
    ];
    return { prompts, prompt_order: [{ character_id: 100001, order: prompts.map(p => ({ identifier: p.identifier, enabled: true })) }], extensions: { regex_scripts: [{ scriptName: 'keep' }] } };
}
async function bundledFull() {
    const entry = getNemoEnginePreset('full');
    return JSON.parse((await Promise.all(getNemoEngineAssetPaths(entry).map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')))).join(''));
}
function rename(preset, names) {
    for (const p of preset.prompts) p.identifier = names[p.identifier] ?? p.identifier;
    for (const profile of preset.prompt_order) for (const e of profile.order) e.identifier = names[e.identifier] ?? e.identifier;
}

test('wiki headings and selector fields identify Vexes/genres independently of versioned IDs and names', () => {
    const prompts = [
        prompt('header', '', '=== Story controls ==='), prompt('vex-header', '', '<Narrators>'),
        prompt('uuid-v13', '{{setvar::NVCR1_raw_new_vex_2::1}}', 'A new Vex'),
        prompt('writing-header', '', '<Writing>'),
        prompt('genre-uuid', '{{// @category Writing }}{{setvar::NCGenreId::mystery}}{{setvar::NCAuthorId::new_author}}{{setvar::NCStyleId::new_style}}', 'A renamed option'),
    ];
    const preset = { prompts: [...prompts].reverse(), prompt_order: [{ character_id: '100001', order: prompts.map(p => ({ identifier: p.identifier, enabled: true })) }] };
    const original = JSON.stringify(preset), index = buildPresetIndex(preset);
    assert.equal(index.dialect, 'nemo-wiki');
    assert.equal(index.vexes[0].id, 'uuid-v13');
    assert.equal(index.vexes[0].flag, 'NVCR1_raw_new_vex_2');
    assert.equal(index.vexes[0].groupId, 'vex-header');
    assert.equal(index.genres[0].value, 'mystery');
    assert.equal(index.authors[0].value, 'new_author');
    assert.equal(index.styles[0].value, 'new_style');
    assert.equal(index.groups[2].parentId, 'header');
    assert.equal(JSON.stringify(preset), original);
});

test('discovery tolerates incomplete structure and reports missing/duplicate IDs without dropping other entries', () => {
    assert.equal(buildPresetIndex({ prompts: null, prompt_order: {} }).promptCount, 0);
    const p = prompt('vex', '{{setvar::NVCR1_raw_bubbly::1}}');
    const index = buildPresetIndex({ prompts: [null, p, { ...p }], prompt_order: [{ order: [null, { identifier: 'missing' }] }] });
    assert.equal(index.vexes.length, 1);
    assert.equal(index.issues.length, 3);
});

test('renamed genre selectors and recipe partitions resolve correctly and retain exact portable exports', async () => {
    const original = recipeFixture(), io = server(), store = new RecipeStore({ fetchFn: io.fetchFn });
    const plan = planExtraction(original);
    assert.equal(selectedKey(original, original.prompt_order[0].order), 'NPabaaaa');
    assert.deepEqual(plan.banks.map(p => p.identifier), ['new-bank-uuid-1', 'new-bank-uuid-2']);
    const compact = await store.extract(original, plan);
    const manifest = await store.manifest(compact);
    assert.equal(await store.selected(manifest, 'NPabaaaa'), '{{setvar::NPabaaaa::original comedy}}');
    assert.deepEqual(await store.restore(compact), original);
});

test('content discovery does not permit a selector to overwrite the recipe index or stored recipes', () => {
    const p = recipeFixture();
    p.prompts.find(p => p.identifier === 'new-genre-uuid').content += '{{setvar::NG_comedy::zz}}';
    assert.throws(() => planExtraction(p), /stored library or index/);
});

test('discovering a renamed partition does not relax its native macro guard grammar', () => {
    const p = recipeFixture();
    p.prompts.find(p => p.identifier === 'new-bank-uuid-1').content = p.prompts.find(p => p.identifier === 'new-bank-uuid-1').content.replace('#if ', '#if\u2800');
    assert.throws(() => planExtraction(p), /unsupported partition guard/);
});

test('a newly named Vex selector remains indexed through import, selection and native preparation', async () => {
    const f = vexFixture();
    rename(f.preset, { 'v11-300-vex-bubbly-vex': 'v13-new-selector-uuid' });
    const h = vexHarness(f);
    try {
        await h.import(); h.generate();
        assert.equal(h.state.VexPersona, 'First 🧩 original.');
    } finally { h.runtime.dispose(); }
});

test('control shapes tolerate metadata/prose edits and retain routing conditions and variable names', () => {
    const shape = text => JSON.stringify(programShape(compile(text)));
    assert.equal(shape('{{setvar::VexPersona::Old prose}}'), shape('{{// New tooltip }}\n{{setvar::VexPersona::Rewritten prose}}\n{{trim}}'));
    assert.notEqual(shape('{{setvar::NVCR1_code::1}}'), shape('{{setvar::NVCR1_code::2}}'));
    assert.notEqual(shape('{{#if {{getvar::NVCR1_raw_bubbly}}}}{{setvar::VexPersona::A}}{{/if}}'),
        shape('{{#if {{getvar::NVCR1_raw_cozy}}}}{{setvar::VexPersona::A}}{{/if}}'));
});

test('production Vex validation accepts new control hashes with the verified macro structure', async () => {
    const p = await bundledFull(), original = p.prompts.find(p => p.identifier === ASSEMBLE).content;
    p.prompts.find(p => p.identifier === ASSEMBLE).content = '{{// Future version metadata }}\n' + original + '\n{{trim}}';
    const contract = await validatePrograms(p);
    assert.equal(contract.selectors[p.prompts.find(p => p.content.includes('NVCR1_raw_bubbly::1')).identifier], 'NVCR1_raw_bubbly');
    const io = server(), plan = await planVex(p), compact = await io.store.extract(p, plan);
    assert(compact.extensions[VEX_KEY]);
    const manager = { serviceSettings: compact, activeCharacter: { id: 100001 },
        getPromptOrderForCharacter: () => compact.prompt_order.find(p => p.character_id === 100001).order,
        preparePrompt(p) { return p; }, tryGenerate() {}, import(p) { return p; }, export(p) { return p; } };
    const fresh = createVexRuntime({ events: new Events(), types: TYPES, getManager: () => manager,
        getContext: () => ({ variables: { local: { get() { return ''; }, del() {} } } }), store: io.store });
    try { assert((await fresh.ready()).characters > 0); } finally { fresh.dispose(); }
    assert.deepEqual(await io.store.restore(compact), p);
});

test('unsupported raw Vex programs import unchanged in native mode without storage writes or a serialization barrier', async () => {
    const f = vexFixture(), io = server(), original = JSON.stringify(f.preset);
    const notices = [], manager = { serviceSettings: f.preset, getPromptOrderForCharacter() { return f.preset.prompt_order[0].order; },
        preparePrompt(p) { return p; }, tryGenerate() { return 'native'; }, export(d) { return d; }, import(d) { return d; } };
    const runtime = createVexRuntime({ events: new Events(), types: TYPES, getManager: () => manager,
        getContext: () => ({ variables: { local: { get() { return ''; }, del() {} } } }), store: io.store,
        notify: (message, level) => notices.push([message, level]) });
    try {
        await runtime.importReady({ data: f.preset, presetName: 'Future Nemo' });
        assert.equal(JSON.stringify(f.preset), original);
        assert.equal(io.calls.length, 0);
        assert.equal(runtime.getStats().compatibility.mode, 'native');
        assert.equal(await manager.tryGenerate(), 'native');
        assert.equal(notices.at(-1)[1], 'warning');
    } finally { runtime.dispose(); }
});

test('unsupported raw recipe controls keep the original preset usable and report native mode', async () => {
    const p = recipeFixture(); p.prompts.find(p => p.identifier === 'nc-writing-resolver').content += '{{getvar::future_rule}}';
    const original = JSON.stringify(p), io = server(), notices = [];
    const manager = { serviceSettings: p, preparePrompt(x) { return x; }, tryGenerate() {}, import(x) { return x; }, export(x) { return x; } };
    const runtime = createRecipeRuntime({ events: new Events(), types: TYPES, getManager: () => manager,
        getContext: () => ({}), store: new RecipeStore({ fetchFn: io.fetchFn }), notify: (m, l) => notices.push([m, l]) });
    try {
        await runtime.importReady({ data: p, presetName: 'Future Nemo' });
        assert.equal(JSON.stringify(p), original);
        assert.equal(p.extensions[RUNTIME_KEY], undefined);
        assert.equal(io.calls.length, 0);
        assert.equal(runtime.getStats().compatibility.mode, 'native');
        assert.equal(notices.at(-1)[1], 'warning');
    } finally { runtime.dispose(); }
});

test('a missing Vex control does not prevent portable import or native generation', async () => {
    const f = vexFixture();
    f.preset.prompts = f.preset.prompts.filter(p => p.identifier !== RESET);
    f.preset.prompt_order[0].order = f.preset.prompt_order[0].order.filter(e => e.identifier !== RESET);
    const original = JSON.stringify(f.preset), io = server();
    const h = vexHarness(f, io, { validate: validatePrograms, planImport: planVex });
    try {
        await h.runtime.importReady({ data: f.preset });
        assert.equal(JSON.stringify(f.preset), original);
        assert.equal(io.calls.length, 0);
        assert.equal(h.runtime.getStats().compatibility.mode, 'native');
        assert.match(h.runtime.getStats().compatibility.reason, /not a supported raw Vex source layout/);
        assert.equal(await h.manager.tryGenerate(), 'native');
    } finally { h.runtime.dispose(); }
});

test('an unrecognized prompt order cannot fail import before Vex compatibility fallback', async () => {
    const f = vexFixture(), io = server();
    f.preset.prompt_order = { future_format: [] };
    const original = JSON.stringify(f.preset);
    const h = vexHarness(f, io);
    try {
        await h.runtime.importReady({ data: f.preset });
        assert.equal(JSON.stringify(f.preset), original);
        assert.equal(io.calls.length, 0);
        assert.equal(h.runtime.getStats().compatibility.mode, 'native');
        assert.equal(await h.manager.tryGenerate(), 'native');
    } finally { h.runtime.dispose(); }
});

for (const missing of ['nemo-init-recipe-index', 'nemo-recipe-selection-sanitize', 'nc-writing-resolver']) {
    test(`missing recipe structure does not prevent portable import: ${missing}`, async () => {
        const p = recipeFixture(), io = server();
        p.prompts = p.prompts.filter(p => p.identifier !== missing);
        p.prompt_order[0].order = p.prompt_order[0].order.filter(e => e.identifier !== missing);
        const original = JSON.stringify(p);
        const manager = { serviceSettings: p, preparePrompt(x) { return x; }, tryGenerate() { return 'native'; },
            import(x) { return x; }, export(x) { return x; } };
        const runtime = createRecipeRuntime({ events: new Events(), types: TYPES, getManager: () => manager,
            getContext: () => ({}), store: new RecipeStore({ fetchFn: io.fetchFn }) });
        try {
            await runtime.importReady({ data: p });
            assert.equal(JSON.stringify(p), original);
            assert.equal(io.calls.length, 0);
            assert.equal(runtime.getStats().compatibility.mode, 'native');
            assert.equal(await manager.tryGenerate(), 'native');
        } finally { runtime.dispose(); }
    });
}

test('renamed Vex control/bank IDs and a future namespace retain native source', async () => {
    const f = vexFixture(), io = server();
    const names = Object.fromEntries(f.preset.prompts.map((p, i) => [p.identifier, `future-layout-${i}`]));
    rename(f.preset, names);
    for (const p of f.preset.prompts) p.content = p.content.replaceAll('NVCR1_', 'NVCR2_').replaceAll('NVCL1_', 'NVCL2_');
    assert.equal(buildPresetIndex(f.preset).vexes.length, 2);
    const original = JSON.stringify(f.preset);
    const manager = { serviceSettings: f.preset, getPromptOrderForCharacter: () => f.preset.prompt_order[0].order,
        preparePrompt(p) { return p; }, tryGenerate() {}, export(p) { return p; }, import(p) { return p; } };
    const runtime = createVexRuntime({ events: new Events(), types: TYPES, getManager: () => manager,
        getContext: () => ({ variables: { local: { get() { return ''; }, del() {} } } }), store: io.store });
    try {
        await runtime.importReady({ data: f.preset });
        assert.equal(runtime.getStats().compatibility.mode, 'native');
        assert.equal(JSON.stringify(f.preset), original);
        assert.equal(io.calls.length, 0);
    } finally { runtime.dispose(); }
});

test('numeric/string profile IDs select the same recipe profile during import preflight', async () => {
    const p = recipeFixture(), io = server();
    const global = p.prompt_order[0]; global.character_id = '100001';
    p.prompt_order.unshift({ character_id: 100000, order: global.order.map(e => ({ ...e, enabled: e.identifier !== 'new-genre-uuid' })) });
    const manager = { serviceSettings: { prompts: [] }, activeCharacter: { id: 100001 },
        preparePrompt(p) { return p; }, tryGenerate() {}, export(p) { return p; }, import(p) { return p; } };
    const runtime = createRecipeRuntime({ events: new Events(), types: TYPES, getManager: () => manager,
        getContext: () => ({}), store: new RecipeStore({ fetchFn: io.fetchFn }) });
    try {
        await runtime.importReady({ data: p });
        assert.equal((await runtime.ready(p)).key, 'NPabaaaa');
    } finally { runtime.dispose(); }
});

test('recipe optimization composes with native Vex fallback and an exact portable export', async () => {
    const p = recipeFixture(), vex = vexFixture();
    p.prompts.push(...vex.preset.prompts);
    p.prompt_order[0].order.push(...vex.preset.prompt_order[0].order);
    const original = structuredClone(p), io = server(), events = new Events();
    const manager = { serviceSettings: p, activeCharacter: { id: 100001 }, getPromptOrderForCharacter: () => p.prompt_order[0].order,
        preparePrompt(p) { return p; }, tryGenerate() {}, export(p) { return p; }, import(p) { return p; } };
    const options = { events, types: TYPES, getManager: () => manager,
        getContext: () => ({ variables: { local: { get() { return ''; }, del() {} } } }) };
    const recipes = createRecipeRuntime({ ...options, store: new RecipeStore({ fetchFn: io.fetchFn }) });
    const vexRuntime = createVexRuntime({ ...options, store: io.store });
    try {
        await events.emit(TYPES.OAI_PRESET_IMPORT_READY, { data: p });
        assert(p.extensions[RUNTIME_KEY]);
        assert.equal(p.extensions[VEX_KEY], undefined);
        assert.equal(vexRuntime.getStats().compatibility.mode, 'native');
        const exported = structuredClone(p);
        await events.emit(TYPES.OAI_PRESET_EXPORT_READY, exported);
        assert.deepEqual(exported, original);
    } finally { vexRuntime.dispose(); recipes.dispose(); }
});
