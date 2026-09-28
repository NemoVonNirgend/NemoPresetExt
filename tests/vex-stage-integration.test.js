import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { fixture, server, Events } from './vex-fixture.mjs';
import { createColdPromptRuntime } from '../features/cold-prompts/controller.js';
import { PromptBodyStore } from '../features/cold-prompts/store.js';
import { isCold } from '../features/cold-prompts/format.js';
import { createRecipeRuntime } from '../features/recipe-runtime/controller.js';
import { RecipeStore } from '../features/recipe-runtime/store.js';
import { DEFAULT_ID, INDEX_ID, GUARD_ID, RESOLVER_ID, GUARD_TEXT, RESOLVER_TEXT } from '../features/recipe-runtime/format.js';
import { createVexRuntime } from '../features/vex-runtime/controller.js';
import { KEY, BANKS, ASSEMBLE, loader } from '../features/vex-runtime/format.js';
import { compile, execute } from '../features/vex-runtime/program.js';

function setup() {
    const f = fixture(), d = server(), events = new Events();
    const writing = [
        [DEFAULT_ID, '{{setvar::NCGenreId::slice_of_life}}{{setvar::NCAuthorId::nemo_manuscript}}{{setvar::NCStyleId::modern_literature}}'],
        [INDEX_ID, '{{setvar::NG_slice_of_life::aa}}{{setvar::NA_nemo_manuscript::aa}}{{setvar::NS_modern_literature::aa}}'],
        [GUARD_ID, GUARD_TEXT],
        ['nemo-init-recipes-slice_of_life-01', '{{#if {{.NCGenreId == slice_of_life}}}}{{setvar::NPaaaaaa::EXACT RECIPE}}{{/if}}'],
        [RESOLVER_ID, RESOLVER_TEXT],
    ].map(([identifier, content]) => ({ identifier, name: identifier, content, role: 'system', system_prompt: false }));
    const other = ['nemo-user-role-character', 'v11-classic-user-message-ender', 'optional'].map(identifier => ({ identifier, name: identifier, role: 'system', system_prompt: false, content: identifier + ' exact source' }));
    f.preset.prompts = [...writing, ...f.preset.prompts, ...other];
    f.preset.preset_name = 'Nemo Engine v12 Full';
    f.preset.prompt_order[0].order = f.preset.prompts.map(p => ({ identifier: p.identifier, enabled: !['optional', 'v11-317-vex-cozy-vex'].includes(p.identifier) }));
    const original = structuredClone(f.preset), state = {};
    const types = Object.fromEntries(['OAI_PRESET_IMPORT_READY', 'OAI_PRESET_EXPORT_READY', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'APP_READY', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY'].map(x => [x, x]));
    const pm = {
        serviceSettings: f.preset, activeCharacter: { id: 100001 },
        getPromptOrderForCharacter() { return this.serviceSettings.prompt_order[0].order; },
        preparePrompt(p) { return { ...p, content: execute(compile(p.content), state) }; },
        getPromptCollection() { return this.getPromptOrderForCharacter().filter(e => e.enabled).map(e => this.preparePrompt(this.serviceSettings.prompts.find(p => p.identifier === e.identifier))); },
        async tryGenerate() { return this.getPromptCollection(); }, async saveServiceSettings() {},
        loadPromptIntoEditForm() {}, import(data) { return data; }, export(data) { return data; },
    };
    const getContext = () => ({ mainApi: 'openai', stopGeneration() {}, variables: { local: { get: k => state[k] ?? '', has: k => Object.hasOwn(state, k), del: k => { delete state[k]; } } } });
    const recipe = createRecipeRuntime({ events, types, getManager: () => pm, getContext, store: new RecipeStore({ fetchFn: d.fetchFn }) });
    let cold;
    const vex = createVexRuntime({ events, types, getManager: () => pm, getContext, store: d.store,
        readBody: p => cold.readBody(p), planImport: async () => f.plan,
        validate: async p => ({ ...f.contract, byId: new Map(p.prompts.map(x => [x.identifier, x])) }),
    });
    cold = createColdPromptRuntime({ events, types, getManager: () => pm, getContext, store: new PromptBodyStore({ fetchFn: d.fetchFn }) });
    return { f, pm, events, types, state, original, recipe, vex, cold, d,
        dispose() { cold.dispose(); vex.dispose(); recipe.dispose(); },
    };
}
test('Stages 1, 3 and 4 compose at import, native preparation and exact portable export', async () => {
    const x = setup();
    try {
        await x.events.emit(x.types.OAI_PRESET_IMPORT_READY, { data: x.pm.serviceSettings });
        assert(x.pm.serviceSettings.extensions[KEY]);
        const copy = structuredClone(x.pm.serviceSettings);
        await x.events.emit(x.types.OAI_PRESET_CHANGED_BEFORE, { preset: copy });
        x.pm.serviceSettings = copy;
        const messages = await x.pm.tryGenerate();
        assert.equal(x.state.VexPersona, 'Original one.');
        assert.equal(x.state.NPaaaaaa, 'EXACT RECIPE');
        assert(messages.some(m => m.identifier === RESOLVER_ID && m.content.includes('EXACT RECIPE')));
        assert(isCold(copy.prompts.find(p => p.identifier === 'optional')));
        assert(!isCold(copy.prompts.find(p => p.identifier === ASSEMBLE)));
        const out = structuredClone(copy);
        await x.events.emit(x.types.OAI_PRESET_EXPORT_READY, out);
        assert.deepEqual(out, x.original);
        assert.equal(copy.prompts.find(p => p.identifier === BANKS[0]).content, loader(BANKS[0]));
    } finally { x.dispose(); }
});
test('cold selector enables before Vex preflight and dependency selection updates', async () => {
    const x = setup();
    try {
        await x.events.emit(x.types.OAI_PRESET_IMPORT_READY, { data: x.pm.serviceSettings });
        await x.pm.tryGenerate();
        const selector = x.pm.serviceSettings.prompts.find(p => p.identifier.includes('cozy'));
        assert(isCold(selector));
        x.pm.getPromptOrderForCharacter().find(e => e.identifier === selector.identifier).enabled = true;
        await x.pm.tryGenerate();
        assert(!isCold(selector)); assert.equal(x.state.VexPersona, 'Family master.');
        assert.equal(x.state.NVCL1_text_one, undefined);
    } finally { x.dispose(); }
});
test('Vex import failures still prevent save after later cold-storage handlers run', async () => {
    const x = setup();
    try {
        x.d.store.write = async () => { throw new Error('Vex storage unavailable'); };
        await x.events.emit(x.types.OAI_PRESET_IMPORT_READY, { data: x.pm.serviceSettings });
        assert.throws(() => JSON.stringify(x.pm.serviceSettings));
    } finally { x.dispose(); }
});
test('entrypoint owns the Vex lifecycle between recipe/performance and cold layers', () => {
    const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
    assert(content.indexOf('initializeRecipeRuntime();') < content.indexOf('initializeVexRuntime();'));
    assert(content.indexOf('initializeVexRuntime();') < content.indexOf('initializeColdPrompts();'));
    assert(content.indexOf('cleanupColdPrompts();') < content.indexOf('cleanupVexRuntime();'));
    assert(content.indexOf('cleanupVexRuntime();') < content.indexOf('cleanupPromptPerformance();'));
});
test('Vex preflight chaining is reversible and abort does not reach the previous stage', async () => {
    const source = readFileSync(new URL('../features/vex-runtime/runtime.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '').replace(/^export /gm, '');
    const calls = []; let allow = true;
    const context = { createVexRuntime: () => ({ preflight: async () => { calls.push('vex'); return allow; }, getStats() {}, dispose() {} }),
        VexStore: class {}, eventSource: {}, event_types: {}, getRequestHeaders() {}, getContext() {}, promptManager: {}, extension_settings: {},
        nemoRecipeRuntimePreflight: async () => calls.push('recipe'), console,
    };
    const api = new Script(source + '\n({ initializeVexRuntime, cleanupVexRuntime })').runInNewContext(context);
    const original = context.nemoRecipeRuntimePreflight;
    api.initializeVexRuntime(); await context.nemoRecipeRuntimePreflight(); assert.deepEqual(calls, ['vex', 'recipe']);
    allow = false; calls.length = 0; await context.nemoRecipeRuntimePreflight(); assert.deepEqual(calls, ['vex']);
    api.cleanupVexRuntime(); assert.equal(context.nemoRecipeRuntimePreflight, original);
});
