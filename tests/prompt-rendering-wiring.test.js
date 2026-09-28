import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('render adapter attaches after existing source runtimes and tears down before them', () => {
    const content = read('../content.js');
    assert(content.indexOf('initializeColdPrompts();') < content.indexOf('initializePromptRendering();'));
    assert(content.indexOf('cleanupPromptRendering();') < content.indexOf('cleanupColdPrompts();'));
    assert(content.indexOf('cleanupPromptRendering();') < content.indexOf('cleanupPromptPerformance();'));
});
test('render adapters do not replace generation, storage, tokenizer or prompt-order APIs', () => {
    const code = read('../features/prompt-rendering/incremental.js') + read('../features/prompt-rendering/runtime.js');
    assert.doesNotMatch(code, /wrap\(pm,\s*['"](?:preparePrompt|getPromptCollection|tryGenerate|saveServiceSettings|import|export)['"]/);
    assert.doesNotMatch(code, /getTokenCount|substituteParams|structuredClone|\.content\b|nemoRecipeRuntimePreflight\s*=/);
    assert.match(code, /virtualized: false/);
});
test('runtime provides a reversible opt-out and bounded startup lifecycle', () => {
    const runtime = read('../features/prompt-rendering/runtime.js');
    assert.match(runtime, /enableIncrementalPromptRendering/);
    assert.match(runtime, /current\.attempts\+\+ < 100/);
    assert.match(runtime, /eventSource\.removeListener/);
    assert.match(runtime, /NemoPresetManager\.createSearchAndStatusUI === current\.uiWrapper/);
    assert.match(runtime, /current\.controller\?\.dispose\(\)/);
});
