/** Filesystem-backed Stage 4A verifier. Never uploads or prints user prompt prose. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BANK_IDS, hasVexLibrary, snapshotLibrary, parseBank } from '../features/vex-library/format.js';
import { VexLibraryStore, digest } from '../features/vex-library/store.js';

const filename = process.argv[2];
if (!filename) throw new Error('Usage: node scripts/validate-vex-storage.mjs /path/to/portable-preset.json');
const source = await readFile(filename, 'utf8'), preset = JSON.parse(source);
if (!hasVexLibrary(preset)) {
    console.log(JSON.stringify({ stage: '4A/5', supportedLibrary: false, changed: false }, null, 2));
} else {
    const directory = await mkdtemp(join(tmpdir(), 'nemo-vex-storage-test-'));
    try {
        let reads = 0, writes = 0;
        const fetchFn = async (url, options = {}) => {
            if (url === '/api/files/upload') {
                const { name, data } = JSON.parse(options.body);
                assert.match(name, /^nemo-vex-source-[a-f0-9]{64}\.json$/);
                await writeFile(join(directory, name), Buffer.from(data, 'base64'));
                writes++;
                return Response.json({ path: `user/files/${name}` });
            }
            assert.match(url, /^\/user\/files\/nemo-vex-source-[a-f0-9]{64}\.json$/);
            reads++;
            try { return new Response(await readFile(join(directory, url.slice('/user/files/'.length)))); }
            catch (error) { if (error.code === 'ENOENT') return new Response('missing', { status: 404 }); throw error; }
        };
        const before = JSON.stringify(preset), snapshot = snapshotLibrary(preset);
        const descriptor = await new VexLibraryStore({ fetchFn }).capture(preset);
        assert.equal(JSON.stringify(preset), before);
        const originals = await new VexLibraryStore({ fetchFn }).originals(descriptor);
        assert.deepEqual(originals, snapshot.banks);
        let checked = 0;
        for (const bank of originals) {
            // Independent flat/scoped literal scan, separate from the source parser.
            const tokens = [...bank.content.matchAll(/\{\{setvar::([A-Za-z][A-Za-z0-9_]*)::([^{}]*?)\}\}|\{\{#setvar::([A-Za-z][A-Za-z0-9_]*)\}\}([^{}]*?)\{\{\/setvar\}\}/g)];
            const entries = parseBank(bank);
            assert.deepEqual(entries.map(e => e.statement), tokens.map(m => m[0]));
            const selected = await new VexLibraryStore({ fetchFn }).selected(descriptor, entries.map(e => e.name));
            assert.equal(selected.length, 1);
            assert.equal(selected[0].identifier, bank.identifier);
            assert.deepEqual(selected[0].statements, tokens.map(m => ({ name: m[1] ?? m[3], statement: m[0] })));
            checked += tokens.length;
        }
        const temporary = structuredClone(preset), expectedContents = new Map();
        temporary.prompts.forEach(prompt => {
            if (BANK_IDS.includes(prompt.identifier)) {
                prompt.content = `TEST ONLY: ${prompt.identifier}`;
                expectedContents.set(prompt.identifier, prompt.content);
            }
        });
        const tempBefore = JSON.stringify(temporary);
        const restored = await new VexLibraryStore({ fetchFn }).restore(temporary, descriptor, { expectedContents });
        assert.equal(JSON.stringify(restored), before);
        assert.equal(JSON.stringify(temporary), tempBefore);
        assert.deepEqual(restored.prompt_order, preset.prompt_order);
        assert.deepEqual(restored.extensions, preset.extensions);
        assert.equal(JSON.stringify(preset), before);
        const storedFiles = await readdir(directory);
        const storedBytes = (await Promise.all(storedFiles.map(async path => (await stat(join(directory, path))).size))).reduce((a, b) => a + b, 0);
        console.log(JSON.stringify({ stage: '4A/5', supportedLibrary: true, inputSha256: await digest(source),
            banks: snapshot.banks.length, entries: snapshot.entryCount, checkedStatements: checked,
            sourceCharacters: snapshot.characters, sourceBytes: snapshot.bytes, storedFiles: storedFiles.length,
            storedBytes, reads, writes, exactRoundTrip: true, sourceUnchanged: true, exportCopyUnchanged: true,
            profilesUnchanged: preset.prompt_order.length, freshStoreRestore: true, liveRuntimeEnabled: false,
            nativeSTTested: false, next: '4B/5: live selection, import/export hooks, and integration tests' }, null, 2));
    } finally { await rm(directory, { recursive: true, force: true }); }
}
