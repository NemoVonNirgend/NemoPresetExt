/** Stage 4B/5 offline parity/storage verifier. Never uploads or prints prompt prose. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { planExtraction, dependencies, BANKS, RESET, RESOLVE, ASSEMBLE, parseBank, libraryKey, candidate, loader } from '../features/vex-runtime/format.js';
import { execute } from '../features/vex-runtime/program.js';
import { VexStore } from '../features/vex-runtime/store.js';
import { digest } from '../features/vex-library/store.js';
const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--'));
if (!file) throw new Error('Usage: node scripts/validate-vex-runtime.mjs PRESET.json [--exhaustive]');
const text = await fs.readFile(file, 'utf8'), preset = JSON.parse(text), original = JSON.stringify(preset);
const equal = (a, b, label) => assert.equal(JSON.stringify(a) === JSON.stringify(b), true, label);
if (!candidate(preset)) {
    console.log(JSON.stringify({ stage: '4B/5', supported: false, unchanged: JSON.stringify(preset) === original }));
    process.exit(0);
}
const plan = await planExtraction(preset), contract = plan.contract, entries = plan.banks.flatMap(parseBank);
const full = Object.fromEntries(entries.map(e => [e.name, e.value]));
const statements = Object.fromEntries(entries.map(e => [e.name, e.statement]));
const families = ['happy', 'darkness', 'havoc', 'precision', 'adventure', 'desire'];
const familyMembers = families.map(f => {
    const start = contract.source[RESOLVE].indexOf(`NVCR1_map_${f}_`);
    const head = /^NVCR1_map_[a-z]+_((?:\{\{getvar::NVCR1_raw_[a-z_]+\}\})+)/.exec(contract.source[RESOLVE].slice(start));
    assert(head, 'Missing family source');
    return [...head[1].matchAll(/NVCR1_raw_[a-z_]+/g)].map(m => m[0]);
});
const choices = families.map((family, i) => {
    const states = new Map();
    for (const [key, value] of Object.entries(full)) if (key.startsWith(`NVCR1_map_${family}_`)) {
        const bits = key.slice(`NVCR1_map_${family}_`.length);
        if (!states.has(value)) states.set(value, familyMembers[i].filter((_, j) => bits[j] === '1'));
    }
    return [...states].sort((a, b) => Number(a[0]) - Number(b[0]));
});
const independent = Object.values(contract.selectors).filter(k => k.startsWith('NVCR1_raw_') && !familyMembers.flat().includes(k));
const baseOrder = preset.prompt_order[0].order;
const orderFor = selected => baseOrder.map(e => ({ ...e,
    enabled: Object.hasOwn(contract.selectors, e.identifier) ? selected.has(contract.selectors[e.identifier]) : e.enabled,
}));
let cases = 0, maxAssignments = 0, minAssignments = Infinity, maxSelectedCharacters = 0;
function run(selected, ambient = {}) {
    const dep = dependencies(preset, orderFor(new Set(selected)), contract, plan), outputs = [];
    for (const lib of [full, Object.fromEntries([...dep.reads].map(k => [k, full[k]]))]) {
        const state = Object.assign(Object.create(null), ambient), reads = new Set();
        execute(contract.programs[RESET], state);
        for (const key of selected) state[key] = '1';
        execute(contract.programs[RESOLVE], state, lib, reads);
        const output = execute(contract.programs[ASSEMBLE], state, lib, reads);
        for (const key of reads) assert(dep.reads.has(key), 'An original library read was not prepared.');
        outputs.push({ output, state: Object.fromEntries(Object.entries(state).filter(([k]) => !libraryKey(k))) });
    }
    equal(outputs[1], outputs[0], 'Full-source and selected-source output/state differ.');
    cases++; maxAssignments = Math.max(maxAssignments, dep.reads.size); minAssignments = Math.min(minAssignments, dep.reads.size);
    maxSelectedCharacters = Math.max(maxSelectedCharacters, [...dep.reads].reduce((n, k) => n + statements[k].length, 0));
    return outputs[0];
}
for (let bits = 0; bits < 2 ** independent.length; bits++) {
    const ids = independent.filter((_, i) => bits & 2 ** i);
    const solo = run(ids), council = run([...choices[0][1][1], ...choices[1][1][1], ...ids]);
    assert.equal(solo.state.NVCR1_code, '000000'); assert.equal(council.state.NVCR1_code, '110000');
}
let collapseCases = 0;
for (const [i, family] of families.entries()) for (const [key, state] of Object.entries(full)) if (key.startsWith(`NVCR1_map_${family}_`)) {
    const bits = key.slice(`NVCR1_map_${family}_`.length);
    const selected = familyMembers[i].filter((_, j) => bits[j] === '1');
    const a = run(selected), b = run(choices[i].find(([value]) => value === state)[1]);
    const publicValues = x => Object.fromEntries(Object.entries(x.state).filter(([k]) => k.startsWith('Vex') || k === 'NemoVexTone' || k === 'NVCR1_key'));
    equal(publicValues(a), publicValues(b), 'Same-family collapse changed public output.'); collapseCases++;
}
const exhaustive = args.includes('--exhaustive'); let familyConfigurations = 0;
function enumerate(i, ids) {
    if (i === choices.length) {
        if (exhaustive || familyConfigurations % 151 === 0) run(ids);
        familyConfigurations++; return;
    }
    for (const [, selected] of choices[i]) enumerate(i + 1, [...ids, ...selected]);
}
enumerate(0, []);
const all = Object.values(contract.selectors).filter(k => k.startsWith('NVCR1_raw_'));
equal(run(all), run([...all].reverse()), 'Selector order must not change output.');
run(all, { VexPersona: 'prior', VexPlanName: 'prior', UserRoleFocalSubject: 'named' });
run(all, { VexPersona: '0', VexPlanName: '', ClassicVexName: 'alternate' });
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-vex-4b-'));
try {
    let requests = 0;
    const fetchFn = async (url, options = {}) => {
        requests++;
        if (url === '/api/files/upload') {
            const data = JSON.parse(options.body); assert(/^[a-z0-9.-]+$/.test(data.name));
            await fs.writeFile(path.join(directory, data.name), Buffer.from(data.data, 'base64'));
            return Response.json({ path: `/files/${data.name}` });
        }
        assert(/^\/files\/nemo-vex-source-[a-f0-9]{64}\.json$/.test(url));
        try { return new Response(await fs.readFile(path.join(directory, path.basename(url)))); }
        catch (error) { if (error.code !== 'ENOENT') throw error; return new Response('missing', { status: 404 }); }
    };
    const store = new VexStore({ fetchFn }), compact = await store.extract(preset, plan);
    const fresh = new VexStore({ fetchFn }), compactBefore = JSON.stringify(compact);
    equal(await fresh.restore(compact), preset, 'Exact portable round trip failed.');
    assert.equal(JSON.stringify(compact), compactBefore); assert.equal(JSON.stringify(preset), original);
    const manifest = await fresh.manifest(compact), profiles = [];
    for (const profile of compact.prompt_order) {
        const dep = dependencies(compact, profile.order, contract, manifest), selected = await fresh.selected(manifest, dep.reads);
        for (const [i, id] of BANKS.entries()) {
            const expected = parseBank(plan.banks[i]).filter(e => dep.reads.has(e.name)).map(e => e.statement).join('');
            assert.equal(selected.bodies[id] === expected + '{{trim}}', true, 'Setter spelling changed during retrieval.');
            assert.equal(compact.prompts.find(p => p.identifier === id).content, loader(id));
        }
        profiles.push({ characterId: profile.character_id, selectedAssignments: dep.reads.size, selectedSetterCharacters: selected.characters });
    }
    console.log(JSON.stringify({ stage: '4B/5', supported: true, inputSha256: await digest(text),
        staticBlocks: BANKS.length, staticAssignments: entries.length,
        libraryCharacters: plan.banks.reduce((n, p) => n + p.content.length, 0), libraryBytes: plan.banks.reduce((n, p) => n + Buffer.byteLength(p.content), 0),
        savedPresetBytesBefore: Buffer.byteLength(original), savedPresetBytesAfter: Buffer.byteLength(JSON.stringify(compact)),
        profiles, parityCases: cases, familyConfigurations, exhaustiveFamilyConfigurationsTested: exhaustive ? familyConfigurations : false,
        collapseCases, independentCombinations: 2 ** independent.length, minAssignments, maxAssignments, maxSelectedCharacters,
        exactPortableRoundTrip: true, sourceUnchanged: true, exportCopyUnchanged: true, freshStoreRestoration: true,
        nativeSTMacroEngineTested: false, nativeBrowserTested: false, storageRequests: requests,
    }, null, 2));
} finally { await fs.rm(directory, { recursive: true, force: true }); }
