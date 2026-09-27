import { isCandidate, runtimeOf, selectedKey, planExtraction, blockSerialization, RESOLVER_ID, RESOLVER_TEXT, LOADER_TEXT } from './format.js';

/** Dependency-injected lifecycle controller. No global tokenizer patches or async getters. */
export function createRecipeRuntime({ events, types, getManager, getContext, store, notify = () => {}, autoExtract = () => true }) {
    let disposed = false;
    let manager = null;
    let manifestCache = null;
    let fault = null;
    let generationType = 'normal';
    const listeners = [];
    const originals = new Map();
    const selectedCache = new Map();
    const pending = new Map();
    const stats = { imports: 0, materializations: 0, cacheHits: 0 };
    const identity = preset => runtimeOf(preset)?.manifest?.sha256;
    const active = () => getManager()?.serviceSettings;
    const orderFor = preset => {
        const pm = getManager();
        if (preset === pm?.serviceSettings) return pm.getPromptOrderForCharacter(pm.activeCharacter);
        const id = pm?.activeCharacter?.id ?? 100001;
        return preset.prompt_order.find(p => p.character_id === id)?.order ?? preset.prompt_order[0]?.order;
    };
    const activeFault = () => fault && fault.identity === identity(active());
    const fail = (error, preset = active()) => {
        fault = { identity: identity(preset), error };
        if (getManager()) getManager().error = error.message;
        notify(error.message, 'error');
        return error;
    };
    const stop = () => getContext()?.stopGeneration?.();

    async function ready(preset = active(), type = generationType) {
        if (!runtimeOf(preset)) return null;
        if (disposed) throw new Error('Nemo recipe runtime is stopped. Restore the extension before generating.');
        const key = selectedKey(preset, orderFor(preset), type);
        if (key === null) return null;
        const id = identity(preset);
        const cacheKey = `${id}:${key}`;
        if (selectedCache.has(cacheKey)) {
            const statement = selectedCache.get(cacheKey);
            selectedCache.delete(cacheKey);
            selectedCache.set(cacheKey, statement);
            stats.cacheHits++;
            return { key, statement };
        }
        if (pending.has(cacheKey)) return pending.get(cacheKey);
        const load = (async () => {
            let manifest;
            if (manifestCache?.id === id && manifestCache.path === runtimeOf(preset).manifest.path) manifest = manifestCache.value;
            else {
                manifest = await store.manifest(preset);
                if (!disposed) manifestCache = { id, path: runtimeOf(preset).manifest.path, value: manifest };
            }
            const statement = await store.selected(manifest, key);
            if (!disposed) {
                selectedCache.set(cacheKey, statement);
                while (selectedCache.size > 2) selectedCache.delete(selectedCache.keys().next().value);
                stats.materializations++;
            }
            return { key, statement };
        })();
        pending.set(cacheKey, load);
        try { return await load; } finally { pending.delete(cacheKey); }
    }

    function wrap(name, factory) {
        if (typeof manager[name] !== 'function') return;
        const original = manager[name];
        const replacement = factory(original);
        originals.set(name, { original, replacement });
        manager[name] = replacement;
    }

    function attach() {
        const next = getManager();
        if (!next || next === manager) return;
        detach();
        if (typeof next.preparePrompt !== 'function' || typeof next.tryGenerate !== 'function') throw new Error('Unsupported ST PromptManager; Nemo recipe acceleration was not attached.');
        manager = next;
        wrap('tryGenerate', original => async function (...args) {
            try { await ready(this.serviceSettings, 'normal'); }
            catch (error) { fail(error); return; }
            return original.apply(this, args);
        });
        wrap('preparePrompt', original => function (prompt, ...args) {
            if (!runtimeOf(this.serviceSettings) || prompt.identifier !== RESOLVER_ID) return original.call(this, prompt, ...args);
            try {
                if (prompt.content !== LOADER_TEXT) throw new Error('The optimized recipe loader was edited. Export portable before changing resolver logic.');
                const vars = getContext()?.variables?.local;
                if (!vars?.get) throw new Error('ST local variable API is unavailable.');
                const key = 'NP' + vars.get(`NG_${vars.get('NCGenreId')}`) + vars.get(`NA_${vars.get('NCAuthorId')}`) + vars.get(`NS_${vars.get('NCStyleId')}`);
                const statement = selectedCache.get(`${identity(this.serviceSettings)}:${key}`);
                if (!statement) throw new Error(`Recipe ${key} was not prepared. Selection changed during assembly; retry after refreshing the preset.`);
                // Execute exactly one ORIGINAL setter, then the ORIGINAL resolver, at its original slot.
                // Native ST keeps responsibility for scoped whitespace, variables and model token counts.
                return original.call(this, { ...prompt, content: `${statement}{{trim}}${RESOLVER_TEXT}` }, ...args);
            } catch (error) { fail(error); stop(); throw error; }
        });
        wrap('export', original => async function (data, ...args) {
            if (!runtimeOf(this.serviceSettings) || !data.prompts?.some(p => p.identifier === RESOLVER_ID)) return original.call(this, data, ...args);
            try {
                const temporary = {
                    ...this.serviceSettings, prompts: data.prompts,
                    prompt_order: [{ character_id: this.activeCharacter?.id, order: data.prompt_order ?? [] }],
                };
                const restored = await store.restore(temporary);
                return original.call(this, { ...data, prompts: restored.prompts, prompt_order: restored.prompt_order[0].order }, ...args);
            } catch (error) { notify(error.message, 'error'); }
        });
        wrap('import', original => function (data, ...args) {
            const prompts = data?.data?.prompts ?? [];
            if (prompts.some(p => /^nemo-init-recipes-/.test(p.identifier) || (p.identifier === RESOLVER_ID && p.content === LOADER_TEXT))) {
                notify('Import Nemo Full using the Chat Completion preset import button, not the partial prompt-list importer.', 'error');
                return;
            }
            return original.call(this, data, ...args);
        });
    }

    function detach() {
        if (manager) for (const [name, { original, replacement }] of originals) if (manager[name] === replacement) manager[name] = original;
        originals.clear();
        manager = null;
    }

    async function importReady({ data }) {
        if (!runtimeOf(data) && (!isCandidate(data) || !autoExtract())) return;
        try {
            attach();
            if (!manager) throw new Error('Wait for SillyTavern to finish starting before importing Nemo Full.');
            if (runtimeOf(data)) { await store.manifest(data); return; }
            notify('Preparing Nemo recipe storage. The original preset remains intact until verification finishes.', 'info');
            const plan = planExtraction(data);
            const compact = await store.extract(data, plan);
            // Preload the default selected recipe before ST's first automatic dry run.
            await ready(compact, 'normal');
            Object.assign(data, compact);
            stats.imports++;
            notify(`Nemo optimized: ${plan.banks.length} recipe partitions moved out of the preset.`, 'success');
        } catch (error) {
            // Throwing alone does not abort ST's EventEmitter. A serialization barrier stops
            // the subsequent native /api/presets/save call BEFORE any settings are changed.
            blockSerialization(data, error);
            notify(`Nemo import stopped: ${error.message} Your source file has not been changed.`, 'error');
            throw error;
        }
    }

    async function exportReady(data) {
        if (!runtimeOf(data)) return;
        try { Object.assign(data, await store.restore(data)); }
        catch (error) { blockSerialization(data, error); notify(`Portable export stopped: ${error.message}`, 'error'); throw error; }
    }

    function on(type, fn) {
        if (!type) return;
        events.on(type, fn);
        listeners.push([type, fn]);
    }
    on(types.OAI_PRESET_IMPORT_READY, importReady);
    on(types.OAI_PRESET_EXPORT_READY, exportReady);
    on(types.APP_READY, attach);
    on(types.OAI_PRESET_CHANGED_BEFORE, async ({ preset }) => {
        attach();
        fault = null;
        try { await ready(preset, 'normal'); } catch (error) { fail(error, preset); }
    });
    on(types.GENERATION_STARTED, type => { generationType = String(type || 'normal'); fault = null; attach(); });
    on(types.GENERATION_AFTER_COMMANDS, async (type, _options, dryRun) => {
        try { await ready(active(), String(type || 'normal')); }
        catch (error) { fail(error); if (!dryRun) stop(); }
    });
    on(types.CHAT_COMPLETION_PROMPT_READY, data => {
        if (activeFault()) { data.chat = []; stop(); }
    });
    on(types.CHAT_COMPLETION_SETTINGS_READY, data => {
        if (activeFault()) { blockSerialization(data, fault.error); stop(); }
    });
    try { attach(); } catch (error) { notify(error.message, 'error'); }

    return {
        ready, importReady, exportReady, attach,
        async preflight(_chat, _size, abort, type) {
            try { await ready(active(), String(type || 'normal')); }
            catch (error) { fail(error); abort(true); }
        },
        getStats: () => ({ ...stats, cachedRecipes: selectedCache.size, cachedCharacters: [...selectedCache.values()].reduce((n, s) => n + s.length, 0) }),
        dispose() {
            disposed = true;
            for (const [type, fn] of listeners) events.removeListener(type, fn);
            listeners.length = 0;
            detach(); selectedCache.clear(); manifestCache = null; fault = null;
        },
    };
}
