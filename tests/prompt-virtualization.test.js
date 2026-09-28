import test from 'node:test';
import assert from 'node:assert/strict';
import { desiredDirectIds } from '../features/prompt-rendering/virtualization.js';

const section = { directIds: ['a', 'b', 'c'], open: false };

test('closed accordion section keeps no ordinary resident rows', () => {
    assert.deepEqual(desiredDirectIds(section), []);
});
test('open accordion section materializes only its direct rows', () => {
    assert.deepEqual(desiredDirectIds({ ...section, open: true }), ['a', 'b', 'c']);
});
test('open child under a closed ancestor remains virtualized', () => {
    assert.deepEqual(desiredDirectIds({ ...section, open: true }, { ancestorOpen: false }), []);
});
test('tray mode keeps native section rows virtualized', () => {
    assert.deepEqual(desiredDirectIds({ ...section, open: true }, { mode: 'tray' }), []);
});
test('search materializes only matching direct rows regardless of collapsed state', () => {
    assert.deepEqual(desiredDirectIds(section, { searchIds: new Set(['b', 'outside']) }), ['b']);
});
test('disabling virtualization or sections restores complete direct residency', () => {
    assert.deepEqual(desiredDirectIds(section, { virtualizationActive: false }), ['a', 'b', 'c']);
    assert.deepEqual(desiredDirectIds(section, { sectionsEnabled: false }), ['a', 'b', 'c']);
});
