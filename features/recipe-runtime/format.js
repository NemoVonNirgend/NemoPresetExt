/** Portable Nemo v12 recipe schema. This module never evaluates prompt macros. */
export const RUNTIME_KEY = 'nemoRecipeRuntime';
export const RESOLVER_ID = 'nc-writing-resolver';
export const INDEX_ID = 'nemo-init-recipe-index';
export const GUARD_ID = 'nemo-recipe-selection-sanitize';
export const DEFAULT_ID = 'nc-selection-init';
export const RESOLVER_TEXT = '{{getvar::NP{{getvar::NG_{{getvar::NCGenreId}}}}{{getvar::NA_{{getvar::NCAuthorId}}}}{{getvar::NS_{{getvar::NCStyleId}}}}}}\n{{trim}}';
export const LOADER_TEXT = '{{// Recipe data is stored by NemoPresetExt, not in this prompt. Export the portable preset to edit the library. }}\n[NemoPresetExt recipe runtime required. Restore the extension or reimport the portable Nemo preset.]';
const BANK_ID = /^nemo-init-recipes-([a-z_]+)-(\d+)$/;
const SELECTOR_ID = /^(?:nc-selection-init|nc-(?:genre|author|style)-[a-z0-9_]+)$/;
const DEFAULTS = { NCGenreId: 'slice_of_life', NCAuthorId: 'nemo_manuscript', NCStyleId: 'modern_literature' };
export const GUARD_TEXT = '{{#if {{getvar::NG_{{getvar::NCGenreId}}}}}}{{else}}{{setvar::NCGenreId::slice_of_life}}{{setvar::NCAuthorId::nemo_manuscript}}{{setvar::NCStyleId::modern_literature}}{{setvar::GenreName::Slice of Life}}{{setvar::InfluenceName::Nemo / Manuscript Voice}}{{setvar::FormatName::Modern Literature / Contemporary Novel}}{{/if}}\n{{#if {{getvar::NA_{{getvar::NCAuthorId}}}}}}{{else}}{{setvar::NCAuthorId::nemo_manuscript}}{{setvar::InfluenceName::Nemo / Manuscript Voice}}{{/if}}\n{{#if {{getvar::NS_{{getvar::NCStyleId}}}}}}{{else}}{{setvar::NCStyleId::modern_literature}}{{setvar::FormatName::Modern Literature / Contemporary Novel}}{{/if}}{{trim}}';
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export const isBank = p => BANK_ID.test(p?.identifier ?? '');
export const runtimeOf = preset => preset?.extensions?.[RUNTIME_KEY] ?? null;
export const isCandidate = preset => Array.isArray(preset?.prompts)
    && preset.prompts.some(isBank)
    && preset.prompts.some(p => p.identifier === DEFAULT_ID)
    && preset.prompts.some(p => p.identifier === RESOLVER_ID);

function requireThat(ok, message) {
    if (!ok) throw new Error(`Nemo recipe runtime: ${message}`);
}

// This is deliberately NOT a general comment elider. Nested/ambiguous syntax is rejected.
function simpleComments(text) {
    return text.replace(/\{\{\/\/([^{}]*?)\}\}/g, '');
}
const normalized = s => simpleComments(s).replace(/\s+/g, '');

/** Accept only literal setter statements, comments and trim in known selector fields. */
export function literalAssignments(text) {
    const assignments = [];
    const rest = simpleComments(text).replace(/\{\{trim\}\}/g, '').replace(
        /\{\{setvar::([A-Za-z][\w-]*)::([^{}]*?)\}\}/g,
        (_, key, value) => { assignments.push([key, value.trim()]); return ''; },
    );
    requireThat(!rest.trim(), 'dynamic or unsupported selector syntax; export portable before changing selector logic.');
    return assignments;
}

export function parseIndex(text) {
    const result = Object.create(null);
    for (const [key, value] of literalAssignments(text)) {
        requireThat(/^N[GAS]_[a-z0-9_]+$/.test(key) && /^[a-z]{2}$/.test(value) && !has(result, key), 'invalid recipe index.');
        result[key] = value;
    }
    requireThat(Object.keys(result).length > 0, 'empty recipe index.');
    return result;
}

/** Parse one inert data partition, retaining the EXACT native setter for each recipe. */
export function parseBank(prompt) {
    const genre = BANK_ID.exec(prompt?.identifier ?? '')?.[1];
    requireThat(genre && typeof prompt.content === 'string', 'invalid recipe partition.');
    const prefix = `{{#if {{.NCGenreId == ${genre}}}}}`;
    const content = prompt.content.trim();
    requireThat(content.startsWith(prefix) && content.endsWith('{{/if}}'), `unsupported partition guard: ${prompt.identifier}`);
    let text = content.slice(prefix.length, -'{{/if}}'.length);
    const recipes = Object.create(null);
    // Scoped setters exist in the shipped v12 too. Preserve their whitespace and spelling.
    const setter = /\{\{setvar::(NP[a-z]{6})::([^{}]*?)\}\}|\{\{#setvar::(NP[a-z]{6})\}\}([^{}]*?)\{\{\/setvar\}\}/g;
    text = text.replace(setter, (statement, inlineKey, _inlineBody, scopedKey) => {
        const key = inlineKey ?? scopedKey;
        requireThat(!has(recipes, key), `duplicate recipe ${key}.`);
        recipes[key] = statement;
        return '';
    });
    text = simpleComments(text).replace(/\{\{trim\}\}/g, '');
    requireThat(!text.trim() && Object.keys(recipes).length > 0, `partition contains unsupported executable content: ${prompt.identifier}`);
    return { genre, recipes };
}

export function indexPrompts(preset) {
    requireThat(Array.isArray(preset?.prompts), 'missing prompts.');
    const result = new Map();
    for (const p of preset.prompts) {
        requireThat(p && typeof p.identifier === 'string' && !result.has(p.identifier), 'duplicate or invalid prompt ID.');
        result.set(p.identifier, p);
    }
    return result;
}

export function selectedKey(preset, order, type = 'normal') {
    const byId = indexPrompts(preset);
    const state = Object.create(null);
    let index = null;
    let defaults = false;
    let guarded = false;
    for (const entry of order ?? []) {
        const p = byId.get(entry.identifier);
        requireThat(p, `missing ordered prompt ${entry.identifier}.`);
        const triggers = p.injection_trigger;
        if (!entry.enabled || (Array.isArray(triggers) && triggers.length && !triggers.includes(type))) continue;
        if (SELECTOR_ID.test(p.identifier)) {
            for (const [key, value] of literalAssignments(p.content)) state[key] = value;
            if (p.identifier === DEFAULT_ID) defaults = true;
        } else if (p.identifier === INDEX_ID) {
            index = parseIndex(p.content);
        } else if (p.identifier === GUARD_ID) {
            requireThat(defaults && index && normalized(p.content) === normalized(GUARD_TEXT), 'unsupported selection guard or execution order.');
            if (!has(index, `NG_${state.NCGenreId}`)) Object.assign(state, DEFAULTS);
            if (!has(index, `NA_${state.NCAuthorId}`)) state.NCAuthorId = DEFAULTS.NCAuthorId;
            if (!has(index, `NS_${state.NCStyleId}`)) state.NCStyleId = DEFAULTS.NCStyleId;
            guarded = true;
        } else if (p.identifier === RESOLVER_ID) {
            requireThat(defaults && index && guarded, 'recipe selectors/index/guard must run before the resolver.');
            const key = 'NP' + index[`NG_${state.NCGenreId}`] + index[`NA_${state.NCAuthorId}`] + index[`NS_${state.NCStyleId}`];
            requireThat(/^NP[a-z]{6}$/.test(key), 'invalid selected recipe.');
            return key;
        }
    }
    return null; // Disabled or untriggered resolver contributes nothing.
}

/** Build a lossless extraction plan without mutating the imported object. */
export function planExtraction(preset) {
    requireThat(isCandidate(preset) && !runtimeOf(preset), 'not a portable supported Nemo recipe preset.');
    const byId = indexPrompts(preset);
    const resolver = byId.get(RESOLVER_ID);
    requireThat(resolver.content === RESOLVER_TEXT, 'modified recipe resolver; automatic conversion refused.');
    const index = parseIndex(byId.get(INDEX_ID)?.content ?? '');
    const banks = preset.prompts.filter(isBank);
    const bankIds = new Set(banks.map(p => p.identifier));
    const keyToBank = Object.create(null);
    for (const bank of banks) {
        const { genre, recipes } = parseBank(bank);
        requireThat(!bank.injection_trigger?.length, 'generation-specific recipe partitions are not supported.');
        for (const key of Object.keys(recipes)) {
            requireThat(key.startsWith(`NP${index[`NG_${genre}`]}`), 'recipe key does not match its genre guard.');
            requireThat(!has(keyToBank, key), `recipe ${key} appears in multiple partitions.`);
            keyToBank[key] = bank.identifier;
        }
    }
    requireThat(Array.isArray(preset.prompt_order) && preset.prompt_order.length, 'missing prompt orders.');
    for (const profile of preset.prompt_order) {
        requireThat(Array.isArray(profile.order), 'unsupported prompt order format.');
        const ids = profile.order.map(e => e.identifier);
        requireThat(new Set(ids).size === ids.length, 'duplicate prompt order entry.');
        const resolverPosition = ids.indexOf(RESOLVER_ID);
        const guardPosition = ids.indexOf(GUARD_ID);
        requireThat(ids.indexOf(DEFAULT_ID) < ids.indexOf(INDEX_ID) && ids.indexOf(INDEX_ID) < guardPosition, 'invalid selector/index order.');
        requireThat(profile.order.every((e, i) => !SELECTOR_ID.test(e.identifier) || i < guardPosition), 'selectors must precede the recipe guard.');
        for (const id of bankIds) {
            const i = ids.indexOf(id);
            requireThat(i >= 0 && i > ids.indexOf(GUARD_ID) && i < resolverPosition && profile.order[i].enabled === true,
                'all recipe partitions must be enabled between the guard and resolver before conversion.');
        }
        const key = selectedKey(preset, profile.order);
        requireThat(key === null || has(keyToBank, key), `selected recipe ${key} is absent.`);
    }
    // Do not externalize libraries used by unknown custom consumers or setters.
    for (const p of preset.prompts) {
        if (isBank(p) || p.identifier === RESOLVER_ID || SELECTOR_ID.test(p.identifier) || p.identifier === GUARD_ID) continue;
        requireThat(!/\bNP[a-z]{6}\b|getvar::NP\{\{|setvar::NC(?:Genre|Author|Style)Id|\.(?:NCGenreId|NCAuthorId|NCStyleId)\s*(?:=(?!=)|\+=|\+\+)/.test(p.content ?? ''),
            `custom recipe access in ${p.identifier}; conversion refused.`);
    }
    return {
        banks, keyToBank,
        restore: {
            promptIds: preset.prompts.map(p => p.identifier),
            profiles: structuredClone(preset.prompt_order),
            resolverContent: resolver.content,
        },
    };
}

/** Only call after every sidecar has been durably saved and verified. */
export function compactPreset(preset, plan, descriptor) {
    const ids = new Set(plan.banks.map(p => p.identifier));
    return {
        ...preset,
        prompts: preset.prompts.filter(p => !ids.has(p.identifier)).map(p => p.identifier === RESOLVER_ID ? { ...p, content: LOADER_TEXT } : p),
        prompt_order: preset.prompt_order.map(p => ({ ...p, order: p.order.filter(e => !ids.has(e.identifier)) })),
        extensions: { ...preset.extensions, [RUNTIME_KEY]: descriptor },
    };
}

function weave(current, originalIds, insertions, getId) {
    const currentIds = new Set(current.map(getId));
    const before = new Map();
    for (const item of insertions) {
        const id = getId(item);
        requireThat(!currentIds.has(id), `export would overwrite a prompt named ${id}.`);
        const pos = originalIds.indexOf(id);
        const anchor = originalIds.slice(pos + 1).find(x => currentIds.has(x)) ?? null;
        if (!before.has(anchor)) before.set(anchor, []);
        before.get(anchor).push(item);
    }
    return current.flatMap(item => [...(before.get(getId(item)) ?? []), item]).concat(before.get(null) ?? []);
}

/** Restore into the EXPORT COPY only; keep all unrelated edits and new prompts. */
export function restorePreset(preset, manifest, banks) {
    requireThat(runtimeOf(preset)?.schema === 1, 'unsupported optimized preset.');
    const ids = new Set(banks.map(p => p.identifier));
    const prompts = weave(preset.prompts, manifest.restore.promptIds, banks, p => p.identifier)
        .map(p => p.identifier === RESOLVER_ID && p.content === LOADER_TEXT ? { ...p, content: manifest.restore.resolverContent } : p);
    const prompt_order = preset.prompt_order.map(profile => {
        const saved = manifest.restore.profiles.find(p => p.character_id === profile.character_id) ?? manifest.restore.profiles[0];
        const order = weave(profile.order, saved.order.map(e => e.identifier), saved.order.filter(e => ids.has(e.identifier)), e => e.identifier);
        return { ...profile, order };
    });
    const extensions = { ...preset.extensions };
    delete extensions[RUNTIME_KEY];
    return { ...preset, prompts, prompt_order, extensions };
}

/** ST's EventEmitter swallows listener exceptions. Prevent a failed save/export from serializing. */
export function blockSerialization(object, error) {
    Object.defineProperty(object, 'toJSON', { configurable: true, enumerable: false, value() { throw error; } });
}
