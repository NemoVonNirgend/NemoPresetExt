// Usage: node scripts/validate-recipe-preset.mjs /path/to/Nemo_Engine_v12_Full.json
// The supplied preset stays local. No recipe corpus is checked into this repository.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { performance } from 'node:perf_hooks';
import { planExtraction, selectedKey, parseBank } from '../features/recipe-runtime/format.js';
import { RecipeStore } from '../features/recipe-runtime/store.js';

if (!process.argv[2]) throw new Error('Pass the portable Full preset path.');
const source = JSON.parse(await readFile(process.argv[2], 'utf8'));
const started = performance.now();
const plan = planExtraction(source);
const parseMs = performance.now() - started;
const directory = await mkdtemp(join(tmpdir(), 'nemo-recipes-'));
let uploads = 0;
const fetchFn = async (url, options) => {
    let text;
    if (url === '/api/files/upload') {
        const { name, data } = JSON.parse(options.body);
        await writeFile(join(directory, name), Buffer.from(data, 'base64'));
        uploads++;
        text = JSON.stringify({ path: `/user/files/${name}` });
    } else {
        try { text = await readFile(join(directory, basename(url)), 'utf8'); }
        catch (error) { if (error.code === 'ENOENT') return { ok: false, status: 404, text: async () => '' }; throw error; }
    }
    return { ok: true, status: 200, text: async () => text };
};
try {
    const store = new RecipeStore({ fetchFn });
    const compact = await store.extract(source, plan);
    // New store, empty runtime memory: only server-side files survive.
    const fresh = new RecipeStore({ fetchFn });
    const restored = await fresh.restore(compact);
    assert.deepEqual(restored, source);
    assert.equal(JSON.stringify(restored), JSON.stringify(source));
    const manifest = await fresh.manifest(compact);
    let exhaustive = 0;
    for (const bank of plan.banks) {
        const original = parseBank(bank).recipes;
        const ref = manifest.shards.find(s => s.identifier === bank.identifier);
        const persisted = parseBank(await fresh.read(ref)).recipes;
        assert.deepEqual(persisted, original);
        for (const key of Object.keys(original)) {
            assert.equal(manifest.shards[manifest.keyToShard[key]].identifier, bank.identifier);
            exhaustive++;
        }
    }
    const profiles = [];
    for (const profile of compact.prompt_order) {
        const key = selectedKey(compact, profile.order);
        assert.equal(key, selectedKey(source, source.prompt_order.find(p => p.character_id === profile.character_id).order));
        const statement = await fresh.selected(manifest, key);
        const bank = plan.banks.find(b => b.identifier === plan.keyToBank[key]);
        assert.equal(statement, parseBank(bank).recipes[key]);
        profiles.push({ character_id: profile.character_id, key, selectedSetterBytes: Buffer.byteLength(statement) });
    }
    const bytes = p => Buffer.byteLength(JSON.stringify(p, null, 2));
    const originalBytes = bytes(source); const compactBytes = bytes(compact);
    console.log(JSON.stringify({
        source: basename(process.argv[2]), originalPrompts: source.prompts.length,
        compactPrompts: compact.prompts.length, partitions: plan.banks.length,
        recipesIncludingScopedSetters: exhaustive, verifiedServerSidecars: uploads,
        originalBytes, compactBytes, reductionPercent: Number((100 * (1 - compactBytes / originalBytes)).toFixed(2)),
        localParseMilliseconds: Number(parseMs.toFixed(2)), profiles,
        checks: ['exact JSON round trip', 'every recipe statement preserved', 'all recipe-to-shard mappings verified', 'both profile selections preserved', 'fresh-store restoration from disk', 'unrelated prompts and regexes unchanged'],
        limitation: 'Local file-backed API-contract test, not a live SillyTavern browser benchmark.',
    }, null, 2));
} finally { await rm(directory, { recursive: true, force: true }); }
