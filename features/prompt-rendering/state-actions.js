import { buildSectionIndex, planSnapshot, readOrderedState } from './state-model.js';

const stateError = message => new Error(`Nemo prompt actions: ${message}`);

function normalizeChanges(changes) {
    if (!Array.isArray(changes)) throw stateError('changes must be an array.');
    const ordered = new Map();
    for (const change of changes) {
        if (!change || typeof change.identifier !== 'string' || !change.identifier
            || typeof change.enabled !== 'boolean') throw stateError('invalid state change.');
        ordered.set(change.identifier, { identifier: change.identifier, enabled: change.enabled });
    }
    return [...ordered.values()];
}

function sectionIdentifier(section) {
    return section?.querySelector?.('summary > li[data-pm-identifier]')?.dataset?.pmIdentifier
        || section?.querySelector?.('summary [data-pm-identifier]')?.dataset?.pmIdentifier
        || null;
}

function classifierFor(manager) {
    return name => {
        if (typeof manager?.getDividerInfo !== 'function') throw stateError('divider classifier is unavailable.');
        const fake = {
            dataset: {},
            querySelector() { return { textContent: name }; },
        };
        return manager.getDividerInfo(fake, true);
    };
}

function autoResolutionChanges(issues, allPrompts, promptId, parseDirectives) {
    const prompt = allPrompts.find(item => item.identifier === promptId);
    if (!prompt) return null;
    const directives = parseDirectives(prompt.content || '');
    const changes = new Map();
    for (const issue of issues) {
        if (issue.type === 'exclusive' || issue.type === 'category-limit' || issue.type === 'mutual-exclusive-group') {
            const conflicts = [];
            if (issue.conflictingPrompt) conflicts.push(issue.conflictingPrompt);
            if (Array.isArray(issue.conflictingPrompts)) conflicts.push(...issue.conflictingPrompts);
            if (!conflicts.length || !conflicts.every(item => directives.autoDisable?.includes(item.identifier))) return null;
            for (const item of conflicts) changes.set(item.identifier, { identifier: item.identifier, enabled: false });
        } else if (issue.type === 'missing-dependency') {
            if (!directives.autoEnableDependencies || !issue.requiredPrompt) return null;
            changes.set(issue.requiredPrompt.identifier, { identifier: issue.requiredPrompt.identifier, enabled: true });
        } else if (issue.severity === 'error') {
            return null;
        }
    }
    return [...changes.values()];
}

/**
 * Stage 5B.2A: move state-changing Prompt Manager consumers off rendered rows.
 * This adapter deliberately leaves tray/navigation/movement and row virtualization
 * for the following deliveries.
 */
export function installStateActions({
    manager,
    getManager,
    getApi,
    storage,
    getCold = () => globalThis.NemoColdPrompts,
    directivesEnabled = () => false,
    getAllPrompts = () => [],
    validateActivation = () => [],
    parseDirectives = () => ({}),
    showConflict = null,
    report = () => {},
}) {
    const originals = new Map();
    const stats = {
        requested: 0,
        targetMutations: 0,
        resolutionMutations: 0,
        saves: 0,
        cancelled: 0,
        locked: 0,
        failures: 0,
        nativeFallbacks: 0,
        sectionReads: 0,
        masterToggles: 0,
        reconciliationPasses: 0,
    };
    let disposed = false;
    let queue = Promise.resolve();
    const api = () => getApi?.() || 'openai';

    function captureTicket() {
        const pm = getManager?.();
        const rows = readOrderedState(pm);
        const active = pm.activeCharacter;
        const order = pm.getPromptOrderForCharacter(active);
        return {
            pm,
            preset: pm.serviceSettings,
            prompts: pm.serviceSettings.prompts,
            activeId: active?.id,
            order,
            entries: new Map(order.map(entry => [entry.identifier, entry])),
            sources: new Map(pm.serviceSettings.prompts.map(prompt => [prompt.identifier, prompt])),
            rows,
        };
    }

    function current(ticket) {
        const pm = getManager?.();
        return !disposed && pm === ticket.pm && pm?.serviceSettings === ticket.preset
            && pm?.serviceSettings?.prompts === ticket.prompts
            && pm?.activeCharacter?.id === ticket.activeId;
    }

    function assertCurrent(ticket) {
        if (!current(ticket)) throw stateError('preset or active profile changed during the operation.');
    }

    function allowed(ticket, identifier) {
        const prompt = ticket.sources.get(identifier);
        if (!prompt) throw stateError(`prompt source is missing: ${identifier}`);
        return Boolean(ticket.pm.isPromptToggleAllowed(prompt));
    }

    function entryFor(ticket, identifier) {
        const entry = ticket.entries.get(identifier);
        if (!entry) throw stateError(`prompt order entry is missing: ${identifier}`);
        return entry;
    }

    function ask(issues, identifier) {
        if (typeof showConflict !== 'function') return Promise.resolve(false);
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = value => {
                if (settled) return;
                settled = true;
                resolve(Boolean(value));
            };
            try { showConflict(issues, identifier, finish); }
            catch (error) { reject(error); }
        });
    }

    async function validateEnable(ticket, identifier) {
        if (!directivesEnabled()) return { proceed: true, resolution: [] };
        const allPrompts = getAllPrompts();
        const issues = validateActivation(identifier, allPrompts) || [];
        if (!issues.length) return { proceed: true, resolution: [] };
        const hasErrors = issues.some(issue => issue.severity === 'error');
        if (hasErrors) {
            const resolution = autoResolutionChanges(issues, allPrompts, identifier, parseDirectives);
            if (resolution && resolution.every(change => {
                try { return allowed(ticket, change.identifier); }
                catch { return false; }
            })) return { proceed: true, resolution };
        }
        const proceed = await ask(issues, identifier);
        assertCurrent(ticket);
        if (!proceed) stats.cancelled++;
        return { proceed, resolution: [] };
    }

    function mutate(ticket, change, before) {
        if (!allowed(ticket, change.identifier)) {
            stats.locked++;
            return false;
        }
        const entry = entryFor(ticket, change.identifier);
        if (entry.enabled === change.enabled) return false;
        if (!before.has(change.identifier)) before.set(change.identifier, { entry, enabled: entry.enabled });
        entry.enabled = change.enabled;
        const counts = ticket.pm.tokenHandler?.getCounts?.();
        if (counts) counts[change.identifier] = null;
        return true;
    }

    function rollback(ticket, before) {
        for (const { entry, enabled } of before.values()) entry.enabled = enabled;
        if (current(ticket)) {
            try { ticket.pm.render?.(); }
            catch (error) { report(error); }
        }
    }

    async function commitOne(change) {
        const ticket = captureTicket();
        stats.requested++;
        if (!allowed(ticket, change.identifier)) {
            stats.locked++;
            return { changed: false, targetChanged: false, resolutionChanged: 0, locked: true, cancelled: false };
        }
        const targetEntry = entryFor(ticket, change.identifier);
        if (targetEntry.enabled === change.enabled) {
            return { changed: false, targetChanged: false, resolutionChanged: 0, locked: false, cancelled: false };
        }
        const targetPrompt = ticket.sources.get(change.identifier);
        const run = async () => {
            assertCurrent(ticket);
            let resolution = [];
            if (change.enabled) {
                const decision = await validateEnable(ticket, change.identifier);
                if (!decision.proceed) {
                    return { changed: false, targetChanged: false, resolutionChanged: 0, locked: false, cancelled: true };
                }
                resolution = decision.resolution;
            }
            assertCurrent(ticket);
            const before = new Map();
            let resolutionChanged = 0;
            let toggleToken;
            try {
                toggleToken = manager.beginToggle?.();
                for (const related of resolution) {
                    if (mutate(ticket, related, before)) resolutionChanged++;
                }
                const targetChanged = mutate(ticket, change, before);
                if (!before.size) {
                    return { changed: false, targetChanged: false, resolutionChanged: 0, locked: false, cancelled: false };
                }
                assertCurrent(ticket);
                ticket.pm.render?.();
                if (typeof ticket.pm.saveServiceSettings !== 'function') throw stateError('native saveServiceSettings is unavailable.');
                await ticket.pm.saveServiceSettings();
                assertCurrent(ticket);
                stats.saves++;
                stats.targetMutations += targetChanged ? 1 : 0;
                stats.resolutionMutations += resolutionChanged;
                return { changed: true, targetChanged, resolutionChanged, locked: false, cancelled: false };
            } catch (error) {
                rollback(ticket, before);
                throw error;
            } finally {
                manager.endToggle?.(toggleToken);
            }
        };
        const cold = getCold?.();
        if (change.enabled && typeof cold?.withBody === 'function') return cold.withBody(targetPrompt, run);
        return run();
    }

    function enqueue(work) {
        const next = queue.catch(() => {}).then(async () => {
            if (disposed) throw stateError('adapter was disposed.');
            return work();
        });
        queue = next;
        next.finally(() => { if (queue === next) queue = Promise.resolve(); }).catch(() => {});
        return next;
    }

    async function applyChanges(changes) {
        const normalized = normalizeChanges(changes);
        const result = { requested: normalized.length, changed: 0, targetChanged: 0, resolutionChanged: 0, locked: 0, cancelled: 0 };
        for (const change of normalized) {
            if (disposed) throw stateError('adapter was disposed.');
            const one = await commitOne(change);
            if (one.changed) result.changed++;
            if (one.targetChanged) result.targetChanged++;
            result.resolutionChanged += one.resolutionChanged;
            if (one.locked) result.locked++;
            if (one.cancelled) result.cancelled++;
        }
        return result;
    }

    async function reconcile(savedIds, maxPasses = 4) {
        let aggregate = { requested: 0, changed: 0, targetChanged: 0, resolutionChanged: 0, locked: 0, cancelled: 0 };
        let plan = null;
        for (let pass = 0; pass < maxPasses; pass++) {
            const rows = readOrderedState(getManager?.());
            plan = planSnapshot(rows, savedIds);
            if (!plan.changes.length) break;
            stats.reconciliationPasses++;
            const result = await applyChanges(plan.changes);
            for (const key of Object.keys(aggregate)) aggregate[key] += result[key];
            if (result.cancelled || result.locked || (!result.changed && !result.resolutionChanged)) break;
        }
        const rows = readOrderedState(getManager?.());
        const finalPlan = planSnapshot(rows, savedIds);
        return { ...aggregate, plan: finalPlan };
    }

    function sectionIndex() {
        const rows = readOrderedState(getManager?.());
        stats.sectionReads++;
        return buildSectionIndex(rows, classifierFor(manager));
    }

    function countsFor(section, descendants) {
        const id = sectionIdentifier(section);
        if (!id) throw stateError('section identifier is unavailable.');
        return sectionIndex().counts(id, descendants);
    }

    function wrap(name, factory) {
        const original = manager?.[name];
        if (typeof original !== 'function') return;
        const handler = factory(original);
        const replacement = function (...args) {
            if (disposed) return original.apply(this, args);
            return handler.apply(this, args);
        };
        originals.set(name, { original, replacement });
        manager[name] = replacement;
    }

    wrap('applySnapshot', original => async function (...args) {
        let currentApi;
        try { currentApi = api(); }
        catch (error) { stats.failures++; report(error); return original.apply(this, args); }
        if (currentApi !== 'openai') { stats.nativeFallbacks++; return original.apply(this, args); }
        try {
            const saved = storage.getSnapshot(currentApi);
            if (!Array.isArray(saved)) {
                this.showStatusMessage?.('No snapshot taken.', 'error');
                return;
            }
            this.showStatusMessage?.(`Applying snapshot from canonical prompt state…`, 'info', 5000);
            const result = await enqueue(() => reconcile(saved));
            const unresolved = result.plan.changes.length;
            if (unresolved) {
                this.showStatusMessage?.(`Snapshot partially applied: ${unresolved} prompt(s) remain different because of permissions, dependencies, or a cancelled choice.`, 'warning', 7000);
            } else {
                this.showStatusMessage?.(`Snapshot applied. ${saved.length} prompt(s) are active.`, 'success');
            }
            return result;
        } catch (error) {
            stats.failures++; report(error);
            this.showStatusMessage?.(`Error applying snapshot: ${error.message}`, 'error');
        }
    });

    wrap('restorePromptStates', original => async function (...args) {
        let currentApi;
        try { currentApi = api(); }
        catch (error) { stats.failures++; report(error); return original.apply(this, args); }
        if (currentApi !== 'openai') { stats.nativeFallbacks++; return original.apply(this, args); }
        try {
            const saved = storage.getPromptStates();
            if (!Array.isArray(saved)) return;
            const rows = readOrderedState(getManager?.());
            const present = new Set(rows.map(row => row.identifier));
            const matched = new Set(saved.filter(id => present.has(id))).size;
            const result = await enqueue(() => reconcile(saved));
            this.showPromptRestorationNotification?.(matched, result.targetChanged);
            return result;
        } catch (error) {
            stats.failures++; report(error);
            this.showStatusMessage?.(`Error restoring prompt states: ${error.message}`, 'error');
        }
    });

    wrap('getSectionDirectCounts', original => function (section, ...args) {
        let currentApi;
        try { currentApi = api(); }
        catch { return original.call(this, section, ...args); }
        if (currentApi !== 'openai') { stats.nativeFallbacks++; return original.call(this, section, ...args); }
        try { return countsFor(section, false); }
        catch (error) { stats.failures++; report(error); return original.call(this, section, ...args); }
    });

    wrap('getAggregatedCounts', original => function (section, ...args) {
        let currentApi;
        try { currentApi = api(); }
        catch { return original.call(this, section, ...args); }
        if (currentApi !== 'openai') { stats.nativeFallbacks++; return original.call(this, section, ...args); }
        try { return countsFor(section, true); }
        catch (error) { stats.failures++; report(error); return original.call(this, section, ...args); }
    });

    wrap('handleContainerClick', original => function (event, ...args) {
        let currentApi;
        try { currentApi = api(); }
        catch { return original.call(this, event, ...args); }
        if (currentApi !== 'openai') { stats.nativeFallbacks++; return original.call(this, event, ...args); }
        const masterToggle = event?.target?.closest?.('.nemo-section-master-toggle');
        if (!masterToggle) return original.call(this, event, ...args);
        const section = masterToggle.closest?.('details.nemo-engine-section');
        if (!section) return original.call(this, event, ...args);
        event.preventDefault?.();
        event.stopPropagation?.();
        stats.masterToggles++;
        void enqueue(async () => {
            const index = sectionIndex();
            const id = sectionIdentifier(section);
            const descriptor = id ? index.getSection(id) : null;
            if (!descriptor) throw stateError('section metadata is unavailable.');
            const rows = descriptor.memberIds.map(memberId => index.getRow(memberId)).filter(Boolean);
            const toggleable = rows.filter(row => row.toggleAllowed);
            const enable = toggleable.some(row => !row.enabled);
            const changes = toggleable.filter(row => row.enabled !== enable)
                .map(row => ({ identifier: row.identifier, enabled: enable }));
            const result = await applyChanges(changes);
            let cursor = section;
            while (cursor) {
                this.updateSectionCount?.(cursor);
                cursor = cursor.parentElement?.closest?.('details.nemo-engine-section') || null;
            }
            return result;
        }).catch(error => {
            stats.failures++; report(error);
            this.showStatusMessage?.(`Section toggle failed: ${error.message}`, 'error');
        });
    });

    return {
        applyChanges: changes => enqueue(() => applyChanges(changes)),
        reconcile: saved => enqueue(() => reconcile(saved)),
        getStats: () => ({ ...stats, attached: !disposed && originals.size > 0, stage: '5B.2A/5', virtualized: false }),
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const [name, pair] of originals) if (manager[name] === pair.replacement) manager[name] = pair.original;
            originals.clear();
        },
    };
}
