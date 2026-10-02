const BRAILLE = '\u2800';
const SPACE_PATTERN = '[ \\u2800]';

// Expand character atoms, preserving groups, assertions and quantifiers.
export function expandRegexSpaces(source, flags = '') {
    return source.replace(/\[(?:\\[\s\S]|[^\\\]])*\]|\\(?:u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|[pP]\{[^}]+\}|c[A-Za-z]|[\s\S])|[ \u2800]/g, atom => {
        if (atom === ' ' || atom === BRAILLE) return SPACE_PATTERN;
        if (/^\\(?:[1-9]|[bBk])/u.test(atom)) return atom;
        atom = atom.replace(/\u2800|\\u2800|\\u\{2800\}/gi, '\\x20');
        const matcher = new RegExp(`^(?:${atom})$`, flags.replace(/[gy]/g, ''));
        const space = matcher.test(' '), braille = matcher.test(BRAILLE);
        if (space === braille) return atom;
        return space ? `(?:${atom}|\\u2800)` : `(?:(?!\\u2800)${atom})`;
    });
}

export function compileScanKey(key, entry, options) {
    if (typeof key !== 'string') return key;
    const resolved = options.substitute(key).trim();
    const regex = options.parseRegex(resolved);
    if (regex) {
        const source = expandRegexSpaces(regex.source, regex.flags).replaceAll('/', '\\/');
        new RegExp(source, regex.flags);
        return `/${source}/${regex.flags}`;
    }
    const text = resolved.replaceAll(BRAILLE, ' ').trim();
    if (!text.includes(' ')) return text;
    // SillyTavern uses substring matching for multiword plaintext keys, even
    // when whole-word matching is enabled. Single-word keys stay native.
    const pattern = text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replaceAll(' ', SPACE_PATTERN);
    return `/${pattern}/${(entry.caseSensitive ?? options.caseSensitive) ? '' : 'i'}`;
}

export function prepareLorebookScan(payload, options) {
    for (const name of ['globalLore', 'characterLore', 'chatLore', 'personaLore']) {
        if (!Array.isArray(payload?.[name])) continue;
        payload[name].forEach((entry, index, entries) => {
            const copy = { ...entry };
            for (const field of ['key', 'keysecondary']) {
                if (Array.isArray(entry[field])) {
                    copy[field] = entry[field].map(key => compileScanKey(key, entry, options));
                }
            }
            // Scan-only copies: cached entries and saved lorebooks stay intact.
            entries[index] = copy;
        });
    }
}
