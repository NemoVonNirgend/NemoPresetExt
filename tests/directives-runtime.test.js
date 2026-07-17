import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const content = read('../content.js');
const promptDirectives = read('../features/directives/prompt-directives.js');
const directiveHooks = read('../features/directives/prompt-directive-hooks.js');
const directiveUi = read('../features/directives/directive-ui.js');
const directiveAutocomplete = read('../features/directives/directive-autocomplete.js');
const directiveAutocompleteUi = read('../features/directives/directive-autocomplete-ui.js');

function loadDirectiveParser() {
    const executableSource = promptDirectives
        .replace(/^import\s+.*?;\r?$/gm, '')
        .replace(/^export\s+/gm, '');
    const script = new Script(`(() => {
        ${executableSource}
        return { evaluateMessageTriggers, parsePromptDirectives, validatePromptActivation };
    })()`);

    return script.runInNewContext({
        logger: { debug() {}, error() {}, warn() {} },
        promptManager: null,
        getContext: () => ({}),
    });
}

test('new-install directive runtime is initialized behind the directive gate', () => {
    assert.match(
        content,
        /if \(featureEnabled\('enableDirectives'\)\) \{[\s\S]*?initDirectiveUI\(\);[\s\S]*?initPromptDirectiveHooks\(\);[\s\S]*?initMessageTriggerHooks\(\);/,
    );
    assert.match(
        content,
        /featureEnabled\('enableDirectiveAutocomplete'\)[\s\S]*?initDirectiveAutocomplete\(\);/,
    );
    assert.doesNotMatch(content, /Directive system[^\n]*deprecated[^\n]*disabled/i);
});

test('directive listeners, observers, and timers have explicit teardown paths', () => {
    assert.match(directiveHooks, /export function cleanupPromptDirectiveHooks\(\)/);
    assert.match(directiveHooks, /export function cleanupMessageTriggerHooks\(\)/);
    assert.match(directiveHooks, /document\.removeEventListener\('click', handlePromptToggleClick, true\)/);
    assert.match(directiveHooks, /eventSource\.removeListener/);
    assert.match(directiveUi, /export function cleanupDirectiveUI\(\)/);
    assert.match(directiveUi, /\.disconnect\(\)/);
    assert.match(directiveAutocompleteUi, /export function cleanupDirectiveAutocomplete\(\)/);
    assert.match(directiveAutocompleteUi, /\.disconnect\(\)/);
    assert.match(directiveAutocompleteUi, /removeEventListener/);
});

test('directive parser supports multiple directives in one comment block', () => {
    const { parsePromptDirectives } = loadDirectiveParser();
    const directives = parsePromptDirectives(`{{// @tooltip Multi-line metadata
@tags alpha, beta
@default-enabled
@color #123456
}}`);

    assert.equal(directives.tooltip, 'Multi-line metadata');
    assert.deepEqual(Array.from(directives.tags), ['alpha', 'beta']);
    assert.equal(directives.defaultEnabled, true);
    assert.equal(directives.color, '#123456');
});

test('directive parser rejects flag prefixes, invalid numbers, and empty list entries', () => {
    const { parsePromptDirectives } = loadDirectiveParser();
    const directives = parsePromptDirectives(`{{//
@hiddenly
@advanced-mode
@priority nope
@token-cost -10
@requires alpha, , alpha, beta
}}`);

    assert.equal(directives.hidden, false);
    assert.equal(directives.advanced, false);
    assert.equal(directives.priority, null);
    assert.equal(directives.tokenCost, null);
    assert.deepEqual(Array.from(directives.requires), ['alpha', 'beta']);
});

test('general warning directives participate in activation validation', () => {
    const { validatePromptActivation } = loadDirectiveParser();
    const issues = validatePromptActivation('warning-prompt', [{
        identifier: 'warning-prompt',
        name: 'Warning Prompt',
        content: '{{// @warning This prompt changes response style. }}',
        enabled: false,
    }]);

    assert.equal(issues.length, 1);
    assert.equal(issues[0].type, 'general-warning');
    assert.equal(issues[0].severity, 'warning');
});
test('overlapping message triggers produce one state change per prompt', () => {
    const { evaluateMessageTriggers } = loadDirectiveParser();
    const result = evaluateMessageTriggers(10, [{
        identifier: 'timed-prompt',
        name: 'Timed Prompt',
        content: `{{// @enable-at-message 5 }}
{{// @enable-after-message 5 }}
{{// @message-range 1-20 }}`,
        enabled: false,
    }]);

    assert.deepEqual(Array.from(result.toEnable), ['timed-prompt']);
    assert.equal(result.triggered.length, 1);
    assert.equal(result.triggered[0].action, 'enable');
});


test('directive parser cache is collision-safe', () => {
    assert.doesNotMatch(promptDirectives, /function hashContent\(/);
    assert.match(promptDirectives, /directiveCache\.get\(content\)/);
    assert.match(promptDirectives, /directiveCache\.set\(content,/);
});

test('directive autocomplete includes message-trigger directives', () => {
    for (const directive of [
        '@enable-at-message',
        '@disable-at-message',
        '@message-range',
        '@enable-after-message',
        '@disable-after-message',
    ]) {
        assert.match(directiveAutocomplete, new RegExp(`directive: ['"]${directive}['"]`));
    }
});
test('directive autocomplete supports subsequent lines in a comment block', () => {
    assert.match(directiveAutocomplete, /\(\?:\\\{\\\{\\\/\\\/\\s\*\)\?\(@\[\\w-\]\+\)/);
});

test('tray metadata and validation honor the directive master switch', () => {
    const categoryTray = read('../features/prompts/category-tray.js');
    assert.match(categoryTray, /isFeatureEnabled\(extension_settings\[NEMO_EXTENSION_NAME\], 'enableDirectives'\)/);
});

test('directive autocomplete setting exposes its dependency on the master switch', () => {
    const settingsUi = read('../ui/settings-ui.js');
    assert.match(settingsUi, /directiveAutocompleteToggle\.disabled\s*=\s*!directivesEnabled/);
    assert.match(settingsUi, /aria-disabled/);
});

test('legacy duplicate directive UI modules remain disconnected', () => {
    assert.doesNotMatch(content, /directive-features(?:-fixes)?\.js/);
    assert.doesNotMatch(content, /initDirectiveFeatures/);
});


test('directive conflict actions use current PromptManager state APIs', () => {
    assert.doesNotMatch(directiveUi, /promptManager\.handleToggle\(/);
    assert.match(directiveUi, /promptManager\.getPromptOrderEntry\(/);
    assert.match(directiveUi, /promptOrderEntry\.enabled\s*=\s*enabled/);
});
