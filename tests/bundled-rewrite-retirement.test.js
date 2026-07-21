import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('retired bundled rewrite cannot initialize from NemoPresetExt', async () => {
    const content = await readFile(new URL('../content.js', import.meta.url), 'utf8');
    assert.doesNotMatch(content, /features\/rewrite\/runtime\.js/);
    assert.doesNotMatch(content, /\binitNemoRewrite\s*\(/);
    await assert.rejects(access(new URL('../features/rewrite/runtime.js', import.meta.url)));
});

test.skip('legacy rewrite settings remain in the schema for standalone migration', async () => {
    const settings = await readFile(new URL('../core/feature-settings.js', import.meta.url), 'utf8');
    const ui = await readFile(new URL('../settings.html', import.meta.url), 'utf8');
    assert.match(settings, /enableRewrite:\s*false/);
    assert.match(ui, /Bundled Nemo Rewrite — Retired/);
    assert.match(ui, /Existing bundled settings are preserved for automatic migration/);
});
