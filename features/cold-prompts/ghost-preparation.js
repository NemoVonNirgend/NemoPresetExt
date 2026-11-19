import { descriptorOf, isGhost } from './format.js';

const generationType = type => String(type || 'normal').toLowerCase().trim();

/** Verified source is owned by the extension until ST's synchronous collection consumes it. */
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
    async prime(pm, requestedType) {
        const type = generationType(requestedType), owner = pm.serviceSettings.prompts;
        const pending = this.pending, targets = this.targets(pm, type);
        const bodies = new Map(), descriptors = new Map(targets.map(p => [p, descriptorOf(p)]));
        await this.store.readMany(targets, (p, content) => bodies.set(p, { descriptor: descriptors.get(p), content }));
        if (pending !== this.pending || pm.serviceSettings.prompts !== owner) throw new Error('Preset changed while loading prompts.');
        let types = pending.get(owner);
        if (!types) pending.set(owner, types = new Map());
        const previous = types.get(type);
        // Concurrent calls with the same type share the most recent verified source set.
        types.set(type, { bodies, uses: (previous?.uses || 0) + 1 });
    }
    collect(pm, requestedType, assemble) {
        const type = generationType(requestedType), types = this.pending.get(pm.serviceSettings.prompts);
        const plan = types?.get(type);
        if (plan && --plan.uses === 0) types.delete(type);
        for (const p of this.targets(pm, type)) {
            if (plan?.bodies.get(p)?.descriptor !== descriptorOf(p)) {
                throw new Error('Prompt selection changed or was not loaded before assembly. Retry generation.');
            }
        }
        const previous = this.current;
        this.current = plan?.bodies;
        try { return assemble(); }
        finally { this.current = previous; }
    }
    source(p) {
        const record = this.current?.get(p);
        if (!record || record.descriptor !== descriptorOf(p)) throw new Error('An unloaded prompt reached native preparation.');
        return record.content;
    }
}
