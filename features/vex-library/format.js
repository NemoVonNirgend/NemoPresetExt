/** Stage 4A/5: inert Vex source format, with no macro execution or live hooks. */
export const BANK_IDS = Object.freeze([
    'nemo-init-vex-maps-01', 'nemo-init-vex-routing-metadata',
    'nemo-init-vex-exchanges-01', 'nemo-init-vex-profiles-01', 'nemo-init-vex-profiles-02',
]);
export const CONTROL_IDS = Object.freeze([
    'nemo-init-vex-reset-01', 'nemo-vc-resolve-selection', 'nemo-vc-assemble-selected',
]);
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_ENTRIES = 10000;
export const SCHEMA = 'nemo-vex-source-v1';
export const byteLength = text => new TextEncoder().encode(text).byteLength;
export function requireThat(ok, message) {
    if (!ok) throw new Error(`Nemo Vex storage: ${message}`);
}
export function libraryKey(name) {
    return typeof name === 'string' && name.length <= 128
        && /^(?:NVCL1_[A-Za-z0-9_]+|NVM[a-z0-9][A-Za-z0-9_]*|NVCR1_(?:is_|map_|idmap_|namemap_|keymap_)[A-Za-z0-9_]+)$/.test(name);
}
export function indexPrompts(preset) {
    requireThat(Array.isArray(preset?.prompts), 'missing prompt list.');
    const result = new Map();
    for (const prompt of preset.prompts) {
        requireThat(prompt && typeof prompt.identifier === 'string' && prompt.identifier.length > 0
            && !result.has(prompt.identifier), 'invalid or duplicate prompt ID.');
        result.set(prompt.identifier, prompt);
    }
    return result;
}
export function hasVexLibrary(preset) {
    return Array.isArray(preset?.prompts)
        && [...BANK_IDS, ...CONTROL_IDS].every(id => preset.prompts.some(p => p?.identifier === id));
}

/** Preserve literal setter spelling, whitespace and UTF-16 source offsets exactly. */
export function parseBank(prompt) {
    requireThat(BANK_IDS.includes(prompt?.identifier) && typeof prompt.content === 'string', 'unknown data bank.');
    const text = prompt.content;
    requireThat(byteLength(text) <= MAX_BYTES, 'data bank exceeds the byte limit.');
    const entries = [], seen = new Set();
    const setter = /\{\{(#?setvar)::([A-Za-z][A-Za-z0-9_]*)((?:::)|(?:\}\}))/y;
    let pos = 0;
    while (pos < text.length) {
        if (/\s/u.test(text[pos])) { pos++; continue; }
        if (text.startsWith('{{//', pos)) {
            const end = text.indexOf('}}', pos + 4);
            requireThat(end >= 0 && !text.slice(pos + 4, end).includes('{{'), 'unclosed or nested data comment.');
            pos = end + 2;
            continue;
        }
        if (text.startsWith('{{trim}}', pos)) { pos += 8; continue; }
        const start = pos;
        setter.lastIndex = pos;
        const match = setter.exec(text);
        requireThat(match, `unsupported executable data in ${prompt.identifier}.`);
        const scoped = match[1] === '#setvar', name = match[2];
        requireThat(match[3] === (scoped ? '}}' : '::'), 'unsupported setter spelling.');
        requireThat(libraryKey(name) && !seen.has(name), 'unknown or duplicate library variable.');
        pos = setter.lastIndex;
        const close = scoped ? '{{/setvar}}' : '}}';
        const end = text.indexOf(close, pos);
        requireThat(end >= 0, 'unclosed literal setter.');
        const value = text.slice(pos, end);
        requireThat(!value.includes('{{') && !value.includes('}}'), 'executable or ambiguous library value.');
        pos = end + close.length;
        entries.push({ name, start, end: pos, value, statement: text.slice(start, pos) });
        seen.add(name);
        requireThat(entries.length <= MAX_ENTRIES, 'too many library entries.');
    }
    requireThat(entries.length > 0, 'empty data bank.');
    return entries;
}

/** Capture only the five banks. Never clone, mutate or evaluate the whole preset. */
export function snapshotLibrary(preset) {
    requireThat(hasVexLibrary(preset), 'not a supported raw Vex source layout.');
    const byId = indexPrompts(preset);
    const banks = BANK_IDS.map(id => JSON.parse(JSON.stringify(byId.get(id))));
    const names = new Set();
    let characters = 0, bytes = 0;
    const indexes = banks.map(bank => {
        const entries = parseBank(bank);
        for (const entry of entries) {
            requireThat(!names.has(entry.name), 'duplicate library variable across banks.');
            names.add(entry.name);
        }
        characters += bank.content.length;
        bytes += byteLength(bank.content);
        return entries.map(({ name, start, end }) => ({ name, start, end }));
    });
    requireThat(names.size <= MAX_ENTRIES, 'too many library entries.');
    return { banks, indexes, entryCount: names.size, characters, bytes };
}

/** Pure restore into an export/test copy. Refuse to overwrite unacknowledged edits. */
export function restoreSources(preset, originals, { expectedContents = new Map() } = {}) {
    const byId = indexPrompts(preset);
    requireThat(expectedContents instanceof Map, 'expected contents must be a Map.');
    requireThat(Array.isArray(originals) && originals.length === BANK_IDS.length, 'incomplete original library.');
    const bodies = new Map();
    originals.forEach((original, index) => {
        requireThat(original?.identifier === BANK_IDS[index] && byId.has(original.identifier), 'missing or mismatched restore slot.');
        parseBank(original);
        const current = byId.get(original.identifier);
        requireThat(current.content === original.content || (expectedContents.has(original.identifier)
            && current.content === expectedContents.get(original.identifier)), 'restore would overwrite an unacknowledged edit.');
        bodies.set(original.identifier, original.content);
    });
    return { ...preset, prompts: preset.prompts.map(prompt => bodies.has(prompt.identifier)
        ? { ...prompt, content: bodies.get(prompt.identifier) } : prompt) };
}
