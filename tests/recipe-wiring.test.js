import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const runtime = readFileSync(new URL('../features/preset-runtime/runtime.js', import.meta.url), 'utf8');

test('runtime interception starts before asynchronous UI initialization', () => {
    assert.ok(content.indexOf('cleanupCallbacks.push(initializeRecipeRuntime())') < content.indexOf('await NemoSettingsUI.initialize()'));
    assert.match(content, /import \{ initializeRecipeRuntime \} from '\.\/features\/preset-runtime\/runtime.js'/);
});

test('manifest registers the supported real-generation abort preflight', () => {
    assert.equal(manifest.generate_interceptor, 'NemoPresetExtRecipePreflight');
    assert.match(runtime, /globalThis\.NemoPresetExtRecipePreflight = recipeGenerationPreflight/);
    assert.match(runtime, /abort\(true\)/);
});

test('native import captures INPUT, not only CHANGE or a noncancellable event', () => {
    assert.match(runtime, /document\.addEventListener\('input', onImportInput, true\)/);
    assert.match(runtime, /stopImmediatePropagation\(\)/);
    assert.match(runtime, /new File\(\[result.text\]/);
});
