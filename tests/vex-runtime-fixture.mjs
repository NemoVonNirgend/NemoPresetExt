import { compile, execute } from '../features/vex-runtime/program.js';
import { BANKS, RESET, RESOLVE, ASSEMBLE, parseBank, probeValue, selectorValue, isSelector } from '../features/vex-runtime/format.js';
import { VexStore } from '../features/vex-runtime/store.js';
import { createVexRuntime } from '../features/vex-runtime/controller.js';
const s = (key, value) => `{{setvar::${key}::${value}}}`;
export function fixture() {
    const source = {
        [RESET]: s('NVCR1_raw_bubbly', '0') + s('NVCR1_raw_cozy', '0') + s('NVCR1_default_requested', ''),
        [RESOLVE]: s('NVCR1_state_happy', '{{getvar::NVCR1_map_happy_{{getvar::NVCR1_raw_bubbly}}{{getvar::NVCR1_raw_cozy}}}}') + s('NVCR1_code', 'x{{getvar::NVCR1_state_happy}}'),
        [ASSEMBLE]: [0, 1, 2, 3].map(i => `{{#if {{.NVCR1_state_happy == ${i}}}}}` + s('VexPersona', `{{getvar::NVCL1_text_${i}}}`) + '{{/if}}').join(''),
    };
    const texts = [
        [0, 1, 2, 3].map((v, i) => s('NVCR1_map_happy_' + ['00', '10', '01', '11'][i], String(v))).join(''),
        s('NVMrevision', '1'), s('NVCL1_exchange_one', 'Exchange.'),
        s('NVCL1_text_1', 'First 🧩 original.') + '{{#setvar::NVCL1_text_2}}\nSecond original.\n{{/setvar}}',
        s('NVCL1_text_0', 'Default.') + s('NVCL1_text_3', 'Family master.'),
    ];
    const selectors = { 'v11-300-vex-bubbly-vex': 'NVCR1_raw_bubbly', 'v11-317-vex-cozy-vex': 'NVCR1_raw_cozy' };
    const prompts = [{ identifier: RESET, content: source[RESET] },
        ...BANKS.map((identifier, i) => ({ identifier, content: '{{// @hidden }}' + texts[i] + '{{trim}}' })),
        ...Object.entries(selectors).map(([identifier, key]) => ({ identifier, content: s(key, '1') })),
        ...[RESOLVE, ASSEMBLE].map(identifier => ({ identifier, content: source[identifier] }))]
        .map(p => ({ ...p, name: p.identifier, role: 'system', injection_position: 0, injection_trigger: [] }));
    const preset = { prompts, extensions: { regex_scripts: [{ findRegex: 'keep', replaceString: 'exact' }] },
        prompt_order: [{ character_id: 100001, order: prompts.map(p => ({ identifier: p.identifier, enabled: p.identifier !== 'v11-317-vex-cozy-vex' })) }] };
    const programs = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, compile(v)]));
    const validate = async (p, read = async x => x.content) => {
        const byId = new Map(p.prompts.map(x => [x.identifier, x]));
        for (const [id, text] of Object.entries(source)) if (await read(byId.get(id)) !== text) throw new Error('Fixture control changed.');
        const selected = {};
        for (const item of p.prompts.filter(isSelector)) selected[item.identifier] = selectorValue(await read(item));
        return { source, programs, byId, selectors: selected };
    };
    const planImport = async p => {
        const contract = await validate(p), banks = BANKS.map(id => ({ ...contract.byId.get(id) }));
        const probes = Object.fromEntries(banks.flatMap(b => parseBank(b).map(e => [e.name, probeValue(e.name, e.value)])));
        return { banks, probes, entries: Object.keys(probes).length, contract };
    };
    return { preset, source, validate, planImport };
}
export function server() {
    const disk = new Map(), calls = [];
    const fetchFn = async (url, options = {}) => {
        calls.push({ url, options });
        if (url === '/api/files/upload') {
            const { name, data } = JSON.parse(options.body), path = '/files/' + name;
            disk.set(path, Buffer.from(data, 'base64').toString('utf8'));
            return Response.json({ path });
        }
        return disk.has(url) ? new Response(disk.get(url)) : new Response('missing', { status: 404 });
    };
    return { disk, calls, fetchFn, store: new VexStore({ fetchFn, headers: () => ({ 'X-CSRF-Token': 'fixture' }) }) };
}
export class Events {
    constructor() { this.listeners = new Map(); }
    on(k, fn) { if (!this.listeners.has(k)) this.listeners.set(k, []); this.listeners.get(k).push(fn); }
    makeFirst(k, fn) { this.on(k, fn); const list = this.listeners.get(k); list.unshift(list.pop()); }
    removeListener(k, fn) { this.listeners.set(k, (this.listeners.get(k) || []).filter(x => x !== fn)); }
    async emit(k, ...args) { for (const fn of [...(this.listeners.get(k) || [])]) { try { await fn(...args); } catch {} } }
}
export const TYPES = Object.fromEntries(['OAI_PRESET_IMPORT_READY', 'OAI_PRESET_EXPORT_READY', 'APP_READY', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY'].map(x => [x, x]));
export function harness(f = fixture(), io = server(), overrides = {}) {
    const events = new Events(), state = Object.create(null), notices = [], seen = [];
    const manager = {
        serviceSettings: f.preset, activeCharacter: { id: 100001 },
        getPromptOrderForCharacter() { return this.serviceSettings.prompt_order.find(p => p.character_id === this.activeCharacter.id).order; },
        preparePrompt(p) { seen.push(p); return { ...p, content: execute(compile(p.content), state) }; },
        tryGenerate() { return 'native'; }, export(data) { return data; }, import(data) { return data; },
    };
    let stopped = 0;
    const context = { mainApi: 'openai', stopGeneration() { stopped++; }, variables: { local: {
        get(k) { const v = state[k] ?? ''; return String(v).trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v; },
        has(k) { return Object.hasOwn(state, k); }, del(k) { delete state[k]; },
    } } };
    const original = { ...manager };
    const runtime = createVexRuntime({ events, types: TYPES, getManager: () => manager, getContext: () => context,
        store: io.store, validate: f.validate, planImport: f.planImport, notify: (m, l) => notices.push([m, l]), ...overrides });
    return { f, io, runtime, manager, original, context, events, types: TYPES, state, seen, notices, stops: () => stopped,
        async import() { await runtime.importReady({ data: f.preset }); await runtime.ready(); },
        generate(type = 'normal') { for (const e of manager.getPromptOrderForCharacter()) {
            const p = manager.serviceSettings.prompts.find(p => p.identifier === e.identifier);
            if (e.enabled && (!p.injection_trigger?.length || p.injection_trigger.includes(type))) manager.preparePrompt(p);
        } },
    };
}
