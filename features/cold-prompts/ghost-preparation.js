import { descriptorOf, isGhost } from './format.js';

function generationType(pm, type) {
    // Older PromptManagers collect every enabled row and omit the type at collection.
    return typeof pm.shouldTrigger === 'function' ? String(type || 'normal').toLowerCase().trim() : 'normal';
}

function matches(record, prompt) {
    const d = descriptorOf(prompt);
    return Boolean(record && record.descriptor === d && record.index === d.index
        && record.characters === d.characters && record.shell === d.shell
        && record.path === d.ref.path && record.hash === d.ref.sha256);
}

/** Only raw source is reusable. ST still assembles and evaluates each collection itself. */
export class GhostPreparation {
    constructor(store) {
        this.store = store;
        this.reset();
    }
    reset() {
        this.pending = new WeakMap();
        this.current = null;
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
                const d = descriptorOf(p);
                bodies.set(p, { descriptor: d, index: d.index, characters: d.characters,
                    shell: d.shell, path: d.ref.path, hash: d.ref.sha256 });
                missing.push(p);
            }
        }
        // A second boundary can pick up newly enabled rows without rereading unchanged packs.
        if (missing.length) await this.store.readMany(missing, (p, content) => { bodies.get(p).content = content; });
        if (pending !== this.pending || pm.serviceSettings.prompts !== owner) throw new Error('Preset changed while loading prompts.');
        if (targets.some(p => !matches(bodies.get(p), p) || typeof bodies.get(p).content !== 'string')) {
            throw new Error('A selected prompt changed while its source was loading. Retry generation.');
        }
        const uses = (types.get(type)?.uses ?? 0) + Number(reserve);
        types.set(type, { bodies, uses });
    }
    collect(pm, requestedType, assemble, repeatable = false) {
        const type = generationType(pm, requestedType), types = this.pending.get(pm.serviceSettings.prompts);
        const plan = types?.get(type);
        if (plan && !repeatable && --plan.uses <= 0) types.delete(type);
        const selected = new Map();
        for (const p of this.targets(pm, type)) {
            const record = plan?.bodies.get(p);
            if (!matches(record, p)) {
                const reason = plan ? 'Prompt selection changed after loading' : 'Prompt sources were not loaded before assembly';
                throw new Error(`${reason} (${type}, ${p.identifier}). Retry generation.`);
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
        if (!matches(record, p)) throw new Error('An unloaded prompt reached native preparation.');
        return record.content;
    }
}
