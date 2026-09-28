import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { BANK_IDS, CONTROL_IDS, MAX_BYTES, SCHEMA, byteLength, hasVexLibrary,
    parseBank, snapshotLibrary, restoreSources } from '../features/vex-library/format.js';
import { VexLibraryStore, checkedPath, digest } from '../features/vex-library/store.js';

function fixture() {
    const prompts = BANK_IDS.map((identifier, i) => ({ identifier, name: `Bank ${i}`, role: 'system',
        content: `{{// @hidden }}\r\n{{setvar::NVCL1_item_${i}::literal ${i}}}\n{{#setvar::NVCL1_other_${i}}}\n🧩 two⠀spaces \n{{/setvar}}{{trim}}`,
        extensions: { retained: true } }));
    prompts.push(...CONTROL_IDS.map(identifier => ({ identifier, content: 'original control source' })));
    prompts.push({ identifier: 'ordinary', content: '{{incvar::turn}} Keep unchanged.' });
    const order = prompts.map(p => ({ identifier: p.identifier, enabled: true }));
    return { preset_name: 'Nemo test', prompts,
        prompt_order: [{ character_id: 100000, order }, { character_id: 100001, order: structuredClone(order).reverse() }],
        extensions: { regex_scripts: [{ findRegex: '/x/g', replaceString: 'y' }], nemoColdPrompts: { retained: true } } };
}
function transport({ uploadFailure = false, corruptReadback = false, status = null } = {}) {
    const files = new Map(), calls = [];
    const fetchFn = async (url, options = {}) => {
        calls.push({ url, options });
        if (url === '/api/files/upload') {
            if (uploadFailure) return new Response('write failed', { status: 507 });
            const { name, data } = JSON.parse(options.body);
            files.set(`/files/${name}`, corruptReadback ? 'corrupt' : Buffer.from(data, 'base64').toString('utf8'));
            return Response.json({ path: `files/${name}` });
        }
        if (status) return new Response('read failed', { status });
        return files.has(url) ? new Response(files.get(url)) : new Response('missing', { status: 404 });
    };
    return { files, calls, fetchFn, store: () => new VexLibraryStore({ fetchFn, headers: () => ({ 'X-CSRF-Token': 'test-only' }) }) };
}
function stubbed(preset) {
    const copy = structuredClone(preset), expectedContents = new Map();
    copy.prompts.forEach(p => {
        if (BANK_IDS.includes(p.identifier)) { p.content = `TEST PLACEHOLDER ${p.identifier}`; expectedContents.set(p.identifier, p.content); }
    });
    return { copy, expectedContents };
}

test('recognition is structural; name-only, Lite and Tavo layouts are not captured', () => {
    assert.equal(hasVexLibrary(fixture()), true);
    assert.equal(hasVexLibrary({ preset_name: 'Nemo Full', prompts: [] }), false);
    const lite = fixture(); lite.prompts = lite.prompts.filter(p => !BANK_IDS.includes(p.identifier));
    assert.equal(hasVexLibrary(lite), false);
    const tavo = fixture(); tavo.prompts[0].content = '<% setvar("x", 1) %>';
    assert.throws(() => snapshotLibrary(tavo), /unsupported executable/);
});
test('parser preserves inline/scoped text, Unicode, CRLF and UTF-16 offsets', () => {
    const prompt = fixture().prompts[0], entries = parseBank(prompt);
    assert.equal(entries.length, 2);
    for (const e of entries) assert.equal(prompt.content.slice(e.start, e.end), e.statement);
    assert.equal(entries[1].value, '\n🧩 two⠀spaces \n');
    assert.ok(byteLength(prompt.content) > prompt.content.length);
});
for (const [label, text] of [
    ['nested executable value', '{{setvar::NVCL1_x::{{getvar::secret}}}}'],
    ['unknown namespace', '{{setvar::UserName::bad}}'],
    ['duplicate variable', '{{setvar::NVCL1_x::a}}{{setvar::NVCL1_x::b}}'],
    ['unclosed inline', '{{setvar::NVCL1_x::a'],
    ['unclosed scoped', '{{#setvar::NVCL1_x}}a'],
    ['unclosed comment', '{{// never closed'],
    ['nested comment', '{{// {{incvar::turn}} }}{{setvar::NVCL1_x::a}}'],
    ['conditional control', '{{#if 1}}{{setvar::NVCL1_x::a}}{{/if}}'],
    ['wrong inline delimiter', '{{setvar::NVCL1_x}}a{{/setvar}}'],
    ['empty bank', '{{// metadata }}{{trim}}'],
    ['escaped syntax', '\\{{setvar::NVCL1_x::a}}'],
    ['raw prose', 'hello{{setvar::NVCL1_x::a}}'],
]) test(`parser rejects ${label} without executing anything`, () => {
    assert.throws(() => parseBank({ identifier: BANK_IDS[0], content: text }), /Nemo Vex storage/);
});
test('capture rejects missing banks, duplicate IDs and cross-bank variable collisions before writes', async () => {
    const cases = [fixture(), fixture(), fixture()];
    cases[0].prompts.shift();
    cases[1].prompts.push(cases[1].prompts[0]);
    cases[2].prompts[1].content = cases[2].prompts[0].content;
    for (const preset of cases) {
        const io = transport(), before = JSON.stringify(preset);
        await assert.rejects(io.store().capture(preset));
        assert.equal(io.calls.length, 0); assert.equal(JSON.stringify(preset), before);
    }
});
test('source and response limits use UTF-8 bytes, not just string length', async () => {
    const content = `{{setvar::NVCL1_x::${'🧩'.repeat(MAX_BYTES / 3)}}}`;
    assert.ok(content.length < MAX_BYTES);
    assert.throws(() => parseBank({ identifier: BANK_IDS[0], content }), /byte limit/);
    await assert.rejects(transport().store().write({ text: content }), /byte limit/);
});
test('capture/read-back and fresh-store restore are exact and do not mutate input', async () => {
    const source = fixture(), before = JSON.stringify(source), io = transport();
    const descriptor = await io.store().capture(source);
    assert.equal(descriptor.entryCount, 10); assert.equal(descriptor.bankCount, 5);
    assert.equal(io.files.size, 6); assert.equal(JSON.stringify(source), before);
    const { copy, expectedContents } = stubbed(source);
    const compactBefore = JSON.stringify(copy);
    assert.deepEqual(await io.store().restore(copy, descriptor, { expectedContents }), source);
    assert.equal(JSON.stringify(copy), compactBefore);
});
test('capture snapshots source before an asynchronous editor change', async () => {
    const source = fixture(), original = source.prompts[0].content, io = transport();
    const work = io.store().capture(source);
    source.prompts[0].content = 'a later user edit';
    const descriptor = await work;
    assert.equal((await io.store().originals(descriptor))[0].content, original);
    assert.equal(source.prompts[0].content, 'a later user edit');
});
test('reimport deduplicates already verified immutable files', async () => {
    const io = transport(), store = io.store(), preset = fixture();
    const first = await store.capture(preset);
    const uploads = io.calls.filter(c => c.url === '/api/files/upload').length;
    assert.deepEqual(await store.capture(preset), first);
    assert.equal(io.calls.filter(c => c.url === '/api/files/upload').length, uploads);
});
test('selected fetch loads only needed banks, returns exact setters in source order and caches no corpus', async () => {
    const source = fixture(), io = transport(), descriptor = await io.store().capture(source);
    const manifest = await io.store().manifest(descriptor);
    io.calls.length = 0;
    const fresh = io.store();
    const result = await fresh.selected(descriptor, ['NVCL1_other_3', 'NVCL1_item_3', 'NVCL1_item_3']);
    assert.equal(io.calls.length, 2);
    assert.equal(io.calls[1].url, manifest.banks[3].path);
    assert.deepEqual(result[0].statements, parseBank(source.prompts[3]).map(({ name, statement }) => ({ name, statement })));
    assert.deepEqual(Object.keys(fresh).sort(), ['fetchFn', 'headers', 'timeoutMs']);
});
test('unknown selected fields fail before reading any bank; empty set returns no statements', async () => {
    const io = transport(), descriptor = await io.store().capture(fixture()); io.calls.length = 0;
    await assert.rejects(io.store().selected(descriptor, ['NVCL1_missing']), /no fallback/);
    assert.equal(io.calls.length, 1);
    assert.deepEqual(await io.store().selected(descriptor, []), []);
});
test('every selected entry reconstructs the original spelling without trimming or macros', async () => {
    const source = fixture(), snapshot = snapshotLibrary(source), io = transport();
    const descriptor = await io.store().capture(source);
    const selected = await io.store().selected(descriptor, snapshot.indexes.flatMap(index => index.map(e => e.name)));
    for (const [i, item] of selected.entries()) assert.deepEqual(item.statements,
        parseBank(source.prompts[i]).map(({ name, statement }) => ({ name, statement })));
});
test('missing and corrupt source are errors in a fresh store; original remains recoverable', async () => {
    const source = fixture(), io = transport(), descriptor = await io.store().capture(source);
    const manifest = await io.store().manifest(descriptor), ref = manifest.banks[0];
    const saved = io.files.get(ref.path); io.files.delete(ref.path);
    await assert.rejects(io.store().originals(descriptor), /unavailable/);
    io.files.set(ref.path, saved + ' ');
    await assert.rejects(io.store().originals(descriptor), /checksum/);
    await io.store().capture(source);
    assert.equal((await io.store().originals(descriptor))[0].content, source.prompts[0].content);
});
for (const label of ['uploadFailure', 'corruptReadback']) test(`${label} never yields a descriptor or changes source`, async () => {
    const io = transport({ [label]: true }), source = fixture(), before = JSON.stringify(source);
    await assert.rejects(io.store().capture(source));
    assert.equal(JSON.stringify(source), before);
});
test('non-404 storage errors do not trigger uploads', async () => {
    const io = transport({ status: 403 });
    await assert.rejects(io.store().capture(fixture()), /cannot check/);
    assert.equal(io.calls.some(c => c.url === '/api/files/upload'), false);
});
for (const path of ['https://evil.example/x', '//evil/x', '/files/../x', '/api/settings/get',
    '/files/nemo-vex-source-x.json', '/files/nemo-vex-source-' + 'a'.repeat(64) + '.json?x=1']) {
    test(`unsafe reference rejected before fetch: ${path}`, async () => {
        const io = transport();
        await assert.rejects(io.store().read({ path, sha256: 'a'.repeat(64) }), /unsafe/);
        assert.equal(io.calls.length, 0);
    });
}
test('relative server path canonicalizes; credentials, redirect protection and CSRF are used', async () => {
    const io = transport(); await io.store().capture(fixture());
    const call = io.calls.find(c => c.url === '/api/files/upload');
    const { name } = JSON.parse(call.options.body), sha256 = name.slice('nemo-vex-source-'.length, -5);
    assert.equal(checkedPath({ path: `files/${name}`, sha256 }), `/files/${name}`);
    assert.equal(call.options.headers['X-CSRF-Token'], 'test-only');
    for (const c of io.calls) {
        assert.equal(c.options.credentials, 'same-origin'); assert.equal(c.options.redirect, 'error');
        assert.equal(c.options.cache, 'no-store'); assert.ok(c.options.signal instanceof AbortSignal);
    }
});
test('network timeout is bounded, even for a noncooperative transport', async () => {
    const store = new VexLibraryStore({ fetchFn: () => new Promise(() => {}), timeoutMs: 10 });
    await assert.rejects(store.capture(fixture()), /timed out/);
});
test('oversized streamed response is cancelled at the byte limit', async () => {
    let cancelled = false;
    const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } });
    const store = new VexLibraryStore({ fetchFn: async () => new Response(stream) });
    await assert.rejects(store.read({ path: '/files/nemo-vex-source-' + 'a'.repeat(64) + '.json', sha256: 'a'.repeat(64) }), /byte limit/);
    assert.equal(cancelled, true);
});
test('declared oversize, malformed JSON and invalid UTF-8 responses fail explicitly', async () => {
    const ref = { path: '/files/nemo-vex-source-' + 'a'.repeat(64) + '.json', sha256: 'a'.repeat(64) };
    await assert.rejects(new VexLibraryStore({ fetchFn: async () => new Response('', { headers: { 'content-length': MAX_BYTES + 1 } }) }).read(ref), /byte limit/);
    await assert.rejects(new VexLibraryStore({ fetchFn: async () => new Response(new Uint8Array([255, 255])) }).read(ref));
    const text = 'not json', sha256 = await digest(text);
    await assert.rejects(new VexLibraryStore({ fetchFn: async () => new Response(text) }).read({ path: `/files/nemo-vex-source-${sha256}.json`, sha256 }), /JSON/);
});
for (const mutation of ['schema', 'count', 'duplicate', 'offset', 'identity']) test(`rehashed malformed manifest is rejected: ${mutation}`, async () => {
    const io = transport(), store = io.store(), descriptor = await store.capture(fixture());
    const manifest = await store.manifest(descriptor);
    if (mutation === 'schema') manifest.schema = 'future-v2';
    if (mutation === 'count') manifest.entryCount++;
    if (mutation === 'duplicate') manifest.banks[1].entries[0].name = manifest.banks[0].entries[0].name;
    if (mutation === 'offset') manifest.banks[0].entries[0].end = MAX_BYTES + 1;
    if (mutation === 'identity') manifest.banks[0].identifier = BANK_IDS[1];
    await assert.rejects(store.manifest({ ...descriptor, manifest: await store.write(manifest) }));
});
test('valid-looking changed offsets are verified against actual source before returning setters', async () => {
    const io = transport(), store = io.store(), descriptor = await store.capture(fixture());
    const manifest = await store.manifest(descriptor); manifest.banks[0].entries[0].start++;
    const altered = { ...descriptor, manifest: await store.write(manifest) };
    await assert.rejects(store.selected(altered, ['NVCL1_item_0']), /index does not match/);
});
test('restore preserves unrelated edits and order while refusing unexpected library edits', async () => {
    const source = fixture(), originals = snapshotLibrary(source).banks;
    const { copy, expectedContents } = stubbed(source);
    copy.prompts.reverse(); copy.prompts.find(p => p.identifier === 'ordinary').content = 'new edit';
    copy.prompts.find(p => p.identifier === BANK_IDS[0]).name = 'renamed bank';
    const restored = restoreSources(copy, originals, { expectedContents });
    assert.deepEqual(restored.prompts.map(p => p.identifier), copy.prompts.map(p => p.identifier));
    assert.equal(restored.prompts.find(p => p.identifier === 'ordinary').content, 'new edit');
    assert.equal(restored.prompts.find(p => p.identifier === BANK_IDS[0]).name, 'renamed bank');
    copy.prompts.find(p => p.identifier === BANK_IDS[0]).content = 'unexpected literal edit';
    assert.throws(() => restoreSources(copy, originals, { expectedContents }), /unacknowledged edit/);
});
test('same prompt IDs from separate captures never cross-contaminate', async () => {
    const io = transport(), one = fixture(), two = fixture();
    two.prompts[0].content = two.prompts[0].content.replace('literal 0', 'different literal');
    const a = await io.store().capture(one), b = await io.store().capture(two);
    assert.notEqual(a.manifest.sha256, b.manifest.sha256);
    assert.equal((await io.store().originals(a))[0].content, one.prompts[0].content);
    assert.equal((await io.store().originals(b))[0].content, two.prompts[0].content);
});
test('Stage 4A is dormant: no entrypoint/runtime imports or manifest changes are needed', () => {
    const format = readFileSync(new URL('../features/vex-library/format.js', import.meta.url), 'utf8');
    const store = readFileSync(new URL('../features/vex-library/store.js', import.meta.url), 'utf8');
    assert.doesNotMatch(format + store, /eventSource|preparePrompt|\.setvar\(|\beval\(|new Function/);
    try {
        const entry = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
        assert.doesNotMatch(entry, /vex-library|vex-runtime/);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
});
