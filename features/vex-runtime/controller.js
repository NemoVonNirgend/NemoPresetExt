import { BANKS, RESET, RESOLVE, ASSEMBLE, runtimeOf, candidate, loader, requireThat,
    blockSerialization, validatePrograms, planExtraction, dependencies, comparable } from './format.js';

/** Async source preparation, synchronous native execution. No replacement council. */
export function createVexRuntime({ events, types, getManager, getContext = () => ({}), store,
    readBody = async p => p.content ?? '', notify = () => {}, autoExtract = () => true,
    validate = validatePrograms, planImport = planExtraction,
}) {
    let manager = null, disposed = false, prepared = null, catalog = null, pending = null;
    let ticket = 0, fault = null, pass = null, generationType = 'normal', generationActive = false;
    const originals = new Map(), listeners = [];
    const stats = { imports: 0, loads: 0, cacheHits: 0, rejectedStale: 0 };
    const active = () => getManager()?.serviceSettings;
    const stop = () => getContext()?.stopGeneration?.();
    const isChat = () => !getContext()?.mainApi || getContext().mainApi === 'openai';
    const selectedIds = new Set([RESET, RESOLVE, ASSEMBLE, ...BANKS]);
    function fail(error, array = active()?.prompts) {
        // A late read from an old preset must not poison the newly selected one.
        fault = { array, error };
        if (array === active()?.prompts && getManager()) getManager().error = error.message;
        notify(error.message, 'error'); return error;
    }
    function orderFor(preset) {
        const pm = getManager();
        if (preset === pm?.serviceSettings) return pm.getPromptOrderForCharacter(pm.activeCharacter) ?? [];
        return preset.prompt_order?.find(p => p.character_id === (pm?.activeCharacter?.id ?? 100001))?.order
            ?? preset.prompt_order?.[0]?.order ?? [];
    }
    function snapshot(preset, type, all = false) {
        const order = orderFor(preset), enabled = new Set(order.filter(e => e.enabled).map(e => e.identifier));
        return { preset, array: preset.prompts, descriptor: JSON.stringify(runtimeOf(preset)), type, all,
            order: JSON.stringify(all ? preset.prompt_order : order),
            sources: preset.prompts.filter(p => all || enabled.has(p.identifier) || selectedIds.has(p.identifier))
                .map(p => [p, p.identifier, p.content, p.injection_position, p.marker,
                    JSON.stringify(p.injection_trigger), JSON.stringify(p.nemoPromptBody)]),
        };
    }
    function equal(a, b) {
        return a?.array === b?.array && a.descriptor === b.descriptor && a.type === b.type && a.order === b.order
            && a.sources.length === b.sources.length && a.sources.every((r, i) => r.every((v, j) => v === b.sources[i][j]));
    }
    const unchanged = s => equal(s, snapshot(s.preset, s.type, s.all));
    function drop() { ticket++; prepared = null; catalog = null; pending = null; pass = null; fault = null; }
    async function ready(preset = active(), type = generationType) {
        if (!runtimeOf(preset)) return null;
        requireThat(!disposed, 'Vex runtime is stopped.');
        const snap = snapshot(preset, type);
        if (prepared && equal(snap, prepared.snapshot)) { stats.cacheHits++; return prepared; }
        if (pending && equal(snap, pending.snapshot)) return pending.promise;
        const sequence = ++ticket;
        const work = (async () => {
            const m = catalog?.descriptor === snap.descriptor ? catalog.value : await store.manifest(preset);
            const ids = new Set(orderFor(preset).filter(e => e.enabled).map(e => e.identifier));
            const contract = await validate(preset, readBody, ids);
            for (const id of BANKS) requireThat(contract.byId.get(id)?.content === loader(id), 'Vex loader was edited; export portable to edit the library.');
            const selection = dependencies(preset, orderFor(preset), contract, m, type);
            const materialized = await store.selected(m, selection.reads);
            if (disposed || sequence !== ticket || !unchanged(snap)) {
                stats.rejectedStale++;
                throw new Error('Vex selection changed during loading. Retry after it settles.');
            }
            // No source banks survive: one selected route, exact setter strings,
            // and a bounded scalar/offset catalog only.
            prepared = { snapshot: snap, selection, ...materialized,
                keysByBank: m.sourceIndex.banks.map(b => b.entries.map(e => e.name)) };
            catalog = { descriptor: snap.descriptor, value: m };
            pass = null; fault = null; stats.loads++;
            return prepared;
        })();
        pending = { snapshot: snap, promise: work };
        try { return await work; } finally { if (pending?.promise === work) pending = null; }
    }
    function requirePrepared() {
        requireThat(prepared && equal(prepared.snapshot, snapshot(active(), generationType)), 'selected Vex source is not ready; generation was blocked.');
        return prepared;
    }
    function checkValues(vars, expected, label) {
        for (const [key, value] of Object.entries(expected)) requireThat(comparable(vars.get(key)) === comparable(value),
            `native Vex ${label} diverged at ${key}; no alternate council was substituted.`);
    }
    function checkComplete() {
        const loaded = requirePrepared();
        if (!loaded.selection.used) return;
        requireThat(pass?.owner === loaded && pass.resolved, 'native Vex resolution did not finish.');
        const order = orderFor(active()), assembler = active().prompts.find(p => p.identifier === ASSEMBLE);
        if (order.some(e => e.identifier === ASSEMBLE && e.enabled)
            && (!assembler.injection_trigger?.length || assembler.injection_trigger.includes(generationType))) {
            requireThat(pass.assembled, 'native Vex assembly did not finish.');
        }
    }
    function wrap(name, factory) {
        if (typeof manager[name] !== 'function') return;
        const original = manager[name], replacement = factory(original);
        originals.set(name, { original, replacement }); manager[name] = replacement;
    }
    function detach() {
        if (manager) for (const [key, pair] of originals) if (manager[key] === pair.replacement) manager[key] = pair.original;
        originals.clear(); manager = null;
    }
    function attach() {
        const next = getManager(); if (!next || next === manager) return;
        detach(); drop(); manager = next;
        wrap('tryGenerate', original => async function (...args) {
            const array = this.serviceSettings.prompts;
            try { await ready(this.serviceSettings, 'normal'); }
            catch (error) { fail(error, array); return; }
            if (disposed || this.serviceSettings.prompts !== array) return;
            generationType = 'normal'; pass = null;
            try { return await original.apply(this, args); }
            finally { if (!generationActive) pass = null; }
        });
        wrap('preparePrompt', original => function (prompt, ...args) {
            if (!runtimeOf(this.serviceSettings) || !selectedIds.has(prompt.identifier)) return original.call(this, prompt, ...args);
            try {
                const loaded = requirePrepared(), vars = getContext()?.variables?.local;
                requireThat(typeof vars?.get === 'function' && typeof vars?.del === 'function', 'native local-variable API unavailable.');
                if (prompt.identifier === RESET) {
                    pass = { owner: loaded, banks: new Set(), resolved: false, assembled: false };
                    return original.call(this, prompt, ...args);
                }
                const bank = BANKS.indexOf(prompt.identifier);
                if (bank >= 0) {
                    requireThat(prompt.content === loader(prompt.identifier), 'unexpected library stub.');
                    // Only keys named by the verified original library are removed.
                    for (const name of loaded.keysByBank[bank]) if (vars.has ? vars.has(name) : vars.get(name) !== '') vars.del(name);
                    const result = original.call(this, { ...prompt, content: loaded.bodies[prompt.identifier] }, ...args);
                    if (pass?.owner === loaded) pass.banks.add(prompt.identifier);
                    return result;
                }
                requireThat(pass?.owner === loaded && pass.banks.size === BANKS.length, 'native Vex data slots were skipped or reordered.');
                if (prompt.identifier === RESOLVE) {
                    checkValues(vars, loaded.selection.input, 'selection');
                    const result = original.call(this, prompt, ...args);
                    checkValues(vars, loaded.selection.route, 'route'); pass.resolved = true;
                    return result;
                }
                requireThat(pass.resolved, 'native resolver must precede assembly.');
                checkValues(vars, loaded.selection.route, 'route');
                const result = original.call(this, prompt, ...args); pass.assembled = true;
                return result;
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
            if (data?.data?.prompts?.some(p => BANKS.includes(p.identifier))) {
                notify('Import Vex libraries through the complete Chat Completion preset importer.', 'error'); return;
            }
            return original.call(this, data, ...args);
        });
    }
    async function importReady({ data }) {
        if (!runtimeOf(data) && (!candidate(data) || !autoExtract())) return;
        const snap = snapshot(data, 'normal', true);
        try {
            attach();
            requireThat(manager && ['tryGenerate', 'preparePrompt', 'export', 'import'].every(k => typeof manager[k] === 'function'), 'required ST boundaries unavailable.');
            const vars = getContext()?.variables?.local;
            requireThat(typeof vars?.get === 'function' && typeof vars?.del === 'function', 'native local-variable API unavailable.');
            if (runtimeOf(data)) {
                await store.restore(data); // Validate all banks, not only the active route.
                const contract = await validate(data, readBody);
                const m = await store.manifest(data);
                for (const profile of data.prompt_order) dependencies(data, profile.order, contract, m);
            } else {
                const plan = await planImport(data, readBody);
                const compact = await store.extract(data, plan);
                requireThat(!disposed && unchanged(snap), 'preset changed while storing Vex source; import stopped.');
                Object.assign(data, compact); stats.imports++;
                notify(`Nemo Vex storage: ${plan.entries} original assignments stored separately.`, 'success');
                return;
            }
            requireThat(!disposed && unchanged(snap), 'preset changed while verifying Vex source.');
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
        drop(); attach();
        const array = preset.prompts;
        try { await ready(preset, 'normal'); } catch (error) { fail(error, array); }
    });
    on('OAI_PRESET_CHANGED_AFTER', () => { if (!runtimeOf(active())) drop(); });
    on('GENERATION_STARTED', (type, _options, dryRun) => {
        generationType = String(type || 'normal'); pass = null; fault = null;
        generationActive = isChat() && !dryRun && Boolean(runtimeOf(active())); attach();
    });
    on('GENERATION_ENDED', () => { generationActive = false; pass = null; });
    on('GENERATION_STOPPED', () => { generationActive = false; });
    on('GENERATION_AFTER_COMMANDS', async (type, _options, dryRun) => {
        if (!isChat()) return;
        const array = active()?.prompts;
        try { await ready(active(), String(type || 'normal')); }
        catch (error) { fail(error, array); if (!dryRun) stop(); }
    });
    on('CHAT_COMPLETION_PROMPT_READY', data => { if (fault && fault.array === active()?.prompts) { data.chat = []; stop(); } });
    on('CHAT_COMPLETION_SETTINGS_READY', data => {
        if (!runtimeOf(active()) || (!generationActive && !pass && !(fault && fault.array === active()?.prompts))) return;
        try { checkComplete(); } catch (error) { fail(error); }
        if (fault && fault.array === active()?.prompts) { blockSerialization(data, fault.error); stop(); }
    });
    attach();
    return {
        ready, importReady, exportReady, attach,
        async preflight(_chat, _size, abort, type) {
            if (!isChat()) return true;
            const array = active()?.prompts;
            try { generationType = String(type || 'normal'); await ready(active(), generationType); return true; }
            catch (error) { fail(error, array); abort(true); return false; }
        },
        getStats: () => ({ stage: '4B/5', ...stats, cachedRoutes: prepared ? 1 : 0,
            cachedSetterCharacters: prepared?.characters ?? 0, selectedAssignments: prepared?.selection.reads.size ?? 0 }),
        dispose() {
            disposed = true; drop();
            for (const [key, fn] of listeners) events.removeListener(key, fn);
            listeners.length = 0; detach();
        },
    };
}
