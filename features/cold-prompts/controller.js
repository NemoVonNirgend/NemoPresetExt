import { BODY_KEY, descriptorOf, isCold, eligible, hasBodies, isNemoPreset, validatePreset, portablePrompt, blockSerialization } from './format.js';

/** Explicit async boundaries around ST's synchronous prompt preparation. */
export function createColdPromptRuntime({
    events, types, getManager, store, getContext = () => ({}),
    notify = () => {}, sourceChanged = () => {}, editorLoading = () => {},
    autoStore = () => true,
}) {
    let disposed = false, manager = null, editor = null, editTicket = 0, fault = null;
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
    function orderFor(preset) {
        const pm = getManager();
        if (preset === pm?.serviceSettings) return pm.getPromptOrderForCharacter(pm.activeCharacter) ?? [];
        const id = pm?.activeCharacter?.id ?? 100001;
        return preset.prompt_order?.find(p => p.character_id === id)?.order ?? preset.prompt_order?.[0]?.order ?? [];
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
    function fail(error, s = active()) {
        if (!s?.prompts) return error;
        fault = { prompts: s.prompts, error };
        if (current(s) && getManager()) getManager().error = error.message;
        notify(error.message, 'error');
        return error;
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
    async function hydrateList(prompts) {
        const waiting = prompts.filter(isCold);
        const before = new Map(waiting.map(p => [p, { descriptor: descriptorOf(p), content: p.content }]));
        await store.readMany(waiting, (p, content) => {
            const captured = before.get(p);
            if (disposed || descriptorOf(p) !== captured.descriptor || p.content !== captured.content) {
                stats.rejectedStale++; return;
            }
            p.content = content;
            hot.set(p, { descriptor: descriptorOf(p), content });
            stats.hydrated++;
            onChange(p);
        });
    }
    async function evictDisabled(s) {
        if (!managed(s)) return;
        const dirty = [];
        const state = enabled(s);
        for (const p of s.prompts) {
            if (required(p, s, state) || isCold(p)) continue;
            const d = descriptorOf(p);
            const stamp = hot.get(p);
            if (d && stamp?.descriptor === d && stamp.content === p.content) {
                p.content = d.shell;
                hot.delete(p); onChange(p); stats.evicted++;
            } else if (d || eligible(p)) {
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
            p[BODY_KEY] = descriptors.get(p);
            hot.set(p, { descriptor: descriptorOf(p), content: p.content });
            if (!required(p, s, nextState)) {
                p.content = descriptorOf(p).shell;
                hot.delete(p); stats.evicted++;
            }
            onChange(p);
        }
    }
    async function ready(preset = active(), { evict = false } = {}) {
        if (!managed(preset)) return;
        const s = snapshot(preset);
        return enqueue(s, async () => {
            for (let attempt = 0; attempt < 4; attempt++) {
                const state = enabled(s);
                const targets = s.prompts.filter(p => required(p, s, state) && isCold(p));
                if (!targets.length) break;
                await hydrateList(targets);
            }
            const state = enabled(s);
            if (s.prompts.some(p => required(p, s, state) && isCold(p))) throw new Error('Prompt selection changed while loading. Retry after it settles.');
            if (fault?.prompts === s.prompts) fault = null;
            if (evict) {
                try { await evictDisabled(s); }
                catch (error) {
                    // A failed optimization must not erase or prevent saving the full edited source.
                    notify(`Prompt kept in memory because storage failed: ${error.message}`, 'warning');
                }
            }
        });
    }
    async function importReady({ data }) {
        if (!hasBodies(data) && (!autoStore() || !isNemoPreset(data))) return;
        try {
            attach();
            if (!getManager() || ['preparePrompt', 'tryGenerate', 'getPromptCollection', 'saveServiceSettings', 'loadPromptIntoEditForm', 'export', 'import'].some(name => typeof getManager()[name] !== 'function')) {
                throw new Error('This ST PromptManager does not expose the required prompt-storage boundaries. Import was not changed.');
            }
            validatePreset(data);
            if (hasBodies(data)) {
                // Verify all referenced bodies, including disabled ones, before accepting a shell import.
                await store.readMany(data.prompts.filter(isCold), () => {});
                return;
            }
            const records = data.prompts.filter(eligible).map(prompt => ({ prompt, content: prompt.content }));
            if (!records.length) return;
            const descriptors = await store.writeMany(records);
            if (disposed) throw new Error('Prompt import was cancelled.');
            const prompts = data.prompts.map(p => descriptors.has(p) ? {
                ...p, [BODY_KEY]: descriptors.get(p), content: descriptors.get(p).shell,
            } : p);
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
        if (!hasBodies(data)) return;
        try { data.prompts = await store.restorePrompts(data.prompts); }
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
        if (s.prompts.some(p => required(p, s, state) && isCold(p))) throw fail(new Error('An enabled prompt is not loaded. Generation was blocked; retry after loading completes.'), s);
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
        const next = getManager();
        if (!next || next === manager) return;
        detach(); manager = next;
        wrap('tryGenerate', original => async function (...args) {
            const s = snapshot(this.serviceSettings);
            try { await ready(this.serviceSettings, { evict: true }); }
            catch (error) { fail(error, s); return; }
            if (!current(s)) return;
            return original.apply(this, args);
        });
        wrap('saveServiceSettings', original => async function (...args) {
            const s = snapshot(this.serviceSettings);
            try { await ready(this.serviceSettings, { evict: true }); }
            catch (error) { fail(error, s); return; }
            if (!current(s)) { notify('Preset changed during prompt save; the new preset was not overwritten.', 'warning'); return; }
            return original.apply(this, args);
        });
        wrap('preparePrompt', original => function (prompt, ...args) {
            if (isCold(prompt)) { const error = fail(new Error('A cold prompt reached native preparation. Generation was blocked.')); stop(); throw error; }
            return original.call(this, prompt, ...args);
        });
        wrap('getPromptCollection', original => function (...args) {
            assertReady(this.serviceSettings);
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
    on('OAI_PRESET_CHANGED_BEFORE', async ({ preset }) => {
        closeEditor(); attach();
        try { await ready(preset, { evict: true }); }
        catch (error) { fail(error, preset); }
    }, true);
    on('OAI_PRESET_CHANGED_AFTER', () => { attach(); void ready(active(), { evict: true }).catch(error => fail(error)); });
    on('APP_READY', () => { attach(); void ready(active(), { evict: true }).catch(error => fail(error)); });
    on('GENERATION_STARTED', async () => {
        if (!chatCompletionActive()) return;
        attach(); try { await ready(); } catch (error) { fail(error); }
    }, true);
    on('GENERATION_AFTER_COMMANDS', async (_type, _options, dryRun) => {
        if (!chatCompletionActive()) return;
        try { await ready(); } catch (error) { fail(error); if (!dryRun) stop(); }
    }, true);
    on('CHAT_COMPLETION_PROMPT_READY', data => {
        try { assertReady(active()); } catch { /* fail() recorded the reason */ }
        if (fault && fault.prompts === active()?.prompts) { data.chat = []; stop(); }
    });
    on('CHAT_COMPLETION_SETTINGS_READY', data => {
        try { assertReady(active()); } catch { /* ST swallows event exceptions */ }
        if (fault && fault.prompts === active()?.prompts) { blockSerialization(data, fault.error); stop(); }
    });
    attach();
    return {
        ready, importReady, exportReady, readBody, withBody, attach,
        async preflight(_chat, _size, abort) {
            if (!chatCompletionActive()) return true;
            try { await ready(); assertReady(active()); }
            catch (error) { fail(error); abort(true); return false; }
            return true;
        },
        getStats() {
            const prompts = active()?.prompts ?? [];
            const refs = prompts.filter(p => descriptorOf(p));
            return { stage: '3/5', ...stats, trackedPrompts: refs.length,
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
