import assert from 'node:assert/strict';
import test from 'node:test';
import { Script } from 'node:vm';
import { readFileSync } from 'node:fs';
import { createColdPromptRuntime } from '../features/cold-prompts/controller.js';
import { PromptBodyStore } from '../features/cold-prompts/store.js';
import { isCold, descriptorOf, shellFor } from '../features/cold-prompts/format.js';
import { RecipeStore } from '../features/recipe-runtime/store.js';
import { createRecipeRuntime } from '../features/recipe-runtime/controller.js';
import { DEFAULT_ID, INDEX_ID, GUARD_ID, RESOLVER_ID, GUARD_TEXT, RESOLVER_TEXT, runtimeOf } from '../features/recipe-runtime/format.js';
import { directiveProjection } from '../features/prompt-performance/metadata-index.js';
import { PromptBodySearch } from '../features/prompt-performance/search-client.js';

class Events {
    handlers = new Map();
    on(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(fn); }
    makeFirst(type, fn) { this.on(type, fn); const a = this.handlers.get(type); a.unshift(a.pop()); }
    removeListener(type, fn) { this.handlers.set(type, (this.handlers.get(type) ?? []).filter(f => f !== fn)); }
    async emit(type, ...args) { for (const fn of [...(this.handlers.get(type) ?? [])]) await fn(...args); }
}
const types = Object.fromEntries(['OAI_PRESET_IMPORT_READY', 'OAI_PRESET_EXPORT_READY', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY', 'APP_READY'].map(k => [k, k]));
function fixture() {
    const sources = [
        [DEFAULT_ID, '{{setvar::NCGenreId::slice_of_life}}{{setvar::NCAuthorId::nemo_manuscript}}{{setvar::NCStyleId::modern_literature}}'],
        [INDEX_ID, '{{setvar::NG_slice_of_life::aa}}{{setvar::NA_nemo_manuscript::aa}}{{setvar::NS_modern_literature::aa}}'],
        [GUARD_ID, GUARD_TEXT],
        ['nemo-init-recipes-slice_of_life-01', '{{#if {{.NCGenreId == slice_of_life}}}}{{setvar::NPaaaaaa::EXACT RECIPE}}{{/if}}'],
        [RESOLVER_ID, RESOLVER_TEXT],
        ['nemo-user-role-character', '{{// @category Roles }}\nKeep player control.'],
        ['optional', '{{// @tooltip Optional }}\n' + 'Worker-only phrase. '.repeat(80) + '\n{{// @requires nemo-user-role-character }}'],
        ['v11-classic-user-message-ender', 'Finish here.'],
    ];
    const prompts = sources.map(([identifier, content]) => ({ identifier, name: identifier, role: 'system', system_prompt: false, content }));
    return { preset_name: 'Nemo Engine v12 Full', prompts, prompt_order: [{ character_id: 100001, order: prompts.map(p => ({ identifier: p.identifier, enabled: p.identifier !== 'optional' })) }], extensions: { regex_scripts: [{ scriptName: 'unchanged' }] } };
}
function setup() {
    const files = new Map();
    const fetchFn = async (url, options = {}) => {
        let text, status = 200;
        if (url === '/api/files/upload') {
            const { name, data } = JSON.parse(options.body);
            files.set(`/files/${name}`, Buffer.from(data, 'base64').toString('utf8'));
            text = JSON.stringify({ path: `files/${name}` });
        } else { text = files.get(url); if (text === undefined) { status = 404; text = ''; } }
        return { ok: status === 200, status, text: async () => text };
    };
    const events = new Events(), original = fixture();
    const variables = { NCGenreId: 'slice_of_life', NCAuthorId: 'nemo_manuscript', NCStyleId: 'modern_literature', NG_slice_of_life: 'aa', NA_nemo_manuscript: 'aa', NS_modern_literature: 'aa' };
    const getContext = () => ({ variables: { local: { get: key => variables[key] } }, mainApi: 'openai', stopGeneration() {} });
    const pm = {
        serviceSettings: structuredClone(original), activeCharacter: { id: 100001 }, prepared: [],
        getPromptOrderForCharacter(c) { return this.serviceSettings.prompt_order.find(p => p.character_id === c.id).order; },
        preparePrompt(p) { this.prepared.push(p); return p; },
        getPromptCollection() { return this.getPromptOrderForCharacter(this.activeCharacter).filter(e => e.enabled).map(e => this.preparePrompt(this.serviceSettings.prompts.find(p => p.identifier === e.identifier))); },
        async tryGenerate() { return this.getPromptCollection(); }, async saveServiceSettings() {},
        loadPromptIntoEditForm() {}, import() {}, export(data) { return JSON.stringify(data); },
    };
    const recipe = createRecipeRuntime({ events, types, getManager: () => pm, getContext, store: new RecipeStore({ fetchFn }) });
    const cold = createColdPromptRuntime({ events, types, getManager: () => pm, getContext, store: new PromptBodyStore({ fetchFn }) });
    return { pm, events, original, recipe, cold, files };
}
test('Stage 1 and Stage 3 compose across native import, select, prepare and portable export', async () => {
    const env = setup();
    try {
        await env.events.emit(types.OAI_PRESET_IMPORT_READY, { data: env.pm.serviceSettings });
        assert.ok(runtimeOf(env.pm.serviceSettings));
        const clone = structuredClone(env.pm.serviceSettings);
        await env.events.emit(types.OAI_PRESET_CHANGED_BEFORE, { preset: clone });
        env.pm.serviceSettings = clone;
        await env.pm.tryGenerate();
        const resolver = env.pm.prepared.find(p => p.identifier === RESOLVER_ID);
        assert.equal(resolver.content, '{{setvar::NPaaaaaa::EXACT RECIPE}}{{trim}}' + RESOLVER_TEXT);
        assert.equal(isCold(clone.prompts.find(p => p.identifier === 'optional')), true);
        const out = structuredClone(clone);
        await env.events.emit(types.OAI_PRESET_EXPORT_READY, out);
        assert.deepEqual(out, env.original);
        assert.ok(runtimeOf(env.pm.serviceSettings));
    } finally { env.cold.dispose(); env.recipe.dispose(); }
});
test('cold metadata preserves the original complete directive language', () => {
    const source = readFileSync(new URL('../features/directives/prompt-directive-rules.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
    const parse = new Script(`(() => { ${source}\nreturn parsePromptDirectives; })()`).runInNewContext({ logger: { debug() {}, warn() {}, error() {} }, promptManager: null, getContext: () => ({}) });
    for (const text of [fixture().prompts[6].content, '{{// Intro }}\nBody\n{{// @message-range 5-10\n@mutual-exclusive-group Mode\n@requires Foo\n@category Test }}']) {
        assert.equal(JSON.stringify(parse(text)), JSON.stringify(parse(shellFor(text))));
        assert.equal(directiveProjection(text), directiveProjection(shellFor(text)));
    }
});
test('worker search reads cold bodies without warming the active source or caching raw cold text on the main side', async () => {
    const env = setup();
    const documents = new Map();
    const createWorker = () => ({
        terminate() {},
        postMessage(message) {
            let result = true;
            if (message.type === 'begin') documents.set(message.id, '');
            if (message.type === 'chunk') documents.set(message.id, documents.get(message.id) + message.text);
            if (message.type === 'search') result = [...documents].filter(([, text]) => text.includes(message.query)).map(([id]) => id);
            queueMicrotask(() => this.onmessage({ data: { request: message.request, result } }));
        },
    });
    const search = new PromptBodySearch({ createWorker, readContent: env.cold.readBody, yieldTask: async () => {} });
    try {
        await env.events.emit(types.OAI_PRESET_IMPORT_READY, { data: env.pm.serviceSettings });
        const p = env.pm.serviceSettings.prompts.find(p => p.identifier === 'optional');
        const shell = p.content;
        const matches = await search.search('Worker-only phrase', [p]);
        assert.ok(matches.has(p.identifier)); assert.equal(p.content, shell); assert.equal(isCold(p), true);
        assert.equal(search.loaded.get(p.identifier), descriptorOf(p));
        const reads = env.cold.getStats().store.reads;
        await search.search('phrase', [p]); assert.equal(env.cold.getStats().store.reads, reads);
    } finally { search.dispose(); env.cold.dispose(); env.recipe.dispose(); }
});
