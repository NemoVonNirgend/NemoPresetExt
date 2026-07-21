import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');

test('core initialization and teardown share one retry-safe lifecycle', () => {
    assert.match(content, /export function cleanupExtension\(\)/);
    assert.match(content, /export async function initializeExtension\(\)/);
    assert.match(content, /window\.NemoPresetExtCleanup = cleanupExtension/);
    assert.match(content, /catch \(error\) \{[\s\S]*?cleanupExtension\(\)/);
});

test('core teardown owns every active runtime', () => {
    for (const cleanup of [
        'cleanupDirectiveAutocomplete()',
        'cleanupMessageTriggerHooks()',
        'cleanupPromptDirectiveHooks()',
        'cleanupDirectiveUI()',
        'cleanupNemoEngineInstaller()',
        'clearDirectiveCache()',
        'NemoSettingsUI.destroy()',
    ]) {
        assert.match(content, new RegExp(cleanup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});
