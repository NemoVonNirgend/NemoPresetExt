import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { digest } from '../core/sha256.js';
import { PromptBodyStore, digest as bodyDigest } from '../features/cold-prompts/store.js';
import { BODY_KEY } from '../features/cold-prompts/format.js';
import { RecipeStore, digest as recipeDigest } from '../features/recipe-runtime/store.js';
import { planExtraction, RESOLVER_TEXT, GUARD_TEXT } from '../features/recipe-runtime/format.js';
import { VexLibraryStore, digest as vexDigest } from '../features/vex-library/store.js';
import { BANK_IDS, CONTROL_IDS } from '../features/vex-library/format.js';

const reference = text => createHash('sha256').update(text, 'utf8').digest('hex');
async function withCrypto(value, action) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value });
    try { return await action(); }
    finally {
        if (original) Object.defineProperty(globalThis, 'crypto', original);
        else delete globalThis.crypto;
    }
}
function transport({ corruptUpload = false } = {}) {
    const files = new Map();
    let uploads = 0;
    const fetchFn = async (url, options) => {
        assert.equal(options.credentials, 'same-origin');
        assert.equal(options.redirect, 'error');
        assert.equal(options.cache, 'no-store');
        if (url === '/api/files/upload') {
            assert.equal(options.method, 'POST');
            const { name, data } = JSON.parse(options.body);
            const path = `/user/files/${name}`;
            const text = Buffer.from(data, 'base64').toString('utf8');
            files.set(path, text + (corruptUpload ? ' ' : ''));
            uploads++;
            return new Response(JSON.stringify({ path }));
        }
        return new Response(files.get(url) ?? '', { status: files.has(url) ? 200 : 404 });
    };
    return { files, fetchFn, get uploads() { return uploads; } };
}
const adapters = [
    { label: 'prompt bodies', Store: PromptBodyStore, prefix: 'nemo-prompts-',
        value: ['{{// @role system }}\nSnow 雪 🐉', 'A second prompt ⠀'],
        write: (store, value) => store.writePack(value), read: (store, ref) => store.pack(ref),
        packed: bodies => ({ schema: 1, bodies }) },
    { label: 'recipe sidecars', Store: RecipeStore, prefix: 'nemo-recipes-',
        value: { identifier: 'recipe-test', content: 'café 雪 🐉\n' },
        write: (store, value) => store.write(value), read: (store, ref) => store.read(ref), packed: value => value },
    { label: 'Vex source sidecars', Store: VexLibraryStore, prefix: 'nemo-vex-source-',
        value: { schema: 'nemo-vex-source-v1', content: 'Nemo ⠀ 雪 🐉\n' },
        write: (store, value) => store.write(value), read: (store, ref) => store.read(ref), packed: value => value },
];

test('all three storage modules re-export the one shared digest', () => {
    assert.equal(bodyDigest, digest);
    assert.equal(recipeDigest, digest);
    assert.equal(vexDigest, digest);
});

for (const adapter of adapters) {
    const { label, Store, prefix, value, write, read, packed } = adapter;
    test(`${label}: missing crypto/subtle still writes, verifies and reuses the same sidecar`, async () => {
        for (const crypto of [{}, undefined]) await withCrypto(crypto, async () => {
            const server = transport(), store = new Store({ fetchFn: server.fetchFn });
            const before = JSON.stringify(value);
            const ref = await write(store, value);
            assert.equal(ref.sha256, reference(JSON.stringify(packed(value))));
            assert.equal(ref.path, `/user/files/${prefix}${ref.sha256}.json`);
            assert.deepEqual(await read(store, ref), packed(value));
            assert.deepEqual(await write(store, value), ref);
            assert.equal(server.uploads, 1);
            assert.equal(JSON.stringify(value), before, 'source must not be mutated');
        });
    });
    test(`${label}: native and software paths can read and reuse each other's files`, async () => {
        for (const [writer, reader] of [[webcrypto, {}], [{}, webcrypto]]) {
            const server = transport(), store = new Store({ fetchFn: server.fetchFn });
            const ref = await withCrypto(writer, () => write(store, value));
            await withCrypto(reader, async () => {
                assert.deepEqual(await read(store, ref), packed(value));
                assert.deepEqual(await write(store, value), ref);
            });
            assert.equal(server.uploads, 1, 'no migration or duplicate upload');
        }
    });
    test(`${label}: fallback rejects corrupted reads and corrupted upload read-back`, async () => {
        await withCrypto({}, async () => {
            const server = transport(), store = new Store({ fetchFn: server.fetchFn });
            const ref = await write(store, value);
            server.files.set(ref.path, server.files.get(ref.path) + ' ');
            await assert.rejects(read(store, ref), /checksum mismatch/i);
            const broken = transport({ corruptUpload: true });
            await assert.rejects(write(new Store({ fetchFn: broken.fetchFn }), value), /checksum mismatch/i);
        });
    });
    test(`${label}: legacy /files references still load through the safe alternate path`, async () => {
        await withCrypto({}, async () => {
            const server = transport(), store = new Store({ fetchFn: server.fetchFn });
            const ref = await write(store, value);
            const legacy = { ...ref, path: ref.path.replace('/user/files/', '/files/') };
            assert.deepEqual(await read(store, legacy), packed(value));
        });
    });
}

test('cold prompt writeMany, shell metadata and portable restore work without subtle', async () => {
    await withCrypto({}, async () => {
        const server = transport(), store = new PromptBodyStore({ fetchFn: server.fetchFn, packChars: 32 });
        const prompts = ['nemo-user-role-character', 'v11-classic-user-message-ender', 'disabled-extra']
            .map(identifier => ({ identifier, content: `{{// @role system }}\n${identifier} 雪 🐉`.repeat(4) }));
        const before = structuredClone(prompts);
        const descriptors = await store.writeMany(prompts.map(prompt => ({ prompt, content: prompt.content })));
        const shells = prompts.map(p => ({ ...p, [BODY_KEY]: descriptors.get(p), content: descriptors.get(p).shell }));
        assert.deepEqual(await store.restorePrompts(shells), before);
        assert.deepEqual(prompts, before);
        assert.equal(store.diagnostics().pendingPacks, 0);
        assert.equal(store.diagnostics().residentPackCache, 0);
    });
});

test('recipe extraction, selected load and portable restoration work without subtle', async () => {
    await withCrypto({}, async () => {
        const server = transport(), store = new RecipeStore({ fetchFn: server.fetchFn });
        const statement = '{{setvar::NPaaaaaa::Recipe 雪 🐉}}';
        const prompts = [
            ['nc-selection-init', '{{setvar::NCGenreId::slice_of_life}}{{setvar::NCAuthorId::nemo_manuscript}}{{setvar::NCStyleId::modern_literature}}'],
            ['nemo-init-recipe-index', '{{setvar::NG_slice_of_life::aa}}{{setvar::NA_nemo_manuscript::aa}}{{setvar::NS_modern_literature::aa}}'],
            ['nemo-recipe-selection-sanitize', GUARD_TEXT],
            ['nemo-init-recipes-slice_of_life-01', `{{#if {{.NCGenreId == slice_of_life}}}}${statement}{{/if}}`],
            ['nc-writing-resolver', RESOLVER_TEXT],
        ].map(([identifier, content]) => ({ identifier, content }));
        const preset = { prompts, extensions: {}, prompt_order: [{ character_id: 100001,
            order: prompts.map(p => ({ identifier: p.identifier, enabled: true })) }] };
        const before = structuredClone(preset);
        const compact = await store.extract(preset, planExtraction(preset));
        assert.equal(await store.selected(await store.manifest(compact), 'NPaaaaaa'), statement);
        assert.deepEqual(await store.restore(compact), before);
        assert.deepEqual(preset, before);
    });
});

test('Vex capture, selected statements and source restoration work without subtle', async () => {
    await withCrypto({}, async () => {
        const server = transport(), store = new VexLibraryStore({ fetchFn: server.fetchFn });
        const banks = BANK_IDS.map((identifier, i) => ({ identifier, content: `{{setvar::NVCL1_test_${i}::Voice 雪 🐉 ${i}}}` }));
        const preset = { prompts: [...banks, ...CONTROL_IDS.map(identifier => ({ identifier, content: '{{trim}}' }))] };
        const before = structuredClone(preset);
        const descriptor = await store.capture(preset);
        const selected = await store.selected(descriptor, ['NVCL1_test_0']);
        assert.equal(selected[0].statements[0].statement, banks[0].content);
        assert.deepEqual(await store.restore(preset, descriptor), before);
        assert.deepEqual(preset, before);
    });
});
