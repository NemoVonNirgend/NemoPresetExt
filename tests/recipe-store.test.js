import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, memoryServer } from './recipe-fixture.js';
import { planOffload } from '../features/preset-runtime/recipe-codec.js';
import { RecipeStore, validateReference, sha256 } from '../features/preset-runtime/recipe-store.js';

function setup() {
    const server = memoryServer();
    const store = new RecipeStore({ request: server.request, headers: () => ({ 'X-CSRF-Token': 'test-csrf' }) });
    const library = planOffload(fixture()).libraries.get('slice_of_life');
    return { server, store, library };
}

test('durable write performs authenticated upload AND read-after-write integrity verification', async () => {
    const { store, server, library } = setup();
    const ref = await store.persist(library);
    assert.equal(server.calls.length, 2);
    assert.equal(server.calls[0].url, '/api/files/upload');
    assert.equal(server.calls[0].options.headers['X-CSRF-Token'], 'test-csrf');
    assert.equal(server.calls[1].url, '/' + ref.path);
    assert.equal(ref.sha256, await sha256(JSON.stringify(library)));
    assert.equal(store.stats().cachedBytes, 0);
});

for (const mode of ['offline', 'corrupt-write', 'bad-path']) test(`storage failure ${mode} blocks successful conversion`, async () => {
    const { store, server, library } = setup(); server.setMode(mode);
    await assert.rejects(store.persist(library));
    assert.equal(store.stats().cachedLibraries, 0);
});

test('same corpus gets immutable stable content-addressed references', async () => {
    const { store, library } = setup();
    assert.deepEqual(await store.persist(library), await store.persist(library));
});

test('reload recovers from durable files without localStorage or IndexedDB', async () => {
    const { store, server, library } = setup(); const ref = await store.persist(library);
    const fresh = new RecipeStore({ request: server.request });
    assert.equal((await fresh.load(ref, 'slice_of_life')).get('NPaoasas'), 'Exact plain recipe.');
});

test('wrong genre, count, corrupted content and missing library are rejected', async () => {
    const { store, server, library } = setup(); const ref = await store.persist(library);
    await assert.rejects(store.load(ref, 'comedy'));
    await assert.rejects(store.load({ ...ref, count: 999 }, 'slice_of_life'));
    server.files.set('/' + ref.path, 'corrupt');
    await assert.rejects(store.load(ref, 'slice_of_life'));
    server.files.clear();
    await assert.rejects(store.load(ref, 'slice_of_life'));
});

test('parallel identical loads coalesce and cached reads do not issue requests', async () => {
    const { store, server, library } = setup(); const ref = await store.persist(library);
    server.calls.length = 0;
    const [a, b] = await Promise.all([store.load(ref, 'slice_of_life'), store.load(ref, 'slice_of_life')]);
    assert.equal(a, b); assert.equal(server.calls.length, 1);
    assert.equal(await store.load(ref, 'slice_of_life'), a); assert.equal(server.calls.length, 1);
});

test('cache eviction retains pinned selection and releases old partitions', async () => {
    const { store, library } = setup(); store.maxCachedBytes = 1;
    const one = await store.persist(library); await store.load(one, 'slice_of_life');
    const other = planOffload(fixture()).libraries.get('comedy');
    const two = await store.persist(other); await store.load(two, 'comedy');
    store.trim(new Set([two.sha256]));
    assert.equal(store.get(one), undefined); assert.ok(store.get(two));
    store.clear(); assert.equal(store.stats().cachedLibraries, 0);
});

for (const path of ['https://attacker.invalid/library.json', '//attacker.invalid/file', '/api/secrets/view', '/user/files/../settings.json', '/user/files/not-a-library.json', 'javascript:alert(1)']) {
    test(`rejects untrusted reference ${path}`, () => {
        assert.throws(() => validateReference({ path, bytes: 10, count: 1, sha256: 'a'.repeat(64) }));
    });
}

test('cache clear prevents an in-flight read from repopulating old state', async () => {
    const { store, server, library } = setup(); const ref = await store.persist(library);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const cache = new RecipeStore({ request: async (...args) => { await gate; return server.request(...args); } });
    const load = cache.load(ref, 'slice_of_life');
    cache.clear(); release(); await load;
    assert.equal(cache.stats().cachedLibraries, 0);
});

test('a cached partition cannot bypass altered reference metadata', async () => {
    const { store, library } = setup(); const ref = await store.persist(library);
    await store.load(ref, 'slice_of_life');
    await assert.rejects(store.load({ ...ref, count: ref.count + 1 }, 'slice_of_life'));
    await assert.rejects(store.load({ ...ref, bytes: ref.bytes + 1 }, 'slice_of_life'));
});
