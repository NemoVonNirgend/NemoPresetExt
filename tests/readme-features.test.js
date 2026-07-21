import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const MANIFEST = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('README version follows the extension manifest', () => {
    assert.ok(README.includes(`**Version:** ${MANIFEST.version}`));
});

test('README documents every active core feature default', () => {
    for (const row of [
        '`enableDirectives`: `true`',
        '`enableDirectiveAutocomplete`: `true`',
        '`enableNemoEngineInstaller`: `true`',
    ]) assert.ok(README.includes(row), `Missing core default ${row}`);
});

test('README documents the extracted extension migration', () => {
    for (const extension of ['NemoPromptTools', 'NemoUIOverhaul', 'NemoEmojiPicker', 'NemoImageGeneration']) {
        assert.ok(README.includes(`NemoVonNirgend/${extension}`));
    }
    assert.ok(README.includes('Legacy keys already stored in `extension_settings.NemoPresetExt` remain untouched'));
});
