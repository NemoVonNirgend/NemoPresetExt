import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('retired bundled NemoLore cannot initialize from NemoPresetExt', async () => {
    const content = await readFile(new URL('../content.js', import.meta.url), 'utf8');
    assert.doesNotMatch(content, /features\/nemolore|initNemoLore/);
    await assert.rejects(access(new URL('../features/nemolore/runtime.js', import.meta.url)));
});

test('migration notes preserve user-data safety guidance', async () => {
    const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
    assert.match(readme, /does not delete existing browser-stored data/i);
});
