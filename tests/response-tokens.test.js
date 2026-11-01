import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';
import { createResponseTokensRuntime } from '../features/response-tokens/controller.js';

const initial = { preset_settings_openai: 'Nemo', openai_max_tokens: 16000 };

function fixture({ live = initial, startup = initial, memory } = {}) {
    const settings = structuredClone(live);
    const saved = structuredClone(startup);
    const events = new EventEmitter();
    const types = Object.fromEntries(['APP_READY', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER'].map(key => [key, key]));
    const writes = [], saves = [], timers = new Map();
    let stored = structuredClone(memory), input, nextTimer = 0, shown = String(settings.openai_max_tokens);
    const options = {
        events, types, getSettings: () => settings, getStartupSettings: () => saved,
        getMemory: () => stored,
        saveMemory(value) { stored = structuredClone(value); saves.push(stored); },
        writeTokens(value) {
            settings.openai_max_tokens = value;
            shown = String(value);
            writes.push(value);
            input?.(shown, { source: 'nemo-response-tokens' });
        },
        subscribeInput(handler) { input = handler; return () => { input = null; }; },
        schedule(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
        cancel(id) { timers.delete(id); },
    };
    const start = () => createResponseTokensRuntime(options);
    const flush = () => {
        for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
    };
    const edit = (value, meta = { user: true }) => {
        settings.openai_max_tokens = Number(value);
        shown = String(value);
        input?.(value, meta);
    };
    return { options, settings, saved, events, types, timers, writes, saves, start, flush, edit,
        get memory() { return stored; }, get shown() { return shown; }, get subscribed() { return Boolean(input); } };
}

test('reload restores the original saved limit after a startup reset and updates the UI', () => {
    const h = fixture({ live: { ...initial, openai_max_tokens: 300 } });
    const runtime = h.start();
    h.events.on(h.types.APP_READY, () => h.edit(500, { source: 'preset' }));
    h.events.emit(h.types.APP_READY);
    assert.equal(h.settings.openai_max_tokens, 500);
    h.flush();
    assert.equal(h.settings.openai_max_tokens, 16000);
    assert.equal(h.shown, '16000');
    assert.deepEqual(h.memory, { preset: 'Nemo', tokens: 16000 });
    runtime.dispose();
});

test('a UI-only startup reset is repaired even when the native setting remains correct', () => {
    const h = fixture();
    const runtime = h.start();
    h.edit(300, { source: 'preset' });
    h.settings.openai_max_tokens = 16000;
    h.events.emit(h.types.APP_READY);
    h.flush();
    assert.equal(h.shown, '16000');
    runtime.dispose();
});

test('serialized response-token preference survives repeated fresh boots with reset native values', () => {
    let memory;
    for (let boot = 0; boot < 3; boot++) {
        const startup = boot ? { ...initial, openai_max_tokens: 300 } : initial;
        const h = fixture({ live: { ...initial, openai_max_tokens: 300 }, startup, memory });
        const runtime = h.start();
        h.events.emit(h.types.APP_READY);
        h.flush();
        assert.equal(h.settings.openai_max_tokens, boot === 0 ? 16000 : 24000);
        if (boot === 0) {
            h.edit('24000');
            assert.equal(h.memory.tokens, 24000);
        }
        memory = JSON.parse(JSON.stringify(h.memory));
        assert.equal(h.saves.length, boot === 0 ? 2 : 0, 'unchanged backups do not schedule extra saves');
        runtime.dispose();
    }
});

test('real edits during startup take precedence over both stored and original values', () => {
    const h = fixture({ memory: { preset: 'Nemo', tokens: 24000 } });
    const runtime = h.start();
    h.edit('32000');
    h.edit('300', { source: 'preset' });
    h.events.emit(h.types.APP_READY);
    h.flush();
    assert.equal(h.settings.openai_max_tokens, 32000);
    assert.equal(h.memory.tokens, 32000);
    runtime.dispose();
});

test('an edit immediately after APP_READY cancels a pending startup restoration', () => {
    const h = fixture();
    const runtime = h.start();
    h.events.emit(h.types.APP_READY);
    h.edit('8192');
    h.flush();
    assert.equal(h.settings.openai_max_tokens, 8192);
    assert.deepEqual(h.writes, []);
    assert.equal(h.memory.tokens, 8192);
    runtime.dispose();
});

test('a change-only control updates the request setting as well as the persisted preference', () => {
    const h = fixture();
    let input;
    const subscribe = h.options.subscribeInput;
    h.options.subscribeInput = handler => { input = handler; return subscribe(handler); };
    const runtime = h.start();
    h.events.emit(h.types.APP_READY);
    h.flush();
    input('32768', { user: true }); // No native input handler has run.
    assert.equal(h.settings.openai_max_tokens, 32768);
    assert.equal(h.shown, '32768');
    assert.equal(h.memory.tokens, 32768);
    runtime.dispose();
});

test('later preset loads, including reloading the same preset, retain their intended limits', () => {
    for (const nextPreset of ['Nemo', 'Different preset']) {
        const h = fixture();
        const runtime = h.start();
        h.events.emit(h.types.APP_READY);
        h.flush();
        h.events.emit(h.types.OAI_PRESET_CHANGED_BEFORE);
        h.settings.preset_settings_openai = nextPreset;
        h.edit('4096', { source: 'preset' });
        h.events.emit(h.types.OAI_PRESET_CHANGED_AFTER);
        h.events.emit(h.types.APP_READY);
        h.flush();
        assert.equal(h.settings.openai_max_tokens, 4096);
        assert.deepEqual(h.memory, { preset: nextPreset, tokens: 4096 });
        runtime.dispose();
    }
});

test('a different startup preset never receives the old preset response limit', () => {
    const h = fixture({ memory: { preset: 'Other preset', tokens: 32000 } });
    const runtime = h.start();
    h.settings.preset_settings_openai = 'Another preset';
    h.edit('1024', { source: 'preset' });
    h.events.emit(h.types.APP_READY);
    h.flush();
    assert.equal(h.settings.openai_max_tokens, 1024);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.memory, { preset: 'Another preset', tokens: 1024 });
    runtime.dispose();
});

test('preset application after APP_READY but before the startup timer runs cancels restoration', () => {
    const h = fixture();
    const runtime = h.start();
    h.events.emit(h.types.APP_READY);
    h.events.emit(h.types.OAI_PRESET_CHANGED_BEFORE);
    h.edit('2048', { source: 'preset' });
    h.events.emit(h.types.OAI_PRESET_CHANGED_AFTER);
    h.flush();
    assert.equal(h.settings.openai_max_tokens, 2048);
    assert.deepEqual(h.writes, []);
    runtime.dispose();
});

test('temporary generation budgets and unrelated settings saves cannot replace the saved preference', () => {
    const h = fixture();
    const runtime = h.start();
    h.events.emit(h.types.APP_READY);
    h.flush();
    h.settings.openai_max_tokens = 128; // Native TempResponseLength changes only the request setting.
    h.events.emit('SETTINGS_UPDATED');
    h.events.emit('CHATCOMPLETION_MODEL_CHANGED');
    assert.equal(h.memory.tokens, 16000);
    assert.equal(h.settings.openai_max_tokens, 128, 'generation-only overrides must still work');
    runtime.dispose();
});

test('invalid backups and partial numeric edits do not become a persisted response limit', () => {
    for (const tokens of [0, -1, NaN, Infinity, 1.5, '16000', null]) {
        const h = fixture({ memory: { preset: 'Nemo', tokens } });
        const runtime = h.start();
        h.events.emit(h.types.APP_READY);
        h.flush();
        assert.equal(h.settings.openai_max_tokens, 16000);
        for (const value of ['', '-', '0', '-4', '1.5', 'not a number']) h.edit(value);
        assert.equal(h.memory.tokens, 16000);
        runtime.dispose();
    }
});

test('cleanup removes every hook and cancels pending work without deleting the persisted value', () => {
    const h = fixture({ memory: { preset: 'Nemo', tokens: 24000 } });
    const runtime = h.start();
    h.events.emit(h.types.APP_READY);
    runtime.dispose();
    runtime.dispose();
    h.flush();
    assert.equal(h.subscribed, false);
    assert.equal(h.events.eventNames().length, 0);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.memory, { preset: 'Nemo', tokens: 24000 });
});

test('production adapter persists normal input/change events and reconnects the UI on fresh boots', () => {
    const source = readFileSync(new URL('../features/response-tokens/runtime.js', import.meta.url), 'utf8')
        .replace(/^import .*;$/gm, '').replace(/^export /gm, '');
    let disk = { oai_settings: initial, extension_settings: { NemoPresetExt: { enableReSwipe: true } } };
    for (let boot = 0; boot < 2; boot++) {
        const h = fixture({ live: { ...initial, openai_max_tokens: 300 }, startup: disk.oai_settings });
        const extensions = structuredClone(disk.extension_settings);
        const document = {};
        const delegated = new Set();
        let shown = '300', saves = 0;
        const notify = (value, data, user = false) => {
            h.settings.openai_max_tokens = Number(value); // Native input handler.
            for (const listener of delegated) listener({ target: { value }, originalEvent: { isTrusted: user } }, data);
        };
        const jquery = target => target === document ? {
            on(events, selector, handler) { assert.equal(selector, '#openai_max_tokens'); delegated.add(handler); },
            off(events, selector, handler) { delegated.delete(handler); },
        } : {
            val(value) { shown = String(value); return this; },
            trigger(name, data) { assert.equal(name, 'input'); notify(shown, data); return this; },
        };
        const api = new Script(source + '\n({ initializeResponseTokens, cleanupResponseTokens })').runInNewContext({
            eventSource: h.events, event_types: h.types, oai_settings: h.settings,
            savedSettings: structuredClone(disk), extension_settings: extensions,
            NEMO_EXTENSION_NAME: 'NemoPresetExt', saveSettingsDebounced() { saves++; },
            createResponseTokensRuntime: options => createResponseTokensRuntime({
                ...options, schedule: h.options.schedule, cancel: h.options.cancel,
            }),
            document, $: jquery,
        });
        api.initializeResponseTokens();
        api.initializeResponseTokens();
        assert.equal(delegated.size, 1);
        h.events.emit(h.types.APP_READY);
        h.flush();
        assert.equal(h.settings.openai_max_tokens, boot === 0 ? 16000 : 24000);
        assert.equal(shown, String(h.settings.openai_max_tokens));
        notify('24000', undefined, true);
        assert.equal(extensions.NemoPresetExt.responseTokens.tokens, 24000);
        assert.ok(saves > 0);
        disk = JSON.parse(JSON.stringify({ oai_settings: h.settings, extension_settings: extensions }));
        assert.equal(disk.extension_settings.NemoPresetExt.enableReSwipe, true);
        api.cleanupResponseTokens();
        assert.equal(delegated.size, 0);
        assert.equal(h.events.eventNames().length, 0);
        disk.oai_settings.openai_max_tokens = 300;
    }
});
