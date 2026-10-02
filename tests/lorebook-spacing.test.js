import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { compileScanKey, prepareLorebookScan } from '../features/lorebook-spacing/matching.js';
import { WorldInfoBuffer, parseRegexFromString } from './fixtures/native-world-info-buffer.mjs';

const options = { parseRegex: parseRegexFromString, substitute: x => x, caseSensitive: false };
const buffer = new WorldInfoBuffer([], {});
const match = (text, key, entry = {}) => buffer.matchKeys(text, compileScanKey(key, entry, options), entry);

for (const key of ['Happy Hapini Village', 'Happy\u2800Hapini\u2800Village']) {
    test(`all combinations of ordinary and Braille spaces match ${JSON.stringify(key)}`, () => {
        for (const a of [' ', '\u2800']) for (const b of [' ', '\u2800']) {
            assert.equal(match(`Happy${a}Hapini${b}Village`, key), true);
        }
        assert.equal(match('HappyHapiniVillage', key), false);
        assert.equal(match('Happy  Hapini Village', key), false);
        assert.equal(match('Happy\tHapini Village', key), false);
    });
}

test('native case, punctuation and whole-word rules are preserved', () => {
    assert.equal(match('happy\u2800hapini\u2800village', 'Happy Hapini Village'), true);
    assert.equal(match('happy\u2800hapini\u2800village', 'Happy Hapini Village', { caseSensitive: true }), false);
    assert.equal(match('Happy\u2800Hapini\u2800Village', 'Happy Hapini Village', { caseSensitive: true }), true);
    assert.equal(match('A+B\u2800(C)/D', 'A+B (C)/D'), true);
    assert.equal(match('AAAB\u2800C/D', 'A+B (C)/D'), false);
    assert.equal(match('villager', 'village', { matchWholeWords: true }), false);
    assert.equal(match('villager', 'village', { matchWholeWords: false }), true);
    assert.equal(match('xxHappy\u2800Hapini\u2800Villageyy', 'Happy Hapini Village', { matchWholeWords: true }), true);
});

for (const pattern of [
    '/Happy Hapini Village/i', '/Happy\\s+Hapini\\s+Village/i',
    '/Happy[ ]Hapini[\\s]Village/i', '/Happy\\x20Hapini\\u0020Village/i',
    '/Happy\\u{20}Hapini Village/iu', '/Happy[^\\S]Hapini[^\\S]Village/i',
]) {
    test(`regex spacing: ${pattern}`, () => {
        assert.equal(match('Happy\u2800Hapini\u2800Village', pattern), true);
        assert.equal(match('Happy Hapini Village', pattern), true);
    });
}

test('negated regex whitespace treats Braille blanks as spaces', () => {
    for (const pattern of ['/Happy\\SHapini/', '/Happy[^ ]Hapini/', '/Happy[^\\s]Hapini/']) {
        assert.equal(match('Happy\u2800Hapini', pattern), false);
        assert.equal(match('Happy Hapini', pattern), false);
        assert.equal(match('Happy-Hapini', pattern), true);
    }
});

test('Braille blanks in regex keys also accept ordinary spaces', () => {
    for (const pattern of ['/Happy[⠀]Hapini/', '/Happy\\u2800Hapini/', '/Happy\\u{2800}Hapini/u']) {
        assert.equal(match('Happy Hapini', pattern), true);
        assert.equal(match('Happy⠀Hapini', pattern), true);
    }
    assert.equal(match('Happy Hapini', '/Happy[^⠀]Hapini/'), false);
});

test('regex captures, backreferences, flags and slash delimiters remain valid', () => {
    assert.equal(match('Happy\u2800Happy/Village', '/(Happy) \\1\\/Village/i'), true);
    assert.equal(match('Happy\u2800Hapini\u2800Village', '/Happy Hapini Village/g'), true);
    assert.equal(match('anything', '/(/'), false);
});

test('macro values are resolved before converting plaintext keys', () => {
    const key = compileScanKey('{{place}}', {}, { ...options, substitute: () => 'Happy Hapini Village' });
    assert.equal(buffer.matchKeys('Happy\u2800Hapini\u2800Village', key, {}), true);
});

test('all lorebook sources, primary/secondary keys and scores use scan-only copies', () => {
    const original = { key: ['Happy Hapini Village'], keysecondary: ['Village Gate'], selectiveLogic: 0, content: 'unchanged' };
    const snapshot = structuredClone(original);
    const payload = Object.fromEntries(['globalLore', 'characterLore', 'chatLore', 'personaLore'].map(name => [name, [original]]));
    prepareLorebookScan(payload, options);
    for (const entries of Object.values(payload)) {
        assert.notEqual(entries[0], original);
        const native = new WorldInfoBuffer(['Happy\u2800Hapini\u2800Village, Village\u2800Gate'], {});
        assert.equal(native.getScore(entries[0], 1), 2);
        assert.equal(entries[0].content, original.content);
    }
    assert.deepEqual(original, snapshot);
});

test('arbitrary phrases in every entry and keyword slot support every space combination', () => {
    const phrases = ['Silver Oak', 'The Old Stone Bridge', 'Captain Mira of North Harbour', 'A+B (West)/Gate', 'Two  Spaces'];
    const payload = Object.fromEntries(['globalLore', 'characterLore', 'chatLore', 'personaLore'].map(name => [name,
        phrases.map((phrase, uid) => ({ world: `Unrelated Book ${uid}`, uid,
            key: ['unrelated', phrase], keysecondary: [phrase, 'another key'],
            caseSensitive: true, matchWholeWords: true })),
    ]));
    const saved = structuredClone(payload);
    prepareLorebookScan(payload, options);
    for (const [source, entries] of Object.entries(payload)) {
        entries.forEach((entry, index) => {
            const phrase = phrases[index], count = [...phrase].filter(char => char === ' ').length;
            for (let mask = 0; mask < 2 ** count; mask++) {
                let offset = 0;
                const text = phrase.replaceAll(' ', () => mask & (1 << offset++) ? '\u2800' : ' ');
                for (const key of [entry.key[1], entry.keysecondary[0]]) {
                    assert.equal(buffer.matchKeys(text, key, entry), true, `${source}: ${phrase}, combination ${mask}`);
                    assert.equal(buffer.matchKeys(text.replace(/[ \u2800]/g, ''), key, entry), false);
                }
            }
        });
    }
    assert.equal(saved.globalLore[0].key[1], phrases[0]);
});

test('recursive, injected and character/persona scan text accepts Braille blanks', () => {
    const entry = { key: ['Happy Hapini Village'], matchPersonaDescription: true, matchCharacterDescription: true };
    const key = compileScanKey(entry.key[0], entry, options);
    for (const field of ['personaDescription', 'characterDescription', 'characterPersonality', 'characterDepthPrompt', 'scenario', 'creatorNotes']) {
        const native = new WorldInfoBuffer([], { [field]: 'Happy\u2800Hapini\u2800Village' });
        const flag = `match${field[0].toUpperCase()}${field.slice(1)}`;
        assert.equal(native.matchKeys(native.get({ [flag]: true }, 1), key, entry), true);
    }
    for (const method of ['addRecurse', 'addInject']) {
        const native = new WorldInfoBuffer([], {});
        native[method]('Happy\u2800Hapini\u2800Village');
        assert.equal(native.matchKeys(native.get(entry, 1), key, entry), true);
    }
});

test('runtime registers once, cleans up and can initialize again', () => {
    const listeners = new Set();
    const source = readFileSync(new URL('../features/lorebook-spacing/runtime.js', import.meta.url), 'utf8')
        .replace(/^import .*;$/gm, '').replaceAll('export function', 'function');
    const api = new Script(`${source}\n({ initializeLorebookSpacing, cleanupLorebookSpacing })`).runInNewContext({
        eventSource: { on: (_, fn) => listeners.add(fn), removeListener: (_, fn) => listeners.delete(fn) },
        event_types: { WORLDINFO_ENTRIES_LOADED: 'loaded' }, prepareLorebookScan,
        parseRegexFromString, substituteParams: x => x, world_info_case_sensitive: false,
    });
    api.initializeLorebookSpacing(); api.initializeLorebookSpacing();
    assert.equal(listeners.size, 1);
    const payload = { chatLore: [{ key: ['Happy Hapini Village'] }] };
    [...listeners][0](payload);
    assert.equal(buffer.matchKeys('Happy\u2800Hapini\u2800Village', payload.chatLore[0].key[0], {}), true);
    api.cleanupLorebookSpacing(); api.cleanupLorebookSpacing();
    assert.equal(listeners.size, 0);
    api.initializeLorebookSpacing();
    assert.equal(listeners.size, 1);
    api.cleanupLorebookSpacing();
});
