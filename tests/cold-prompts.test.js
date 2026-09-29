import assert from 'node:assert/strict';
import test from 'node:test';
import { BODY_KEY, checkedDescriptor, isCold, isNemoPreset, eligible, shellFor, bodyRevision, blockSerialization } from '../features/cold-prompts/format.js';
import { PromptBodyStore, digest } from '../features/cold-prompts/store.js';
import { createColdPromptRuntime } from '../features/cold-prompts/controller.js';

function fixture() {
    const prompts = [
        { identifier: 'main', name: 'Main', content: 'Main source', system_prompt: true },
        { identifier: 'nemo-user-role-character', name: 'Player', content: '{{// @category Roles }}\nUSER CONTROL\n{{setvar::active::1}}', system_prompt: false },
        { identifier: 'v11-classic-user-message-ender', name: 'Ender', content: '{{getvar::active}}\nEnd input', system_prompt: false },
        { identifier: 'optional', name: 'Optional', content: '{{// Intro tooltip }}\n' + 'Rare prose. '.repeat(100) + '\n{{// @requires nemo-user-role-character }}', system_prompt: false },
        { identifier: 'nc-writing-resolver', name: 'Recipe', content: 'RECIPE LOADER', system_prompt: false },
    ];
    return { preset_name: 'Nemo Engine v12 Lite', prompts, prompt_order: [
        { character_id: 100001, order: prompts.map(p => ({ identifier: p.identifier, enabled: p.identifier !== 'optional' })) },
        { character_id: 100000, order: prompts.map(p => ({ identifier: p.identifier, enabled: true })) },
    ], extensions: { regex_scripts: [{ id: 'keep', findRegex: 'raw', replaceString: 'exact' }] } };
}
function transport() {
    const files = new Map(), log = [];
    let writeFailure = false;
    const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => value });
    const fetchFn = async (url, options = {}) => {
        log.push({ url, ...options });
        if (url === '/api/files/upload') {
            if (writeFailure) return response('failed', 500);
            const { name, data } = JSON.parse(options.body);
            files.set(`/user/files/${name}`, Buffer.from(data, 'base64').toString('utf8'));
            return response(JSON.stringify({ path: `user/files/${name}` }));
        }
        return files.has(url) ? response(files.get(url)) : response('missing', 404);
    };
    return { files, log, fetchFn, failWrites: () => { writeFailure = true; } };
}
class Events {
    constructor() { this.handlers = new Map(); }
    on(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(fn); }
    makeFirst(type, fn) { this.on(type, fn); const list = this.handlers.get(type); list.unshift(list.pop()); }
    removeListener(type, fn) { this.handlers.set(type, (this.handlers.get(type) ?? []).filter(f => f !== fn)); }
    async emit(type, ...args) { for (const fn of [...(this.handlers.get(type) ?? [])]) { try { await fn(...args); } catch { /* native ST catches */ } } }
}
const keys = ['OAI_PRESET_IMPORT_READY', 'OAI_PRESET_EXPORT_READY', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'APP_READY', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY'];
const types = Object.fromEntries(keys.map(k => [k, k]));
function environment(preset = fixture(), options = {}) {
    const network = transport(), events = new Events();
    const store = new PromptBodyStore({ fetchFn: network.fetchFn, packChars: 2048 });
    const notices = [], editorStates = [], saved = [];
    let stops = 0;
    const pm = {
        activeCharacter: { id: 100001 }, serviceSettings: preset, prepared: [],
        getPromptOrderForCharacter(c) { return this.serviceSettings.prompt_order.find(p => p.character_id === c.id).order; },
        getPromptById(id) { return this.serviceSettings.prompts.find(p => p.identifier === id); },
        preparePrompt(p) { this.prepared.push(p.content); return { ...p }; },
        getPromptCollection() { return this.getPromptOrderForCharacter(this.activeCharacter).filter(e => e.enabled).map(e => this.preparePrompt(this.getPromptById(e.identifier))); },
        async tryGenerate() { return this.getPromptCollection(); },
        async saveServiceSettings() { saved.push(JSON.stringify(this.serviceSettings)); },
        loadPromptIntoEditForm(p) { this.editText = p.content; },
        updatePromptWithPromptEditForm(p) { p.content = this.editText; },
        clearEditForm() { this.editText = ''; }, hidePopup() {},
        export(data) { return JSON.stringify(data); },
        import(data) { this.lastImport = data; },
    };
    const runtime = createColdPromptRuntime({ events, types, getManager: () => pm, store,
        getContext: () => ({ stopGeneration() { stops++; } }),
        notify: (...v) => notices.push(v), editorLoading: (...v) => editorStates.push(v), ...options });
    return { runtime, pm, store, events, network, notices, editorStates, saved, stopped: () => stops };
}
async function installed(options = {}) {
    const env = environment(fixture(), options);
    const original = structuredClone(env.pm.serviceSettings);
    await env.runtime.importReady({ data: env.pm.serviceSettings });
    return { ...env, original };
}

test('recognition is structural; unrelated and Tavo presets are untouched', async () => {
    assert.equal(isNemoPreset(fixture()), true);
    assert.equal(isNemoPreset({ ...fixture(), preset_name: 'Tavo' }), false);
    assert.equal(isNemoPreset({ prompts: [{ identifier: 'unrelated', content: 'text' }] }), false);
    const env = environment();
    const data = { prompts: [{ identifier: 'x', content: 'unrelated' }] };
    await env.runtime.importReady({ data }); assert.deepEqual(data.prompts[0], { identifier: 'x', content: 'unrelated' });
    env.runtime.dispose();
});
test('metadata shells preserve late directives and a plain leading tooltip', () => {
    const shell = shellFor(fixture().prompts[3].content);
    assert.match(shell, /Intro tooltip/); assert.match(shell, /@requires/); assert.doesNotMatch(shell, /Rare prose/);
});
test('native quick fields, markers, initializers and recipe loader are not externalized', () => {
    for (const p of [{ identifier: 'main' }, { identifier: 'nsfw' }, { identifier: 'nc-writing-resolver' }, { identifier: 'nemo-init-core' }, { marker: true }, { system_prompt: true }]) {
        assert.equal(eligible({ content: 'content', ...p }), false);
    }
});
test('import writes and verifies before replacing bodies; export round-trips exactly', async () => {
    const env = await installed();
    assert.equal(env.pm.serviceSettings.prompts.filter(isCold).length, 3);
    const exported = structuredClone(env.pm.serviceSettings);
    await env.runtime.exportReady(exported);
    assert.deepEqual(exported, env.original);
    assert.equal(env.pm.serviceSettings.prompts.filter(isCold).length, 3);
    env.runtime.dispose();
});
test('current ST user/files path is stored and legacy /files descriptors still read through fallback', async () => {
    const env = await installed(), p = env.pm.getPromptById('optional');
    assert.match(p[BODY_KEY].ref.path, /^\/user\/files\/nemo-prompts-/);
    const legacy = structuredClone(p[BODY_KEY]);
    legacy.ref.path = legacy.ref.path.replace('/user/files/', '/files/');
    assert.equal(await env.store.read(legacy), env.original.prompts[3].content);
    env.runtime.dispose();
});
test('enabled prompts hydrate before native dry run; disabled text stays cold', async () => {
    const env = await installed();
    const messages = await env.pm.tryGenerate();
    assert.equal(isCold(env.pm.getPromptById('optional')), true);
    for (const p of messages) assert.equal(p.content, env.original.prompts.find(o => o.identifier === p.identifier).content);
    assert.equal(env.pm.prepared.some(t => t.includes('stored externally')), false);
    env.runtime.dispose();
});
test('enable loads before save and disable evicts without a redundant write', async () => {
    const env = await installed(); await env.pm.tryGenerate();
    const e = env.pm.getPromptOrderForCharacter(env.pm.activeCharacter).find(p => p.identifier === 'optional');
    const p = env.pm.getPromptById('optional');
    e.enabled = true; await env.pm.saveServiceSettings(); assert.equal(isCold(p), false);
    const writes = env.store.stats.writes;
    e.enabled = false; await env.pm.saveServiceSettings(); assert.equal(isCold(p), true);
    assert.equal(env.store.stats.writes, writes); env.runtime.dispose();
});
test('editing a disabled prompt pins its source, saves changes durably, and evicts on close', async () => {
    const env = await installed();
    const p = env.pm.getPromptById('optional');
    await env.pm.loadPromptIntoEditForm(p);
    await env.runtime.ready(env.pm.serviceSettings, { evict: true }); assert.equal(isCold(p), false);
    env.pm.editText = '{{// @category Changed }}\nA new body';
    env.pm.updatePromptWithPromptEditForm(p); env.pm.hidePopup();
    await env.pm.saveServiceSettings(); assert.equal(isCold(p), true);
    const fresh = new PromptBodyStore({ fetchFn: env.network.fetchFn });
    assert.equal(await fresh.read(p[BODY_KEY]), '{{// @category Changed }}\nA new body');
    env.runtime.dispose();
});
test('empty edits and edits equal to an old shell remain authoritative', async () => {
    for (const replacement of ['', 'shell']) {
        const env = await installed(), p = env.pm.getPromptById('optional');
        const text = replacement === 'shell' ? p.content : replacement;
        await env.pm.loadPromptIntoEditForm(p); env.pm.editText = text;
        env.pm.updatePromptWithPromptEditForm(p); env.pm.hidePopup(); await env.pm.saveServiceSettings();
        assert.equal(await env.runtime.readBody(p), text);
        const out = structuredClone(env.pm.serviceSettings); await env.runtime.exportReady(out);
        assert.equal(out.prompts.find(o => o.identifier === p.identifier).content, text);
        env.runtime.dispose();
    }
});
test('failed dirty-body storage leaves the complete edit in memory and in native save', async () => {
    const env = await installed(), p = env.pm.getPromptById('optional');
    await env.pm.loadPromptIntoEditForm(p); env.pm.editText = 'IMPORTANT UNSAVED EDIT'; env.pm.updatePromptWithPromptEditForm(p);
    env.network.failWrites(); env.pm.hidePopup(); await env.pm.saveServiceSettings();
    assert.equal(p.content, 'IMPORTANT UNSAVED EDIT');
    assert.match(env.saved.at(-1), /IMPORTANT UNSAVED EDIT/); env.runtime.dispose();
});
test('missing disabled storage blocks export rather than downloading shells', async () => {
    const env = await installed(); env.network.files.clear();
    const out = structuredClone(env.pm.serviceSettings);
    await env.events.emit(types.OAI_PRESET_EXPORT_READY, out);
    assert.throws(() => JSON.stringify(out), /unavailable/);
    env.runtime.dispose();
});
test('missing enabled storage stops dry run and real request serialization', async () => {
    const env = await installed(); env.network.files.clear();
    assert.equal(await env.pm.tryGenerate(), undefined); assert.equal(env.pm.prepared.length, 0);
    let aborted = false;
    await env.runtime.preflight([], 10000, value => { aborted = value; }); assert.equal(aborted, true);
    const data = { messages: ['should not send'] };
    await env.events.emit(types.CHAT_COMPLETION_SETTINGS_READY, data);
    assert.throws(() => JSON.stringify(data)); env.runtime.dispose();
});
test('unexpected cold enabled prompt cannot pass synchronous collection preparation', async () => {
    const env = await installed(); assert.throws(() => env.pm.getPromptCollection(), /not loaded/);
    assert.equal(env.pm.prepared.length, 0); env.runtime.dispose();
});
test('storage corruption is detected even by a fresh runtime', async () => {
    const env = await installed(), p = env.pm.getPromptById('optional');
    env.network.files.set(p[BODY_KEY].ref.path, '{"schema":1,"bodies":["corrupt"]}');
    await assert.rejects(new PromptBodyStore({ fetchFn: env.network.fetchFn }).read(p[BODY_KEY]), /checksum/);
    env.runtime.dispose();
});
test('portable reimport repairs corrupted content-addressed storage', async () => {
    const env = await installed(), p = env.pm.getPromptById('optional');
    env.network.files.set(p[BODY_KEY].ref.path, 'broken');
    const repaired = structuredClone(env.original); await env.runtime.importReady({ data: repaired });
    assert.equal(await env.store.read(repaired.prompts[3][BODY_KEY]), env.original.prompts[3].content); env.runtime.dispose();
});
test('failed imports cannot serialize, even when the native event emitter swallows errors', async () => {
    const env = environment(); env.network.failWrites(); const source = structuredClone(env.pm.serviceSettings);
    await env.events.emit(types.OAI_PRESET_IMPORT_READY, env.pm.serviceSettings); // Wrong payload is ignored.
    const data = structuredClone(source); await env.events.emit(types.OAI_PRESET_IMPORT_READY, { data });
    assert.throws(() => JSON.stringify(data)); assert.deepEqual(data.prompts, source.prompts); env.runtime.dispose();
});
test('partial export and reference-bearing partial import restore exact source', async () => {
    const env = await installed(), p = env.pm.getPromptById('optional');
    const data = { prompts: [p], prompt_order: [{ identifier: p.identifier, enabled: false }] };
    const out = JSON.parse(await env.pm.export(data)); assert.equal(out.prompts[0].content, env.original.prompts[3].content);
    assert.equal(out.prompts[0][BODY_KEY], undefined);
    await env.pm.import({ data, version: 1 }); assert.equal(env.pm.lastImport.data.prompts[0].content, env.original.prompts[3].content);
    assert.equal(isCold(p), true); env.runtime.dispose();
});
test('two presets with the same prompt IDs keep separate exact bodies', async () => {
    const env = await installed(); const second = fixture(); second.prompts[3].content = 'Different preset';
    await env.runtime.importReady({ data: second });
    assert.notEqual(second.prompts[3][BODY_KEY].ref.sha256, env.pm.getPromptById('optional')[BODY_KEY].ref.sha256);
    assert.equal(await env.runtime.readBody(second.prompts[3]), 'Different preset'); env.runtime.dispose();
});
test('profile switching hydrates the newly enabled set', async () => {
    const env = await installed(); await env.runtime.ready();
    env.pm.activeCharacter.id = 100000; await env.pm.tryGenerate();
    assert.equal(isCold(env.pm.getPromptById('optional')), false); env.runtime.dispose();
});
test('metadata-only references do not turn off runtime when automatic conversion is disabled', async () => {
    const env = await installed(); const compact = structuredClone(env.pm.serviceSettings); env.runtime.dispose();
    const second = environment(compact, { autoStore: () => false });
    for (const [k, v] of env.network.files) second.network.files.set(k, v);
    await second.pm.tryGenerate(); assert.equal(isCold(second.pm.getPromptById('nemo-user-role-character')), false);
    second.runtime.dispose();
});
test('corrupt shell/index/length metadata cannot load another body', async () => {
    const env = await installed(); const original = env.pm.getPromptById('optional')[BODY_KEY];
    for (const d of [{ ...original, index: 3000 }, { ...original, characters: 10 }, { ...original, shell: 'forged' }]) {
        await assert.rejects(env.store.read(d), /metadata/);
    }
    env.runtime.dispose();
});
for (const path of ['https://evil.example/x', '/api/settings/get', '/files/../x', '/user/files/../x', '//evil/x']) test(`reject external or traversing path ${path}`, () => {
    assert.throws(() => checkedDescriptor({ schema: 1, ref: { sha256: 'a'.repeat(64), path }, index: 0, characters: 0, shell: '' }));
});
test('an in-flight hydrate never overwrites a newer source edit', async () => {
    const env = await installed(); const p = env.pm.getPromptById('optional');
    const original = env.store.readMany.bind(env.store);
    let release; const wait = new Promise(r => { release = r; });
    env.store.readMany = async (...args) => { await wait; return original(...args); };
    const work = env.runtime.withBody(p, () => {}); p.content = 'Concurrent edit'; release(); await work;
    assert.equal(await env.runtime.readBody(p), 'Concurrent edit'); env.runtime.dispose();
});
test('closing or replacing the editor rejects late loads', async () => {
    const env = await installed(), p = env.pm.getPromptById('optional');
    let release; const wait = new Promise(r => { release = r; });
    const read = env.store.readMany.bind(env.store); env.store.readMany = async (...a) => { await wait; return read(...a); };
    const work = env.pm.loadPromptIntoEditForm(p); env.pm.clearEditForm(); release(); await work;
    assert.equal(env.pm.editText, ''); env.runtime.dispose();
});
test('a stale preset save never calls the native save for a new selection', async () => {
    const env = await installed();
    let release; const wait = new Promise(r => { release = r; });
    const read = env.store.readMany.bind(env.store); env.store.readMany = async (...a) => { await wait; return read(...a); };
    const work = env.pm.saveServiceSettings(); env.pm.serviceSettings = fixture(); release(); await work;
    assert.equal(env.saved.length, 0); env.runtime.dispose();
});
test('preloading does not execute random, counter or other variable macros', async () => {
    const env = await installed(); await env.runtime.ready(); assert.equal(env.pm.prepared.length, 0); env.runtime.dispose();
});
test('readBody for worker search does not hydrate a disabled source or retain packs', async () => {
    const env = await installed(), p = env.pm.getPromptById('optional');
    const before = JSON.stringify(p), revision = bodyRevision(p);
    assert.equal(await env.runtime.readBody(p), env.original.prompts[3].content);
    assert.equal(JSON.stringify(p), before); assert.equal(bodyRevision(p), revision);
    assert.equal(env.store.diagnostics().pendingPacks, 0); assert.equal(env.store.diagnostics().residentPackCache, 0);
    env.runtime.dispose();
});
test('changed enabled bodies are exported as edits without fetching an obsolete reference', async () => {
    const env = await installed(); await env.runtime.ready(); const p = env.pm.getPromptById('nemo-user-role-character');
    p.content = 'Live modified body'; env.network.files.clear();
    const result = await env.store.restorePrompts([p]); assert.equal(result[0].content, 'Live modified body'); env.runtime.dispose();
});
test('cleanup removes listeners and restores methods without overwriting later wrappers', async () => {
    const env = await installed(); const later = () => 'later'; env.pm.preparePrompt = later;
    env.runtime.dispose(); assert.equal(env.pm.preparePrompt, later);
    assert.equal([...env.events.handlers.values()].flat().length, 0); assert.equal(env.runtime.getStats().pinnedEditors, 0);
});
test('reimport deduplicates existing verified body packs', async () => {
    const env = await installed(); const writes = env.store.stats.writes;
    await env.runtime.importReady({ data: structuredClone(env.original) }); assert.equal(env.store.stats.writes, writes); env.runtime.dispose();
});
test('storage request opts into same-origin credentials, rejects redirects, and uses server files', async () => {
    const env = await installed(); assert.ok(env.network.log.every(r => r.credentials === 'same-origin' && r.redirect === 'error'));
    assert.ok(env.network.log.some(r => r.url === '/api/files/upload')); env.runtime.dispose();
});
test('serialization barriers stay non-enumerable and survive nesting', () => {
    const obj = { x: 1 }; blockSerialization(obj, new Error('stopped'));
    assert.deepEqual(Object.keys(obj), ['x']); assert.throws(() => JSON.stringify({ nested: obj }), /stopped/);
});
test('hashes preserve Unicode and exact whitespace in stored source', async () => {
    const env = environment();
    const records = [{ prompt: {}, content: '⠀\n漢字 🪶\r\n  exact\t' }];
    const map = await env.store.writeMany(records);
    assert.equal(await env.store.read(map.get(records[0].prompt)), records[0].content);
    assert.equal((await digest('abc')).length, 64); env.runtime.dispose();
});

test('unsupported native manager cannot accept an optimized import', async () => {
    const env = environment(); delete env.pm.getPromptCollection;
    const data = fixture();
    await assert.rejects(env.runtime.importReady({ data }), /boundaries/);
    assert.equal(env.network.files.size, 0); assert.throws(() => JSON.stringify(data)); env.runtime.dispose();
});
test('text-completion preflight does not load an inactive chat-completion preset', async () => {
    const env = await installed({ getContext: () => ({ mainApi: 'textgenerationwebui' }) });
    env.network.files.clear(); let aborted = false;
    assert.equal(await env.runtime.preflight([], 1000, () => { aborted = true; }), true);
    assert.equal(aborted, false); env.runtime.dispose();
});
test('metadata reference mutation during a load does not overwrite current content', async () => {
    const env = await installed(), p = env.pm.getPromptById('optional');
    const saved = p[BODY_KEY];
    const read = env.store.readMany.bind(env.store);
    env.store.readMany = async (ps, visit) => read(ps, (source, body) => {
        source[BODY_KEY] = { ...saved }; return visit(source, body);
    });
    await assert.rejects(env.runtime.withBody(p, () => { throw new Error('must not replay'); }), /changed while loading/);
    assert.equal(isCold(p), true); env.runtime.dispose();
});

// Exercise the browser entrypoint with a DOM/event boundary harness, not a real ST client.
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
function browserHarness(env) {
    env.runtime.dispose();
    const handlers = new Map(), fields = new Map();
    const originalPreflight = async () => { sandbox.recipeCalls++; };
    const nm = {
        selectedPromptItem: { dataset: { pmIdentifier: 'optional' } },
        extractPromptData(row) { return { content: env.pm.getPromptById(row.dataset.pmIdentifier).content }; },
        showSavePromptDialog() { this.archiveCopy = this.extractPromptData(this.selectedPromptItem); },
    };
    const sandbox = {
        console: { info() {}, error() {} }, eventSource: env.events, event_types: types,
        getRequestHeaders: () => ({}), getContext: () => ({ mainApi: 'openai' }),
        extension_settings: {}, promptManager: env.pm, NemoPresetManager: nm,
        syncPromptMetadata: () => ({ records: new WeakMap() }),
        PromptBodyStore: class { constructor() { return env.store; } },
        createColdPromptRuntime, isCold, BODY_KEY, recipeCalls: 0,
        nemoRecipeRuntimePreflight: originalPreflight,
        document: {
            addEventListener(type, fn) { handlers.set(type, fn); },
            removeEventListener(type, fn) { if (handlers.get(type) === fn) handlers.delete(type); },
            getElementById(id) {
                if (!fields.has(id)) fields.set(id, { style: {}, setAttribute() {}, disabled: false, value: '' });
                return fields.get(id);
            },
        },
    };
    const source = readFileSync(new URL('../features/cold-prompts/runtime.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
    const api = new Script(`(() => { ${source}\nreturn { initializeColdPrompts, cleanupColdPrompts }; })()`).runInNewContext(sandbox);
    api.initializeColdPrompts();
    return { ...api, sandbox, nm, handlers, fields, originalPreflight };
}
test('browser toggle loads before replay, coalesces double clicks and preserves dependency validation boundary', { timeout: 2000 }, async () => {
    const env = await installed(), browser = browserHarness(env), p = env.pm.getPromptById('optional');
    const entry = env.pm.getPromptOrderForCharacter(env.pm.activeCharacter).find(e => e.identifier === p.identifier);
    let clicked = 0, resolveClick;
    const done = new Promise(r => { resolveClick = r; });
    const row = { dataset: { pmIdentifier: p.identifier } };
    const button = { isConnected: true, closest: () => row, click() {
        assert.equal(isCold(p), false); entry.enabled = true; clicked++; resolveClick();
    } };
    const event = { target: { closest: () => button }, preventDefault() {}, stopImmediatePropagation() {} };
    browser.handlers.get('click')(event); browser.handlers.get('click')(event);
    await done; assert.equal(clicked, 1); browser.cleanupColdPrompts();
});
test('archive Save Prompt gets the exact body; unexpected sync copies are refused', async () => {
    const env = await installed(), browser = browserHarness(env);
    assert.throws(() => browser.nm.extractPromptData(browser.nm.selectedPromptItem), /Load this stored prompt/);
    await browser.nm.showSavePromptDialog();
    assert.equal(browser.nm.archiveCopy.content, env.original.prompts[3].content);
    browser.cleanupColdPrompts();
});
test('aggregate preflight calls Stage 1 only after cold prompts are ready and restores on cleanup', async () => {
    const env = await installed(), browser = browserHarness(env);
    await browser.sandbox.nemoRecipeRuntimePreflight([], 1000, () => {});
    assert.equal(browser.sandbox.recipeCalls, 1);
    assert.equal(isCold(env.pm.getPromptById('nemo-user-role-character')), false);
    browser.cleanupColdPrompts(); assert.equal(browser.sandbox.nemoRecipeRuntimePreflight, browser.originalPreflight);
    assert.equal(browser.handlers.size, 0);
});
test('failed cold preflight never reaches the recipe generation interceptor', async () => {
    const env = await installed(), browser = browserHarness(env); env.network.files.clear();
    let abort = false;
    await browser.sandbox.nemoRecipeRuntimePreflight([], 1000, () => { abort = true; });
    assert.equal(abort, true); assert.equal(browser.sandbox.recipeCalls, 0); browser.cleanupColdPrompts();
});
