/** Stage 4B/5: narrow runtime contract over the Stage 4A source format. */
import { BANK_IDS, CONTROL_IDS, hasVexLibrary, snapshotLibrary } from '../vex-library/format.js';
import { digest } from '../vex-library/store.js';
import { compile, execute, truthy } from './program.js';
export { parseBank, libraryKey, indexPrompts, requireThat } from '../vex-library/format.js';
import { parseBank, indexPrompts, requireThat } from '../vex-library/format.js';
export { digest };
export const BANKS = BANK_IDS;
export const [RESET, RESOLVE, ASSEMBLE] = CONTROL_IDS;
export const KEY = 'nemoVexRuntime';
export const SCHEMA = 'nemo-vex-runtime-v2';
export const HASHES = Object.freeze({
    [RESET]: 'a86137adc573a35ceaf2c23e77753342604bdec2ee37cf5009012a756445a1b2',
    [RESOLVE]: 'e32941910f005440c2b51bc207949e280b7b0cdb812119d14c2aeb410fff4206',
    [ASSEMBLE]: '0311e2862e20fca36abeb0b04b451ab7bbbad5d27218515586ab6d3df369134a',
});
export const runtimeOf = preset => preset?.extensions?.[KEY] ?? null;
export const candidate = preset => hasVexLibrary(preset) && !/tavo/i.test(preset.preset_name ?? '');
export const blockSerialization = (object, error) => Object.defineProperty(object, 'toJSON', {
    configurable: true, enumerable: false, value() { throw error; },
});
export const loader = id => `{{// @category Variable-Init }}{{// @hidden }}{{// @badge LAZY }}{{// Vex source ${id} is stored by NemoPresetExt. Export portable before editing the library. }}\n[NemoPresetExt Vex runtime required. Restore the extension or reimport the portable preset.]`;
export const isSelector = p => /^v11-\d+-(?:vex-|classicvex-)/.test(p.identifier) || p.identifier === 'v11-299-default-vex';
export const probeValue = (name, value) => /^(NVCL1_text_|NVCL1_exchange_)/.test(name) ? (truthy(value) ? 'VEX_TEXT' : '') : value;
export const comparable = value => {
    const text = String(value ?? '');
    return text.trim() !== '' && !Number.isNaN(Number(text)) ? String(Number(text)) : text;
};
export function selectorValue(content) {
    const text = content.replace(/\{\{\/\/[^{}]*\}\}/g, '').replace(/\{\{trim\}\}/g, '').trim();
    const match = /^\{\{setvar::(NVCR1_(?:raw_[a-z_]+|default_requested))::1\}\}$/.exec(text);
    requireThat(match, 'unsupported Vex selector; export portable before changing selection logic.');
    return match[1];
}
const touchesLibrary = text => /NVCL1_|\bNVM[a-z0-9]|NVCR1_(?:is_|map_|idmap_|namemap_|keymap_)/.test(text);
export async function validatePrograms(preset, readBody = async p => p.content ?? '', activeIds = null) {
    const byId = indexPrompts(preset), programs = {}, source = {}, selectors = {};
    // Fingerprint before compiling. No untrusted JavaScript or general macros run.
    for (const [id, hash] of Object.entries(HASHES)) {
        requireThat(byId.has(id), `missing ${id}.`);
        const body = await readBody(byId.get(id));
        requireThat(await digest(body) === hash, `unsupported or edited ${id}; conversion refused.`);
        programs[id] = compile(body); source[id] = body;
    }
    for (const p of preset.prompts) {
        if (BANKS.includes(p.identifier) || CONTROL_IDS.includes(p.identifier)) continue;
        if (activeIds && !activeIds.has(p.identifier)) continue;
        const body = await readBody(p);
        if (isSelector(p)) selectors[p.identifier] = selectorValue(body);
        else {
            requireThat(!touchesLibrary(body), `custom library access in ${p.identifier}.`);
            requireThat(!/\{\{(?:#?setvar|addvar)::NVCR1_|\{\{\.NVCR1_\w+\s*(?:=(?!=)|\+=|\+\+)/.test(body), `custom Vex state writer in ${p.identifier}.`);
        }
    }
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
    // Even an inactive program needs its source slots retained for later use/export.
    for (const id of [...BANKS, ...CONTROL_IDS]) {
        const p = byId.get(id);
        requireThat(p && (p.injection_position ?? 0) === 0 && !p.marker, 'unsupported Vex slot.');
    }
    if (!active(RESOLVE) && !active(ASSEMBLE)) return { active, selected: [], used: false };
    requireThat(active(RESET) && active(RESOLVE) && positions.get(RESET) < positions.get(RESOLVE)
        && (!active(ASSEMBLE) || positions.get(ASSEMBLE) > positions.get(RESOLVE)), 'invalid reset/resolver/assembly order.');
    for (const id of BANKS) requireThat(active(id) && positions.get(id) > positions.get(RESET)
        && positions.get(id) < positions.get(RESOLVE), 'all Vex data slots must run between reset and resolver.');
    const selected = [];
    for (const e of order) if (Object.hasOwn(selectors, e.identifier) && active(e.identifier)) {
        const p = byId.get(e.identifier);
        requireThat((p.injection_position ?? 0) === 0 && !p.marker && positions.get(e.identifier) > positions.get(RESET)
            && positions.get(e.identifier) < positions.get(RESOLVE), 'Vex selector lies outside its initialization boundary.');
        selected.push(selectors[e.identifier]);
    }
    return { active, selected, used: true };
}
export const ROUTE_KEYS = Object.freeze([
    'NVCR1_code', 'NVCR1_key', 'NVCR1_n', 'NVCR1_total', 'NVCR1_error', 'NVCR1_multi',
    ...Array.from({ length: 5 }, (_, i) => `NVCR1_edge_${i + 1}`),
    ...['happy', 'darkness', 'havoc', 'precision', 'adventure', 'desire'].map(k => `NVCR1_state_${k}`),
]);
export function dependencies(preset, order, contract, catalog, type = 'normal') {
    const { active, selected, used } = checkOrder(preset, order, contract.selectors, type);
    const reads = new Set(), state = Object.create(null);
    if (!used) return { reads, state, selected, input: {}, route: {}, used: false };
    execute(contract.programs[RESET], state);
    for (const key of selected) state[key] = '1';
    const input = Object.fromEntries(Object.entries(state).filter(([key]) => /^NVCR1_raw_|^NVCR1_default_requested$/.test(key)));
    execute(contract.programs[RESOLVE], state, catalog.probes, reads);
    const route = Object.fromEntries(ROUTE_KEYS.map(k => [k, state[k] ?? '']));
    if (active(ASSEMBLE)) execute(contract.programs[ASSEMBLE], state, catalog.probes, reads);
    return { reads, state, selected, input, route, used: true };
}
export async function planExtraction(preset, readBody) {
    requireThat(candidate(preset) && !runtimeOf(preset), 'not a supported raw Vex library.');
    // Bank snapshots and control sources are immutable throughout storage writes.
    const snapshot = snapshotLibrary(preset);
    const contract = await validatePrograms(preset, readBody);
    const probes = Object.create(null);
    for (const bank of snapshot.banks) for (const entry of parseBank(bank)) {
        probes[entry.name] = probeValue(entry.name, entry.value);
        requireThat(probes[entry.name].length < 1024, 'oversized scalar dependency field.');
    }
    requireThat(Array.isArray(preset.prompt_order) && preset.prompt_order.length > 0, 'missing saved profiles.');
    for (const profile of preset.prompt_order) dependencies(preset, profile.order, contract, { probes });
    return { banks: snapshot.banks, contract, probes, entries: snapshot.entryCount };
}
