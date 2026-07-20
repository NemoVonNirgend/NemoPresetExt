export const NEMO_EXTENSION_CATALOG = Object.freeze([
    Object.freeze({
        id: 'NemoLore',
        name: 'NemoLore',
        repository: 'https://github.com/NemoVonNirgend/NemoLore',
        description: 'Long-form roleplay memory, summaries, semantic retrieval, and lore maintenance.',
        category: 'Memory & Lore',
        icon: 'fa-solid fa-brain',
        recommended: true,
        requiresReload: true,
    }),
    Object.freeze({
        id: 'Ember',
        name: 'Ember',
        repository: 'https://github.com/NemoVonNirgend/Ember',
        description: 'Interactive JavaScript, rendered HTML, and reusable chat artifacts.',
        category: 'Interactive Content',
        icon: 'fa-solid fa-fire-flame-curved',
        recommended: true,
        requiresReload: true,
    }),
    Object.freeze({
        id: 'NemoGuides',
        name: 'Nemo Guides',
        repository: 'https://github.com/NemoVonNirgend/NemoGuides',
        description: 'Optional scene assessment, planning, writing, DM notes, rules, and narrative utility tools.',
        category: 'Narrative Tools',
        icon: 'fa-solid fa-compass-drafting',
        recommended: false,
        requiresReload: true,
    }),
    Object.freeze({
        id: 'NemoRewrite',
        name: 'Nemo Rewrite',
        repository: 'https://github.com/NemoVonNirgend/NemoRewrite',
        description: 'Selection-based rewriting, shortening, expansion, custom editing, deletion, undo, and optional NemoLore preference evidence.',
        category: 'Writing Tools',
        icon: 'fa-solid fa-wand-magic-sparkles',
        recommended: false,
        requiresReload: true,
    }),
]);

export function findCatalogEntry(id) {
    return NEMO_EXTENSION_CATALOG.find(entry => entry.id === id) ?? null;
}
