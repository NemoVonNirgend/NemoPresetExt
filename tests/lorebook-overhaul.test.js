import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { isSafePresetName, normalizePresetMap } from '../features/world-info/preset-validation.js';

const source = readFileSync(new URL('../features/world-info/world-info-ui.js', import.meta.url), 'utf8');
const template = readFileSync(new URL('../features/world-info/world-info-ui.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../features/world-info/world-info-ui.css', import.meta.url), 'utf8');

test('uses the supported SillyTavern world-info editor surface', () => {
    assert.match(source, /\bopenWorldInfoEditor\b/);
    assert.doesNotMatch(source, /window\.(?:getWorldEntry|displayWorldEntries)/);
    assert.match(source, /event_types\.WORLDINFO_UPDATED/);
});

test('owns its lifecycle and restores the native world-info panel', () => {
    assert.match(source, /_abortController:\s*null/);
    assert.match(source, /_panelObserver:\s*null/);
    assert.match(source, /_entriesObserver:\s*null/);
    assert.match(source, /id\s*=\s*['"]nemo-native-world-info-preserved['"]/);
    assert.match(source, /destroy:\s*function/);
    assert.match(source, /eventSource\.removeListener/);
    assert.match(source, /replaceChildren\([^)]*preserved/);
    assert.match(source, /_settingsDisplay:\s*null/);
    assert.match(source, /settingsPanel\.style\.display = this\._settingsDisplay/);
});

test('adds keyboard and screen-reader semantics to the modernized template', () => {
    assert.match(source, /setAttribute\(['"]role['"],\s*['"]tablist['"]\)/);
    assert.match(source, /setAttribute\(['"]role['"],\s*['"]tab['"]\)/);
    assert.match(source, /setAttribute\(['"]aria-selected['"]/);
    assert.match(source, /event\.key === ['"]ArrowRight['"]/);
    assert.match(source, /event\.key === ['"]Enter['"]\s*\|\|\s*event\.key === ['"] ['"]/);
    assert.match(source, /aria-live/);
});

test('provides owned responsive and focus-visible enhancements', () => {
    assert.match(template, /role="tablist"/);
    assert.match(template, /<button[^>]+role="tab"/);
    assert.match(styles, /@media\s*\(max-width:\s*768px\)/);
    assert.match(styles, /:focus-visible/);
    assert.match(styles, /prefers-reduced-motion/);
    assert.match(source, /aria-busy/);
    assert.match(source, /input\.addEventListener\(['"]input['"], schedule, signal/);
    assert.match(source, /_previewTimer:\s*null/);
    assert.doesNotMatch(styles, /#world_info_pagination\s*\{[^}]*display:\s*none/s);
});

test('uses SillyTavern native pagination controls instead of a dead page-size selector', () => {
    assert.match(template, /id=.world_info_pagination./);
    assert.doesNotMatch(template, /nemo-world-info-buffer-size|Entries per page/);
    assert.doesNotMatch(source, /nemo-world-info-buffer-size|Entries per page/);
    assert.doesNotMatch(styles, /nemo-world-info-buffer-size/);
    assert.doesNotMatch(styles, /#world_info_pagination\s*\{[^}]*display:\s*none/s);
});

test('keeps lorebook and entry search controls independent', () => {
    const entryManagement = source.match(/initEntryManagement: function\(\) \{([\s\S]*?)\n    \}\n\};/)?.[1];
    assert.ok(entryManagement);
    assert.match(entryManagement, /nemo-world-info-entry-search/);
    assert.match(entryManagement, /originalSearch\.dispatchEvent\(new Event\('input'/);
    assert.doesNotMatch(entryManagement, /lorebookSearch|nemo-world-info-search/);
});

test('keeps lorebook multi-selection synchronized for mouse, keyboard, and refreshes', () => {
    assert.match(template, /aria-multiselectable=.true./);
    assert.match(template, /aria-describedby=.nemo-world-info-list-instructions./);
    assert.match(template, /id=.nemo-world-info-list-instructions./);

    const createLorebookElement = source.match(/createLorebookElement: function\(option\) \{([\s\S]*?)\n    \},\n\n    createFolderElement:/)?.[1];
    assert.ok(createLorebookElement);
    assert.match(createLorebookElement, /event\.ctrlKey\s*\|\|\s*event\.metaKey/);
    assert.match(createLorebookElement, /event\.key === [' ]{3}[\s\S]*toggleLorebookSelection/);
    assert.match(createLorebookElement, /event\.key === [']Enter['][\s\S]*openLorebook/);
    assert.doesNotMatch(createLorebookElement, /event\.key === [']Enter[']\s*\|\|/);
    assert.doesNotMatch(createLorebookElement, /shiftKey/);

    assert.match(source, /syncLorebookSelectionUI: function/);
    assert.match(source, /classList\.toggle\([']selected['], selected\)/);
    assert.match(source, /setAttribute\([']aria-selected['], String\(selected\)\)/);
});

test('avoids selector interpolation for user-controlled lorebook names', () => {
    assert.doesNotMatch(source, /querySelector\(`\.nemo-lorebook-item\[data-name="\$\{/);
});


test('validates order inputs before loading books and forces immediate multi-book saves', () => {
    const applyOrderHelper = source.match(/applyOrderHelper: async function\(\) \{([\s\S]*?)\n    \},\n    initPrimaryKeywordPreview:/)?.[1];
    assert.ok(applyOrderHelper);
    assert.match(applyOrderHelper, /Number\.isFinite\(start\).*Number\.isFinite\(step\)/);
    assert.ok(applyOrderHelper.indexOf('Number.isFinite(start)') < applyOrderHelper.indexOf('loadWorldInfo(bookName)'));
    assert.equal(Number.isFinite(Number.parseInt('', 10)), false);
    assert.match(applyOrderHelper, /for \(const \[bookName, book\] of booksToSave\)[\s\S]*saveWorldInfo\(bookName, book, true\)/);
});

test('matches primary keywords using literal, punctuation, and entry matching settings', () => {
    const escapeHelper = source.match(/function escapeRegExp\(value\) \{[\s\S]*?\n\}/)?.[0];
    const expressionHelper = source.match(/function createLiteralKeywordExpression\(keyword, entry\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(escapeHelper);
    assert.ok(expressionHelper);

    const loadHelper = (matchWholeWords, caseSensitive) => runInNewContext(
        [escapeHelper, expressionHelper, 'createLiteralKeywordExpression'].join('\n'),
        {
            world_info_match_whole_words: matchWholeWords,
            world_info_case_sensitive: caseSensitive,
        },
    );
    const createExpression = loadHelper(false, false);
    const createStrictExpression = loadHelper(true, true);

    assert.equal(createExpression('space.ship', {}).test('A space.ship landed.'), true);
    assert.equal(createExpression('space.ship', {}).test('A spaceXship landed.'), false);
    assert.equal(createExpression('C++', {}).test('Use C++ here.'), true);
    assert.equal(createExpression('Dragon', { caseSensitive: true }).test('dragon'), false);
    assert.equal(createExpression('space', { matchWholeWords: false }).test('spaceship'), true);
    assert.equal(createStrictExpression('space', { matchWholeWords: null }).test('spaceship'), false);
    assert.equal(createStrictExpression('Dragon', { caseSensitive: null }).test('dragon'), false);
});

test('does not advertise unsupported World Info macro syntax', () => {
    assert.doesNotMatch(source, /\{\{wi::|macro-picker/i);
    assert.doesNotMatch(template, /macro picker|macro-picker/i);
    assert.doesNotMatch(styles, /macro-picker/i);
});

test('clears active entries across generation and chat lifecycle boundaries', () => {
    assert.match(source, /eventSource\.on\(event_types\.GENERATION_STARTED, this\._generationStartedHandler\)/);
    assert.match(source, /eventSource\.on\(event_types\.CHAT_CHANGED, this\._chatChangedHandler\)/);
    assert.match(source, /eventSource\.removeListener\(event_types\.GENERATION_STARTED, this\._generationStartedHandler\)/);
    assert.match(source, /eventSource\.removeListener\(event_types\.CHAT_CHANGED, this\._chatChangedHandler\)/);
    assert.match(source, /const clearActiveEntries = \(\) => \{[\s\S]*this\._activeEntries = \[\]/);
});

test('labels the preview honestly and documents unsupported activation semantics', () => {
    assert.match(template, /Primary Keyword Preview/);
    assert.doesNotMatch(template, /Lore Simulator/i);
    assert.match(template, /lightweight preview checks primary keywords only/i);
    for (const limitation of ['constant entries', 'secondary', 'selective logic', 'probability', 'groups', 'recursion', 'vector activation']) {
        assert.match(template, new RegExp(limitation, 'i'));
    }
    assert.match(source, /Checking primary keywords/);
    assert.match(source, /No primary keyword matches/);
    assert.match(source, /Primary keyword preview results/);
});

test('keeps current and active preview scopes empty instead of scanning all lorebooks', () => {
    assert.doesNotMatch(source, /if \(lorebooksToScan\.length === 0\) lorebooksToScan = \[\.\.\.world_names\]/);
    assert.match(source, /scope === 'current'[\s\S]*Select a lorebook to preview primary keywords/);
    assert.match(source, /scope === 'active'[\s\S]*No active lorebooks to preview/);
    assert.match(source, /scope === 'all'[\s\S]*lorebooksToScan = \[\.\.\.world_names\]/);
});
test('rejects malformed or prototype-sensitive preset maps', () => {
    const lorebooks = ['Main Lore', 'Characters'];
    const valid = normalizePresetMap({ Story: lorebooks, toString: ['Safe own key'] });
    assert.deepEqual({ ...valid }, { Story: ['Main Lore', 'Characters'], toString: ['Safe own key'] });
    assert.equal(Object.getPrototypeOf(valid), null);
    assert.notEqual(valid.Story, lorebooks);
    lorebooks.push('Mutated later');
    assert.deepEqual(valid.Story, ['Main Lore', 'Characters']);
    assert.equal(Object.getPrototypeOf(normalizePresetMap(Object.create(null))), null);

    for (const name of ['', '   ', ' leading', 'trailing ', '__proto__', 'prototype', 'constructor']) {
        assert.equal(isSafePresetName(name), false);
    }
    assert.equal(isSafePresetName('constructor notes'), true);

    for (const invalid of [
        null,
        [],
        new Map(),
        Object.create({ inherited: ['Book'] }),
        { Broken: {} },
        { Broken: [1] },
        { '': ['Book'] },
        { ' padded ': ['Book'] },
        JSON.parse('{"__proto__":["Book"]}'),
        { prototype: ['Book'] },
        { constructor: ['Book'] },
    ]) {
        assert.equal(normalizePresetMap(invalid), null);
    }
});

test('validates stored and imported presets before mutating UI state', () => {
    assert.match(source, /import \{ isSafePresetName, normalizePresetMap \} from '.\/preset-validation\.js'/);
    assert.match(source, /_presets: Object\.create\(null\)/);
    assert.match(source, /normalizePresetMap\(JSON\.parse\(state\)\)/);
    assert.match(source, /normalizePresetMap\(JSON\.parse\(await file\.text\(\)\)\)/);
    assert.match(source, /const nextPresets = normalizePresetMap\(this\._presets\)/);
    assert.match(source, /this\._presets = nextPresets/);
    assert.ok(source.indexOf('normalizePresetMap(JSON.parse(await file.text()))') < source.indexOf('this._presets = nextPresets'));
    assert.doesNotMatch(source, /for \(const presetName in (?:this\._presets|importedPresets)\)/);
    assert.match(source, /for \(const presetName of Object\.keys\(this\._presets\)\)/);
    assert.match(source, /Object\.hasOwn\(this\._presets, presetName\)/);
    assert.ok(source.match(/isSafePresetName\(/g).length >= 2);
    assert.match(source, /Saved lorebook presets were invalid and could not be loaded/);
    assert.match(source, /Invalid preset file/);
});
