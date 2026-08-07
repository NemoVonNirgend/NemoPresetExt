import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../features/hub/catalog.js', import.meta.url), 'utf8');

test('core entry point owns prompt tools, directives, dividers, settings, hub, and NemoEngine', () => {
    for (const required of [
        'initializePromptTools()',
        'initDirectiveUI()',
        'initPromptDirectiveHooks()',
        'initMessageTriggerHooks()',
        'initNemoEngineInstaller()',
        'validateDividerPatterns()',
        'NemoSettingsUI.initialize()',
    ]) {
        assert.match(content, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(content, /promptTools: true/);
});

test('core entry point still excludes non-prompt optional runtimes', () => {
    for (const forbidden of [
        'PollinationsInterceptor',
        'EmojiPicker',
        'NemoWorldInfoUI',
        'ExtensionsTabOverhaul',
        'animatedBackgrounds',
        'ModelSelector',
        'TextCompletionSelector',
    ]) {
        assert.doesNotMatch(content, new RegExp(forbidden));
    }
});

test('Nemo Hub no longer offers PromptTools as a separate install', () => {
    assert.doesNotMatch(catalog, /id: 'NemoPromptTools'/);
    for (const id of ['NemoUIOverhaul', 'NemoEmojiPicker', 'NemoImageGeneration']) {
        assert.match(catalog, new RegExp(`id: '${id}'`));
    }
});
