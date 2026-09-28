import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { readOrderedState, snapshotIds, buildSectionIndex } from '../features/prompt-rendering/state-model.js';

const source = readFileSync(new URL('../features/prompts/prompt-manager.js', import.meta.url), 'utf8');
function method(name, nextMarker, context) {
    const label = `${name}: `, start = source.indexOf(label), end = source.indexOf(nextMarker, start);
    assert(start >= 0 && end > start, 'Legacy method boundary changed; review the contract test.');
    const expression = source.slice(start + label.length, end).trim().replace(/,$/, '');
    return new Script(`(${expression})`).runInNewContext(context);
}
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const divider = method('getDividerInfo', '\n\n    // Favorites Logic', {
    DIVIDER_PREFIX_REGEX: /^(=+|⭐─+|━+|~+)/, escapeRegex,
    SELECTORS: { promptNameLink: 'native-name' },
});
const classify = text => divider({ dataset: {}, querySelector: () => ({ textContent: text }) }, true);

test('section model uses the actual legacy divider classifier, including custom patterns', () => {
    const names = ['Top', '=== One ===', 'A', '< Sub >', 'B', '⭐── Star ⭐──', 'C',
        '━━ Heavy ━━', 'D', '~~~ Custom ~~~', 'E', '< Sub >', 'F', '=== One ==='];
    const rows = names.map((name, i) => ({ identifier: `p${i}`, name, enabled: true, toggleAllowed: true }));
    const index = buildSectionIndex(rows, classify);
    assert.deepEqual(index.roots, ['p0', 'p1', 'p5', 'p7', 'p9', 'p13']);
    assert.equal(index.getSection('p9').name, 'Custom');
    assert.deepEqual(index.getSection('p9').memberIds, ['p10', 'p12']);
    assert.equal(index.getSection('p11').parentId, 'p9');
    assert.equal(index.getSection('p13').name, 'One');
    assert.deepEqual(index.getSection('p13').memberIds, []);
});
test('state snapshot matches actual legacy capture on a complete native-shaped row list', async () => {
    const prompts = ['Header', 'A', 'Locked', 'B'].map((name, i) => ({ identifier: `p${i}`, name,
        get content() { throw new Error('Do not read source.'); } }));
    const order = prompts.map((p, i) => ({ identifier: p.identifier, enabled: i !== 3 }));
    const pm = { serviceSettings: { prompts }, activeCharacter: { id: 100001 },
        getPromptOrderForCharacter: () => order, isPromptToggleAllowed: p => p.identifier !== 'p2' };
    let saved;
    const original = method('takeSnapshot', '\n\n    applySnapshot:', {
        logger: { info() {}, debug() {}, error() {} }, console: { log() {}, error() {} }, LOG_PREFIX: 'test',
        SELECTORS: { promptsContainer: '#list', toggleButton: '.toggle', enabledToggleClass: 'on', promptItemRow: 'li' },
        getContext: () => ({ mainApi: 'openai' }), storage: { saveSnapshot(_api, ids) { saved = ids; } },
        document: { querySelector: () => ({}), getElementById: () => null,
            querySelectorAll: () => order.filter(e => e.enabled && pm.isPromptToggleAllowed(prompts.find(p => p.identifier === e.identifier)))
                .map(e => ({ closest: () => ({ dataset: { pmIdentifier: e.identifier } }) })) },
    });
    await original.call({ showStatusMessage() {} });
    assert.deepEqual(snapshotIds(readOrderedState(pm)), Array.from(saved));
});
test('this half retains legacy mutating/DOM paths and does not install virtualization', () => {
    assert.match(source, /applySnapshot: async function/);
    assert.match(source, /handleContainerClick: function/);
    const stateSource = readFileSync(new URL('../features/prompt-rendering/state-snapshots.js', import.meta.url), 'utf8');
    assert.doesNotMatch(stateSource, /wrap\('(?:applySnapshot|restorePromptStates|handleContainerClick|organizePrompts)'/);
    assert.doesNotMatch(stateSource, /new MutationObserver|\.removeChild\(|\.replaceChildren\(/);
});
