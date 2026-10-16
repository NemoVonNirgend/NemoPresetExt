import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRuntimeLoader } from '../core/runtime-loader.js';
import { LOADER_TEXT } from '../features/recipe-runtime/format.js';
import { BANKS, loader } from '../features/vex-runtime/format.js';

for (const expected of [LOADER_TEXT, loader(BANKS[0])]) {
    const visible = expected.replace(/\{\{\/\/[^{}]*\}\}/g, '').trim();
    test(`generated loader recognizes formatting changes: ${visible}`, () => {
        for (const content of [
            expected, visible, '{{// Revised documentation }}\r\n' + visible,
            visible.replace(/ /g, '\u2800\t\n'), '{{trim}}\n' + visible + '\n{{trim}}',
            visible.replace('runtime required', 'runtime {{// Explanatory note }}required'),
        ]) assert.equal(matchesRuntimeLoader(content, expected), true);
    });
    test(`generated loader refuses meaningful and ambiguous edits: ${visible}`, () => {
        for (const content of [
            '', null, undefined, {}, visible + ' Extra instruction.',
            visible.replace('runtime required', 'runtime optional'),
            visible + '{{setvar::counter::0}}', visible + '{{incvar::counter}}',
            visible + '{{getvar::otherSource}}', visible + '{{customMacro}}',
            '{{// unclosed note ' + visible, '{{// nested {{trim}} }}' + visible,
            '\\{{// escaped note }}' + visible, '{{ trim }}' + visible, '{{TRIM}}' + visible,
        ]) assert.equal(matchesRuntimeLoader(content, expected), false);
    });
}

test('loader recognition requires string inputs', () => {
    assert.equal(matchesRuntimeLoader(undefined, undefined), false);
    assert.equal(matchesRuntimeLoader(LOADER_TEXT, null), false);
});
