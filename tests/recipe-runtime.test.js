import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RUNTIME_KEY, RESOLVER_ID, RESOLVER_TEXT, LOADER_TEXT, GUARD_TEXT, selectedKey, parseBank, planExtraction, compactPreset, restorePreset, blockSerialization } from '../features/recipe-runtime/format.js';
import { RecipeStore, checkedPath, digest } from '../features/recipe-runtime/store.js';
import { createRecipeRuntime } from '../features/recipe-runtime/controller.js';

const p = (identifier, content) => ({ identifier, content, name: identifier, role: 'system', system_prompt: false, marker: false, injection_trigger: [] });
const bank = (genre, key, text, scoped = false) => p(`nemo-init-recipes-${genre}-01`, `{{#if {{.NCGenreId == ${genre}}}}}{{// @category Variable-Init }}\n${scoped ? `{{#setvar::${key}}}${text}{{/setvar}}` : `{{setvar::${key}::${text}}}`}\n{{trim}}{{/if}}`);
function fixture() {
    const prompts = [p('main', 'Retain this exact prompt.'), p('nc-selection-init', '{{setvar::NCGenreId::slice_of_life}}{{setvar::NCAuthorId::nemo_manuscript}}{{setvar::NCStyleId::modern_literature}}{{trim}}'),
        p('nc-genre-comedy', '{{setvar::NCGenreId::comedy}}{{setvar::NCAuthorId::terry_pratchett}}{{setvar::NCStyleId::modern_literature}}{{trim}}'),
        p('nc-style-light_novel', '{{setvar::NCStyleId::light_novel}}{{trim}}'),
        p('nemo-init-recipe-index', '{{setvar::NG_slice_of_life::ao}}{{setvar::NG_comedy::ac}}{{setvar::NA_nemo_manuscript::as}}{{setvar::NA_terry_pratchett::ay}}{{setvar::NS_modern_literature::as}}{{setvar::NS_light_novel::an}}{{trim}}'),
        p('nemo-recipe-selection-sanitize', GUARD_TEXT),
        bank('slice_of_life', 'NPaoasas', 'Ordinary prose. \u2800 café 🎭'),
        bank('comedy', 'NPacayan', 'Light novel scene.'),
        p('nemo-init-recipes-comedy-02', '{{#if {{.NCGenreId == comedy}}}}{{#setvar::NPacayas}}  Scoped author voice.  {{/setvar}}{{trim}}{{/if}}'),
        p(RESOLVER_ID, RESOLVER_TEXT), p('user-tail', 'Keep the final instruction.')];
    return { preset_name: 'Renamed by the user', prompts, prompt_order: [100000, 100001].map(character_id => ({ character_id, order: prompts.map(x => ({ identifier: x.identifier, enabled: !['nc-genre-comedy', 'nc-style-light_novel'].includes(x.identifier) || character_id === 100001 })) })), extensions: { regex_scripts: [{ findRegex: '/unchanged/g', replaceString: '{{match}}' }], other_setting: true } };
}
const response = (status, text) => ({ ok: status >= 200 && status < 300, status, text: async () => text });
function server() {
    const files = new Map(); const calls = []; let failUpload = false;
    return {
        files, calls, set failUpload(v) { failUpload = v; },
        fetchFn: async (url, options) => {
            calls.push({ url, options });
            assert.equal(options.credentials, 'same-origin'); assert.equal(options.redirect, 'error');
            if (url === '/api/files/upload') {
                if (failUpload) return response(500, 'Failed');
                const { name, data } = JSON.parse(options.body);
                const path = `/user/files/${name}`;
                files.set(path, Buffer.from(data, 'base64').toString('utf8'));
                return response(200, JSON.stringify({ path }));
            }
            return files.has(url) ? response(200, files.get(url)) : response(404, 'Missing');
        },
    };
}
function emitter() {
    const handlers = new Map(); const errors = [];
    return {
        handlers, errors,
        on(t, f) { if (!handlers.has(t)) handlers.set(t, []); handlers.get(t).push(f); },
        removeListener(t, f) { handlers.set(t, (handlers.get(t) ?? []).filter(x => x !== f)); },
        async emit(t, ...args) { for (const f of [...handlers.get(t) ?? []]) { try { await f(...args); } catch (e) { errors.push(e); } } },
    };
}
const types = Object.fromEntries(['OAI_PRESET_IMPORT_READY', 'OAI_PRESET_EXPORT_READY', 'APP_READY', 'OAI_PRESET_CHANGED_BEFORE', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY'].map(x => [x, x]));
function harness(preset = fixture(), host = server()) {
    const events = emitter(); const variables = new Map(); const messages = [];
    let stopped = 0; let dryRuns = 0; let exports = 0; let imports = 0;
    const manager = {
        serviceSettings: preset, activeCharacter: { id: 100001 },
        getPromptOrderForCharacter(c) { return this.serviceSettings.prompt_order.find(x => x.character_id === c.id).order; },
        preparePrompt(prompt) { return { ...prompt }; },
        async tryGenerate() { dryRuns++; },
        export(data) { exports++; return data; }, import() { imports++; },
    };
    const original = manager.preparePrompt;
    const store = new RecipeStore({ fetchFn: host.fetchFn });
    const runtime = createRecipeRuntime({ events, types, getManager: () => manager,
        getContext: () => ({ variables: { local: { get: k => variables.get(k) ?? '' } }, stopGeneration: () => { stopped++; } }), store,
        notify: (m, l) => messages.push([m, l]) });
    return { manager, runtime, store, host, events, variables, messages, original, counts: () => ({ stopped, dryRuns, exports, imports }) };
}
async function optimized(h) { const incoming = fixture(); await h.runtime.importReady({ data: incoming }); h.manager.serviceSettings = incoming; return incoming; }
const liveVars = (h, genre = 'comedy', author = 'terry_pratchett', style = 'light_novel') => {
    for (const [k, v] of Object.entries({ NCGenreId: genre, NCAuthorId: author, NCStyleId: style, NG_comedy: 'ac', NG_slice_of_life: 'ao', NA_terry_pratchett: 'ay', NA_nemo_manuscript: 'as', NS_light_novel: 'an', NS_modern_literature: 'as' })) h.variables.set(k, v);
};

test('extraction preserves exact inline and scoped setters', () => {
    const f = fixture(); const plan = planExtraction(f);
    assert.equal(Object.keys(plan.keyToBank).length, 3);
    assert.equal(parseBank(f.prompts[8]).recipes.NPacayas, '{{#setvar::NPacayas}}  Scoped author voice.  {{/setvar}}');
    assert.equal(f.prompts.length, 11);
});
test('selection follows saved order, genre defaults and explicit style', () => {
    const f = fixture(); assert.equal(selectedKey(f, f.prompt_order[0].order), 'NPaoasas');
    assert.equal(selectedKey(f, f.prompt_order[1].order), 'NPacayan');
    f.prompt_order[1].order.find(x => x.identifier === 'nc-style-light_novel').enabled = false;
    assert.equal(selectedKey(f, f.prompt_order[1].order), 'NPacayas');
});
test('disabled resolver and generation triggers do not require a recipe', () => {
    const f = fixture(); f.prompts.find(x => x.identifier === RESOLVER_ID).injection_trigger = ['swipe'];
    assert.equal(selectedKey(f, f.prompt_order[1].order, 'normal'), null);
    assert.equal(selectedKey(f, f.prompt_order[1].order, 'swipe'), 'NPacayan');
});
test('unknown literal genre is sanitized exactly to the default bundle', () => {
    const f = fixture(); f.prompts[2].content = '{{setvar::NCGenreId::not_real}}';
    assert.equal(selectedKey(f, f.prompt_order[1].order), 'NPaoasas');
});
for (const [name, mutate] of [
    ['nested executable content', f => { f.prompts[6].content = f.prompts[6].content.replace('Ordinary prose.', '{{incvar::counter}}'); }],
    ['duplicate recipe', f => { f.prompts[7].content += '\n{{setvar::NPacayan::duplicate}}'; }],
    ['modified resolver', f => { f.prompts[9].content += ' changed'; }],
    ['disabled partition', f => { f.prompt_order[0].order[6].enabled = false; }],
    ['dynamic selector', f => { f.prompts[2].content = '{{setvar::NCGenreId::{{getvar::other}}}}'; }],
    ['duplicate ID', f => { f.prompts.push({ ...f.prompts[0] }); }],
    ['unknown consumer', f => { f.prompts[0].content = '{{getvar::NPaoasas}}'; }],
    ['mismatched genre', f => { f.prompts[6].content = f.prompts[6].content.replace('NPaoasas', 'NPacasas'); }],
    ['reordered selector', f => { const x = f.prompt_order[1].order.splice(2, 1)[0]; f.prompt_order[1].order.splice(8, 0, x); }],
]) test(`rejects ${name} without mutating source`, () => { const f = fixture(); mutate(f); const before = JSON.stringify(f); assert.throws(() => planExtraction(f)); assert.equal(JSON.stringify(f), before); });

test('durable extraction, compact import and exact portable round trip', async () => {
    const h = harness(); const source = fixture(); const input = structuredClone(source);
    await h.runtime.importReady({ data: input });
    assert.equal(input.prompts.length, source.prompts.length - 3);
    assert.equal(h.host.files.size, 4); // Three immutable sources, one index/restore manifest.
    assert.deepEqual(input.extensions.regex_scripts, source.extensions.regex_scripts);
    h.runtime.dispose();
    const coldStore = new RecipeStore({ fetchFn: h.host.fetchFn }); // Browser state is gone.
    assert.deepEqual(await coldStore.restore(input), source);
});
test('reimport deduplicates identical sidecars', async () => {
    const h = harness(); await optimized(h); const n = h.host.calls.filter(x => x.url.endsWith('/upload')).length;
    await h.runtime.importReady({ data: fixture() });
    assert.equal(h.host.calls.filter(x => x.url.endsWith('/upload')).length, n);
});
test('preserves modified recipe corpus rather than replacing it with a bundled library', async () => {
    const h = harness(); const f = fixture(); f.prompts[7].content = f.prompts[7].content.replace('Light novel scene.', 'MY EDIT: 🌲 custom scene.');
    await h.runtime.importReady({ data: f });
    const m = await h.store.manifest(f); assert.match(await h.store.selected(m, 'NPacayan'), /MY EDIT/);
});
test('portable export retains later prompt edits, additions and ordering changes', async () => {
    const h = harness(); const f = await optimized(h);
    f.prompts[0].content = 'EDITED MAIN'; f.prompts.push(p('new-prompt', 'New text'));
    f.prompt_order[0].order.push({ identifier: 'new-prompt', enabled: true });
    const before = JSON.stringify(f); const restored = await h.store.restore(f);
    assert.equal(restored.prompts[0].content, 'EDITED MAIN');
    assert.equal(restored.prompts.at(-1).identifier, 'new-prompt');
    assert.equal(restored.prompt_order[0].order.at(-1).identifier, 'new-prompt');
    assert.equal(JSON.stringify(f), before);
});
test('native event swallowing cannot turn failed storage into a raw unsafe import', async () => {
    const h = harness(); h.host.failUpload = true; const f = fixture(); const originalContents = f.prompts.map(x => x.content);
    await h.events.emit(types.OAI_PRESET_IMPORT_READY, { data: f });
    assert.throws(() => JSON.stringify({ preset: f }), /save recipe/);
    assert.deepEqual(f.prompts.map(x => x.content), originalContents);
    assert.equal(f.extensions[RUNTIME_KEY], undefined);
});
test('corrupt or missing sidecars prevent portable export, not a partial download', async () => {
    const h = harness(); const f = await optimized(h); h.host.files.clear();
    const copy = structuredClone(f); await h.events.emit(types.OAI_PRESET_EXPORT_READY, copy);
    assert.throws(() => JSON.stringify(copy), /sidecar unavailable/);
    assert.equal(copy.prompts.length, f.prompts.length);
});
test('checksum mismatch is rejected and a later import can repair it', async () => {
    const h = harness(); const f = await optimized(h); const m = await h.store.manifest(f);
    h.host.files.set(m.shards[0].path, '{}');
    await assert.rejects(h.store.read(m.shards[0]), /checksum/);
    await h.runtime.importReady({ data: fixture() });
    assert.equal((await h.store.read(m.shards[0])).identifier, m.shards[0].identifier);
});
for (const path of ['https://evil.example/files/x.json', '/api/secrets/read', '/files/../x', '/user/files/../x', '//other.example/file']) test(`rejects unsafe storage path ${path}`, () => assert.throws(() => checkedPath({ path, sha256: 'a'.repeat(64) })));

test('recipe references use current ST user/files and legacy paths remain readable', async () => {
    const h = harness(); const f = await optimized(h);
    const ref = f.extensions[RUNTIME_KEY].manifest;
    assert.match(ref.path, /^\/user\/files\/nemo-recipes-/);
    const legacy = { ...ref, path: ref.path.replace('/user/files/', '/files/') };
    assert.equal((await h.store.read(legacy)).schema, 1);
});

test('a fresh runtime fetches only the index and selected shard; cache retains only two recipe strings', async () => {
    const h = harness(); const f = await optimized(h); h.runtime.dispose(); h.host.calls.length = 0;
    const next = harness(f, h.host); await Promise.all([next.runtime.ready(), next.runtime.ready()]);
    assert.equal(h.host.calls.length, 2);
    assert.equal(next.runtime.getStats().cachedRecipes, 1);
    assert.ok(next.runtime.getStats().cachedCharacters < 200);
    next.manager.activeCharacter.id = 100000; await next.runtime.ready();
    next.manager.activeCharacter.id = 100001; f.prompt_order[1].order.find(x => x.identifier === 'nc-style-light_novel').enabled = false; await next.runtime.ready();
    assert.equal(next.runtime.getStats().cachedRecipes, 2);
});
test('synchronous native preparation receives the exact selected setter and original resolver only', async () => {
    const h = harness(); const f = await optimized(h); liveVars(h);
    const prompt = f.prompts.find(p => p.identifier === RESOLVER_ID);
    assert.equal(h.manager.preparePrompt(prompt).content, '{{setvar::NPacayan::Light novel scene.}}{{trim}}' + RESOLVER_TEXT);
    assert.equal(h.manager.preparePrompt(f.prompts[0]).content, f.prompts[0].content);
});
test('unexpected selector change blocks final request serialization even when ST swallows the error', async () => {
    const h = harness(); const f = await optimized(h); liveVars(h, 'comedy', 'terry_pratchett', 'modern_literature');
    assert.throws(() => h.manager.preparePrompt(f.prompts.find(p => p.identifier === RESOLVER_ID)), /not prepared/);
    const data = { messages: ['partial prompt'] }; await h.events.emit(types.CHAT_COMPLETION_SETTINGS_READY, data);
    assert.throws(() => JSON.stringify(data), /not prepared/); assert.ok(h.counts().stopped > 0);
});
test('missing library aborts the generation interceptor and dry run never runs', async () => {
    const h = harness(); const f = await optimized(h); h.runtime.dispose(); h.host.files.clear();
    const next = harness(f, h.host); let aborted = false;
    await next.runtime.preflight([], 1000, yes => { aborted = yes; }, 'normal'); assert.equal(aborted, true);
    await next.manager.tryGenerate(); assert.equal(next.counts().dryRuns, 0);
});
test('disabled/triggered recipe resolver supports swipe without aging other variables in preflight', async () => {
    const h = harness(); const f = await optimized(h); h.variables.set('turnCounter', 3);
    f.prompts.find(p => p.identifier === RESOLVER_ID).injection_trigger = ['swipe'];
    await h.runtime.ready(f, 'normal'); await h.runtime.ready(f, 'swipe'); assert.equal(h.variables.get('turnCounter'), 3);
});
test('partial prompt-list export is rehydrated, and partial recipe import cannot bypass extraction', async () => {
    const h = harness(); const f = await optimized(h);
    const result = await h.manager.export({ prompts: f.prompts, prompt_order: f.prompt_order[1].order }, 'full');
    assert.equal(result.prompts.length, fixture().prompts.length);
    h.manager.import({ data: { prompts: fixture().prompts } }); assert.equal(h.counts().imports, 0);
});
test('cleanup restores methods and removes all listeners', async () => {
    const h = harness(); await optimized(h); h.runtime.dispose();
    assert.equal(h.manager.preparePrompt, h.original);
    assert.equal([...h.events.handlers.values()].flat().length, 0);
});
test('does not overwrite a later wrapper during cleanup', () => {
    const h = harness(); const thirdParty = () => 7; h.manager.preparePrompt = thirdParty; h.runtime.dispose(); assert.equal(h.manager.preparePrompt, thirdParty);
});
test('unrelated and Lite imports remain byte-identical', async () => {
    const h = harness(); const f = { prompts: [p('main', 'Small')], extensions: {} }; const before = JSON.stringify(f);
    await h.runtime.importReady({ data: f }); assert.equal(JSON.stringify(f), before); assert.equal(h.host.files.size, 0);
});
test('network timeout leaves the source untouched', async () => {
    const store = new RecipeStore({ timeoutMs: 10, fetchFn: (_u, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
    const f = fixture(); const before = JSON.stringify(f); await assert.rejects(store.extract(f, planExtraction(f)), /aborted/); assert.equal(JSON.stringify(f), before);
});
test('serialization barrier is non-enumerable and stops nested serialization', () => { const f = { data: true }; blockSerialization(f, new Error('blocked')); assert.deepEqual(Object.keys(f), ['data']); assert.throws(() => JSON.stringify({ f }), /blocked/); });
test('entrypoint attaches import protection before UI/cache initialization', async () => {
    const text = await readFile(new URL('../content.js', import.meta.url), 'utf8');
    assert.ok(text.indexOf('        initializeRecipeRuntime();') < text.indexOf('        await NemoSettingsUI.initialize();'));
    assert.match(text, /cleanupRecipeRuntime\(\);/);
    const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
    assert.equal(manifest.generate_interceptor, 'nemoRecipeRuntimePreflight');
});
