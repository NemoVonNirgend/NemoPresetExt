import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { PromptBodyStore, digest } from '../features/cold-prompts/store.js';
import { createColdPromptRuntime } from '../features/cold-prompts/controller.js';
import { descriptorOf, isCold, shellFor } from '../features/cold-prompts/format.js';

if (!process.argv[2]) throw new Error('Usage: node scripts/validate-cold-preset.mjs PRESET.json [REPORT.json]');
const text = await readFile(process.argv[2], 'utf8');
const original = JSON.parse(text), preset = structuredClone(original);
const directory = await mkdtemp(join(tmpdir(), 'nemo-cold-validation-'));
const files = new Set();
const response = (text, status = 200) => ({ ok: status === 200, status, text: async () => text });
const fileFetch = async (url, options = {}) => {
    if (url === '/api/files/upload') {
        const { name, data } = JSON.parse(options.body);
        assert.match(name, /^nemo-prompts-[a-f0-9]{64}\.json$/);
        await writeFile(join(directory, name), Buffer.from(data, 'base64'));
        files.add(name);
        return response(JSON.stringify({ path: `user/files/${name}` }));
    }
    assert.match(url, /^\/user\/files\/nemo-prompts-[a-f0-9]{64}\.json$/);
    try { return response(await readFile(join(directory, basename(url)), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return response('', 404); throw error; }
};
const pm = {
    serviceSettings: preset, activeCharacter: { id: preset.prompt_order[0].character_id },
    getPromptOrderForCharacter(c) { return this.serviceSettings.prompt_order.find(p => p.character_id === c.id).order; },
    preparePrompt(p) { return p; }, getPromptCollection() {}, loadPromptIntoEditForm() {},
    export() {}, import() {}, async tryGenerate() {}, async saveServiceSettings() {},
};
const runtime = createColdPromptRuntime({
    events: { on() {}, removeListener() {} }, types: {}, getManager: () => pm,
    store: new PromptBodyStore({ fetchFn: fileFetch }),
});
try {
    await runtime.importReady({ data: preset });
    const descriptors = preset.prompts.filter(p => descriptorOf(p));
    assert.ok(descriptors.length > 0, 'No supported prompt bodies were stored.');
    for (const p of descriptors) {
        const before = original.prompts.find(o => o.identifier === p.identifier);
        assert.equal(p.content, shellFor(before.content));
    }
    const profiles = [];
    for (const profile of preset.prompt_order) {
        pm.activeCharacter.id = profile.character_id;
        await runtime.ready(preset, { evict: true });
        const enabled = new Set(profile.order.filter(e => e.enabled).map(e => e.identifier));
        for (const p of preset.prompts) {
            if (enabled.has(p.identifier)) {
                assert.equal(p.content, original.prompts.find(o => o.identifier === p.identifier).content);
                assert.equal(isCold(p), false);
            } else if (descriptorOf(p)) assert.equal(isCold(p), true);
        }
        profiles.push({ characterId: profile.character_id, enabled: enabled.size, ...runtime.getStats() });
    }
    // Simulate a fresh browser/runtime: no shared object, hot cache or IndexedDB.
    const freshStore = new PromptBodyStore({ fetchFn: fileFetch });
    const restored = { ...preset, prompts: await freshStore.restorePrompts(JSON.parse(JSON.stringify(preset.prompts))) };
    assert.deepEqual(restored, original);
    assert.equal(JSON.stringify(restored), JSON.stringify(original));
    const report = {
        stage: '3/5', input: basename(process.argv[2]), inputSha256: await digest(text),
        inputPrompts: original.prompts.length, storedPromptBodies: descriptors.length,
        durablePacks: files.size, profiles, exactPortableRoundTrip: true,
        enabledSourceParity: true, freshStoreRestoration: true,
        nativeBrowserValidation: 'not run',
        scope: 'Stage 3 on the supplied input. Recipe/Vex banks are not counted as Stage 3 externalization.',
    };
    if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
} finally { runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
