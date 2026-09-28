import test from 'node:test';
import assert from 'node:assert/strict';
import { installStateActions } from '../features/prompt-rendering/state-actions.js';

const classify = name => {
    const sub = /^<\s*(.+?)\s*>$/.exec(name);
    if (sub) return { isDivider: true, isSubHeader: true, name: sub[1] };
    const main = /^===\s*(.*?)\s*===$/.exec(name);
    return main ? { isDivider: true, isSubHeader: false, name: main[1] }
        : { isDivider: false, isSubHeader: false };
};

function harness({ directives = false, api = 'openai', saved = ['b'] } = {}) {
    let currentApi = api, snapshot = saved, promptStates = saved;
    let saves = 0, renders = 0, begin = 0, end = 0, legacyCalls = 0, coldCalls = 0;
    let conflictResolve = null, validate = () => [];
    const notices = [], reports = [], restorations = [];
    const prompts = [
        { identifier: 'h', name: '=== Main ===', content: '' },
        { identifier: 'a', name: 'A', content: 'shell-a' },
        { identifier: 's', name: '< Sub >', content: '' },
        { identifier: 'b', name: 'B', content: 'body-b' },
        { identifier: 'locked', name: 'Locked', content: 'body-locked' },
    ];
    const order = [
        { identifier: 'h', enabled: true },
        { identifier: 'a', enabled: false },
        { identifier: 's', enabled: true },
        { identifier: 'b', enabled: true },
        { identifier: 'locked', enabled: true },
    ];
    let pm = {
        serviceSettings: { prompts }, activeCharacter: { id: 100001 },
        getPromptOrderForCharacter() { return order; },
        isPromptToggleAllowed(prompt) { return !['h', 's', 'locked'].includes(prompt.identifier); },
        render() { renders++; },
        async saveServiceSettings() { saves++; },
        tokenHandler: { getCounts() { return {}; } },
    };
    const manager = {
        showStatusMessage(...args) { notices.push(args); },
        showPromptRestorationNotification(...args) { restorations.push(args); },
        beginToggle() { begin++; }, endToggle() { end++; }, updateSectionCount() {},
        getDividerInfo(element) { return classify(element.querySelector().textContent); },
        applySnapshot(...args) { legacyCalls++; return ['legacy-apply', ...args]; },
        restorePromptStates(...args) { legacyCalls++; return ['legacy-restore', ...args]; },
        getSectionDirectCounts() { legacyCalls++; return { enabled: 90, total: 99 }; },
        getAggregatedCounts() { legacyCalls++; return { enabled: 91, total: 99 }; },
        handleContainerClick() { legacyCalls++; return 'legacy-click'; },
    };
    const storage = {
        getSnapshot() { return snapshot; },
        getPromptStates() { return promptStates; },
    };
    const cold = {
        async withBody(prompt, callback) {
            coldCalls++;
            const before = prompt.content;
            prompt.content = prompt.hydratedContent ?? `hydrated-${prompt.identifier}`;
            try { return await callback(prompt); }
            finally {
                const entry = order.find(item => item.identifier === prompt.identifier);
                if (!entry?.enabled) prompt.content = before;
            }
        },
    };
    const adapter = installStateActions({
        manager, getManager: () => pm, getApi: () => currentApi, storage, getCold: () => cold,
        directivesEnabled: () => directives,
        getAllPrompts: () => prompts.map(prompt => ({ ...prompt,
            enabled: Boolean(order.find(entry => entry.identifier === prompt.identifier)?.enabled) })),
        validateActivation(identifier, all) { return validate(identifier, all); },
        parseDirectives: content => content.includes('auto')
            ? { autoDisable: ['b'], autoEnableDependencies: true } : { autoDisable: [], autoEnableDependencies: false },
        showConflict(_issues, _identifier, done) { conflictResolve = done; }, report: error => reports.push(error),
    });
    const section = id => ({
        querySelector(selector) {
            assert.match(selector, /summary/);
            return { dataset: { pmIdentifier: id } };
        },
        parentElement: null,
    });
    return {
        manager, adapter, prompts, order, storage, cold, section, notices, reports, restorations,
        get pm() { return pm; }, set pm(value) { pm = value; },
        get saves() { return saves; }, get renders() { return renders; }, get begin() { return begin; }, get end() { return end; },
        get legacyCalls() { return legacyCalls; }, get coldCalls() { return coldCalls; },
        set snapshot(value) { snapshot = value; }, set promptStates(value) { promptStates = value; }, set api(value) { currentApi = value; },
        set validator(fn) { validate = fn; }, resolve(value) { conflictResolve?.(value); },
    };
}

const enabled = h => Object.fromEntries(h.order.map(entry => [entry.identifier, entry.enabled]));

test('snapshot application mutates native order without enumerating prompt rows', async () => {
    const h = harness({ saved: ['a'] });
    await h.manager.applySnapshot();
    assert.deepEqual(enabled(h), { h: true, a: true, s: true, b: false, locked: true });
    assert.equal(h.saves, 2); assert.equal(h.renders, 2); assert.equal(h.legacyCalls, 0);
    assert.equal(h.adapter.getStats().targetMutations, 2); h.adapter.dispose();
});

test('intentionally empty snapshots disable toggleable prompts and preserve locked state', async () => {
    const h = harness({ saved: [] });
    await h.manager.applySnapshot();
    assert.equal(enabled(h).b, false); assert.equal(enabled(h).locked, true);
    assert.equal(h.notices.at(-1)[1], 'success'); h.adapter.dispose();
});

test('cold target is hydrated before directive validation and remains disabled when user cancels', async () => {
    const h = harness({ directives: true, saved: ['a'] });
    let validatedContent;
    h.validator = (id, all) => {
        if (id === 'a') validatedContent = all.find(prompt => prompt.identifier === id).content;
        return id === 'a' ? [{ type: 'general-warning', severity: 'warning' }] : [];
    };
    const work = h.manager.applySnapshot();
    while (!validatedContent) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(validatedContent, 'hydrated-a');
    h.resolve(false); await work;
    assert.equal(enabled(h).a, false); assert.equal(enabled(h).b, false);
    assert.equal(h.coldCalls, 1); assert.equal(h.adapter.getStats().cancelled, 1); h.adapter.dispose();
});

test('automatic directive resolution is committed with the target in one native save', async () => {
    const h = harness({ directives: true, saved: ['a'] });
    h.prompts.find(prompt => prompt.identifier === 'a').hydratedContent = 'auto';
    h.validator = id => id === 'a' ? [{ type: 'exclusive', severity: 'error', conflictingPrompt: h.prompts.find(p => p.identifier === 'b') }] : [];
    await h.adapter.applyChanges([{ identifier: 'a', enabled: true }]);
    assert.equal(enabled(h).a, true); assert.equal(enabled(h).b, false);
    assert.equal(h.saves, 1); assert.equal(h.adapter.getStats().resolutionMutations, 1); h.adapter.dispose();
});

test('save failure rolls back only adapter-staged native changes', async () => {
    const h = harness();
    h.pm.saveServiceSettings = async () => { throw new Error('disk unavailable'); };
    await assert.rejects(h.adapter.applyChanges([{ identifier: 'a', enabled: true }]), /disk unavailable/);
    assert.equal(enabled(h).a, false); assert(h.renders >= 2); h.adapter.dispose();
});

test('preset switch while a directive choice is open prevents mutation of the new preset', async () => {
    const h = harness({ directives: true });
    h.validator = id => id === 'a' ? [{ type: 'general-warning', severity: 'warning' }] : [];
    const work = h.adapter.applyChanges([{ identifier: 'a', enabled: true }]);
    while (!h.coldCalls) await new Promise(resolve => setTimeout(resolve, 0));
    const replacement = { ...h.pm, serviceSettings: { prompts: h.prompts.map(prompt => ({ ...prompt })) } };
    h.pm = replacement; h.resolve(true);
    await assert.rejects(work, /preset or active profile changed/);
    assert.equal(enabled(h).a, false); h.adapter.dispose();
});

test('section counts use canonical metadata and stable header IDs', () => {
    const h = harness();
    assert.deepEqual(h.manager.getSectionDirectCounts(h.section('h')), { enabled: 0, total: 1 });
    assert.deepEqual(h.manager.getAggregatedCounts(h.section('h')), { enabled: 1, total: 3 });
    assert.equal(h.legacyCalls, 0); assert.equal(h.adapter.getStats().sectionReads, 2); h.adapter.dispose();
});

test('section master toggle works with only the header shell materialized', async () => {
    const h = harness();
    const section = h.section('h'); let prevented = 0, stopped = 0, updates = 0;
    section.parentElement = null;
    h.manager.updateSectionCount = () => { updates++; };
    const master = { closest(selector) {
        if (selector === '.nemo-section-master-toggle') return master;
        if (selector === 'details.nemo-engine-section') return section;
        return null;
    } };
    h.manager.handleContainerClick({ target: master, preventDefault() { prevented++; }, stopPropagation() { stopped++; } });
    for (let i = 0; i < 20 && enabled(h).a === false; i++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(enabled(h).a, true); assert.equal(enabled(h).b, true); assert.equal(enabled(h).locked, true);
    assert.equal(prevented, 1); assert.equal(stopped, 1); assert(updates >= 1);
    assert.equal(h.adapter.getStats().masterToggles, 1); h.adapter.dispose();
});

test('restore accepts an empty saved state instead of treating it as missing', async () => {
    const h = harness(); h.promptStates = [];
    await h.manager.restorePromptStates();
    assert.equal(enabled(h).b, false); assert.deepEqual(h.restorations.at(-1), [0, 1]); h.adapter.dispose();
});

test('non Chat Completion APIs keep legacy mutating and count handlers unchanged', async () => {
    const h = harness({ api: 'textgenerationwebui' });
    assert.deepEqual(await h.manager.applySnapshot(7), ['legacy-apply', 7]);
    assert.deepEqual(h.manager.getAggregatedCounts({}), { enabled: 91, total: 99 });
    assert.equal(h.manager.handleContainerClick({ target: { closest: () => null } }), 'legacy-click');
    assert.equal(h.legacyCalls, 3); h.adapter.dispose();
});

test('teardown restores owned methods and retained wrappers fall through to originals', async () => {
    const h = harness(); const retained = h.manager.applySnapshot;
    const later = function (...args) { return retained.apply(this, args); };
    h.manager.applySnapshot = later; h.adapter.dispose(); h.adapter.dispose();
    assert.equal(h.manager.applySnapshot, later);
    assert.deepEqual(await h.manager.applySnapshot('after'), ['legacy-apply', 'after']);
});
