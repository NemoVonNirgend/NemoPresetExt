import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../features/hub/catalog.js', import.meta.url), 'utf8');

test('core entry point owns only directives, dividers, settings, hub, and NemoEngine', () => {
    for (const required of [
        'initDirectiveUI()',
        'initPromptDirectiveHooks()',
        'initMessageTriggerHooks()',
        'initNemoEngineInstaller()',
        'validateDividerPatterns()',
        'NemoSettingsUI.initialize()',
    ]) {
        assert.match(content, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

test('core entry point does not initialize extracted optional runtimes', () => {
    for (const forbidden of [
        'NemoCharacterManager',
        'PresetNavigator',
        'applyNemoNetReasoning',
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

test('Nemo Hub publishes every extracted extension repository', () => {
    for (const id of ['NemoPromptTools', 'NemoUIOverhaul', 'NemoEmojiPicker', 'NemoImageGeneration']) {
        assert.match(catalog, new RegExp(`id: '${id}'`));
        assert.match(catalog, new RegExp(`https://github\\.com/NemoVonNirgend/${id}`));
    }
});
