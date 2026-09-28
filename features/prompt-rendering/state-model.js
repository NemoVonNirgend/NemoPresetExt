/** Stage 5B.1: metadata-only state for consumers that must outlive DOM rows. */
const requireState = (ok, message) => {
    if (!ok) throw new Error(`Nemo prompt state: ${message}`);
};

/** Copy only small UI fields. Never keep source objects, bodies or native order entries. */
export function readOrderedState(pm) {
    requireState(pm?.activeCharacter && Array.isArray(pm.serviceSettings?.prompts)
        && typeof pm.getPromptOrderForCharacter === 'function'
        && typeof pm.isPromptToggleAllowed === 'function', 'native state is not ready.');
    const sources = new Map();
    for (const prompt of pm.serviceSettings.prompts) {
        requireState(prompt && typeof prompt.identifier === 'string' && prompt.identifier.length > 0
            && typeof prompt.name === 'string' && !sources.has(prompt.identifier), 'invalid or duplicate prompt ID.');
        sources.set(prompt.identifier, prompt);
    }
    const order = pm.getPromptOrderForCharacter(pm.activeCharacter);
    requireState(Array.isArray(order), 'active prompt order is unavailable.');
    const seen = new Set();
    const rows = order.map(entry => {
        requireState(entry && typeof entry.identifier === 'string' && !seen.has(entry.identifier), 'duplicate or invalid order entry.');
        const prompt = sources.get(entry.identifier);
        requireState(prompt, `ordered prompt is missing: ${entry.identifier}`);
        requireState(typeof entry.enabled === 'boolean', `invalid enabled state: ${entry.identifier}`);
        seen.add(entry.identifier);
        return Object.freeze({ identifier: prompt.identifier, name: prompt.name,
            enabled: entry.enabled, toggleAllowed: Boolean(pm.isPromptToggleAllowed(prompt)) });
    });
    return Object.freeze(rows);
}

function validateRows(rows) {
    requireState(Array.isArray(rows), 'row metadata must be an array.');
    const seen = new Set();
    for (const row of rows) {
        requireState(row && typeof row.identifier === 'string' && row.identifier.length > 0
            && typeof row.name === 'string' && typeof row.enabled === 'boolean'
            && typeof row.toggleAllowed === 'boolean' && !seen.has(row.identifier), 'invalid row metadata.');
        seen.add(row.identifier);
    }
}

/** Preserve the existing snapshot format: an ordered array of enabled, toggleable IDs. */
export function snapshotIds(rows) {
    validateRows(rows);
    return rows.filter(row => row.enabled && row.toggleAllowed).map(row => row.identifier);
}

/** Plan only. The later action adapter must validate dependencies and hydrate before applying. */
export function planSnapshot(rows, savedIds) {
    validateRows(rows);
    requireState(Array.isArray(savedIds) && savedIds.every(id => typeof id === 'string' && id.length > 0), 'invalid saved snapshot.');
    const requested = new Set(savedIds), present = new Set(rows.map(row => row.identifier));
    const changes = rows.filter(row => row.toggleAllowed && row.enabled !== requested.has(row.identifier))
        .map(row => Object.freeze({ identifier: row.identifier, enabled: requested.has(row.identifier) }));
    return Object.freeze({ changes: Object.freeze(changes),
        missing: Object.freeze([...requested].filter(id => !present.has(id))),
        locked: Object.freeze(rows.filter(row => !row.toggleAllowed && row.enabled !== requested.has(row.identifier))
            .map(row => row.identifier)) });
}

/**
 * Build the existing main/subheader hierarchy from ordered metadata only.
 * The caller supplies its current divider classifier, including custom patterns.
 * Empty sections and orphan subheaders remain addressable by ID, not display name.
 */
export function buildSectionIndex(rows, classify) {
    validateRows(rows);
    requireState(typeof classify === 'function', 'divider classifier is required.');
    const byId = new Map(rows.map(row => [row.identifier, Object.freeze({
        identifier: row.identifier, name: row.name, enabled: row.enabled, toggleAllowed: row.toggleAllowed,
    })]));
    const sections = new Map(), roots = [], membership = new Map();
    let main = null, sub = null;
    for (const row of byId.values()) {
        const info = classify(row.name);
        requireState(info && typeof info.isDivider === 'boolean', 'divider classifier returned invalid metadata.');
        if (info.isDivider) {
            requireState(typeof info.isSubHeader === 'boolean' && typeof info.name === 'string', 'invalid section metadata.');
            const parentId = info.isSubHeader && main ? main : null;
            const section = { identifier: row.identifier, name: info.name, parentId,
                isSubHeader: info.isSubHeader, directIds: [], children: [] };
            sections.set(row.identifier, section);
            if (parentId) sections.get(parentId).children.push(row.identifier);
            else roots.push(row.identifier);
            if (info.isSubHeader) sub = row.identifier;
            else { main = row.identifier; sub = null; }
        } else {
            const parentId = sub ?? main;
            membership.set(row.identifier, parentId);
            if (parentId) sections.get(parentId).directIds.push(row.identifier);
            else roots.push(row.identifier);
        }
    }
    const summary = new Map();
    function finalize(id) {
        const section = sections.get(id), directIds = Object.freeze(section.directIds);
        const descendants = [...directIds];
        let enabled = directIds.filter(key => byId.get(key).enabled && byId.get(key).toggleAllowed).length;
        const directEnabled = enabled;
        for (const child of section.children) {
            const nested = finalize(child);
            descendants.push(...nested.memberIds);
            enabled += nested.enabled;
        }
        const value = Object.freeze({ ...section, directIds, children: Object.freeze(section.children),
            memberIds: Object.freeze(descendants), directEnabled, directTotal: directIds.length,
            enabled, total: descendants.length });
        summary.set(id, value);
        return value;
    }
    for (const id of roots) if (sections.has(id)) finalize(id);
    return Object.freeze({ roots: Object.freeze(roots),
        sectionIds: Object.freeze([...sections.keys()]),
        getSection: id => summary.get(id) ?? null,
        getRow: id => byId.get(id) ?? null,
        parentOf: id => sections.has(id) ? summary.get(id).parentId : membership.get(id) ?? null,
        counts(id, descendants = true) {
            const section = summary.get(id);
            requireState(section, 'unknown section ID.');
            return descendants ? { enabled: section.enabled, total: section.total }
                : { enabled: section.directEnabled, total: section.directTotal };
        },
    });
}
