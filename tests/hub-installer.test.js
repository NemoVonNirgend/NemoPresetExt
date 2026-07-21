import test from 'node:test';
import assert from 'node:assert/strict';

import { includesExtension } from '../features/hub/installed-state.js';

test('Hub installed-state normalization recognizes SillyTavern third-party paths', () => {
    const names = ['third-party/NemoLore', 'Ember'];
    const installed = (id) => includesExtension(names, id);
    assert.equal(installed('NemoLore'), true);
    assert.equal(installed('ember'), true);
    assert.equal(installed('NemoRewrite'), false);
});

test('Hub catalog contains unique stable ids and HTTPS repositories', async () => {
    const { NEMO_EXTENSION_CATALOG } = await import('../features/hub/catalog.js');
    assert.equal(new Set(NEMO_EXTENSION_CATALOG.map(entry => entry.id)).size, NEMO_EXTENSION_CATALOG.length);
    assert.ok(NEMO_EXTENSION_CATALOG.every(entry => entry.repository.startsWith('https://github.com/NemoVonNirgend/')));
    const rewrite = NEMO_EXTENSION_CATALOG.find(entry => entry.id === 'NemoRewrite');
    assert.equal(rewrite.repository, 'https://github.com/NemoVonNirgend/NemoRewrite');
});

test('Hub installer validates bounded timeouts before calling SillyTavern', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../features/hub/installer.js', import.meta.url), 'utf8');
    assert.match(source, /timeoutMs = 90_000/);
    assert.match(source, /global = true/);
    assert.match(source, /SillyTavern did not finish installing/);
});
