/** Offline production-hook import/export check. Never uploads or prints prompt prose. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRecipeRuntime } from '../features/recipe-runtime/controller.js';
import { RecipeStore } from '../features/recipe-runtime/store.js';
import { createVexRuntime } from '../features/vex-runtime/controller.js';
import { VexStore } from '../features/vex-runtime/store.js';
import { createColdPromptRuntime } from '../features/cold-prompts/controller.js';
import { PromptBodyStore } from '../features/cold-prompts/store.js';

const files = process.argv.slice(2);
assert(files.length, 'Usage: node scripts/validate-preset-imports.mjs PRESET.json [PRESET.json ...]');
const types = Object.fromEntries(['OAI_PRESET_IMPORT_READY', 'OAI_PRESET_EXPORT_READY', 'APP_READY',
    'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS',
    'GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY']
    .map(type => [type, type]));

function setup(preset, disk) {
    const handlers = new Map(), errors = [];
    const events = {
        on(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
        removeListener(type, fn) { handlers.set(type, (handlers.get(type) ?? []).filter(f => f !== fn)); },
        async emit(type, ...args) {
            // Match ST's swallowed event exceptions, then explicitly check them.
            for (const fn of [...handlers.get(type) ?? []]) try { await fn(...args); } catch (error) { errors.push(error); }
            if (errors.length) throw errors[0];
        },
    };
    const fetchFn = async (url, options = {}) => {
        if (url === '/api/files/upload') {
            const { name, data } = JSON.parse(options.body), target = '/user/files/' + name;
            disk.set(target, Buffer.from(data, 'base64').toString('utf8'));
            return Response.json({ path: target });
        }
        return disk.has(url) ? new Response(disk.get(url)) : new Response('missing', { status: 404 });
    };
    const manager = {
        serviceSettings: preset, activeCharacter: { id: preset.prompt_order[0].character_id },
        getPromptOrderForCharacter() { return this.serviceSettings.prompt_order.find(p => p.character_id === this.activeCharacter.id).order; },
        preparePrompt(prompt) { return { ...prompt }; },
        getPromptCollection() { return this.serviceSettings.prompts; },
        async tryGenerate() {}, async saveServiceSettings() {}, loadPromptIntoEditForm() {},
        import(data) { return data; }, export(data) { return data; },
    };
    const getContext = () => ({ mainApi: 'openai', variables: { local: { get: () => '', del() {} } } });
    const options = { events, types, getManager: () => manager, getContext };
    const recipe = createRecipeRuntime({ ...options, store: new RecipeStore({ fetchFn }) });
    let cold;
    const vex = createVexRuntime({ ...options, store: new VexStore({ fetchFn }), readBody: p => cold.readBody(p) });
    cold = createColdPromptRuntime({ ...options, store: new PromptBodyStore({ fetchFn }) });
    return { manager, events, recipe, vex, cold, dispose() { cold.dispose(); vex.dispose(); recipe.dispose(); } };
}

for (const file of files) {
    const original = JSON.parse(await fs.readFile(file, 'utf8')), disk = new Map();
    let current = setup(structuredClone(original), disk);
    try {
        await current.events.emit(types.OAI_PRESET_IMPORT_READY, { data: current.manager.serviceSettings });
        const serialized = JSON.stringify(current.manager.serviceSettings);
        // A new extension instance must read the saved catalog, not an import cache.
        current.dispose(); current = setup(JSON.parse(serialized), disk);
        await current.events.emit(types.OAI_PRESET_IMPORT_READY, { data: current.manager.serviceSettings });
        for (const profile of current.manager.serviceSettings.prompt_order) {
            current.manager.activeCharacter.id = profile.character_id;
            await current.cold.ready(); await current.vex.ready(); await current.recipe.ready();
        }
        const exported = structuredClone(current.manager.serviceSettings);
        await current.events.emit(types.OAI_PRESET_EXPORT_READY, exported);
        assert.equal(JSON.stringify(exported) === JSON.stringify(original), true, 'Portable export changed source text or settings.');
        console.log(JSON.stringify({ file: path.basename(file), profiles: original.prompt_order.length,
            storedFiles: disk.size, exactPortableRoundTrip: true, freshRuntimeReimport: true,
            nativeSTMacroEngineTested: false, nativeBrowserTested: false }));
    } finally { current.dispose(); }
}
