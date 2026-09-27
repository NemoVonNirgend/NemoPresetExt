/** Nemo v12 recipe-bank codec. Pure data transformation; never evaluates macros. */
export const SCHEMA = 'nemo-recipes/1';
export const RESOLVER_ID = 'nc-writing-resolver';
export const RESOLVER_SOURCE = '{{getvar::NP{{getvar::NG_{{getvar::NCGenreId}}}}{{getvar::NA_{{getvar::NCAuthorId}}}}{{getvar::NS_{{getvar::NCStyleId}}}}}}\n{{trim}}';
export const RUNTIME_SOURCE = '{{// @nemo-external-recipes 1 }}{{nemoRecipeV12}}';
export const RUNTIME_KEY = 'nemoRecipeRuntime';
const BANK = /^nemo-init-recipes-([a-z_]+)-(\d+)$/;
const HEADING = /^nemo-init-heading-recipes-([a-z_]+)$/;
const KEY = /^NP[a-z]{6}$/;
const MAX_SOURCE = 64 * 1024 * 1024;

function requireValue(value, message) {
    if (!value) throw new Error(`Nemo recipe runtime: ${message}`);
}

export function getManifest(preset) {
    return preset?.extensions?.[RUNTIME_KEY] ?? null;
}

function skipTrivia(text, start) {
    let pos = start;
    while (pos < text.length) {
        if (/\s/.test(text[pos])) { pos++; continue; }
        if (text.startsWith('{{trim}}', pos)) { pos += 8; continue; }
        if (text.startsWith('{{//', pos)) {
            const end = text.indexOf('}}', pos + 4);
            requireValue(end >= 0, 'unterminated metadata comment');
            requireValue(!text.slice(pos + 4, end).includes('{{'), 'nested metadata is not supported by this codec');
            pos = end + 2;
            continue;
        }
        break;
    }
    return pos;
}

/** Index literal assignments by character offset, retaining original bytes for export. */
export function indexBank(prompt, genre) {
    const text = prompt.content;
    requireValue(typeof text === 'string' && text.length < MAX_SOURCE, 'invalid bank body');
    const opener = `{{#if {{.NCGenreId == ${genre}}}}}`;
    requireValue(text.startsWith(opener), `unrecognized guard in ${prompt.identifier}`);
    const entries = [];
    let pos = opener.length;
    while (true) {
        pos = skipTrivia(text, pos);
        if (text.startsWith('{{/if}}', pos)) {
            requireValue(text.slice(pos + 7).trim() === '', 'trailing bank instructions would be lost');
            break;
        }
        const inline = /^\{\{setvar::(NP[a-z]{6})::/.exec(text.slice(pos, pos + 40));
        const scoped = /^\{\{#setvar::(NP[a-z]{6})\}\}/.exec(text.slice(pos, pos + 40));
        const assignment = inline ?? scoped;
        requireValue(assignment, `nonliteral bank instruction in ${prompt.identifier}`);
        const start = pos + assignment[0].length;
        const close = scoped ? '{{/setvar}}' : '}}';
        const end = text.indexOf(close, start);
        requireValue(end >= 0, 'unterminated recipe assignment');
        requireValue(!text.slice(start, end).includes('{{'), 'recipes with executable nested macros require another codec');
        entries.push([assignment[1], start, end]);
        pos = end + close.length;
    }
    requireValue(entries.length > 0, 'empty recipe bank');
    return entries;
}

function captureLayout(items, removed) {
    const entries = [];
    const kept = [];
    for (let i = 0; i < items.length; i++) {
        const entry = items[i];
        if (removed.has(entry.identifier)) {
            // The next surviving entry is a stable export anchor even after ordinary edits.
            let next = i + 1;
            while (next < items.length && removed.has(items[next].identifier)) next++;
            entries.push({ entry, before: items[next]?.identifier ?? null });
        } else kept.push(entry);
    }
    return { kept, entries };
}

function insertLayout(items, removedEntries) {
    const result = items.slice();
    const ids = new Set(result.map(x => x.identifier));
    for (const { entry, before } of removedEntries) {
        requireValue(!ids.has(entry.identifier), `export has duplicate ${entry.identifier}`);
        const index = before === null ? result.length : result.findIndex(x => x.identifier === before);
        requireValue(index >= 0, `export anchor ${before} was deleted; restore from the original portable file`);
        result.splice(index, 0, structuredClone(entry));
        ids.add(entry.identifier);
    }
    return result;
}

/** Return null for non-recipe editions. Recognized but incompatible banks are rejected intact. */
export function planOffload(preset) {
    if (!preset || !Array.isArray(preset.prompts) || getManifest(preset)) return null;
    const banks = preset.prompts.filter(p => BANK.test(p?.identifier ?? ''));
    if (!banks.length) return null; // Lite, Tavo, legacy, and unrelated presets are untouched.
    const byId = new Map(preset.prompts.map(p => [p.identifier, p]));
    requireValue(byId.size === preset.prompts.length, 'duplicate prompt identifiers');
    for (const id of ['nc-selection-init', 'nemo-init-recipe-index', 'nemo-recipe-selection-sanitize', RESOLVER_ID]) {
        requireValue(byId.has(id), `missing structural signature ${id}`);
    }
    requireValue(byId.get(RESOLVER_ID).content === RESOLVER_SOURCE, 'custom recipe resolver is not safe to replace');
    requireValue(Array.isArray(preset.prompt_order) && preset.prompt_order.length > 0, 'missing order profiles');
    requireValue(new Set(preset.prompt_order.map(p => p.character_id)).size === preset.prompt_order.length, 'duplicate profile identifiers');
    const genres = new Set(banks.map(p => BANK.exec(p.identifier)[1]));
    const removed = new Set(banks.map(p => p.identifier));
    for (const p of preset.prompts) {
        const header = HEADING.exec(p.identifier);
        if (header && genres.has(header[1])) {
            requireValue(skipTrivia(p.content ?? '', 0) === (p.content ?? '').length, 'recipe heading contains executable content');
            removed.add(p.identifier);
        }
        if (!removed.has(p.identifier) && p.identifier !== RESOLVER_ID) {
            requireValue(!/\{\{(?:getvar|hasvar|varexists)::NP[a-z{]/.test(p.content ?? ''), 'another prompt reads recipe storage directly');
        }
    }
    const libraries = new Map();
    let recipeCount = 0;
    let sourceCharacters = 0;
    const allKeys = new Set();
    for (const p of preset.prompts) {
        if (!removed.has(p.identifier)) continue;
        const genre = (BANK.exec(p.identifier) ?? HEADING.exec(p.identifier))[1];
        if (!libraries.has(genre)) libraries.set(genre, { schema: SCHEMA, genre, prompts: [], entries: [] });
        const lib = libraries.get(genre);
        const sourceIndex = lib.prompts.length;
        lib.prompts.push(p); // References only in this temporary plan, not a second corpus copy.
        sourceCharacters += (p.content ?? '').length;
        if (BANK.test(p.identifier)) {
            requireValue(!p.marker && (p.injection_position ?? 0) === 0 && !(p.injection_trigger?.length), 'bank has custom injection semantics');
            for (const [key, start, end] of indexBank(p, genre)) {
                requireValue(!allKeys.has(key), `duplicate recipe key ${key}`);
                allKeys.add(key);
                lib.entries.push([key, sourceIndex, start, end]);
                recipeCount++;
            }
        }
    }
    const promptLayout = captureLayout(preset.prompts, removed);
    const profiles = preset.prompt_order.map(profile => {
        requireValue(Array.isArray(profile.order), 'invalid order profile');
        const ids = profile.order.map(x => x.identifier);
        requireValue(new Set(ids).size === ids.length, 'duplicate order references');
        const resolverIndex = ids.indexOf(RESOLVER_ID);
        requireValue(resolverIndex >= 0, 'resolver is missing from an order profile');
        for (const required of ['nc-selection-init', 'nemo-init-recipe-index', 'nemo-recipe-selection-sanitize']) {
            const position = ids.indexOf(required);
            requireValue(position >= 0 && position < resolverIndex && profile.order[position].enabled === true, `required setup ${required} is inactive`);
        }
        const guardIndex = ids.indexOf('nemo-recipe-selection-sanitize');
        requireValue(guardIndex >= 0 && guardIndex < resolverIndex, 'selection guard is out of order');
        for (const bank of banks) {
            const index = ids.indexOf(bank.identifier);
            requireValue(index > guardIndex && index < resolverIndex && profile.order[index].enabled === true,
                'disabled, missing, or reordered banks require portable mode');
        }
        const layout = captureLayout(profile.order, removed);
        return { character_id: profile.character_id, removed: layout.entries, kept: layout.kept };
    });
    return { preset, libraries, removed, promptLayout, profiles, recipeCount, sourceCharacters };
}

/** Call only after all referenced library files are durably saved and verified. */
export function finishOffload(plan, references) {
    for (const genre of plan.libraries.keys()) requireValue(references[genre], `library ${genre} was not saved`);
    const manifest = {
        schema: SCHEMA,
        libraries: references,
        recipeCount: plan.recipeCount,
        resolverSource: RESOLVER_SOURCE,
        // Bodies stay in server files. Only identifiers and order information live in ST.
        promptLayout: plan.promptLayout.entries.map(({ entry, before }) => ({ identifier: entry.identifier, before })),
        orderLayout: plan.profiles.map(p => ({ character_id: p.character_id, removed: p.removed })),
    };
    const prompts = plan.promptLayout.kept.map(p => p.identifier === RESOLVER_ID ? { ...p, content: RUNTIME_SOURCE } : p);
    return { ...plan.preset, prompts,
        prompt_order: plan.preset.prompt_order.map((p, i) => ({ ...p, order: plan.profiles[i].kept })),
        extensions: { ...plan.preset.extensions, [RUNTIME_KEY]: manifest },
    };
}

export function validateLibrary(library, expectedGenre) {
    requireValue(library?.schema === SCHEMA && library.genre === expectedGenre, 'wrong library schema or genre');
    requireValue(Array.isArray(library.prompts) && Array.isArray(library.entries), 'invalid library records');
    const index = new Map();
    for (const entry of library.entries) {
        const [key, source, start, end] = entry;
        const text = library.prompts[source]?.content;
        requireValue(KEY.test(key) && !index.has(key) && typeof text === 'string'
            && [source, start, end].every(Number.isSafeInteger) && start >= 0 && end >= start && end <= text.length,
        'invalid or duplicate recipe range');
        index.set(key, { text, start, end });
    }
    return { library, index, get: key => {
        const range = index.get(key);
        return range ? range.text.slice(range.start, range.end) : '';
    } };
}

/** Rehydrate an export COPY. Ordinary prompt edits and enablement are retained. */
export function restorePortable(preset, libraries) {
    const manifest = getManifest(preset);
    requireValue(manifest?.schema === SCHEMA, 'unsupported optimized preset');
    const originals = new Map();
    for (const genre of Object.keys(manifest.libraries)) {
        const data = libraries.get(genre);
        requireValue(data, `portable export is missing ${genre}`);
        for (const p of data.library.prompts) originals.set(p.identifier, p);
    }
    const additions = manifest.promptLayout.map(({ identifier, before }) => {
        requireValue(originals.has(identifier), `missing original ${identifier}`);
        return { entry: originals.get(identifier), before };
    });
    const resolver = preset.prompts.find(p => p.identifier === RESOLVER_ID);
    requireValue(resolver?.content === RUNTIME_SOURCE, 'external resolver was edited; cannot silently overwrite it');
    const prompts = insertLayout(preset.prompts.map(p => p.identifier === RESOLVER_ID
        ? { ...p, content: manifest.resolverSource } : p), additions);
    const order = preset.prompt_order.map(profile => {
        const old = manifest.orderLayout.find(x => x.character_id === profile.character_id);
        requireValue(old, 'new order profile needs an explicit portable migration');
        return { ...profile, order: insertLayout(profile.order, old.removed) };
    });
    const extensions = { ...preset.extensions };
    delete extensions[RUNTIME_KEY];
    return { ...preset, prompts, prompt_order: order, extensions };
}

/** Conservative prefetch hints, NOT a replacement for ST's actual variable evaluation. */
export function selectedGenres(preset, characterId = 100001, generationType = 'normal') {
    const manifest = getManifest(preset);
    requireValue(manifest?.schema === SCHEMA, 'unknown runtime schema');
    const profile = preset.prompt_order.find(p => p.character_id === characterId) ?? preset.prompt_order[0];
    const byId = new Map(preset.prompts.map(p => [p.identifier, p]));
    const genres = new Set();
    if (manifest.libraries.slice_of_life) genres.add('slice_of_life'); // Existing guard fallback.
    for (const entry of profile.order) {
        if (!entry.enabled) continue;
        const prompt = byId.get(entry.identifier);
        if (prompt?.injection_trigger?.length && !prompt.injection_trigger.includes(generationType)) continue;
        const text = prompt?.content ?? '';
        for (const match of text.matchAll(/\{\{setvar::NCGenreId::([a-z_]+)\}\}/g)) {
            if (manifest.libraries[match[1]]) genres.add(match[1]);
        }
    }
    requireValue(genres.size > 0, 'no supported selection is available');
    return genres;
}
