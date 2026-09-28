import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TOP_LEVEL_SECTION_ID, headerRows, navigatorRows, readConsumerState, reorderSectionMembers,
    sectionRecords, topLevelRecords, movePromptBelowHeader, movePromptToSectionIndex, movePromptToTopLevel,
} from '../features/prompt-rendering/state-consumers.js';

const classify = name => {
    const sub = /^<\\s*(.+?)\\s*>$/.exec(name);
    if (sub) return { isDivider: true, isSubHeader: true, name: sub[1].trim() };
    const main = /^===\\s*(.*?)\\s*===$/.exec(name);
    return main ? { isDivider: true, isSubHeader: false, name: main[1].trim() }
        : { isDivider: false, isSubHeader: false };
};

function harness(names = ['Root', '=== Main ===', 'A', '< Sub >', 'B', '=== Next ===', 'C']) {
    const prompts = names.map((name, i) => ({ identifier: `p${i}`, name, role: i % 2 ? 'system' : 'user',
        get content() { throw new Error('consumer state must not read prompt bodies'); } }));
    const order = prompts.map(prompt => ({ identifier: prompt.identifier, enabled: true }));
    let saves = 0, renders = 0;
    const pm = {
        serviceSettings: { prompts }, activeCharacter: { id: 100001 },
        getPromptOrderForCharacter() { return order; },
        isPromptToggleAllowed(prompt) { return !classify(prompt.name).isDivider; },
        async saveServiceSettings() { saves++; },
        render() { renders++; },
    };
    const manager = { getDividerInfo(fake) { return classify(fake.querySelector().textContent); } };
    return { pm, manager, order, get saves() { return saves; }, get renders() { return renders; } };
}

test('consumer state exposes canonical section and source metadata without body reads', () => {
    const h = harness(), state = readConsumerState(h.pm, h.manager);
    assert.deepEqual(state.index.getSection('p1').memberIds, ['p2', 'p4']);
    assert.equal(state.sources.get('p2').role, 'user');
});
test('tray records come from stable section IDs, including sub-section markers', () => {
    const h = harness();
    assert.deepEqual(sectionRecords(h.pm, h.manager, 'p1'), [
        { identifier: 'p2', name: 'A' },
        { identifier: 'p3', name: 'Sub', isSubSectionHeader: true },
        { identifier: 'p4', name: 'B' },
    ]);
    assert.deepEqual(topLevelRecords(h.pm, h.manager), [{ identifier: 'p0', name: 'Root' }]);
    assert.deepEqual(sectionRecords(h.pm, h.manager, TOP_LEVEL_SECTION_ID), [{ identifier: 'p0', name: 'Root' }]);
});
test('navigator and header discovery do not require rendered rows', () => {
    const h = harness();
    assert.deepEqual(navigatorRows(h.pm).map(row => [row.identifier, row.name, row.role]), [
        ['p0', 'Root', 'user'], ['p1', '=== Main ===', 'system'], ['p2', 'A', 'user'],
        ['p3', '< Sub >', 'system'], ['p4', 'B', 'user'], ['p5', '=== Next ===', 'system'], ['p6', 'C', 'user'],
    ]);
    assert.deepEqual(headerRows(h.pm, h.manager), [
        { identifier: 'p1', name: 'Main', isSubHeader: false, parentId: null },
        { identifier: 'p3', name: 'Sub', isSubHeader: true, parentId: 'p1' },
        { identifier: 'p5', name: 'Next', isSubHeader: false, parentId: null },
    ]);
});
test('move below header mutates native order and saves once', async () => {
    const h = harness(); await movePromptBelowHeader(h.pm, 'p6', 'p1', { render: true });
    assert.deepEqual(h.order.map(e => e.identifier), ['p0', 'p1', 'p6', 'p2', 'p3', 'p4', 'p5']);
    assert.equal(h.saves, 1); assert.equal(h.renders, 1);
});
test('move to section index works when no child rows are materialized', async () => {
    const h = harness(); await movePromptToSectionIndex(h.pm, h.manager, 'p6', 'p1', 1);
    assert.deepEqual(h.order.map(e => e.identifier), ['p0', 'p1', 'p2', 'p6', 'p3', 'p4', 'p5']);
    assert.equal(h.saves, 1);
});
test('move to top level places the prompt before the first divider', async () => {
    const h = harness(); await movePromptToTopLevel(h.pm, h.manager, 'p6');
    assert.deepEqual(h.order.map(e => e.identifier), ['p0', 'p6', 'p1', 'p2', 'p3', 'p4', 'p5']);
});
test('section member reorder preserves divider positions while changing membership order', async () => {
    const h = harness(); await reorderSectionMembers(h.pm, h.manager, 'p1', ['p4', 'p2']);
    assert.deepEqual(h.order.map(e => e.identifier), ['p0', 'p1', 'p4', 'p3', 'p2', 'p5', 'p6']);
});
test('failed native save rolls movement back exactly', async () => {
    const h = harness(), before = h.order.slice();
    h.pm.saveServiceSettings = async () => { throw new Error('save failed'); };
    await assert.rejects(() => movePromptBelowHeader(h.pm, 'p6', 'p1'), /save failed/);
    assert.deepEqual(h.order, before);
});
test('malformed reorder requests fail before saving', async () => {
    const h = harness();
    await assert.rejects(() => reorderSectionMembers(h.pm, h.manager, 'p1', ['p2']), /membership/);
    assert.equal(h.saves, 0);
});
