import test from 'node:test';
import assert from 'node:assert/strict';
import { renderState, remember, sameRevision, changedRows, supportsNativeRows } from '../features/prompt-rendering/model.js';

function manager() {
    const prompts = ['main', 'one', 'two', 'chatHistory'].map(identifier => ({ identifier, name: identifier,
        role: 'system', marker: identifier === 'chatHistory', system_prompt: identifier === 'main' }));
    for (const p of prompts) Object.defineProperty(p, 'content', { get() { throw new Error('Renderer read a prompt body'); } });
    const counts = { main: 10, one: 20, two: 30, chatHistory: 100 };
    return {
        serviceSettings: { prompts, prompt_order: [{ character_id: 100000,
            order: prompts.map(p => ({ identifier: p.identifier, enabled: true })) }], openai_max_context: 8192, openai_max_tokens: 1024 },
        activeCharacter: { id: 100000 }, configuration: { prefix: 'completion_', promptOrder: { strategy: 'global' }, warningTokenThreshold: 1500, dangerTokenThreshold: 500 },
        error: null, tokenUsage: 160, overriddenPrompts: [], tokenHandler: { getCounts: () => counts },
        getPromptOrderForCharacter() { return this.serviceSettings.prompt_order[0].order; },
        isPromptDeletionAllowed: p => !p.system_prompt,
        isPromptEditAllowed: p => !p.marker,
        isPromptToggleAllowed: () => true,
        isPromptInspectionAllowed: () => true,
    };
}
test('render state reads no prompt body, including disabled rows', () => {
    const pm = manager(); pm.getPromptOrderForCharacter()[1].enabled = false;
    assert.equal(renderState(pm).rows.length, 4);
});
test('warm state has exact equality without content hashes or string keys', () => {
    const pm = manager(), state = renderState(pm);
    assert(sameRevision(state, renderState(pm)));
    assert.deepEqual(changedRows(remember(state, {}), renderState(pm)), []);
    assert.equal(JSON.stringify(state.rows).includes('content'), false);
});
test('remembered signatures contain no body map or source copies', () => {
    const state = remember(renderState(manager()), {});
    assert.equal('byId' in state, false); assert.equal('entries' in state, false);
    assert.equal('content' in state, false);
});
for (const [key, value] of [['role', 'assistant'], ['marker', true], ['system_prompt', true],
    ['forbid_overrides', true], ['injection_position', 1], ['injection_depth', 9]]) {
    test(`visual change invalidates exactly the affected row: ${key}`, () => {
        const pm = manager(), before = renderState(pm); pm.serviceSettings.prompts[1][key] = value;
        assert.deepEqual(changedRows(before, renderState(pm)).map(r => r.id), ['one']);
    });
}
test('toggle and token-count changes invalidate only their native rows', () => {
    const pm = manager(), before = renderState(pm);
    pm.getPromptOrderForCharacter()[1].enabled = false;
    pm.tokenHandler.getCounts().two = 45;
    assert.deepEqual(changedRows(before, renderState(pm)).map(r => r.id), ['one', 'two']);
});
test('token pressure invalidates the chat-history warning', () => {
    const pm = manager(), before = renderState(pm); pm.tokenUsage = 8000;
    assert.deepEqual(changedRows(before, renderState(pm)).map(r => r.id), ['chatHistory']);
});
test('overrides and permission changes participate in visual signatures', () => {
    const pm = manager(), before = renderState(pm); pm.overriddenPrompts = ['two'];
    pm.isPromptInspectionAllowed = p => p.identifier !== 'one';
    assert.deepEqual(changedRows(before, renderState(pm)).map(r => r.id), ['one', 'two']);
});
for (const action of ['rename', 'append', 'remove', 'reorder']) test(`${action} requests complete native layout instead of inferring a partial order`, () => {
    const pm = manager(), before = renderState(pm), rows = pm.getPromptOrderForCharacter();
    if (action === 'rename') pm.serviceSettings.prompts[1].name = 'Renamed';
    if (action === 'append') { pm.serviceSettings.prompts.push({ identifier: 'new', name: 'New' }); rows.push({ identifier: 'new', enabled: false }); }
    if (action === 'remove') rows.splice(1, 1);
    if (action === 'reorder') [rows[1], rows[2]] = [rows[2], rows[1]];
    assert.equal(changedRows(before, renderState(pm)), null);
});
test('new preset with identical IDs does not reuse a previous preset signature', () => {
    const pm = manager(), before = renderState(pm); pm.serviceSettings.prompts = [...pm.serviceSettings.prompts];
    assert.equal(changedRows(before, renderState(pm)), null);
});
test('profile, prefix and strategy changes invalidate the render context', () => {
    for (const change of [pm => pm.activeCharacter.id++, pm => pm.configuration.prefix = 'other_', pm => pm.configuration.promptOrder.strategy = 'character']) {
        const pm = manager(), before = renderState(pm); change(pm);
        assert.equal(changedRows(before, renderState(pm)), null);
    }
});
test('unlisted footer prompt names still invalidate the native frame', () => {
    const pm = manager(), before = renderState(pm);
    pm.serviceSettings.prompts.push({ identifier: 'extra', name: 'Available prompt' });
    assert.notEqual(before.frame, renderState(pm).frame);
    assert.deepEqual(changedRows(before, renderState(pm)), []);
});
test('bad or incomplete host state fails open to native rendering', () => {
    const cases = [pm => pm.activeCharacter = null, pm => pm.serviceSettings.prompts.push(pm.serviceSettings.prompts[0]),
        pm => pm.getPromptOrderForCharacter().push({ identifier: 'missing' }),
        pm => pm.getPromptOrderForCharacter().push(pm.getPromptOrderForCharacter()[0]),
        pm => pm.serviceSettings.prompts[0].name = null];
    for (const change of cases) { const pm = manager(); change(pm); assert.equal(renderState(pm), null); }
});
test('row snapshot never mutates order, enabled state or source object identity', () => {
    const pm = manager(), refs = [...pm.serviceSettings.prompts], order = JSON.stringify(pm.serviceSettings.prompt_order);
    renderState(pm); renderState(pm);
    assert.equal(JSON.stringify(pm.serviceSettings.prompt_order), order);
    assert(pm.serviceSettings.prompts.every((p, i) => p === refs[i]));
});
test('bound or unrecognized renderers are not run against an isolated receiver', () => {
    function renderPromptManagerListItems() { return this.listElement && this.getPromptsForCharacter() && this.getPromptOrderEntry() && 'promptManagerListHeader'; }
    assert.equal(supportsNativeRows(renderPromptManagerListItems), true);
    assert.equal(supportsNativeRows(renderPromptManagerListItems.bind({})), false);
    assert.equal(supportsNativeRows(() => {}), false);
    assert.equal(supportsNativeRows(null), false);
});
