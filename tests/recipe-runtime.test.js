import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixture, memoryServer } from './recipe-fixture.js';
import { planOffload, finishOffload, restorePortable, getManifest, RUNTIME_SOURCE } from '../features/preset-runtime/recipe-codec.js';
import { RecipeStore } from '../features/preset-runtime/recipe-store.js';

const base = new URL('../features/preset-runtime/', import.meta.url);
const wait = async predicate => {
    for (let i = 0; i < 500; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 2)); }
    throw new Error('Timed out waiting for mocked host event.');
};

async function harness(t) {
    const server = memoryServer();
    const persistence = new RecipeStore({ request: server.request });
    const originalPreset = fixture();
    const plan = planOffload(originalPreset);
    const refs = Object.create(null);
    for (const [genre, lib] of plan.libraries) refs[genre] = await persistence.persist(lib);
    const preset = finishOffload(plan, refs);
    preset.preset_settings_openai = 'fixture';
    const variables = { NCGenreId: 'slice_of_life', NCAuthorId: 'nemo_manuscript', NCStyleId: 'modern_literature',
        NG_slice_of_life: 'ao', NG_comedy: 'ac', NA_nemo_manuscript: 'as', NS_modern_literature: 'as' };
    const host = { prepared: [], generated: 0, stops: 0, nativeImports: [], nativeExports: [], errors: [] };
    const eventListeners = new Map();
    const eventSource = {
        on: (type, fn) => { if (!eventListeners.has(type)) eventListeners.set(type, new Set()); eventListeners.get(type).add(fn); },
        removeListener: (type, fn) => eventListeners.get(type)?.delete(fn),
        emit: async (type, ...args) => { for (const fn of eventListeners.get(type) ?? []) await fn(...args); },
    };
    const event_types = Object.fromEntries(['OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_EXPORT_READY', 'CHAT_COMPLETION_PROMPT_READY'].map(x => [x, x]));
    const documentListeners = new Map();
    const document = {
        addEventListener: (type, fn) => { if (!documentListeners.has(type)) documentListeners.set(type, new Set()); documentListeners.get(type).add(fn); },
        removeEventListener: (type, fn) => documentListeners.get(type)?.delete(fn),
    };
    class FakeEvent {
        constructor(type) { this.type = type; this.stopped = false; }
        preventDefault() { this.defaultPrevented = true; }
        stopImmediatePropagation() { this.stopped = true; }
    }
    const input = { id: 'openai_preset_import_file', files: [], value: '', dispatchEvent(event) {
        event.target = input;
        for (const fn of documentListeners.get(event.type) ?? []) { fn(event); if (event.stopped) break; }
        if (!event.stopped) host.nativeImports.push(input.files[0]);
    } };
    const button = { id: 'export_oai_preset', closest: () => button, dispatchEvent(event) {
        event.target = button;
        for (const fn of documentListeners.get(event.type) ?? []) { fn(event); if (event.stopped) break; }
        if (!event.stopped) {
            const exportCopy = structuredClone(preset);
            delete exportCopy.reverse_proxy; // Model native exporter endpoint-redaction choice.
            void eventSource.emit('OAI_PRESET_EXPORT_READY', exportCopy).then(() => host.nativeExports.push(exportCopy));
        }
    } };
    class FakeTransfer { constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; } }
    class FakeWorker {
        terminate() { this.dead = true; }
        postMessage(payload) {
            setImmediate(async () => {
                try {
                    const imported = JSON.parse(await payload.file.text());
                    const nextPlan = planOffload(imported);
                    if (!nextPlan) { if (!this.dead) this.onmessage({ data: { type: 'passthrough' } }); return; }
                    const nextRefs = Object.create(null);
                    for (const [genre, lib] of nextPlan.libraries) nextRefs[genre] = await persistence.persist(lib);
                    if (!this.dead) this.onmessage({ data: { type: 'result', text: JSON.stringify(finishOffload(nextPlan, nextRefs)), stats: { recipeCount: nextPlan.recipeCount } } });
                } catch (error) { if (!this.dead) this.onmessage({ data: { type: 'error', message: error.message } }); }
            });
        }
    }
    const pm = {
        serviceSettings: preset, activeCharacter: { id: 100001 },
        preparePrompt(prompt) { host.prepared.push(prompt.content); return { ...prompt, content: prompt.content.replace(/\n\{\{trim\}\}$/, '') }; },
        async tryGenerate() { host.generated++; return pm.preparePrompt(preset.prompts.find(p => p.identifier === 'nc-writing-resolver')); },
    };
    const originalPrepare = pm.preparePrompt; const originalTry = pm.tryGenerate;
    const deps = {
        eventSource, event_types, getRequestHeaders: () => ({}), main_api: 'openai', extension_settings: {},
        getContext: () => ({ variables: { local: { get: name => variables[name] } }, stopGeneration: () => host.stops++ }),
        promptManager: pm, oai_settings: preset, openai_settings: [preset], openai_setting_names: { fixture: 0 },
    };
    const key = `__nemoFixture${Math.random().toString(36).slice(2)}`;
    globalThis[key] = deps;
    const replacements = { fetch: server.request, document, Event: FakeEvent, MouseEvent: FakeEvent, Worker: FakeWorker, DataTransfer: FakeTransfer,
        toastr: { error: message => host.errors.push(message), info: () => null, success: () => {} } };
    const previous = Object.fromEntries(Object.keys(replacements).map(k => [k, globalThis[k]]));
    Object.assign(globalThis, replacements);
    const dir = mkdtempSync(join(tmpdir(), 'nemo-runtime-test-'));
    let source = readFileSync(new URL('runtime.js', base), 'utf8');
    source = source.split('\n').slice(3).join('\n'); // Replace only the three host-module imports with injected host contracts.
    source = `const { ${Object.keys(deps).join(', ')} } = globalThis[${JSON.stringify(key)}];\n` + source;
    source = source.replaceAll("'./recipe-codec.js'", JSON.stringify(new URL('recipe-codec.js', base).href));
    source = source.replaceAll("'./recipe-store.js'", JSON.stringify(new URL('recipe-store.js', base).href));
    const path = join(dir, 'runtime.mjs'); writeFileSync(path, source);
    const runtime = await import(pathToFileURL(path).href);
    t.after(() => { runtime.cleanupRecipeRuntime(); Object.assign(globalThis, previous); delete globalThis[key]; rmSync(dir, { recursive: true, force: true }); });
    runtime.initializeRecipeRuntime();
    return { server, runtime, preset, originalPreset, pm, variables, host, eventSource, input, button, FakeEvent, originalPrepare, originalTry };
}

test('mocked ST dry-run loads needed partitions then processes only one recipe', async t => {
    const h = await harness(t);
    const result = await h.pm.tryGenerate();
    assert.equal(result.content, 'Exact plain recipe.');
    assert.equal(h.host.generated, 1);
    assert.equal(h.host.prepared.length, 1);
    assert.equal(h.host.prepared[0].includes('Comic recipe'), false);
    assert.equal(h.preset.prompts.find(p => p.identifier === 'nc-writing-resolver').content, RUNTIME_SOURCE);
});

test('mocked generation preflight warms a toggled genre without executing selectors', async t => {
    const h = await harness(t);
    h.preset.prompt_order[1].order.find(p => p.identifier === 'nc-genre-comedy').enabled = true;
    let aborted = false;
    await h.runtime.recipeGenerationPreflight([], 8000, () => { aborted = true; }, 'normal');
    assert.equal(h.host.prepared.length, 0);
    h.variables.NCGenreId = 'comedy';
    const result = h.pm.preparePrompt(h.preset.prompts.find(p => p.identifier === 'nc-writing-resolver'));
    assert.equal(result.content, 'Comic recipe.'); assert.equal(aborted, false);
});

test('missing durable library aborts mocked real generation before context assembly', async t => {
    const h = await harness(t); h.server.files.clear();
    const calls = [];
    await h.runtime.recipeGenerationPreflight([], 8000, value => calls.push(value), 'normal');
    assert.deepEqual(calls, [true]); assert.equal(h.host.generated, 0); assert.ok(h.host.errors.length);
});

test('unexpected runtime genre mismatch requests host cancellation, never an empty replacement', async t => {
    const h = await harness(t); await h.runtime.prepareRecipeRuntime(h.preset);
    h.variables.NCGenreId = 'comedy'; // Not hinted by enabled selectors, e.g. third-party mutation.
    assert.throws(() => h.pm.preparePrompt(h.preset.prompts.find(p => p.identifier === 'nc-writing-resolver')), /not ready/);
    assert.equal(h.host.stops, 1); assert.equal(h.host.prepared.length, 0);
});

test('native input interception waits for durable writes and forwards only the slim file', async t => {
    const h = await harness(t);
    const file = new File([JSON.stringify(h.originalPreset)], 'renamed-full.json');
    h.input.files = [file]; h.input.dispatchEvent(new h.FakeEvent('input'));
    assert.equal(h.host.nativeImports.length, 0);
    await wait(() => h.host.nativeImports.length === 1);
    const accepted = h.host.nativeImports[0];
    assert.equal(accepted.name, file.name);
    const saved = JSON.parse(await accepted.text());
    assert.ok(getManifest(saved)); assert.equal(saved.prompts.length, h.preset.prompts.length);
    assert.equal((await accepted.text()).includes('Exact plain recipe.'), false);
});

test('native input interception leaves unrelated file byte-for-byte unchanged', async t => {
    const h = await harness(t); const file = new File(['{ "prompts": [], "custom": true }'], 'other.json');
    h.input.files = [file]; h.input.dispatchEvent(new h.FakeEvent('input'));
    await wait(() => h.host.nativeImports.length === 1);
    assert.equal(h.host.nativeImports[0], file);
});

test('failed offload never resumes native import', async t => {
    const h = await harness(t); h.server.setMode('offline');
    h.input.files = [new File([JSON.stringify(h.originalPreset)], 'full.json')];
    h.input.dispatchEvent(new h.FakeEvent('input'));
    await wait(() => h.host.errors.length > 0);
    assert.equal(h.host.nativeImports.length, 0);
});

test('native export restores recipes after native endpoint redaction', async t => {
    const h = await harness(t);
    h.button.dispatchEvent(new h.FakeEvent('click'));
    assert.equal(h.host.nativeExports.length, 0);
    await wait(() => h.host.nativeExports.length === 1);
    const exported = h.host.nativeExports[0];
    assert.equal(getManifest(exported), null);
    assert.equal(exported.prompts.length, h.originalPreset.prompts.length);
    assert.equal('reverse_proxy' in exported, false);
    assert.equal(getManifest(h.preset).schema, 'nemo-recipes/1');
});

test('missing archive blocks native export before its download handler runs', async t => {
    const h = await harness(t); h.server.files.clear();
    h.button.dispatchEvent(new h.FakeEvent('click'));
    await wait(() => h.host.errors.length > 0);
    assert.equal(h.host.nativeExports.length, 0);
});

test('non-native failed export event emits an explicit error document, not a broken preset', async t => {
    const h = await harness(t); h.server.files.clear();
    const exportCopy = structuredClone(h.preset);
    await h.eventSource.emit('OAI_PRESET_EXPORT_READY', exportCopy);
    assert.equal('prompts' in exportCopy, false); assert.ok(exportCopy.nemoExportError);
    assert.ok(getManifest(h.preset));
});

test('cleanup is idempotent and restores only wrappers owned by this runtime', async t => {
    const h = await harness(t); h.runtime.initializeRecipeRuntime();
    assert.notEqual(h.pm.preparePrompt, h.originalPrepare);
    const foreign = () => 'foreign'; h.pm.tryGenerate = foreign;
    h.runtime.cleanupRecipeRuntime(); h.runtime.cleanupRecipeRuntime();
    assert.equal(h.pm.preparePrompt, h.originalPrepare);
    assert.equal(h.pm.tryGenerate, foreign);
    assert.equal(globalThis.NemoPresetExtRecipePreflight, undefined);
});


test('a failed optimized preset does not stop later unrelated generations', async t => {
    const h = await harness(t);
    h.server.files.clear();
    await h.runtime.recipeGenerationPreflight([], 8000, () => {}, 'normal');
    delete h.preset.extensions.nemoRecipeRuntime;
    await h.runtime.recipeGenerationPreflight([], 8000, () => assert.fail('unrelated preset aborted'), 'normal');
    await h.eventSource.emit('CHAT_COMPLETION_PROMPT_READY', {});
    assert.equal(h.host.stops, 0);
});
