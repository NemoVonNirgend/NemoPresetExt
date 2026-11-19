import { createPreparationDiagnostics, diagnosticLabel, PromptPreparationError } from './diagnostics.js';
import { GhostPreparation } from './ghost-preparation.js';
import { BODY_KEY, descriptorOf, isCold, eligible, hasBodies, isNemoPreset, validatePreset, idleContent, isGhost, ghostDescriptor, GHOST_SCHEMA, blockSerialization } from './format.js';

/** Explicit async boundaries around ST's synchronous prompt preparation. */
export function createColdPromptRuntime({
    events, types, getManager, store, getContext = () => ({}),
    notify = () => {}, sourceChanged = () => {}, editorLoading = () => {},
    debug = () => {}, getVersion = () => null,
    autoStore = () => true, journal = null, getUser = () => null, waitForToggles = () => {},
}) {
    let disposed = false, manager = null, editor = null, editTicket = 0, fault = null;
    let settingsOwner = null, journalUnavailable = false, previewFault = null;
    // ST's final pre-assembly and completion events carry dryRun but omit the action type.
    // Keep all overlapping actions in each lane until its last assembly finishes.
    const lanes = [{ count: 0, announced: 0, types: new Set() }, { count: 0, announced: 0, types: new Set() }];
    const hasFinalBoundary = Boolean(types.GENERATE_AFTER_COMBINE_PROMPTS && types.GENERATE_AFTER_DATA);
    const laneFor = dryRun => lanes[dryRun ? 1 : 0];
    let cancellation = 0, preparing = 0, finishedLiveAssembly = false;
    const lastFlags = new WeakMap();
    const pins = new Map();
    const hot = new WeakMap();
    const queues = new WeakMap();
    const originals = new Map();
    const listeners = [];
    const stats = { imports: 0, hydrated: 0, evicted: 0, rejectedStale: 0 };
    const active = () => getManager()?.serviceSettings;
    const managed = p => hasBodies(p) || (autoStore() && isNemoPreset(p));
    const current = snapshot => active()?.prompts === snapshot.prompts;
    const stop = () => getContext()?.stopGeneration?.();
    const chatCompletionActive = () => !getContext()?.mainApi || getContext().mainApi === 'openai';
    const onChange = p => { sourceChanged(p); };
    const pin = p => pins.set(p, (pins.get(p) ?? 0) + 1);
    const unpin = p => { if ((pins.get(p) ?? 0) <= 1) pins.delete(p); else pins.set(p, pins.get(p) - 1); };
    const diagnostics = createPreparationDiagnostics(debug, getVersion);
    const trace = diagnostics.trace;
    const ghost = new GhostPreparation(store, trace);
    const countGhost = new GhostPreparation(store, trace);
    const recounts = new Set();
    let collection = null; // The synchronous native assembly currently calling preparePrompt.
    const catalogKey = 'nemoGhostCatalog';
    const catalog = preset => {
        const record = preset?.extensions?.[catalogKey];
        const id = typeof record === 'object' ? record?.id : record;
        return typeof id === 'string' && /^(?:[a-f0-9]{32}|[a-f0-9]{64})$/.test(id) ? id : null;
    };
    const usesGhostSources = preset => Boolean(catalog(preset) || preset?.prompts?.some(isGhost));
    const ghostCandidate = preset => usesGhostSources(preset) || (autoStore() && isNemoPreset(preset)
        && !preset.extensions?.nemoRecipeRuntime && !preset.extensions?.nemoVexRuntime
        && preset.prompts.some(p => p.identifier === 'nemo-init-reset')
        && preset.prompts.some(p => p.identifier === 'nemo-runtime-state-resolver'));
    function ensureCatalog(preset, id) {
        if (catalog(preset)) return;
        const original = preset.extensions;
        preset.extensions ??= {};
        preset.extensions[catalogKey] = original == null
            ? { id, container: original === null ? 'null' : 'absent' } : id;
    }
    function scope(preset, name, profile) {
        const user = getUser();
        return journal && !journalUnavailable && user && catalog(preset) && name
            ? [user, name, catalog(preset), String(profile)] : null;
    }
    async function restoreToggles(preset, name = preset?.preset_settings_openai) {
        if (!catalog(preset)) return false;
        let changed = false;
        for (const profile of preset.prompt_order || []) {
            const key = scope(preset, name, profile.character_id);
            if (!key) continue;
            const before = new Map(profile.order.map(e => [e.identifier, e.enabled]));
            let flags;
            try { flags = await journal.access(key); }
            catch (error) {
                journalUnavailable = true;
                notify(`Local prompt switches could not be read. Using ST’s current flags and native saves in this session. ${error.message}`, 'warning');
                return changed;
            }
            const previous = lastFlags.get(profile.order);
            for (const entry of profile.order) {
                const id = entry.identifier;
                if (!flags.has(id) || entry.enabled !== before.get(id)
                    || (previous?.has(id) && entry.enabled !== previous.get(id))) continue;
                if (entry.enabled !== flags.get(id)) { entry.enabled = flags.get(id); changed = true; }
            }
            lastFlags.set(profile.order, flags);
        }
        return changed;
    }
    async function saveToggles(pm, changes) {
        const preset = pm.serviceSettings;
        const key = scope(preset, preset.preset_settings_openai, pm.activeCharacter?.id);
        if (!key) return false;
        const order = pm.getPromptOrderForCharacter(pm.activeCharacter);
        const flags = lastFlags.get(order) || new Map();
        await journal.access(key, changes);
        for (const [id, enabled] of changes) flags.set(id, enabled);
        lastFlags.set(order, flags);
        return true;
    }
    function orderFor(preset) {
        const pm = getManager();
        if (preset === pm?.serviceSettings) return pm.getPromptOrderForCharacter(pm.activeCharacter) ?? [];
        const id = pm?.activeCharacter?.id ?? 100001;
        return preset.prompt_order?.find(p => String(p.character_id) === String(id))?.order ?? preset.prompt_order?.[0]?.order ?? [];
    }
    function snapshot(preset) {
        return { ...preset, _order: orderFor(preset).map(e => ({ ...e })) };
    }
    function enabled(s) {
        // Re-read only when this is still the active prompt array. Preset clones use their own order.
        const order = current(s) ? orderFor(active()) : s._order;
        return new Set((order ?? []).filter(e => e.enabled).map(e => e.identifier));
    }
    function required(p, s, state = enabled(s)) {
        return pins.has(p) || state.has(p.identifier) || p.system_prompt || p.marker || ['main', 'nsfw', 'jailbreak'].includes(p.identifier);
    }
    function fail(error, s = active(), stage, dryRun = false) {
        const prior = dryRun ? previewFault : fault;
        if (!s?.prompts || (prior && prior.error === error && prior.prompts === s.prompts)) return error;
        let message = error?.message || 'Prompt preparation failed unexpectedly.', report;
        if (stage) {
            const previous = prior?.prompts === s.prompts ? prior.report : null;
            report = diagnostics.capture(error, stage, {
                dryRun, postWorldInfoHook: hasFinalBoundary, priming: preparing,
                liveAnnounced: lanes[0].announced, dryAnnounced: lanes[1].announced,
                liveAssembling: lanes[0].count, dryAssembling: lanes[1].count,
            }, previous);
            const reason = error instanceof PromptPreparationError ? error.message : 'Prompt preparation failed unexpectedly.';
            message = `[${report.code} · ${stage}] ${reason}`;
        }
        const failure = { prompts: s.prompts, error, report };
        if (dryRun) previewFault = failure;
        else fault = failure;
        if (current(s) && getManager()) getManager().error = message;
        notify(message, 'error', report);
        return error;
    }
    function clearFault(prompts, dryRun) {
        if (dryRun) {
            if (previewFault?.prompts === prompts) previewFault = null;
        } else if (fault?.prompts === prompts) fault = null;
    }
    function enqueue(s, action) {
        const previous = queues.get(s.prompts) ?? Promise.resolve();
        const work = previous.catch(() => {}).then(() => {
            if (disposed) throw new Error('Nemo prompt runtime was stopped.');
            return action();
        });
        queues.set(s.prompts, work);
        work.finally(() => { if (queues.get(s.prompts) === work) queues.delete(s.prompts); }).catch(() => {});
        return work;
    }
    function markVerified(p) {
        const descriptor = descriptorOf(p);
        hot.set(p, { descriptor, content: p.content, shell: descriptor.shell, index: descriptor.index,
            characters: descriptor.characters, path: descriptor.ref.path, hash: descriptor.ref.sha256 });
    }
    function hasVerifiedBody(p) {
        const stamp = hot.get(p), d = descriptorOf(p);
        return Boolean(stamp && stamp.content === p.content && stamp.descriptor === d && (d.schema === 1 || d.schema === GHOST_SCHEMA)
            && stamp.index === d.index && stamp.characters === d.characters && stamp.shell === d.shell
            && stamp.path === d.ref?.path && stamp.hash === d.ref?.sha256);
    }
    // Stock ST serializes the live settings object under this key. Use the same
    // verified shell format as a cold import without changing live prompt bodies.
    function settingsJSON(key) {
        if (disposed || key !== 'oai_settings' || this !== settingsOwner || !autoStore() || !Array.isArray(this.prompts)) return this;
        return { ...this, prompts: this.prompts.map(p => hasVerifiedBody(p)
            ? { ...p, content: idleContent(descriptorOf(p)) } : p) };
    }
    function bindSettings(owner) {
        if (settingsOwner === owner) return;
        if (settingsOwner?.toJSON === settingsJSON) delete settingsOwner.toJSON;
        settingsOwner = null;
        if (owner && !('toJSON' in owner) && Object.isExtensible(owner)) {
            Object.defineProperty(owner, 'toJSON', { configurable: true, writable: true, value: settingsJSON });
            settingsOwner = owner;
        }
    }
    async function hydrateList(prompts) {
        const waiting = prompts.filter(isCold);
        const before = new Map(waiting.map(p => [p, { descriptor: descriptorOf(p), content: p.content }]));
        await store.readMany(waiting, (p, content) => {
            const captured = before.get(p);
            if (disposed || descriptorOf(p) !== captured.descriptor || p.content !== captured.content) {
                stats.rejectedStale++; return;
            }
            p.content = content;
            markVerified(p);
            stats.hydrated++;
            onChange(p);
        });
    }
    async function storeBodies(s, useGhost) {
        if (!managed(s)) return;
        const dirty = [];
        const state = enabled(s);
        for (const p of s.prompts) {
            if (isCold(p)) {
                if (useGhost && !isGhost(p)) {
                    p[BODY_KEY] = ghostDescriptor(descriptorOf(p));
                    p.content = ''; onChange(p);
                }
                continue;
            }
            const d = descriptorOf(p);
            if (hasVerifiedBody(p)) {
                if (pins.has(p) || (!useGhost && required(p, s, state))) continue;
                if (useGhost && d.schema !== GHOST_SCHEMA) p[BODY_KEY] = ghostDescriptor(d);
                p.content = idleContent(descriptorOf(p));
                hot.delete(p); onChange(p); stats.evicted++;
            } else if (d || (autoStore() && eligible(p, useGhost))) {
                dirty.push({ prompt: p, content: p.content, descriptor: d });
            }
        }
        if (!dirty.length) return;
        // All writes/read-backs complete before dropping any changed source.
        const descriptors = await store.writeMany(dirty);
        const nextState = enabled(s);
        for (const record of dirty) {
            const p = record.prompt;
            if (disposed || p.content !== record.content || descriptorOf(p) !== record.descriptor || !s.prompts.includes(p)) {
                stats.rejectedStale++; continue;
            }
            p[BODY_KEY] = useGhost ? ghostDescriptor(descriptors.get(p)) : descriptors.get(p);
            markVerified(p);
            if (useGhost ? !pins.has(p) : !required(p, s, nextState)) {
                p.content = idleContent(descriptorOf(p));
                hot.delete(p); stats.evicted++;
            }
            onChange(p);
        }
    }
    async function ready(preset = active(), { evict = false, dryRun = false } = {}) {
        if (!managed(preset)) return;
        if (preset === active()) bindSettings(preset);
        const s = snapshot(preset);
        const useGhost = ghostCandidate(preset);
        return enqueue(s, async () => {
            async function maintain() {
                try {
                    await storeBodies(s, useGhost);
                } catch (error) {
                    notify(`Prompt kept in memory because storage failed: ${error.message}`, 'warning');
                }
                if (useGhost && !catalog(preset) && preset.prompts === s.prompts) {
                    const anchor = s.prompts.find(p => p.identifier === 'nemo-init-reset' && descriptorOf(p))
                        || s.prompts.find(isGhost);
                    if (anchor) ensureCatalog(preset, descriptorOf(anchor).ref.sha256);
                }
            }
            // Convert legacy shells before considering eager hydration. On storage
            // failure any remaining legacy entries keep their original boundaries.
            if (useGhost && (evict || !catalog(preset))) await maintain();
            const needsBody = (p, state) => required(p, s, state) && !isGhost(p) && isCold(p);
            for (let attempt = 0; attempt < 4; attempt++) {
                const state = enabled(s);
                const targets = s.prompts.filter(p => needsBody(p, state));
                if (!targets.length) break;
                await hydrateList(targets);
            }
            const state = enabled(s);
            const pending = s.prompts.find(p => needsBody(p, state));
            if (pending) throw new PromptPreparationError('SELECTION_UNSTABLE', 'Prompt selection changed while loading. Retry after it settles.', { promptId: diagnosticLabel(pending.identifier) });
            if (!useGhost) clearFault(s.prompts, dryRun);
            if (!useGhost && evict) await maintain();
        });
    }
    async function importReady({ data }) {
        const referenced = hasBodies(data);
        if (!referenced && (!autoStore() || !isNemoPreset(data))) return;
        try {
            attach();
            if (!getManager() || ['preparePrompt', 'tryGenerate', 'getPromptCollection', 'saveServiceSettings', 'loadPromptIntoEditForm', 'export', 'import'].some(name => typeof getManager()[name] !== 'function')) {
                throw new Error('This ST PromptManager does not expose the required prompt-storage boundaries. Import was not changed.');
            }
            try { validatePreset(data); }
            catch (error) {
                if (referenced) throw error;
                notify(`Prompt optimization skipped: ${error.message} The original prompts will be imported unchanged.`, 'warning');
                return;
            }
            if (referenced) {
                // Verify all referenced bodies, including disabled ones, before accepting a shell import.
                await store.readMany(data.prompts.filter(isCold), () => {});
                return;
            }
            const useGhost = ghostCandidate(data);
            const records = data.prompts.filter(p => eligible(p, useGhost)).map(prompt => ({ prompt, content: prompt.content }));
            if (!records.length) return;
            const descriptors = await store.writeMany(records);
            if (disposed) throw new Error('Prompt import was cancelled.');
            const prompts = data.prompts.map(p => descriptors.has(p) ? {
                ...p, [BODY_KEY]: useGhost ? ghostDescriptor(descriptors.get(p)) : descriptors.get(p),
                content: useGhost ? '' : descriptors.get(p).shell,
            } : p);
            if (useGhost) {
                const id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
                ensureCatalog(data, id);
            }
            data.prompts = prompts;
            stats.imports++;
            notify(`Nemo prompt storage: ${records.length} source bodies saved; enabled bodies load before use.`, 'success');
        } catch (error) {
            blockSerialization(data, error);
            notify(`Prompt import stopped: ${error.message} The source file is unchanged.`, 'error');
            throw error;
        }
    }
    async function exportReady(data) {
        try {
            const live = active();
            if (catalog(live)) await waitForToggles();
            // ST exports its named preset, which may still be a portable or
            // legacy shell copy. Apply this catalog's switches to matching IDs.
            const id = catalog(data) || (catalog(live) && ghostCandidate(data) && catalog(live));
            if (id) {
                const view = { ...data, extensions: { ...data.extensions, [catalogKey]: id } };
                await restoreToggles(view, live?.preset_settings_openai || data.preset_settings_openai);
            }
            if (!hasBodies(data)) return;
            data.prompts = await store.restorePrompts(data.prompts);
            if (catalog(data)) {
                const record = data.extensions[catalogKey];
                data.extensions = { ...data.extensions };
                delete data.extensions[catalogKey];
                if (!Object.keys(data.extensions).length) {
                    if (record.container === 'absent') delete data.extensions;
                    else if (record.container === 'null') data.extensions = null;
                }
            }
        }
        catch (error) { blockSerialization(data, error); notify(error.message, 'error'); throw error; }
    }
    async function readBody(prompt) {
        return isCold(prompt) ? store.read(descriptorOf(prompt)) : prompt.content ?? '';
    }
    async function withBody(prompt, callback) {
        pin(prompt);
        try {
            await hydrateList([prompt]);
            if (disposed || isCold(prompt)) throw new Error('Prompt changed while loading. Try the action again.');
            return await callback(prompt);
        }
        finally {
            unpin(prompt);
            if (!disposed && active()?.prompts?.includes(prompt)) void ready(active(), { evict: true }).catch(error => fail(error));
        }
    }
    function closeEditor() {
        editTicket++;
        if (editor) unpin(editor);
        editor = null;
        editorLoading(false);
        if (!disposed) void ready(active(), { evict: true }).catch(error => fail(error));
    }
    function assertReady(preset) {
        if (!managed(preset)) return;
        const s = snapshot(preset);
        const state = enabled(s);
        const missing = s.prompts.find(p => required(p, s, state) && isCold(p) && !isGhost(p));
        if (missing) throw new PromptPreparationError('COLD_SOURCE_UNLOADED', 'An enabled prompt is not loaded. Retry after loading completes.', { promptId: diagnosticLabel(missing.identifier) });
    }
    function wrap(name, factory) {
        if (typeof manager[name] !== 'function') return;
        const original = manager[name], replacement = factory(original);
        originals.set(name, { original, replacement }); manager[name] = replacement;
    }
    function clearLane(lane) {
        lane.count = 0;
        lane.announced = 0;
        lane.types.clear();
    }
    function releaseIdle(dryRun) {
        if (dryRun) {
            if (!laneFor(true).announced && !recounts.size) countGhost.reset();
        } else if (!preparing && !laneFor(false).announced) ghost.reset();
    }
    function collectingPreview(pm, type) {
        const action = String(type || 'normal').toLowerCase().trim();
        const dry = laneFor(true), live = laneFor(false);
        if (!live.announced && dry.announced && typeof pm.shouldTrigger !== 'function') return true;
        if (!dry.types.has(action) && !(action === 'normal' && recounts.size)) return false;
        // ST does not pass dryRun to getPromptCollection. When the same action is live
        // and counting, keep the live request's blocking behavior on ambiguous failures.
        return !live.announced || (typeof pm.shouldTrigger === 'function' && !live.types.has(action));
    }
    function cancelPreparation() {
        cancellation++;
        finishedLiveAssembly = false;
        for (const lane of lanes) clearLane(lane);
        recounts.clear(); previewFault = null; countGhost.reset(); ghost.reset();
    }
    function detach() {
        if (manager) for (const [key, pair] of originals) if (manager[key] === pair.replacement) manager[key] = pair.original;
        originals.clear(); bindSettings(null); cancelPreparation(); manager = null;
    }
    function attach() {
        const next = getManager();
        if (!next || next === manager) return;
        trace('managerAttached'); detach(); manager = next;
        wrap('tryGenerate', original => async function (...args) {
            trace('tryGenerate');
            const s = snapshot(this.serviceSettings), ticket = {};
            recounts.add(ticket);
            try {
                try {
                    await ready(this.serviceSettings, { evict: true, dryRun: true });
                    if (!current(s) || !recounts.has(ticket)) return;
                    if (usesGhostSources(this.serviceSettings)) await primeGhost('normal', false, true);
                } catch (error) {
                    if (current(s) && recounts.has(ticket)) fail(error, s, 'tryGenerate', true);
                    return;
                }
                if (current(s) && recounts.has(ticket)) return await original.apply(this, args);
            } finally {
                recounts.delete(ticket);
                releaseIdle(true);
            }
        });
        wrap('saveServiceSettings', original => async function (...args) {
            const s = snapshot(this.serviceSettings);
            // A native editor or another extension can change a previously staged
            // flag. Its explicit save is authoritative for that flag on reload.
            const order = orderFor(this.serviceSettings), flags = lastFlags.get(order);
            if (flags) {
                const changes = order.filter(e => flags.has(e.identifier) && flags.get(e.identifier) !== e.enabled);
                if (changes.length) await saveToggles(this, changes.map(e => [e.identifier, e.enabled]));
            }
            try { await ready(this.serviceSettings, { evict: true }); }
            catch (error) { fail(error, s); return; }
            if (!current(s)) { notify('Preset changed during prompt save; the new preset was not overwritten.', 'warning'); return; }
            return original.apply(this, args);
        });
        wrap('preparePrompt', original => function (prompt, ...args) {
            if (!isGhost(prompt) && !isCold(prompt)) return original.call(this, prompt, ...args);
            try {
                if (isGhost(prompt)) return original.call(this, { ...prompt, content: (collection ?? ghost).source(prompt) }, ...args);
                throw new PromptPreparationError('COLD_SOURCE_UNLOADED', 'A cold prompt reached native preparation. Generation was blocked.', { promptId: diagnosticLabel(prompt.identifier) });
            } catch (error) {
                // The enclosing collection reports once and knows whether this is a recount.
                if (!collection) { fail(error, active(), 'preparePrompt'); stop(); }
                throw error;
            }
        });
        wrap('getPromptCollection', original => function (...args) {
            const dryRun = collectingPreview(this, args[0]);
            const previous = collection;
            // When Send and its normal recount overlap, ST supplies the same type for both.
            // Both sets contain verified source. A live failure still blocks serialization.
            const useCountSource = dryRun || ((laneFor(true).announced || recounts.size)
                && !ghost.hasPlan(this, args[0]) && countGhost.hasPlan(this, args[0]));
            collection = useCountSource ? countGhost : ghost;
            try {
                assertReady(this.serviceSettings);
                if (usesGhostSources(this.serviceSettings)) {
                    const lane = laneFor(dryRun);
                    return collection.collect(this, args[0], () => original.apply(this, args),
                        Boolean(lane.announced || dryRun), dryRun ? null : lane.types);
                }
            } catch (error) {
                fail(error, this.serviceSettings, 'getPromptCollection', dryRun);
                if (!dryRun) stop();
                throw error;
            } finally { collection = previous; }
            return original.apply(this, args);
        });
        wrap('loadPromptIntoEditForm', original => function (prompt, ...args) {
            closeEditor();
            if (!isCold(prompt) && !descriptorOf(prompt)) return original.call(this, prompt, ...args);
            editor = prompt; pin(prompt);
            const ticket = ++editTicket, array = this.serviceSettings.prompts;
            editorLoading(true, prompt.name);
            return hydrateList([prompt]).then(() => {
                if (disposed || ticket !== editTicket || this.serviceSettings.prompts !== array) return;
                if (isCold(prompt)) throw new Error('Prompt changed while opening the editor. Open it again.');
                original.call(this, prompt, ...args);
                editorLoading(false);
            }).catch(error => {
                if (ticket === editTicket) { editorLoading(true, `Load failed: ${error.message}`); notify(error.message, 'error'); }
            });
        });
        wrap('updatePromptWithPromptEditForm', original => function (prompt, ...args) {
            if (editor === prompt && isCold(prompt)) throw new Error('Wait for the prompt editor to finish loading.');
            const result = original.call(this, prompt, ...args);
            // An explicit editor save is authoritative, including empty text or text
            // equal to an old shell. Do not mistake that edit for the old reference.
            if (editor === prompt && descriptorOf(prompt)) {
                delete prompt[BODY_KEY]; hot.delete(prompt); onChange(prompt);
            }
            return result;
        });
        for (const name of ['hidePopup', 'clearEditForm']) wrap(name, original => function (...args) {
            closeEditor(); return original.apply(this, args);
        });
        wrap('export', original => async function (data, ...args) {
            if (!data?.prompts?.some(p => descriptorOf(p))) return original.call(this, data, ...args);
            try { return await original.call(this, { ...data, prompts: await store.restorePrompts(data.prompts) }, ...args); }
            catch (error) { notify(`Prompt export stopped: ${error.message}`, 'error'); }
        });
        wrap('import', original => async function (data, ...args) {
            if (!data?.data?.prompts?.some(p => descriptorOf(p))) return original.call(this, data, ...args);
            try {
                const prompts = await store.restorePrompts(data.data.prompts);
                return original.call(this, { ...data, data: { ...data.data, prompts } }, ...args);
            } catch (error) { notify(`Prompt import stopped: ${error.message}`, 'error'); }
        });
    }
    function on(key, fn, first = false) {
        const type = types[key];
        if (!type) return;
        if (first && typeof events.makeFirst === 'function') events.makeFirst(type, fn); else events.on(type, fn);
        listeners.push([type, fn]);
    }
    on('OAI_PRESET_IMPORT_READY', importReady);
    on('OAI_PRESET_EXPORT_READY', exportReady);
    on('OAI_PRESET_CHANGED_BEFORE', async ({ preset, presetName }) => {
        trace('presetChanged'); cancelPreparation(); closeEditor(); attach();
        try { await ready(preset, { evict: true }); await restoreToggles(preset, presetName); }
        catch (error) { fail(error, preset); }
    }, true);
    on('OAI_PRESET_CHANGED_AFTER', () => { attach(); void ready(active(), { evict: true }).catch(error => fail(error)); });
    on('APP_READY', async () => {
        attach(); const preset = active();
        try {
            await ready(preset, { evict: true });
            if (await restoreToggles(preset) && preset === active()) getManager().render?.(false);
        }
        catch (error) { fail(error, preset); }
    });
    on('GENERATION_STOPPED', () => { trace('stopped'); cancelPreparation(); });
    on('WORLD_INFO_ACTIVATED', entries => { trace('worldInfoActivated', { entries: Array.isArray(entries) ? entries.length : null }); });
    on('GENERATION_STARTED', async (type, _options, dryRun) => {
        if (!chatCompletionActive()) return;
        attach();
        trace('generationStarted', { type: diagnosticLabel(type), dryRun: Boolean(dryRun) });
        try { await ready(active(), { dryRun }); } catch (error) { fail(error, active(), 'generationStarted', dryRun); }
    }, true);
    on('GENERATION_AFTER_COMMANDS', async (type, _options, dryRun) => {
        if (!chatCompletionActive()) return;
        const lane = laneFor(dryRun), epoch = cancellation;
        trace('afterCommands', { type: diagnosticLabel(type), dryRun: Boolean(dryRun) });
        try {
            await ready(active(), { dryRun });
            if (epoch !== cancellation || !usesGhostSources(active())) return;
            lane.announced++;
            lane.types.add(String(type || 'normal').toLowerCase().trim());
            // The final hook runs only for requests that survive slash commands, group
            // dispatch, connection checks and World Info scanning.
            if (!hasFinalBoundary) {
                lane.count++;
                await primeGhost(type, false, dryRun);
            } else if (!dryRun && (type === 'swipe' || type === 'regenerate')) {
                // Regenerate deletes the previous reply before interceptors run. A listener
                // may collect here. The post-World Info boundary still rechecks the selection.
                await primeGhost(type, false);
            }
        } catch (error) {
            if (epoch !== cancellation) return;
            fail(error, active(), 'afterCommands', dryRun); if (!dryRun) stop();
        }
    }, true);
    on('GROUP_WRAPPER_STARTED', () => {
        // The outer group request delegates to member generations before assembly.
        const lane = laneFor(false);
        if (lane.announced === 1 && !lane.count) { clearLane(lane); releaseIdle(false); }
    });
    on('GENERATE_AFTER_COMBINE_PROMPTS', async ({ dryRun }) => {
        const lane = laneFor(dryRun);
        if (!chatCompletionActive()) return;
        trace('afterCombine', { dryRun: Boolean(dryRun), announced: lane.announced });
        if (!hasFinalBoundary || !lane.announced) return;
        lane.count++;
        const epoch = cancellation;
        try {
            for (const type of lane.types) await primeGhost(type, false, dryRun);
        } catch (error) {
            if (epoch !== cancellation) return;
            fail(error, active(), 'afterCombine', dryRun); if (!dryRun) stop();
        }
    });
    on('GENERATE_AFTER_DATA', (_data, dryRun) => {
        const lane = laneFor(dryRun);
        trace('afterData', { dryRun: Boolean(dryRun), assembling: lane.count });
        if (!lane.count) return;
        lane.count--;
        if (!dryRun) finishedLiveAssembly = true;
        if (--lane.announced === 0) clearLane(lane);
        releaseIdle(dryRun);
    });
    on('GENERATION_ENDED', () => {
        trace('generationEnded');
        const live = laneFor(false);
        if (!hasFinalBoundary || (!finishedLiveAssembly && !live.count)) clearLane(live);
        finishedLiveAssembly = false;
        releaseIdle(false);
    });
    on('CHAT_COMPLETION_PROMPT_READY', data => {
        const dryRun = Boolean(data.dryRun);
        const relevantFault = () => dryRun ? previewFault : fault;
        try { assertReady(active()); } catch (error) {
            if (relevantFault()?.prompts !== active()?.prompts) fail(error, active(), 'promptReady', dryRun);
        }
        if (relevantFault() && relevantFault().prompts === active()?.prompts) {
            data.chat = [];
            if (!dryRun) stop();
        }
        if (!hasFinalBoundary && data.dryRun) {
            const dry = laneFor(true);
            if (dry.count && --dry.count === 0) clearLane(dry);
            releaseIdle(true);
        }
    });
    on('CHAT_COMPLETION_SETTINGS_READY', data => {
        try { assertReady(active()); } catch (error) { if (!fault || fault.prompts !== active()?.prompts) fail(error, active(), 'settingsReady'); }
        if (fault && fault.prompts === active()?.prompts) { blockSerialization(data, fault.error); stop(); }
    });
    async function primeGhost(type, reserve = true, dryRun = false) {
        const pm = getManager(), preset = pm.serviceSettings, prompts = preset.prompts;
        const epoch = cancellation;
        if (!dryRun) preparing++;
        try {
            await waitForToggles();
            // Serialize revisions for the same preset. A slower, older read cannot publish
            // its selection over the result of a later preload.
            await enqueue(preset, async () => {
                const isCurrent = () => epoch === cancellation && pm === getManager() && active()?.prompts === prompts;
                if (!isCurrent()) throw new PromptPreparationError('PREPARATION_INVALIDATED', 'Preset changed or generation stopped before prompt preparation.');
                await restoreToggles(preset);
                if (!isCurrent()) throw new PromptPreparationError('PREPARATION_INVALIDATED', 'Preset changed or generation stopped while applying prompt toggles.');
                await (dryRun ? countGhost : ghost).prime(pm, type, reserve);
                if (!isCurrent()) throw new PromptPreparationError('PREPARATION_INVALIDATED', 'Preset changed during prompt preparation.');
                clearFault(prompts, dryRun);
            });
        } finally { if (!dryRun) preparing--; }
    }
    attach();
    return {
        ready, importReady, exportReady, readBody, withBody, attach, saveToggles, restoreToggles,
        isGhostPreset: () => Boolean(catalog(active())),
        async preflight(_chat, _size, abort, type) {
            if (!chatCompletionActive()) return true;
            const epoch = cancellation, owner = active()?.prompts;
            trace('preflight', { type: diagnosticLabel(type) });
            try { await ready(); assertReady(active()); if (usesGhostSources(active())) await primeGhost(type); }
            catch (error) {
                if (epoch === cancellation && owner === active()?.prompts) fail(error, active(), 'preflight');
                abort(true);
                return false;
            }
            return true;
        },
        getLastFailure: diagnostics.getLastFailure,
        getStats() {
            const prompts = active()?.prompts ?? [];
            const refs = prompts.filter(p => descriptorOf(p));
            return { stage: '3/5', ...stats, trackedPrompts: refs.length, ghostPreset: Boolean(catalog(active())),
                ghostPrompts: refs.filter(isGhost).length,
                hostSourceCharacters: prompts.reduce((n, p) => n + (p.content?.length || 0), 0),
                coldPrompts: refs.filter(isCold).length,
                coldSourceCharacters: refs.filter(isCold).reduce((n, p) => n + descriptorOf(p).characters, 0),
                pinnedEditors: pins.size, store: store.diagnostics?.() };
        },
        dispose() {
            disposed = true; editTicket++;
            for (const [type, fn] of listeners) events.removeListener(type, fn);
            listeners.length = 0; pins.clear(); editor = null; editorLoading(false); detach(); fault = null;
        },
    };
}
