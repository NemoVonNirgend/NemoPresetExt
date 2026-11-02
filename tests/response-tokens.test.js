import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';
import { createResponseTokensRuntime } from '../features/response-tokens/controller.js';
import { createFinalUserRoleRuntime } from '../features/final-user-role/controller.js';

const initial = { preset_settings_openai: 'Nemo', openai_max_tokens: 16000 };

function fixture({ live = initial, startup = initial, memory } = {}) {
    const settings = structuredClone(live);
    const saved = structuredClone(startup);
    const events = new EventEmitter();
    const types = Object.fromEntries(['APP_READY', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'CHAT_COMPLETION_SETTINGS_READY', 'GENERATION_STARTED', 'CHAT_COMPLETION_PROMPT_READY'].map(key => [key, key]));
    const writes = [], saves = [], timers = new Map();
    let stored = structuredClone(memory), input, nextTimer = 0, shown = String(settings.openai_max_tokens);
    const options = {
        events, types, getSettings: () => settings, getStartupSettings: () => saved,
        getDisplayedTokens: () => Number(shown),
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

const mainRequest = (type = 'normal', field = 'max_tokens') => ({
    type, messages: [{ role: 'assistant', content: 'Reply.' }], stream: true,
    model: 'gemini-4-argon', [field]: 1200,
});
const outgoing = request => JSON.parse(JSON.stringify(request));

test('overlapping temporary helpers cannot leak 1200 into a foreground request displaying 64000', () => {
    const h = fixture({ live: { ...initial, openai_max_tokens: 64000 }, startup: { ...initial, openai_max_tokens: 64000 } });
    const runtime = h.start();
    h.events.emit(h.types.APP_READY);
    h.flush();

    // Native TempResponseLength stores one original value. A nested save replaces
    // 64000 with 1200 as the original, so a double restore can leave 1200 behind.
    let original = -1;
    const save = tokens => { original = h.settings.openai_max_tokens; h.settings.openai_max_tokens = tokens; };
    const restore = () => { if (original !== -1) { h.settings.openai_max_tokens = original; original = -1; } };
    save(1200); save(1200); restore(); restore();
    assert.equal(h.settings.openai_max_tokens, 1200);
    assert.equal(h.shown, '64000');

    const reply = mainRequest();
    const quiet = mainRequest('quiet');
    h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, quiet);
    h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, reply);
    assert.equal(outgoing(reply).max_tokens, 64000);
    assert.equal(outgoing(quiet).max_tokens, 1200);
    assert.equal(reply.max_tokens, 1200, 'repair only the outgoing copy');
    assert.equal(h.settings.openai_max_tokens, 1200, 'do not alter a concurrent helper shared budget');
    assert.equal(h.memory.tokens, 64000);
    runtime.dispose();
});

test('all normal reply modes and both native token fields use the displayed budget', () => {
    for (const type of ['normal', 'continue', 'swipe', 'regenerate', 'impersonate', 'append']) {
        for (const field of ['max_tokens', 'max_completion_tokens']) {
            const h = fixture();
            const runtime = h.start();
            const request = mainRequest(type, field);
            const keys = Object.keys(request);
            h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
            const sent = outgoing(request);
            assert.equal(sent[field], 16000);
            assert.equal(Object.hasOwn(sent, field === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens'), false);
            assert.deepEqual(sent.messages, request.messages);
            assert.deepEqual(Object.keys(request), keys, 'the serializer is non-enumerable');
            runtime.dispose();
        }
    }
});

test('late request listeners cannot reintroduce the small leaked budget', () => {
    const h = fixture();
    const runtime = h.start();
    h.events.on(h.types.CHAT_COMPLETION_SETTINGS_READY, request => { request.max_tokens = 1200; });
    const request = mainRequest();
    h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.equal(outgoing(request).max_tokens, 16000);
    runtime.dispose();
});

test('quiet, unknown and untyped helpers keep their explicit token budgets', () => {
    const h = fixture();
    const runtime = h.start();
    for (const type of ['quiet', 'background', 'summary', '', undefined, null]) {
        const request = mainRequest();
        request.type = type;
        h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
        assert.equal(outgoing(request).max_tokens, 1200);
        assert.equal(Object.hasOwn(request, 'toJSON'), false);
    }
    const custom = { type: 'normal', max_output_tokens: 1200 };
    h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, custom);
    assert.deepEqual(outgoing(custom), { type: 'normal', max_output_tokens: 1200 });
    runtime.dispose();
});

test('the saved preference is a fallback only for its own preset when the control is unavailable', () => {
    for (const preset of ['Nemo', 'Other preset']) {
        const h = fixture({ memory: { preset, tokens: 64000 } });
        h.options.getDisplayedTokens = () => NaN;
        const runtime = h.start();
        const request = mainRequest();
        h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
        assert.equal(outgoing(request).max_tokens, preset === 'Nemo' ? 64000 : 1200);
        runtime.dispose();
    }
});

test('serialization blockers and earlier custom serialization remain authoritative', () => {
    const h = fixture();
    const runtime = h.start();
    const blocked = { ...mainRequest(), toJSON() { throw new Error('Native integrity check failed'); } };
    h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, blocked);
    assert.throws(() => outgoing(blocked), /Native integrity check failed/);
    const customized = { ...mainRequest(), toJSON() { return { ...this, customField: 'preserved' }; } };
    h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, customized);
    assert.equal(outgoing(customized).customField, 'preserved');
    assert.equal(outgoing(customized).max_tokens, 16000);
    for (const value of [null, false, 'blocked']) {
        const request = { ...mainRequest(), toJSON() { return value; } };
        h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
        assert.equal(outgoing(request), value);
    }
    runtime.dispose();
});

test('request reuse updates the captured budget without stacking the same serializer', () => {
    const h = fixture();
    const runtime = h.start();
    const request = mainRequest();
    h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
    const serializer = request.toJSON;
    h.edit('32000');
    h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.equal(request.toJSON, serializer);
    assert.equal(outgoing(request).max_tokens, 32000);
    runtime.dispose();
    assert.equal(outgoing(request).max_tokens, 1200, 'cleanup disables existing guards');
});

test('request-budget correction composes with the final-user-role serializer in either order', () => {
    for (const roleFirst of [true, false]) {
        const h = fixture();
        const role = () => createFinalUserRoleRuntime({ events: h.events, types: h.types, getSettings: () => ({ forceLastUserRole: true }) });
        const first = roleFirst ? role() : h.start();
        const second = roleFirst ? h.start() : role();
        const request = mainRequest();
        h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
        const sent = outgoing(request);
        assert.equal(sent.max_tokens, 16000);
        assert.equal(sent.messages.at(-1).role, 'user');
        first.dispose(); second.dispose();
    }
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
            shown = String(value);
            h.settings.openai_max_tokens = Number(value); // Native input handler.
            for (const listener of delegated) listener({ target: { value }, originalEvent: { isTrusted: user } }, data);
        };
        const jquery = target => target === document ? {
            on(events, selector, handler) { assert.equal(selector, '#openai_max_tokens'); delegated.add(handler); },
            off(events, selector, handler) { delegated.delete(handler); },
        } : {
            val(value) { if (!arguments.length) return shown; shown = String(value); return this; },
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
        h.settings.openai_max_tokens = 1200;
        const request = mainRequest();
        const quiet = mainRequest('quiet');
        h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, request);
        h.events.emit(h.types.CHAT_COMPLETION_SETTINGS_READY, quiet);
        assert.equal(outgoing(request).max_tokens, 24000);
        assert.equal(outgoing(quiet).max_tokens, 1200);
        assert.ok(saves > 0);
        disk = JSON.parse(JSON.stringify({ oai_settings: h.settings, extension_settings: extensions }));
        assert.equal(disk.extension_settings.NemoPresetExt.enableReSwipe, true);
        api.cleanupResponseTokens();
        assert.equal(delegated.size, 0);
        assert.equal(h.events.eventNames().length, 0);
        disk.oai_settings.openai_max_tokens = 300;
    }
});
