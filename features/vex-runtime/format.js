import { compile, execute, truthy } from './program.js';

export const KEY = 'nemoVexRuntime';
export const RESET = 'nemo-init-vex-reset-01';
export const RESOLVE = 'nemo-vc-resolve-selection';
export const ASSEMBLE = 'nemo-vc-assemble-selected';
export const BANKS = Object.freeze([
    'nemo-init-vex-maps-01', 'nemo-init-vex-routing-metadata',
    'nemo-init-vex-exchanges-01', 'nemo-init-vex-profiles-01', 'nemo-init-vex-profiles-02',
]);
export const HASHES = Object.freeze({
    [RESET]: 'a86137adc573a35ceaf2c23e77753342604bdec2ee37cf5009012a756445a1b2',
    [RESOLVE]: 'e32941910f005440c2b51bc207949e280b7b0cdb812119d14c2aeb410fff4206',
    [ASSEMBLE]: '0311e2862e20fca36abeb0b04b451ab7bbbad5d27218515586ab6d3df369134a',
});
export const runtimeOf = preset => preset?.extensions?.[KEY] ?? null;
export const candidate = preset => Array.isArray(preset?.prompts) && BANKS.every(id => preset.prompts.some(p => p.identifier === id));
export const libraryKey = name => /^(?:NVCL1_|NVM[a-z0-9]|NVCR1_(?:is_|map_|idmap_|namemap_|keymap_))/.test(name);
export const requireThat = (ok, message) => { if (!ok) throw new Error(`Nemo Vex runtime: ${message}`); };
export const blockSerialization = (object, error) => Object.defineProperty(object, 'toJSON', { configurable: true, enumerable: false, value() { throw error; } });
export async function digest(text) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
}
export const loader = id => `{{// @category Variable-Init }}{{// @hidden }}{{// @badge LAZY }}{{// Vex library ${id} is stored by NemoPresetExt. Export portable to edit it. }}\n[NemoPresetExt Vex runtime required. Restore the extension or reimport the portable preset.]`;

/** Literal data only. Retain the original setter spelling and source offsets. */
export function parseBank(prompt) {
    requireThat(BANKS.includes(prompt?.identifier) && typeof prompt.content === 'string', 'unknown Vex data partition.');
    const text = prompt.content, entries = [];
    let pos = 0;
    while (pos < text.length) {
        if (/\s/.test(text[pos])) { pos++; continue; }
        const start = pos;
        if (text.startsWith('{{//', pos)) {
            pos = text.indexOf('}}', pos + 4);
            requireThat(pos >= 0, 'unclosed data comment.'); pos += 2; continue;
        }
        if (text.startsWith('{{trim}}', pos)) { pos += 8; continue; }
        const scoped = /^\{\{#setvar::([A-Za-z][\w]*)\}\}/.exec(text.slice(pos));
        const inline = scoped ? null : /^\{\{setvar::([A-Za-z][\w]*)::/.exec(text.slice(pos));
        requireThat(scoped || inline, `unsupported executable data in ${prompt.identifier}.`);
        const head = scoped || inline, name = head[1];
        pos += head[0].length;
        const close = scoped ? '{{/setvar}}' : '}}';
        const end = text.indexOf(close, pos);
        requireThat(end >= 0, 'unclosed literal setter.');
        const value = text.slice(pos, end);
        requireThat(libraryKey(name) && !value.includes('{{') && !value.includes('}}'), 'nonliteral or unknown library setter.');
        pos = end + close.length;
        entries.push({ name, value, start, end: pos, statement: text.slice(start, pos) });
    }
    requireThat(entries.length > 0, 'empty Vex partition.');
    requireThat(new Set(entries.map(e => e.name)).size === entries.length, 'duplicate library variable.');
    return entries;
}

export function indexPrompts(preset) {
    requireThat(Array.isArray(preset?.prompts), 'missing prompt list.');
    const byId = new Map();
    for (const p of preset.prompts) {
        requireThat(p && typeof p.identifier === 'string' && !byId.has(p.identifier), 'duplicate or invalid prompt ID.');
        byId.set(p.identifier, p);
    }
    return byId;
}
export function selectorValue(content) {
    const text = content.replace(/\{\{\/\/[^{}]*\}\}/g, '').replace(/\{\{trim\}\}/g, '').trim();
    const match = /^\{\{setvar::(NVCR1_(?:raw_[a-z_]+|default_requested))::1\}\}$/.exec(text);
    requireThat(match, 'unsupported Vex selector. Export portable before changing selection logic.');
    return match[1];
}
export const isSelector = p => /^v11-\d+-(?:vex-|classicvex-)/.test(p.identifier) || p.identifier === 'v11-299-default-vex';
const touchesLibrary = text => /NVCL1_|\bNVM[a-z0-9]|NVCR1_(?:is_|map_|idmap_|namemap_|keymap_)/.test(text);

/** Validate real source, not a filename. Strict fingerprints keep this an opt-in schema adapter. */
export async function validatePrograms(preset, readBody = async p => p.content ?? '', activeIds = null, registeredSelectors = {}) {
    const byId = indexPrompts(preset), programs = {}, source = {}, selectors = { ...registeredSelectors };
    for (const [id, hash] of Object.entries(HASHES)) {
        requireThat(byId.has(id), `missing ${id}.`);
        const body = await readBody(byId.get(id));
        requireThat(await digest(body) === hash, `unsupported or edited ${id}; no speculative conversion was performed.`);
        programs[id] = compile(body); source[id] = body;
    }
    for (const p of preset.prompts) {
        if (BANKS.includes(p.identifier) || Object.hasOwn(programs, p.identifier)) continue;
        if (activeIds && !activeIds.has(p.identifier)) continue;
        const body = await readBody(p);
        if (isSelector(p)) selectors[p.identifier] = selectorValue(body);
        else {
            requireThat(!touchesLibrary(body), `custom library access in ${p.identifier}.`);
            requireThat(!/\{\{(?:#?setvar|addvar)::NVCR1_|\{\{\.NVCR1_\w+\s*(?:=(?!=)|\+=|\+\+)/.test(body), `custom Vex state writer in ${p.identifier}.`);
        }
    }
    requireThat(Object.keys(selectors).length > 0, 'missing Vex selectors.');
    return { byId, programs, source, selectors };
}

export function checkOrder(preset, order, selectors, type = 'normal') {
    const byId = indexPrompts(preset), positions = new Map();
    requireThat(Array.isArray(order), 'missing prompt order.');
    order.forEach((e, i) => {
        requireThat(byId.has(e.identifier) && !positions.has(e.identifier), 'missing or repeated ordered prompt.');
        positions.set(e.identifier, i);
    });
    const active = id => {
        const p = byId.get(id), e = order[positions.get(id)];
        return Boolean(e?.enabled) && (!p.injection_trigger?.length || p.injection_trigger.includes(type));
    };
    if (!active(RESOLVE) && !active(ASSEMBLE)) return { active, selected: [], used: false };
    requireThat(active(RESET) && active(RESOLVE) && (!active(ASSEMBLE) || positions.get(ASSEMBLE) > positions.get(RESOLVE)), 'Vex reset/resolver/assembly order is not supported.');
    for (const id of BANKS) requireThat(active(id) && positions.get(id) > positions.get(RESET) && positions.get(id) < positions.get(RESOLVE), 'all Vex data slots must precede the resolver.');
    const selected = [];
    for (const e of order) if (Object.hasOwn(selectors, e.identifier) && active(e.identifier)) {
        requireThat(positions.get(e.identifier) > positions.get(RESET) && positions.get(e.identifier) < positions.get(RESOLVE), 'Vex selector lies outside its initialization boundary.');
        selected.push(selectors[e.identifier]);
    }
    for (const id of [RESET, RESOLVE, ASSEMBLE, ...BANKS]) {
        const p = byId.get(id);
        requireThat((p?.injection_position ?? 0) === 0 && !p?.marker, 'absolute or marker Vex slots are not supported.');
    }
    return { active, selected, used: true };
}

export function dependencies(preset, order, contract, manifest, type = 'normal') {
    const { active, selected, used } = checkOrder(preset, order, contract.selectors, type);
    const reads = new Set(), state = Object.create(null);
    if (!used) return { reads, state, selected, route: {}, used: false };
    execute(contract.programs[RESET], state);
    for (const key of selected) state[key] = '1';
    // Scalars are exact; literal profile prose is represented by its truth value.
    // It is only used in truth tests in this fingerprinted assembly program.
    execute(contract.programs[RESOLVE], state, manifest.probes, reads);
    const route = Object.fromEntries(['NVCR1_code', 'NVCR1_key', 'NVCR1_n', 'NVCR1_total', 'NVCR1_error', ...Array.from({ length: 5 }, (_, i) => `NVCR1_edge_${i + 1}`)].map(k => [k, state[k] ?? '']));
    if (active(ASSEMBLE)) execute(contract.programs[ASSEMBLE], state, manifest.probes, reads);
    return { reads, state, selected, route, used: true };
}

export async function planExtraction(preset, readBody) {
    requireThat(candidate(preset) && !runtimeOf(preset), 'not a raw supported Vex library.');
    const contract = await validatePrograms(preset, readBody);
    const banks = BANKS.map(id => contract.byId.get(id));
    const probes = Object.create(null), locations = Object.create(null);
    for (const [i, bank] of banks.entries()) for (const entry of parseBank(bank)) {
        requireThat(!Object.hasOwn(locations, entry.name), 'duplicate Vex variable across partitions.');
        probes[entry.name] = /^(NVCL1_text_|NVCL1_exchange_)/.test(entry.name) ? (truthy(entry.value) ? 'VEX_TEXT' : '') : entry.value;
        locations[entry.name] = [i, entry.start, entry.end];
    }
    requireThat(Array.isArray(preset.prompt_order) && preset.prompt_order.length > 0, 'missing saved profiles.');
    for (const profile of preset.prompt_order) dependencies(preset, profile.order, contract, { probes });
    return { contract, banks, probes, locations };
}
