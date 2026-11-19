import assert from 'node:assert/strict';
import test from 'node:test';
import { BODY_KEY, checkedDescriptor, isCold, isNemoPreset, eligible, shellFor, bodyRevision, blockSerialization } from '../features/cold-prompts/format.js';
import { ToggleJournal } from '../features/cold-prompts/toggle-journal.js';
import { PromptBodyStore, digest } from '../features/cold-prompts/store.js';
import { createColdPromptRuntime } from '../features/cold-prompts/controller.js';
import { installCommentView } from '../features/prompt-performance/comment-view.js';

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
test('a late comment view cannot disguise a cold shell from its preparation guard', async () => {
    const env = await installed();
    const restoreComments = installCommentView(env.pm);
    const prompt = env.pm.getPromptById('optional'), original = prompt.content;
    try {
        assert.throws(() => env.pm.preparePrompt(prompt), /cold prompt reached native preparation/);
        assert.equal(prompt.content, original);
        assert.equal(env.stopped(), 1);
    } finally { restoreComments(); env.runtime.dispose(); }
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
test('a raw preset with a missing prompt-order reference imports unchanged without storage writes', async () => {
    const p = fixture();
    p.prompt_order[0].order.push({ identifier: 'renamed-or-missing-selector', enabled: true });
    const env = environment(p), original = JSON.stringify(p);
    try {
        await env.runtime.importReady({ data: p });
        assert.equal(JSON.stringify(p), original);
        assert.equal(env.network.log.length, 0);
        assert.equal(env.notices.at(-1)[1], 'warning');
    } finally { env.runtime.dispose(); }
});
test('missing prompt-order references in an optimized preset still require verified recovery', async () => {
    const env = await installed();
    const p = structuredClone(env.pm.serviceSettings);
    p.prompt_order[0].order.push({ identifier: 'missing', enabled: true });
    try {
        await assert.rejects(env.runtime.importReady({ data: p }), /prompt-order reference/);
        assert.throws(() => JSON.stringify(p), /prompt-order reference/);
    } finally { env.runtime.dispose(); }
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
        createColdPromptRuntime, ToggleJournal, accountsEnabled: false, currentUser: null, isCold, BODY_KEY, recipeCalls: 0,
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

test('global saves use verified shells, reload the saved order, and preserve inline edits on failure', async () => {
    const env = await installed(), { pm, runtime } = env;
    const disk = () => JSON.parse(JSON.stringify({ oai_settings: pm.serviceSettings })).oai_settings;
    try {
        const order = pm.getPromptOrderForCharacter(pm.activeCharacter);
        order.find(e => e.identifier === 'optional').enabled = true;
        await pm.saveServiceSettings();
        const active = pm.getPromptById('optional'), body = active.content;
        const snapshot = disk();
        assert(isCold(snapshot.prompts.find(p => p.identifier === 'optional')));
        assert.equal(JSON.parse(JSON.stringify(pm.serviceSettings)).prompts[3].content, body);
        assert.equal(structuredClone(pm.serviceSettings).prompts[3].content, body);
        pm.serviceSettings = snapshot;
        const messages = await pm.tryGenerate();
        assert(messages.some(p => p.content === body));
        assert.deepEqual(pm.getPromptOrderForCharacter(pm.activeCharacter), order);
        assert.equal(pm.getPromptById('optional').content, body);

        pm.getPromptById('optional').content = 'unsaved current source';
        assert.equal(disk().prompts[3].content, 'unsaved current source');
        env.network.failWrites();
        await pm.saveServiceSettings();
        assert.equal(disk().prompts[3].content, 'unsaved current source');
        assert.equal(snapshot.toJSON instanceof Function, true);
        runtime.dispose();
        assert.equal(snapshot.toJSON, undefined);
    } finally { runtime.dispose(); }
});

test('upgrades a previously inline active preset and writes its verified bodies once', async () => {
    const env = environment();
    try {
        await env.runtime.ready(env.pm.serviceSettings, { evict: true });
        const writes = env.store.stats.writes;
        assert(writes > 0);
        const p = env.pm.getPromptById('nemo-user-role-character');
        const serialized = () => JSON.parse(JSON.stringify({ oai_settings: env.pm.serviceSettings })).oai_settings;
        assert(isCold(serialized().prompts[1]));
        assert.equal(isCold(p), false);
        await env.pm.saveServiceSettings();
        assert.equal(env.store.stats.writes, writes);
        p[BODY_KEY].index++;
        assert.equal(serialized().prompts[1].content, p.content, 'altered reference cannot replace live source');
    } finally { env.runtime.dispose(); }
});


test('disabling automatic storage leaves enabled bodies inline on global saves', async () => {
    let automatic = true;
    const env = await installed({ autoStore: () => automatic });
    try {
        await env.pm.tryGenerate();
        automatic = false;
        const saved = JSON.parse(JSON.stringify({ oai_settings: env.pm.serviceSettings })).oai_settings;
        assert.equal(saved.prompts[1].content, env.original.prompts[1].content);
    } finally { env.runtime.dispose(); }
});

function ghostFixture() {
    const data = fixture();
    data.preset_settings_openai = 'Test Ghost';
    for (const prompt of [
        { identifier: 'nemo-init-reset', name: 'Reset', content: '{{setvar::active::}}' },
        { identifier: 'nemo-runtime-state-resolver', name: 'Settings resolver', content: '{{getvar::active}}' },
        { identifier: 'swipe-only', name: 'Swipe', content: 'Only for a swipe', injection_trigger: ['swipe'] },
    ]) {
        data.prompts.push(prompt);
        for (const profile of data.prompt_order) profile.order.push({ identifier: prompt.identifier, enabled: true });
    }
    return data;
}

function ghostTestEnvironment(options = {}) {
    const data = ghostFixture(), original = structuredClone(data);
    const env = environment(data, options);
    env.pm.shouldTrigger = (p, type) => !p?.injection_trigger?.length || p.injection_trigger.includes(type);
    const selected = type => env.pm.getPromptOrderForCharacter(env.pm.activeCharacter)
        .map(e => e.enabled && env.pm.getPromptById(e.identifier)).filter(p => p && env.pm.shouldTrigger(p, type));
    // Install the controller around the same synchronous collection shape used by ST.
    env.runtime.dispose();
    env.pm.getPromptCollection = function (type = 'normal') { return selected(type).map(p => this.preparePrompt(p)); };
    const runtime = createColdPromptRuntime({ events: env.events, types, getManager: () => env.pm, store: env.store, ...options });
    return { ...env, data, original, runtime, selected };
}

test('ghost source exists only inside a triggered assembly, including setter-only prompts', async () => {
    const h = ghostTestEnvironment();
    try {
        await h.runtime.importReady({ data: h.data });
        await h.runtime.ready(h.data, { evict: true });
        const sources = new Map(h.original.prompts.map(p => [p.identifier, p.content]));
        const requested = [], read = h.store.readMany.bind(h.store);
        h.store.readMany = (rows, callback) => { requested.push(...rows.map(p => p.identifier)); return read(rows, callback); };
        const p = h.pm.getPromptById('nemo-init-reset');
        assert.equal(p.content, '');
        assert.equal(await h.runtime.preflight([], 0, assert.fail, 'normal'), true);
        assert(requested.includes(p.identifier)); assert(!requested.includes('swipe-only')); assert(!requested.includes('optional'));
        assert.equal(p.content, '');
        const prepared = h.pm.getPromptCollection('normal');
        for (const entry of prepared) assert.equal(entry.content, sources.get(entry.identifier));
        assert.equal(p.content, '');
        assert.throws(() => h.pm.getPromptCollection('normal'), /not loaded/);
        const out = structuredClone(h.data); await h.runtime.exportReady(out);
        assert.deepEqual(out, h.original);
    } finally { h.runtime.dispose(); }
});

test('overlapping ghost requests consume their own passes and late enables fail before macros run', async () => {
    const h = ghostTestEnvironment();
    try {
        await h.runtime.importReady({ data: h.data });
        await Promise.all([h.runtime.preflight([], 0, assert.fail, 'normal'), h.runtime.preflight([], 0, assert.fail, 'normal')]);
        assert.deepEqual(h.pm.getPromptCollection('normal'), h.pm.getPromptCollection('normal'));
        await h.runtime.preflight([], 0, assert.fail, 'normal');
        h.data.prompt_order[0].order.find(e => e.identifier === 'optional').enabled = true;
        const before = h.pm.prepared.length;
        assert.throws(() => h.pm.getPromptCollection('normal'), /selection changed/);
        assert.equal(h.pm.prepared.length, before);
        await h.runtime.preflight([], 0, assert.fail, 'normal');
        assert(h.pm.getPromptCollection('normal').some(p => p.identifier === 'optional'));
    } finally { h.runtime.dispose(); }
});

test('ghost journal isolates profiles, restores a fresh session, and respects a newer native edit', async () => {
    const records = new Map(), journal = { async access(key, edits) {
        const id = JSON.stringify(key), flags = new Map(records.get(id));
        for (const [name, enabled] of edits || []) flags.set(name, enabled);
        records.set(id, [...flags]); return flags;
    } };
    const h = ghostTestEnvironment({ journal, getUser: () => 'test-user' });
    try {
        await h.runtime.importReady({ data: h.data });
        const persisted = structuredClone(h.data);
        const order = h.pm.getPromptOrderForCharacter(h.pm.activeCharacter);
        order.find(e => e.identifier === 'optional').enabled = true;
        assert(await h.runtime.saveToggles(h.pm, [['optional', true]]));
        assert.equal(h.saved.length, 0);
        const other = structuredClone(persisted);
        await h.runtime.restoreToggles(other, 'Other preset');
        assert.equal(other.prompt_order[0].order.find(e => e.identifier === 'optional').enabled, false);
        h.pm.serviceSettings = persisted; await h.runtime.restoreToggles(persisted);
        const entry = persisted.prompt_order[0].order.find(e => e.identifier === 'optional');
        assert.equal(entry.enabled, true);
        entry.enabled = false;
        await h.pm.saveServiceSettings(); await h.runtime.restoreToggles(persisted);
        assert.equal(entry.enabled, false);
    } finally { h.runtime.dispose(); }
});

test('export overlays switches onto the older named preset after upgrading legacy source packs', async () => {
    const changes = new Map(), journal = { async access(key, edits) {
        const id = JSON.stringify(key), flags = new Map(changes.get(id));
        for (const pair of edits || []) flags.set(...pair);
        changes.set(id, flags); return flags;
    } };
    const h = ghostTestEnvironment({ journal, getUser: () => 'test-user' });
    try {
        const rows = h.data.prompts.filter(p => eligible(p));
        const refs = await h.store.writeMany(rows.map(prompt => ({ prompt, content: prompt.content })));
        for (const p of rows) { p[BODY_KEY] = refs.get(p); p.content = refs.get(p).shell; }
        const savedNamedPreset = structuredClone(h.data);
        await h.runtime.ready(h.data, { evict: true });
        assert(h.runtime.isGhostPreset());
        await h.runtime.saveToggles(h.pm, [['optional', true]]);
        await h.runtime.exportReady(savedNamedPreset);
        h.original.prompt_order[0].order.find(e => e.identifier === 'optional').enabled = true;
        assert.deepEqual(savedNamedPreset, h.original);
    } finally { h.runtime.dispose(); }
});

test('a ghost row delegates native button clicks without fetching or replaying ST’s toggle', async () => {
    const h = ghostTestEnvironment();
    await h.runtime.importReady({ data: h.data });
    const browser = browserHarness(h);
    const id = 'optional', row = { dataset: { pmIdentifier: id } }, calls = [];
    const button = { closest: () => row, click: () => assert.fail('unexpected native toggle') };
    browser.sandbox.NemoPromptRendering = { async togglePrompt(value) { calls.push(value); } };
    const reads = h.store.stats.reads;
    try {
        const click = { target: { closest: () => button }, preventDefault() {}, stopImmediatePropagation() {} };
        browser.handlers.get('click')(click);
        assert.deepEqual(calls, [id]); assert.equal(h.store.stats.reads, reads);
        assert.equal(h.pm.getPromptById(id).content, '');
    } finally { browser.cleanupColdPrompts(); }
});

test('portable ghost exports preserve a missing or null extensions field', async () => {
    for (const kind of ['absent', 'null']) {
        const h = ghostTestEnvironment();
        try {
            if (kind === 'absent') delete h.data.extensions; else h.data.extensions = null;
            const expected = structuredClone(h.data);
            await h.runtime.importReady({ data: h.data });
            const out = structuredClone(h.data); await h.runtime.exportReady(out);
            assert.deepEqual(out, expected);
        } finally { h.runtime.dispose(); }
    }
});
