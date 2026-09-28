import { BANKS, RESET, RESOLVE, ASSEMBLE, runtimeOf, candidate, loader, requireThat, blockSerialization, validatePrograms, planExtraction, dependencies, indexPrompts } from './format.js';

/** Native ST remains the only writer of resolved Vex output. Async preflight only
 * discovers the original library setters to make available at synchronous slots.
 */
export function createVexRuntime({
    events, types, getManager, getContext = () => ({}), store,
    readBody = async p => p.content ?? '', notify = () => {}, autoExtract = () => true,
    validate = validatePrograms, planImport = planExtraction,
}) {
    let manager = null, disposed = false, prepared = null, manifestCache = null, pending = null, ticket = 0, fault = null;
    let generationType = 'normal';
    const originals = new Map(), listeners = [];
    const stats = { imports: 0, loads: 0, cacheHits: 0, rejectedStale: 0 };
    const active = () => getManager()?.serviceSettings;
    const stop = () => getContext()?.stopGeneration?.();
    const isChat = () => !getContext()?.mainApi || getContext().mainApi === 'openai';
    const identity = p => runtimeOf(p)?.manifest?.sha256;
    function fail(error, preset = active()) {
        fault = { array: preset?.prompts, error };
        if (preset?.prompts === active()?.prompts && getManager()) getManager().error = error.message;
        notify(error.message, 'error'); return error;
    }
    function orderFor(preset) {
        const pm = getManager();
        if (preset === pm?.serviceSettings) return pm.getPromptOrderForCharacter(pm.activeCharacter) ?? [];
        return preset.prompt_order?.find(o => o.character_id === (pm?.activeCharacter?.id ?? 100001))?.order ?? preset.prompt_order?.[0]?.order ?? [];
    }
    function snapshot(preset, type) {
        const order = orderFor(preset), enabled = new Set(order.filter(e => e.enabled).map(e => e.identifier));
        return { preset, array: preset.prompts, identity: identity(preset), path: runtimeOf(preset)?.manifest?.path, type,
            order: order.map(e => `${e.identifier}:${Boolean(e.enabled)}`).join('|'),
            sources: preset.prompts.filter(p => enabled.has(p.identifier) || [RESET, RESOLVE, ASSEMBLE, ...BANKS].includes(p.identifier)).map(p => [p, p.content, p.injection_position, JSON.stringify(p.injection_trigger), p.marker]),
        };
    }
    function equal(a, b) {
        return a?.array === b?.array && a.identity === b.identity && a.path === b.path && a.type === b.type && a.order === b.order && a.sources.length === b.sources.length
            && a.sources.every((row, i) => row.every((value, j) => value === b.sources[i][j]));
    }
    function unchanged(s) { return equal(s, snapshot(s.preset, s.type)); }
    async function ready(preset = active(), type = generationType) {
        if (!runtimeOf(preset)) return null;
        requireThat(!disposed, 'extension runtime is stopped.');
        const snap = snapshot(preset, type);
        if (prepared && equal(snap, prepared.snapshot)) { stats.cacheHits++; if (fault?.array === preset.prompts) fault = null; return prepared; }
        if (pending && equal(snap, pending.snapshot)) return pending.promise;
        const sequence = ++ticket;
        const promise = (async () => {
            let manifest;
            if (manifestCache?.identity === snap.identity && manifestCache.path === snap.path) manifest = manifestCache.value;
            else manifest = await store.manifest(preset);
            const activeIds = new Set(orderFor(preset).filter(e => e.enabled).map(e => e.identifier));
            const contract = await validate(preset, readBody, activeIds, manifest.selectors);
            for (const id of BANKS) requireThat(contract.byId.get(id)?.content === loader(id), 'Vex library loader changed. Reimport portable to change library content.');
            const selection = dependencies(preset, orderFor(preset), contract, manifest, type);
            const materialized = await store.selected(manifest, selection.reads);
            const result = { snapshot: snap, selection, ...materialized,
                keysByBank: BANKS.map((_, i) => Object.keys(manifest.locations).filter(k => manifest.locations[k][0] === i)),
            };
            if (disposed || sequence !== ticket || !unchanged(snap)) {
                stats.rejectedStale++;
                throw new Error('Vex selection changed during loading. Retry after the preset settles.');
            }
            // Drop the old route and its setter strings. Keep one prepared route only.
            prepared = result;
            manifestCache = { identity: snap.identity, path: snap.path, value: manifest };
            fault = null; stats.loads++;
            return result;
        })();
        pending = { snapshot: snap, promise };
        try { return await promise; } finally { if (pending?.promise === promise) pending = null; }
    }
    function requirePrepared() {
        requireThat(prepared && equal(prepared.snapshot, snapshot(active(), generationType)), 'selected Vex library is not ready; generation was blocked.');
        return prepared;
    }
    const comparable = v => { const s = String(v ?? ''); return s.trim() !== '' && !Number.isNaN(Number(s)) ? String(Number(s)) : s; };
    function checkRoute(vars, selection) {
        for (const [key, value] of Object.entries(selection.route)) requireThat(comparable(vars.get(key)) === comparable(value), `native Vex route diverged at ${key}; no alternate council was substituted.`);
    }
    function wrap(name, factory) {
        if (typeof manager[name] !== 'function') return;
        const original = manager[name], replacement = factory(original);
        originals.set(name, { original, replacement }); manager[name] = replacement;
    }
    function detach() {
        if (manager) for (const [name, pair] of originals) if (manager[name] === pair.replacement) manager[name] = pair.original;
        originals.clear(); manager = null;
    }
    function attach() {
        const next = getManager(); if (!next || next === manager) return;
        detach(); manager = next;
        wrap('tryGenerate', original => async function (...args) {
            const array = this.serviceSettings.prompts;
            try { await ready(this.serviceSettings, 'normal'); }
            catch (error) { fail(error); return; }
            if (array !== this.serviceSettings.prompts || disposed) return;
            generationType = 'normal';
            return original.apply(this, args);
        });
        wrap('preparePrompt', original => function (prompt, ...args) {
            if (!runtimeOf(this.serviceSettings) || ![...BANKS, RESOLVE, ASSEMBLE].includes(prompt.identifier)) return original.call(this, prompt, ...args);
            try {
                const loaded = requirePrepared(), vars = getContext()?.variables?.local;
                requireThat(vars?.get && vars?.del, 'native local-variable API is unavailable.');
                const bank = BANKS.indexOf(prompt.identifier);
                if (bank >= 0) {
                    requireThat(prompt.content === loader(prompt.identifier), 'unexpected Vex loader content.');
                    // Remove stale values from earlier raw/optimized selections. Only
                    // this verified library's keys are touched, never arbitrary user vars.
                    for (const name of loaded.keysByBank[bank]) if (vars.has ? vars.has(name) : vars.get(name) !== '') vars.del(name);
                    return original.call(this, { ...prompt, content: loaded.bodies[prompt.identifier] }, ...args);
                }
                if (prompt.identifier === RESOLVE) {
                    for (const [key, value] of Object.entries(loaded.selection.state)) if (key.startsWith('NVCR1_raw_')) {
                        requireThat(comparable(vars.get(key)) === comparable(value), 'Vex selector state changed during native assembly.');
                    }
                    const result = original.call(this, prompt, ...args);
                    checkRoute(vars, loaded.selection);
                    return result;
                }
                checkRoute(vars, loaded.selection);
                return original.call(this, prompt, ...args);
            } catch (error) { fail(error); stop(); throw error; }
        });
        wrap('export', original => async function (data, ...args) {
            if (!runtimeOf(this.serviceSettings) || !data?.prompts?.some(p => BANKS.includes(p.identifier))) return original.call(this, data, ...args);
            try {
                const restored = await store.restore({ ...this.serviceSettings, prompts: data.prompts }, { partial: true });
                return original.call(this, { ...data, prompts: restored.prompts }, ...args);
            } catch (error) { notify(`Vex prompt export stopped: ${error.message}`, 'error'); }
        });
        wrap('import', original => function (data, ...args) {
            if (data?.data?.prompts?.some(p => BANKS.includes(p.identifier) || p.content === loader(p.identifier))) {
                notify('Import Vex libraries using the Chat Completion preset importer, not partial prompt import.', 'error'); return;
            }
            return original.call(this, data, ...args);
        });
    }
    async function importReady({ data }) {
        if (!runtimeOf(data) && (!candidate(data) || !autoExtract())) return;
        try {
            attach();
            requireThat(manager && ['tryGenerate', 'preparePrompt', 'export', 'import'].every(k => typeof manager[k] === 'function'), 'required ST boundaries unavailable.');
            if (runtimeOf(data)) {
                // Verify every source once on import; cache is never the sole copy.
                await store.restore(data); return;
            }
            const plan = await planImport(data, readBody);
            const compact = await store.extract(data, plan);
            requireThat(!disposed, 'import cancelled.');
            Object.assign(data, compact); stats.imports++;
            notify(`Nemo Vex library optimized: ${Object.keys(plan.locations).length} static assignments stored separately.`, 'success');
        } catch (error) { blockSerialization(data, error); notify(`Vex import stopped: ${error.message}`, 'error'); throw error; }
    }
    async function exportReady(data) {
        if (!runtimeOf(data)) return;
        try { Object.assign(data, await store.restore(data)); }
        catch (error) { blockSerialization(data, error); notify(`Vex export stopped: ${error.message}`, 'error'); throw error; }
    }
    function on(key, fn) {
        if (!types[key]) return;
        events.on(types[key], fn); listeners.push([types[key], fn]);
    }
    on('OAI_PRESET_IMPORT_READY', importReady);
    on('OAI_PRESET_EXPORT_READY', exportReady);
    on('APP_READY', attach);
    on('OAI_PRESET_CHANGED_BEFORE', async ({ preset }) => {
        ticket++; prepared = null; fault = null; attach();
        try { await ready(preset, 'normal'); } catch (error) { fail(error, preset); }
    });
    on('GENERATION_STARTED', type => { generationType = String(type || 'normal'); fault = null; attach(); });
    on('GENERATION_AFTER_COMMANDS', async (type, _options, dryRun) => {
        if (!isChat()) return;
        try { await ready(active(), String(type || 'normal')); } catch (error) { fail(error); if (!dryRun) stop(); }
    });
    on('CHAT_COMPLETION_PROMPT_READY', data => { if (fault?.array === active()?.prompts && fault) { data.chat = []; stop(); } });
    on('CHAT_COMPLETION_SETTINGS_READY', data => {
        if (runtimeOf(active())) {
            try { requirePrepared(); } catch (error) { fail(error); }
            if (fault?.array === active()?.prompts && fault) { blockSerialization(data, fault.error); stop(); }
        }
    });
    attach();
    return {
        ready, importReady, exportReady, attach,
        async preflight(_chat, _size, abort, type) {
            if (!isChat()) return true;
            try { generationType = String(type || 'normal'); await ready(active(), generationType); return true; }
            catch (error) { fail(error); abort(true); return false; }
        },
        getStats: () => ({ stage: '4/5', ...stats, cachedRoutes: prepared ? 1 : 0, cachedSetterCharacters: prepared?.characters ?? 0, selectedAssignments: prepared?.selection.reads.size ?? 0 }),
        dispose() {
            disposed = true; ticket++;
            for (const [key, fn] of listeners) events.removeListener(key, fn);
            listeners.length = 0; detach(); prepared = null; manifestCache = null; pending = null; fault = null;
        },
    };
}
