import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const MANIFEST = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('README version follows the extension manifest', () => {
    assert.ok(README.includes(`**Version:** ${MANIFEST.version}`));
});

test('README documents the merged prompt workstation defaults', () => {
    for (const row of [
        '`enablePromptManager`: `true`',
        '`enablePresetNavigator`: `true`',
        '`enableCharacterNavigator`: `true`',
        '`enableReasoningCapture`: `true`',
        '`promptUiMode`: `classic`',
        '`enableDirectives`: `true`',
        '`enableDirectiveAutocomplete`: `true`',
        '`enableNemoEngineInstaller`: `true`',
    ]) assert.ok(README.includes(row), `Missing core default ${row}`);
});

test('README documents PromptTools reintegration and retained optional boundaries', () => {
    assert.ok(README.includes('Version 6 merges NemoPromptTools back into NemoPresetExt'));
    assert.ok(README.includes('extension_settings.NemoPromptTools'));
    for (const extension of ['NemoUIOverhaul', 'NemoEmojiPicker', 'NemoImageGeneration']) {
        assert.ok(README.includes(`NemoVonNirgend/${extension}`));
    }
    assert.ok(!README.includes('| [Nemo Prompt Tools]('));
});
