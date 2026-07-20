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
]);

export function findCatalogEntry(id) {
    return NEMO_EXTENSION_CATALOG.find(entry => entry.id === id) ?? null;
}
