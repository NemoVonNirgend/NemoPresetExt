/** Offline verifier. No preset prose is emitted or uploaded. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { planExtraction, dependencies, BANKS, RESET, RESOLVE, ASSEMBLE, parseBank, libraryKey, candidate } from '../features/vex-runtime/format.js';
import { execute } from '../features/vex-runtime/program.js';
import { VexStore } from '../features/vex-runtime/store.js';
const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--'));
if (!file) throw new Error('Usage: node scripts/validate-vex-preset.mjs PRESET.json [--exhaustive]');
const preset = JSON.parse(await fs.readFile(file, 'utf8'));
const original = JSON.stringify(preset);
if (!candidate(preset)) {
    console.log(JSON.stringify({ supported: false, unchanged: JSON.stringify(preset) === original }));
    process.exit(0);
}
const plan = await planExtraction(preset);
const full = Object.fromEntries(plan.banks.flatMap(p => parseBank(p).map(e => [e.name, e.value])));
const contract = plan.contract, families = ['happy', 'darkness', 'havoc', 'precision', 'adventure', 'desire'];
const source = contract.source[RESOLVE];
const familyMembers = families.map(f => {
    const segment = source.slice(source.indexOf(`NVCR1_map_${f}_`));
    const names = [];
    const regex = /^NVCR1_map_[a-z]+_((?:\{\{getvar::NVCR1_raw_[a-z_]+\}\})+)/.exec(segment);
    assert(regex);
    for (const m of regex[1].matchAll(/NVCR1_raw_[a-z_]+/g)) names.push(m[0]);
    return names;
});
const choices = families.map((f, i) => {
    const states = new Map();
    for (const [key, state] of Object.entries(full)) if (key.startsWith(`NVCR1_map_${f}_`)) {
        const bits = key.slice(`NVCR1_map_${f}_`.length);
        if (!states.has(state)) states.set(state, familyMembers[i].filter((_, j) => bits[j] === '1'));
    }
    return [...states].sort((a, b) => Number(a[0]) - Number(b[0]));
});
const independent = Object.values(contract.selectors).filter(k => k.startsWith('NVCR1_raw_') && !familyMembers.flat().includes(k));
const baseOrder = preset.prompt_order[0].order;
const orderFor = selected => baseOrder.map(e => ({ ...e, enabled: Object.hasOwn(contract.selectors, e.identifier) ? selected.has(contract.selectors[e.identifier]) : e.enabled }));
let cases = 0, maxAssignments = 0, minAssignments = Infinity, maxSelectedCharacters = 0;
const statements = Object.fromEntries(plan.banks.flatMap(p => parseBank(p).map(e => [e.name, e.statement])));
function run(selected, ambient = {}) {
    const order = orderFor(new Set(selected));
    const dep = dependencies(preset, order, contract, plan);
    const outputs = [];
    for (const lib of [full, Object.fromEntries([...dep.reads].map(k => [k, full[k]]))]) {
        const state = Object.assign(Object.create(null), ambient), actual = new Set();
        execute(contract.programs[RESET], state);
        for (const key of selected) state[key] = '1';
        execute(contract.programs[RESOLVE], state, lib, actual);
        const output = execute(contract.programs[ASSEMBLE], state, lib, actual);
        for (const key of actual) assert(dep.reads.has(key), `Unprepared library variable ${key}`);
        outputs.push({ output, state: Object.fromEntries(Object.entries(state).filter(([k]) => !libraryKey(k))) });
    }
    assert.deepEqual(outputs[1], outputs[0]);
    cases++;
    maxAssignments = Math.max(maxAssignments, dep.reads.size);
    minAssignments = Math.min(minAssignments, dep.reads.size);
    maxSelectedCharacters = Math.max(maxSelectedCharacters, [...dep.reads].reduce((n, k) => n + statements[k].length, 0));
    return outputs[0];
}
// Independent selections do not enter the six-family key, and all combinations
// remain additive without changing the selected family interview.
for (let bits = 0; bits < 2 ** independent.length; bits++) {
    const ids = independent.filter((_, i) => bits & 2 ** i);
    const solo = run(ids), council = run([...choices[0][1][1], ...choices[1][1][1], ...ids]);
    assert.equal(solo.state.NVCR1_code, '000000');
    assert.equal(council.state.NVCR1_code, '110000');
}
// Every same-family bitmask agrees with its lookup-defined representative.
let collapseCases = 0;
for (const [i, f] of families.entries()) for (const [key, state] of Object.entries(full)) if (key.startsWith(`NVCR1_map_${f}_`)) {
    const bits = key.slice(`NVCR1_map_${f}_`.length);
    const selected = familyMembers[i].filter((_, j) => bits[j] === '1');
    const a = run(selected), b = run(choices[i].find(([s]) => s === state)[1]);
    const publicValues = x => Object.fromEntries(Object.entries(x.state).filter(([k]) => k.startsWith('Vex') || k === 'NemoVexTone' || k === 'NVCR1_key'));
    assert.deepEqual(publicValues(a), publicValues(b)); collapseCases++;
}
// Canonical code is authoritative. This exhaustively compares the original
// literal library with the dependency-filtered library, not a reauthored council.
const exhaustive = args.includes('--exhaustive'); let familyCases = 0;
function enumerate(i, ids) {
    if (i === choices.length) {
        if (exhaustive || familyCases % 151 === 0) run(ids);
        familyCases++; return;
    }
    for (const [, selected] of choices[i]) enumerate(i + 1, [...ids, ...selected]);
}
enumerate(0, []);
// Source selection order is a set under the supported 1-valued selector schema.
const all = Object.values(contract.selectors).filter(k => k.startsWith('NVCR1_raw_'));
assert.deepEqual(run(all), run([...all].reverse()));
for (const ambient of [{ VexPersona: 'prior', VexPlanName: 'prior', UserRoleFocalSubject: 'named' }, { VexPersona: '0', VexPlanName: '', ClassicVexName: 'alternate' }]) run(all, ambient);

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-vex-'));
try {
    let requests = 0;
    const fetchFn = async (url, options = {}) => {
        requests++;
        if (url === '/api/files/upload') {
            const data = JSON.parse(options.body);
            assert(/^[a-z0-9.-]+$/.test(data.name));
            await fs.writeFile(path.join(directory, data.name), Buffer.from(data.data, 'base64'));
            return { ok: true, status: 200, text: async () => JSON.stringify({ path: `/files/${data.name}` }) };
        }
        assert(/^\/files\/nemo-vex-[a-f0-9]{64}\.json$/.test(url));
        try { const value = await fs.readFile(path.join(directory, path.basename(url)), 'utf8'); return { ok: true, status: 200, text: async () => value }; }
        catch (error) { if (error.code !== 'ENOENT') throw error; return { ok: false, status: 404, text: async () => '' }; }
    };
    const store = new VexStore({ fetchFn }), compact = await store.extract(preset, plan);
    const fresh = new VexStore({ fetchFn });
    assert.deepEqual(await fresh.restore(compact), preset);
    assert.equal(JSON.stringify(preset), original);
    const manifest = await fresh.manifest(compact), profiles = [];
    for (const profile of compact.prompt_order) {
        const dep = dependencies(compact, profile.order, contract, manifest);
        const selected = await fresh.selected(manifest, dep.reads);
        for (const [i, id] of BANKS.entries()) {
            const expected = parseBank(plan.banks[i]).filter(e => dep.reads.has(e.name)).map(e => e.statement).join('');
            assert.equal(selected.bodies[id], expected ? expected + '{{trim}}' : '');
        }
        profiles.push({ characterId: profile.character_id, selectedAssignments: dep.reads.size, selectedSetterCharacters: selected.characters });
    }
    console.log(JSON.stringify({
        stage: '4/5', supported: true, staticBlocks: BANKS.length, staticAssignments: Object.keys(full).length,
        originalLibraryCharacters: plan.banks.reduce((n, p) => n + p.content.length, 0),
        originalLibraryBytes: plan.banks.reduce((n, p) => n + Buffer.byteLength(p.content), 0),
        savedPresetBytesBefore: Buffer.byteLength(original), savedPresetBytesAfter: Buffer.byteLength(JSON.stringify(compact)),
        profiles, dependencyParityCases: cases, familyConfigurations: familyCases,
        exhaustiveFamilyConfigurationsTested: exhaustive ? familyCases : false, collapseCases,
        independentCombinations: 2 ** independent.length,
        minAssignments, maxAssignments, maxSelectedCharacters,
        exactPortableRoundTrip: true, sourceUnchanged: true, freshStoreRestoration: true,
        nativeBrowserTested: false, storageRequests: requests,
    }, null, 2));
} finally { await fs.rm(directory, { recursive: true, force: true }); }
