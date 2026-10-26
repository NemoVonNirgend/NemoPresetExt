import test from 'node:test';
import assert from 'node:assert/strict';
import { installNativeSortGuard, isCompletePromptOrder } from '../features/prompt-rendering/native-sort-guard.js';

function harness() {
    const initial = Array.from({ length: 103 }, (_, i) => ({ identifier: `p${i}`, enabled: i % 3 !== 0 }));
    let order = initial, ids = initial.map(entry => entry.identifier), saves = 0, redraws = 0, instance;
    const warnings = [];
    const pm = {
        activeCharacter: { id: 100001 }, serviceSettings: { prompts: initial.map(({ identifier }) => ({ identifier })) },
        listElement: {}, getPromptOrderForCharacter: () => order,
        makeDraggable() {
            instance = { options: { update() {
                // Native ST makeDraggable's update: replace order with toArray's IDs.
                const byId = new Map(order.map(entry => [entry.identifier, entry]));
                order = ids.map(id => byId.get(id)); saves++;
                return 'native-result';
            } } };
        },
    };
    const jquery = () => ({ sortable(command) {
        if (command === 'instance') return instance;
        if (command === 'toArray') return ids;
        throw new Error(`Unexpected sortable call: ${command}`);
    } });
    pm.makeDraggable();
    const original = pm.makeDraggable, originalUpdate = instance.options.update;
    const guard = installNativeSortGuard({ pm, jquery: () => jquery, notify: error => warnings.push(error.message), redraw: () => redraws++ });
    return { pm, guard, initial, original, originalUpdate, warnings,
        get order() { return order; }, get saves() { return saves; }, get redraws() { return redraws; },
        get instance() { return instance; }, set ids(value) { ids = value; },
        update: () => instance.options.update(), detach() { order = order.slice(1); ids = order.map(entry => entry.identifier); },
    };
}

test('103-entry order cannot be replaced by the 10 headers left after virtualization', () => {
    const h = harness(), before = JSON.stringify(h.order);
    h.ids = h.initial.slice(0, 10).map(entry => entry.identifier);
    h.update();
    assert.equal(h.order, h.initial); assert.equal(JSON.stringify(h.order), before);
    assert.equal(h.saves, 0); assert.equal(h.redraws, 1); assert.equal(h.guard.getStats().blocked, 1);
    h.guard.dispose();
});

test('a complete native reorder saves once and preserves enabled states and entry identity', () => {
    const h = harness(); h.ids = h.initial.map(entry => entry.identifier).reverse();
    assert.equal(h.update(), 'native-result');
    assert.deepEqual(h.order, [...h.initial].reverse()); assert.equal(h.saves, 1); assert.equal(h.redraws, 0);
    h.order.forEach((entry, i) => assert.equal(entry, h.initial[102 - i]));
    h.guard.dispose();
});

for (const [name, transform] of [
    ['duplicate', ids => [ids[0], ...ids.slice(0, -1)]],
    ['unknown', ids => ['unknown', ...ids.slice(1)]],
    ['empty', () => []],
    ['missing', ids => ids.slice(1)],
    ['unreadable', () => null],
]) test(`${name} DOM order never reaches the native save callback`, () => {
    const h = harness(); h.ids = transform(h.initial.map(entry => entry.identifier)); h.update();
    assert.equal(h.saves, 0); assert.equal(h.order, h.initial); h.guard.dispose();
});

for (const change of ['preset', 'character', 'list']) test(`a stale ${change} callback cannot save against current state`, () => {
    const h = harness();
    if (change === 'preset') h.pm.serviceSettings.prompts = [...h.pm.serviceSettings.prompts];
    if (change === 'character') h.pm.activeCharacter = { id: 100002 };
    if (change === 'list') h.pm.listElement = {};
    h.update(); assert.equal(h.saves, 0); h.guard.dispose();
});

test('an intentional detach still permits later complete native sorting', () => {
    const h = harness(); h.detach(); h.update();
    assert.equal(h.order.length, 102); assert.equal(h.saves, 1); h.guard.dispose();
});

test('reinitializing native sortable keeps the new update callback protected', () => {
    const h = harness(); h.pm.makeDraggable(); h.ids = ['p0']; h.update();
    assert.equal(h.saves, 0); h.guard.dispose(); assert.equal(h.pm.makeDraggable, h.original);
});

test('refresh repairs a replaced callback and cleanup restores only owned hooks', () => {
    const h = harness(); let replacements = 0;
    const replacement = () => replacements++;
    h.instance.options.update = replacement;
    assert.equal(h.guard.protect(), true); h.ids = ['p0']; h.update(); assert.equal(replacements, 0);
    const later = () => {};
    h.instance.options.update = later; h.pm.makeDraggable = later; h.guard.dispose();
    assert.equal(h.instance.options.update, later); assert.equal(h.pm.makeDraggable, later);
});

test('ordinary cleanup restores the preexisting native callback', () => {
    const h = harness(); h.guard.dispose();
    assert.equal(h.instance.options.update, h.originalUpdate); assert.equal(h.pm.makeDraggable, h.original);
});

test('unknown sortable capability refuses permission to virtualize', () => {
    const pm = { makeDraggable() {}, listElement: {} };
    const guard = installNativeSortGuard({ pm, jquery: () => null });
    assert.equal(guard.protect(), false); guard.dispose();
});

test('order validation rejects malformed canonical entries, but permits an intentional empty order', () => {
    assert.equal(isCompletePromptOrder(['one'], [{ identifier: 'one' }]), true);
    assert.equal(isCompletePromptOrder([], []), true);
    assert.equal(isCompletePromptOrder(['one', 'one'], [{ identifier: 'one' }, { identifier: 'one' }]), false);
    assert.equal(isCompletePromptOrder([undefined], [{}]), false);
});
