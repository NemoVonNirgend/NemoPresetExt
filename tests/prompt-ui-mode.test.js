import assert from 'node:assert/strict';
import test from 'node:test';
import {
    PROMPT_UI_MODE_DESCRIPTORS,
    resolvePromptUiMode,
    usesFullPromptFeatures,
} from '../features/prompts/ui-mode.js';

test('the three public modes resolve to two skins and two feature profiles', () => {
    assert.deepEqual(resolvePromptUiMode('classic'), PROMPT_UI_MODE_DESCRIPTORS.classic);
    assert.deepEqual(resolvePromptUiMode('modern'), PROMPT_UI_MODE_DESCRIPTORS.modern);
    assert.deepEqual(resolvePromptUiMode('classicPlus'), PROMPT_UI_MODE_DESCRIPTORS.classicPlus);
    assert.equal(resolvePromptUiMode('classic').skin, 'classic');
    assert.equal(resolvePromptUiMode('classicPlus').skin, 'classic');
    assert.equal(resolvePromptUiMode('modern').skin, 'modern');
    assert.equal(usesFullPromptFeatures('classic'), false);
    assert.equal(usesFullPromptFeatures('classicPlus'), true);
    assert.equal(usesFullPromptFeatures('modern'), true);
});

test('unknown modes fall back to Classic+', () => {
    assert.equal(resolvePromptUiMode('future-mode').mode, 'classicPlus');
});
