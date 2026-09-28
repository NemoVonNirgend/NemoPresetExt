import { compile, execute } from '../features/vex-runtime/program.js';
import { BANKS, RESET, RESOLVE, ASSEMBLE, parseBank } from '../features/vex-runtime/format.js';
import { VexStore } from '../features/vex-runtime/store.js';
import { createVexRuntime } from '../features/vex-runtime/controller.js';
const s = (key, value) => `{{setvar::${key}::${value}}}`;
const texts = [
    s('NVCR1_map_happy_00', '0') + s('NVCR1_map_happy_10', '1') + s('NVCR1_map_happy_01', '2') + s('NVCR1_map_happy_11', '3'),
    s('NVMrev', '1'),
    '{{#setvar::NVCL1_exchange_1}} Original exchange.\n{{/setvar}}',
    '{{#setvar::NVCL1_text_one}}Original one.{{/setvar}}{{#setvar::NVCL1_text_two}}Original two.{{/setvar}}',
    '{{#setvar::NVCL1_text_master}}Family master.{{/setvar}}{{#setvar::NVCL1_text_default}}Default.{{/setvar}}' + s('NVCL1_ready', '1'),
];
export function fixture() {
    const programs = {
        [RESET]: s('NVCR1_raw_bubbly', '0') + s('NVCR1_raw_cozy', '0') + s('NVCR1_n', '0'),
        [RESOLVE]: s('NVCR1_state_happy', '{{getvar::NVCR1_map_happy_{{getvar::NVCR1_raw_bubbly}}{{getvar::NVCR1_raw_cozy}}}}') + s('NVCR1_code', '00{{getvar::NVCR1_state_happy}}'),
        [ASSEMBLE]: '{{#if {{.NVCR1_state_happy == 1}}}}' + s('VexPersona', '{{getvar::NVCL1_text_one}}') + '{{/if}}{{#if {{.NVCR1_state_happy == 2}}}}' + s('VexPersona', '{{getvar::NVCL1_text_two}}') + '{{/if}}{{#if {{.NVCR1_state_happy == 3}}}}' + s('VexPersona', '{{getvar::NVCL1_text_master}}') + '{{/if}}{{#if !{{getvar::NVCR1_state_happy}}}}' + s('VexPersona', '{{getvar::NVCL1_text_default}}') + '{{/if}}',
    };
    const selectors = { 'v11-300-vex-bubbly-vex': 'NVCR1_raw_bubbly', 'v11-317-vex-cozy-vex': 'NVCR1_raw_cozy' };
    const prompts = [
        { identifier: RESET, content: programs[RESET] }, ...BANKS.map((id, i) => ({ identifier: id, content: '{{// metadata }}' + texts[i] + '{{trim}}' })),
        ...Object.entries(selectors).map(([id, key]) => ({ identifier: id, content: s(key, '1') })),
        ...[RESOLVE, ASSEMBLE].map(id => ({ identifier: id, content: programs[id] })),
    ].map(p => ({ ...p, name: p.identifier, role: 'system', injection_position: 0 }));
    const preset = { prompts, extensions: { regex_scripts: [{ findRegex: 'keep', replaceString: 'exact' }] }, prompt_order: [{ character_id: 100001, order: prompts.map(p => ({ identifier: p.identifier, enabled: p.identifier !== 'v11-317-vex-cozy-vex' })) }] };
    const contract = { selectors, programs: Object.fromEntries(Object.entries(programs).map(([k, v]) => [k, compile(v)])), byId: new Map(prompts.map(p => [p.identifier, p])) };
    const plan = { contract, banks: BANKS.map(id => contract.byId.get(id)), probes: {}, locations: {} };
    plan.banks.forEach((p, i) => parseBank(p).forEach(e => { plan.locations[e.name] = [i, e.start, e.end]; plan.probes[e.name] = /NVCL1_text_|NVCL1_exchange_/.test(e.name) ? 'VEX_TEXT' : e.value; }));
    return { preset, contract, plan };
}
export function server() {
    const disk = new Map(), calls = [];
    const fetchFn = async (url, options = {}) => {
        calls.push({ url, options });
        if (url === '/api/files/upload') {
            const body = JSON.parse(options.body), path = '/files/' + body.name;
            disk.set(path, Buffer.from(body.data, 'base64').toString('utf8'));
            return { ok: true, status: 200, text: async () => JSON.stringify({ path }) };
        }
        return { ok: disk.has(url), status: disk.has(url) ? 200 : 404, text: async () => disk.get(url) ?? '' };
    };
    return { disk, calls, fetchFn, store: new VexStore({ fetchFn, headers: () => ({ 'X-CSRF-Token': 'fixture' }) }) };
}
export class Events {
    constructor() { this.listeners = new Map(); }
    on(k, fn) { if (!this.listeners.has(k)) this.listeners.set(k, []); this.listeners.get(k).push(fn); }
    makeFirst(k, fn) { this.on(k, fn); const list = this.listeners.get(k); list.unshift(list.pop()); }
    removeListener(k, fn) { this.listeners.set(k, (this.listeners.get(k) || []).filter(x => x !== fn)); }
    async emit(k, ...args) { for (const fn of this.listeners.get(k) || []) { try { await fn(...args); } catch {} } }
}
export function harness(f, disk) {
    const events = new Events(), state = Object.create(null), notices = [], prepared = [];
    const keys = ['OAI_PRESET_IMPORT_READY', 'OAI_PRESET_EXPORT_READY', 'APP_READY', 'OAI_PRESET_CHANGED_BEFORE', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY'];
    const types = Object.fromEntries(keys.map(x => [x, x]));
    const manager = {
        serviceSettings: f.preset, activeCharacter: { id: 100001 },
        getPromptOrderForCharacter() { return this.serviceSettings.prompt_order[0].order; },
        preparePrompt(p) { prepared.push(p.content); return { ...p, content: execute(compile(p.content), state) }; },
        tryGenerate() { return 'native'; }, export(data) { return data; }, import(data) { return data; },
    };
    let stops = 0;
    const getContext = () => ({ mainApi: 'openai', stopGeneration() { stops++; }, variables: { local: {
        get(k) { const v = state[k] ?? ''; return String(v).trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v; },
        has(k) { return Object.hasOwn(state, k); }, del(k) { delete state[k]; },
    } } });
    const runtime = createVexRuntime({ events, types, getManager: () => manager, getContext, store: disk.store,
        validate: async p => ({ ...f.contract, byId: new Map(p.prompts.map(x => [x.identifier, x])) }),
        planImport: async () => f.plan, notify: (m, l) => notices.push([m, l]),
    });
    return { runtime, manager, events, types, state, prepared, notices, stops: () => stops,
        generate() { for (const e of manager.getPromptOrderForCharacter()) if (e.enabled) manager.preparePrompt(manager.serviceSettings.prompts.find(p => p.identifier === e.identifier)); },
    };
}
