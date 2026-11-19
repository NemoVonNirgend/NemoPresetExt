import { diagnosticLabel, PromptPreparationError } from './diagnostics.js';
import { checkedDescriptor, descriptorOf, isGhost } from './format.js';

function generationType(pm, type) {
    // Older PromptManagers collect every enabled row and omit the type at collection.
    return typeof pm.shouldTrigger === 'function' ? String(type || 'normal').toLowerCase().trim() : 'normal';
}

function matches(record, prompt) {
    const d = descriptorOf(prompt);
    return Boolean(record && d && record.descriptor === d && record.index === d.index
        && record.characters === d.characters && record.shell === d.shell
        && record.path === d.ref?.path && record.hash === d.ref?.sha256);
}

/** Only raw source is reusable. ST still assembles and evaluates each collection itself. */
export class GhostPreparation {
    constructor(store, trace = () => {}) {
        this.trace = trace;
        this.store = store;
        this.reset();
    }
    reset() {
        this.pending = new WeakMap();
        this.current = null;
    }
    hasPlan(pm, requestedType) {
        return this.pending.get(pm.serviceSettings.prompts)?.has(generationType(pm, requestedType)) ?? false;
    }
    targets(pm, type) {
        const order = pm.getPromptOrderForCharacter(pm.activeCharacter) || [];
        const enabled = new Set(order.filter(e => e.enabled).map(e => e.identifier));
        return pm.serviceSettings.prompts.filter(p => isGhost(p) && enabled.has(p.identifier)
            && (typeof pm.shouldTrigger !== 'function' || pm.shouldTrigger(p, type)));
    }
    async prime(pm, requestedType, reserve = true) {
        const owner = pm.serviceSettings.prompts, type = generationType(pm, requestedType);
        const pending = this.pending;
        let types = pending.get(owner);
        if (!types) pending.set(owner, types = new Map());
        const previous = types.get(type);
        const targets = this.targets(pm, type);
        const bodies = new Map(), missing = [];
        for (const p of targets) {
            const record = previous?.bodies.get(p);
            if (matches(record, p)) bodies.set(p, record);
            else {
                const d = checkedDescriptor(descriptorOf(p));
                bodies.set(p, { descriptor: d, index: d.index, characters: d.characters,
                    shell: d.shell, path: d.ref.path, hash: d.ref.sha256 });
                missing.push(p);
            }
        }
        this.trace('prime.sources', { type: diagnosticLabel(type), selected: targets.length, toRead: missing.length, reused: targets.length - missing.length });
        // A second boundary can pick up newly enabled rows without rereading unchanged packs.
        if (missing.length) await this.store.readMany(missing, (p, content) => { bodies.get(p).content = content; });
        if (pending !== this.pending || pm.serviceSettings.prompts !== owner) throw new PromptPreparationError('PREPARATION_INVALIDATED', 'Preset changed while loading prompts.');
        const stale = targets.find(p => !matches(bodies.get(p), p) || typeof bodies.get(p).content !== 'string');
        if (stale) {
            throw new PromptPreparationError('SOURCE_CHANGED_DURING_READ', 'A selected prompt changed while its source was loading. Retry generation.', { promptId: diagnosticLabel(stale.identifier) });
        }
        const uses = (types.get(type)?.uses ?? 0) + Number(reserve);
        types.set(type, { bodies, uses });
        this.trace('prime.ready', { type: diagnosticLabel(type), prepared: bodies.size, reservations: uses });
    }
    collect(pm, requestedType, assemble, repeatable = false, retryTypes) {
        const type = generationType(pm, requestedType), types = this.pending.get(pm.serviceSettings.prompts);
        const plan = types?.get(type);
        if (plan && !repeatable && --plan.uses <= 0) types.delete(type);
        // A retry can also ask for a normal collection. Reuse only source strings whose
        // rows are independently selected for normal and still have the same descriptor.
        const retries = !plan && type === 'normal' && retryTypes && types
            ? [...retryTypes].filter(t => t === 'swipe' || t === 'regenerate').map(t => types.get(t)).filter(Boolean)
            : [];
        const selected = new Map(), targets = this.targets(pm, type);
        this.trace('collect', { requested: diagnosticLabel(requestedType), type: diagnosticLabel(type), selected: targets.length,
            prepared: plan?.bodies.size ?? 0, hasPlan: Boolean(plan), retryPlans: retries.length, repeatable });
        for (const p of targets) {
            let record = plan?.bodies.get(p);
            for (const retry of retries) {
                const candidate = retry.bodies.get(p);
                if (matches(candidate, p)) { record = candidate; break; }
            }
            if (!matches(record, p)) {
                const details = { type: diagnosticLabel(type), promptId: diagnosticLabel(p.identifier) };
                if (!plan) throw new PromptPreparationError('PLAN_MISSING', 'Prompt sources were not loaded before assembly. Retry generation.', details);
                if (!record) {
                    const replaced = [...plan.bodies.keys()].some(row => row.identifier === p.identifier);
                    throw new PromptPreparationError('SELECTION_CHANGED', 'Prompt selection changed after loading. Retry generation.', {
                        ...details, row: replaced ? 'replaced' : 'newly-selected',
                    });
                }
                throw new PromptPreparationError('SOURCE_REVISED', 'A prepared prompt reference changed before assembly. Retry generation.', details);
            }
            selected.set(p, record);
        }
        const previous = this.current;
        this.current = selected;
        try { return assemble(); }
        finally { this.current = previous; }
    }
    source(p) {
        const record = this.current?.get(p);
        if (!matches(record, p)) throw new PromptPreparationError('SOURCE_UNPREPARED', 'An unloaded prompt reached native preparation.', {
            promptId: diagnosticLabel(p.identifier), inCollection: this.current !== null,
        });
        return record.content;
    }
}
