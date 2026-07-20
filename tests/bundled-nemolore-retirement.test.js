import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('retired bundled NemoLore cannot initialize from the NemoPresetExt entrypoint', async () => {
    const content = await readFile(new URL('../content.js', import.meta.url), 'utf8');
    assert.doesNotMatch(content, /from ['"]\.\/features\/nemolore\/runtime\.js['"]/);
    assert.doesNotMatch(content, /\binitNemoLore\s*\(/);
});

test('retired NemoLore data remains present for a future explicit migration', async () => {
    const storage = await readFile(new URL('../features/nemolore/storage.js', import.meta.url), 'utf8');
    const audit = await readFile(new URL('../docs/BUNDLED_NEMOLORE_AUDIT.md', import.meta.url), 'utf8');
    assert.match(storage, /getArchiveKey/);
    assert.match(storage, /getPreferencesKey/);
    assert.match(audit, /persisted localforage records are not deleted/i);
});
