import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const runtime = readFileSync(new URL('../features/prompt-tools/runtime.js', import.meta.url), 'utf8');
const detector = readFileSync(new URL('../features/prompts/compat/capability-detector.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../features/prompts/compat/control-bridge.js', import.meta.url), 'utf8');
const coordinator = readFileSync(new URL('../features/prompts/compat/prompt-compatibility.js', import.meta.url), 'utf8');
const rootStyles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const compatibilityStyles = readFileSync(new URL('../styles/prompt-compat.css', import.meta.url), 'utf8');

test('Rivelle compatibility remains optional and dependency-free', () => {
    assert.deepEqual(manifest.requires, []);
    assert.deepEqual(manifest.optional, []);

    const compatibilitySource = `${detector}\n${bridge}\n${coordinator}`;
    assert.doesNotMatch(compatibilitySource, /from\s+['"][^'"]*(?:Rivelle|ChatCompletionTabs|MoonlitEchoes)/i);
    assert.doesNotMatch(compatibilitySource, /RivelleDays\/SillyTavern/i);
});

test('prompt runtime reconciles and cleans up optional compatibility ownership', () => {
    for (const symbol of [
        'initializePromptCompatibility',
        'reconcilePromptCompatibility',
        'cleanupPromptCompatibility',
        'getPromptCompatibilityState',
    ]) {
        assert.match(runtime, new RegExp(symbol));
    }
    assert.match(runtime, /reconcilePromptCompatibility\(\{ manager: NemoPresetManager \}\)/);
    assert.match(runtime, /cleanupPromptCompatibility\(\);/);
});

test('compatibility styling is scoped by capability markers', () => {
    assert.match(rootStyles, /@import url\('\.\/styles\/prompt-compat\.css'\);/);
    assert.match(compatibilityStyles, /data-nemo-prompt-host/);
    assert.match(compatibilityStyles, /data-nemo-reasoning-owner='native'/);
    assert.match(compatibilityStyles, /data-nemo-native-reasoning-group='true'/);
    assert.match(compatibilityStyles, /data-nemo-moonlit='true'/);
});
