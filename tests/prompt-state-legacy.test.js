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

for (const preset of ['sola-v3-flame', 'sola-kindling-v1']) {
    const fixture = JSON.parse(readFileSync(new URL(`./fixtures/${preset}.json`, import.meta.url), 'utf8'));
    for (const profile of fixture.profiles) {
        test(`${preset}: every prompt belongs to its authored section in order ${profile.character_id}`, () => {
            const rows = profile.rows.map(row => ({ ...row, toggleAllowed: true }));
            const before = JSON.stringify(rows);
            const index = buildSectionIndex(rows, classify);
            assert.deepEqual(new Set(index.sectionIds), new Set(fixture.headerIds));
            for (const row of rows) {
                assert.equal(index.parentOf(row.identifier), row.expectedParent, row.name);
            }
            if (preset === 'sola-v3-flame') {
                assert.equal(index.roots.length, 10);
                assert.equal(index.getSection(index.roots[0]).name, "🧠 00. SOLA'S MIND");
                assert.equal(index.getSection(index.roots[0]).total, 3);
            } else {
                assert.deepEqual(index.roots, rows.map(row => row.identifier));
            }
            assert.equal(JSON.stringify(rows), before, 'classification must not modify native metadata');
        });
    }
}

test('Sola sections retain existing subheader nesting and reset it at the next main header', () => {
    const names = ['🧠 00. SOLA\'S MIND ══════════', '< Choices >', 'Choice',
        '📜 02. CORE FOUNDATIONS ══════════', 'Oath'];
    const rows = names.map((name, i) => ({ identifier: `p${i}`, name, enabled: true, toggleAllowed: true }));
    const index = buildSectionIndex(rows, classify);
    assert.deepEqual(index.roots, ['p0', 'p3']);
    assert.equal(index.parentOf('p1'), 'p0');
    assert.equal(index.parentOf('p2'), 'p1');
    assert.equal(index.parentOf('p4'), 'p3');
});

test('ordinary Sola prompt labels and PICK 1 choices are not dividers', () => {
    for (const name of ['Header', 'HTML Headers 🎬', 'Simple Headers 📱', 'Feeling Engine',
        '👾 Gremlin Sola [PICK 1: MIND]', '[PICK 1: ↓] Agency-Lite', 'He / Him [PICK 1: PRONOUN]',
        'Text ══', 'Text ═══ followed by prose', '══════════']) {
        assert.equal(classify(name).isDivider, false, name);
    }
});

test('forced divider checks preserve cleaned Sola titles and honor subsequent renames', () => {
    const original = '📊 08. TELEMETRY & STATE TRACKERS ══════════';
    const link = { textContent: original };
    const element = { dataset: {}, querySelector: () => link };
    const info = divider(element, true);
    link.textContent = info.name; // processSingleItem displays the cleaned name.
    assert.equal(divider(element, true).originalText, original);
    assert.equal(divider(element).name, info.name);
    link.textContent = 'Ordinary renamed prompt';
    assert.equal(divider(element, true).isDivider, false);
    assert.equal(element.dataset.nemoOriginalText, undefined);
    link.textContent = original;
    assert.equal(divider(element, true).isDivider, true);
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
