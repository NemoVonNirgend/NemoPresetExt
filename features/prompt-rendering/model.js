/** Stage 5A: visual state only. Never read, clone, hash or tokenize prompt bodies. */
export function renderState(pm) {
    const sources = pm?.serviceSettings?.prompts;
    if (!Array.isArray(sources) || !pm.activeCharacter) return null;
    const byId = new Map();
    const footer = [];
    for (const p of sources) {
        if (!p || typeof p.identifier !== 'string' || byId.has(p.identifier) || typeof p.name !== 'string') return null;
        byId.set(p.identifier, p);
        if (!p.system_prompt) footer.push([p.identifier, p.name]);
    }
    const order = pm.getPromptOrderForCharacter(pm.activeCharacter);
    if (!Array.isArray(order)) return null;
    const entries = new Map(), counts = pm.tokenHandler?.getCounts() || {};
    const overridden = new Set(pm.overriddenPrompts || []);
    const rows = [];
    for (const entry of order) {
        const p = byId.get(entry.identifier);
        if (!p || entries.has(entry.identifier)) return null;
        entries.set(entry.identifier, entry);
        const allowed = ['Deletion', 'Edit', 'Toggle', 'Inspection'].map(kind => Boolean(pm[`isPrompt${kind}Allowed`](p)));
        const tokens = counts[p.identifier] || '-';
        const history = p.identifier === 'chatHistory' ? [pm.tokenUsage,
            pm.serviceSettings.openai_max_context, pm.serviceSettings.openai_max_tokens,
            pm.configuration.warningTokenThreshold, pm.configuration.dangerTokenThreshold] : [];
        rows.push({ id: p.identifier, name: p.name, key: JSON.stringify([
            p.name, p.role, Boolean(p.marker), Boolean(p.system_prompt), Boolean(p.forbid_overrides),
            p.injection_position, p.injection_depth, Boolean(entry.enabled), tokens,
            overridden.has(p.identifier), allowed, history,
        ]) });
    }
    const context = JSON.stringify([pm.configuration.prefix, pm.configuration.promptOrder,
        pm.activeCharacter.id, pm.activeCharacter.name]);
    return {
        owner: sources, context, rows, byId, entries,
        topology: JSON.stringify(rows.map(r => [r.id, r.name])),
        frame: JSON.stringify([context, pm.error, footer]),
        tokens: pm.tokenUsage,
    };
}

/** Keep only metadata signatures after a paint, not source strings or prompt records. */
export function remember(state, list) {
    return { owner: state.owner, context: state.context, topology: state.topology,
        frame: state.frame, tokens: state.tokens, rows: state.rows, list };
}
export function sameRevision(a, b) {
    return Boolean(a && b && a.owner === b.owner && a.context === b.context && a.frame === b.frame
        && a.tokens === b.tokens && a.topology === b.topology && a.rows.length === b.rows.length
        && a.rows.every((row, i) => row.key === b.rows[i].key));
}
export function changedRows(previous, next) {
    if (!previous || !next || previous.owner !== next.owner || previous.context !== next.context
        || previous.topology !== next.topology) return null;
    return next.rows.filter((row, i) => previous.rows[i]?.key !== row.key);
}

/** Restrict receiver-isolated rendering to the native ST method contract we inspected. */
export function supportsNativeRows(renderer) {
    if (typeof renderer !== 'function') return false;
    const source = Function.prototype.toString.call(renderer);
    return renderer.name === 'renderPromptManagerListItems'
        && source.includes('this.listElement') && source.includes('this.getPromptsForCharacter(')
        && source.includes('this.getPromptOrderEntry(') && source.includes('promptManagerListHeader')
        && !source.includes('this.#') && !source.includes('[native code]');
}
