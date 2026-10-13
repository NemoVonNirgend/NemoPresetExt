import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';
import { applySettingsSchema } from '../core/feature-settings.js';
import { createFinalUserRoleRuntime, forceFinalUserRole } from '../features/final-user-role/controller.js';

// Native ST events await each listener and snapshot the order before dispatch.
class Events {
    handlers = new Map();
    on(type, fn) { this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]); }
    removeListener(type, fn) { this.handlers.set(type, (this.handlers.get(type) ?? []).filter(listener => listener !== fn)); }
    makeLast(type, fn) { this.removeListener(type, fn); this.on(type, fn); }
    async emit(type, ...args) { for (const fn of [...(this.handlers.get(type) ?? [])]) await fn(...args); }
    count() { return [...this.handlers.values()].reduce((sum, listeners) => sum + listeners.length, 0); }
}
const types = Object.fromEntries(['APP_READY', 'GENERATION_STARTED', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY'].map(key => [key, key]));
const serialize = request => JSON.parse(JSON.stringify(request));
const baseMessages = () => [{ role: 'system', content: 'System instructions' }, { role: 'user', content: 'Player action' }];
function setup(settings = { forceLastUserRole: true }) {
    const events = new Events();
    const state = { settings };
    const runtime = createFinalUserRoleRuntime({ events, types, getSettings: () => state.settings });
    return { events, state, runtime };
}

for (const role of ['system', 'assistant', 'developer']) {
    test(`only the final ${role} prompt changes role; its text and earlier messages survive`, () => {
        const earlier = baseMessages();
        const tail = Object.freeze({ role, content: 'Final instruction\nwith whitespace  ', name: 'origin' });
        const source = Object.freeze([...earlier, tail]);
        const request = { messages: source, temperature: 0.8 };
        assert.equal(forceFinalUserRole(request), true);
        assert.deepEqual(request.messages, [...earlier, { ...tail, role: 'user' }]);
        assert.equal(request.messages[0], earlier[0]);
        assert.equal(source.at(-1).role, role);
        assert.equal(request.temperature, 0.8);
    });
}

test('multimodal message content survives conversion without flattening or reordering', () => {
    const content = [{ type: 'text', text: 'Inspect this' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }];
    const request = { messages: [{ role: 'assistant', content, prefix: true, reasoning: 'private', signature: 'assistant-signature' }] };
    forceFinalUserRole(request);
    assert.equal(request.messages[0].content, content);
    assert.deepEqual(request.messages[0], { role: 'user', content });
});

test('Claude Start reply with is the actual last message and is sent once as user', () => {
    const source = [...baseMessages(), { role: 'assistant', content: 'Earlier assistant prompt' }];
    const request = { messages: source, assistant_prefill: '<think>\n  ' };
    forceFinalUserRole(request);
    assert.deepEqual(request.messages, [...source, { role: 'user', content: '<think>\n  ' }]);
    assert.equal(request.assistant_prefill, undefined);
    assert.equal(forceFinalUserRole(request), false);
    assert.equal(request.messages.length, source.length + 1);
});

test('a terminal tool result keeps its protocol pairing and supplies the final user content', () => {
    const source = [...baseMessages(),
        { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'call_1', content: 'Lookup result' },
    ];
    const request = { messages: source };
    forceFinalUserRole(request);
    assert.deepEqual(request.messages, [...source, { role: 'user', content: 'Lookup result' }]);
    assert.equal(request.messages[2], source[2]);
    assert.equal(request.messages[3], source[3]);
    assert.equal(forceFinalUserRole(request), false);
});

test('already-user, empty and invalid requests do not manufacture placeholder content', () => {
    for (const request of [undefined, {}, { messages: 'plain text' }, { messages: [] }, { messages: [null] }, { messages: [[]] }, { messages: [{ role: 'user', content: '' }] }]) {
        const before = structuredClone(request);
        assert.equal(forceFinalUserRole(request), false);
        assert.deepEqual(request, before);
    }
});

test('whitespace and empty content count as the last message; the override does not search backward', () => {
    const request = { messages: [...baseMessages(), { role: 'system', content: '' }] };
    forceFinalUserRole(request);
    assert.deepEqual(request.messages.at(-1), { role: 'user', content: '' });
});

test('the schema defaults off and retains an explicitly enabled toggle across reloads', () => {
    const defaults = applySettingsSchema({});
    assert.equal(defaults.forceLastUserRole, false);
    const enabled = applySettingsSchema({ forceLastUserRole: true });
    assert.equal(applySettingsSchema(JSON.parse(JSON.stringify(enabled))).forceLastUserRole, true);
});

test('disabled and non-boolean settings leave the full request and its serializer untouched', async () => {
    for (const enabled of [undefined, false, 1, 'true']) {
        const { events, runtime } = setup({ forceLastUserRole: enabled });
        const request = { messages: [{ role: 'assistant', content: 'Prefix' }], assistant_prefill: 'Start here' };
        const before = structuredClone(request);
        await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
        assert.equal(Object.hasOwn(request, 'toJSON'), false);
        assert.deepEqual(serialize(request), before);
        runtime.dispose();
    }
});

test('the serialization boundary includes prompts appended by a later async extension listener', async () => {
    const { events, runtime } = setup();
    const request = { messages: baseMessages(), stream: true };
    const original = structuredClone(request);
    events.on(types.CHAT_COMPLETION_SETTINGS_READY, async data => {
        await Promise.resolve();
        data.messages = [...data.messages, { role: 'system', content: 'Injected lorebook/extension prompt' }];
    });
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
    const outgoing = serialize(request);
    assert.deepEqual(outgoing.messages, [...original.messages, { role: 'user', content: 'Injected lorebook/extension prompt' }]);
    assert.deepEqual(request.messages.at(-1), { role: 'system', content: 'Injected lorebook/extension prompt' });
    assert.equal(Object.keys(request).includes('toJSON'), false);
    assert.equal(Object.hasOwn(outgoing, 'toJSON'), false);
    assert.equal(outgoing.stream, true);
    runtime.dispose();
});

test('a late extension prefill wins over the original tail without changing that earlier role', async () => {
    const { events, runtime } = setup();
    const request = { messages: [...baseMessages(), { role: 'assistant', content: 'Previous tail' }] };
    events.on(types.CHAT_COMPLETION_SETTINGS_READY, data => { data.assistant_prefill = 'Late Start reply with'; });
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
    const outgoing = serialize(request);
    assert.equal(outgoing.messages.at(-2).role, 'assistant');
    assert.deepEqual(outgoing.messages.at(-1), { role: 'user', content: 'Late Start reply with' });
    assert.equal(Object.hasOwn(outgoing, 'assistant_prefill'), false);
    assert.equal(request.assistant_prefill, 'Late Start reply with');
    runtime.dispose();
});

test('toggling the current namespace applies to the next request without reinitializing', async () => {
    const { events, state, runtime } = setup({ forceLastUserRole: false });
    const request = () => ({ messages: [{ role: 'assistant', content: 'Continue from here' }] });
    const first = request();
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, first);
    assert.equal(serialize(first).messages.at(-1).role, 'assistant');
    state.settings = { forceLastUserRole: true };
    const second = request();
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, second);
    assert.equal(serialize(second).messages.at(-1).role, 'user');
    state.settings.forceLastUserRole = false;
    assert.equal(serialize(second).messages.at(-1).role, 'assistant');
    runtime.dispose();
});

test('normal, swipe, continue, impersonate, quiet and raw requests use the same final boundary', async () => {
    const { events, runtime } = setup();
    for (const type of ['normal', 'swipe', 'continue', 'impersonate', 'quiet', 'raw']) {
        const chat = [...baseMessages(), { role: 'assistant', content: `${type} tail` }];
        await events.emit(types.GENERATION_STARTED, type);
        await events.emit(types.CHAT_COMPLETION_PROMPT_READY, { chat, dryRun: false });
        assert.equal(chat.at(-1).role, 'assistant');
        const request = { messages: chat, stream: type !== 'quiet' };
        await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
        assert.equal(serialize(request).messages.at(-1).role, 'user');
        assert.equal(chat.at(-1).role, 'assistant');
    }
    runtime.dispose();
});

test('raw requests with only the settings-ready event are also covered', async () => {
    const { events, runtime } = setup();
    const request = { messages: [{ role: 'system', content: 'Summarize this' }] };
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.deepEqual(serialize(request).messages, [{ role: 'user', content: 'Summarize this' }]);
    runtime.dispose();
});

test('repeated events and serialization do not duplicate the prefill', async () => {
    const { events, runtime } = setup();
    const request = { messages: baseMessages(), assistant_prefill: 'Prefill' };
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
    const guard = request.toJSON;
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.equal(request.toJSON, guard);
    assert.deepEqual(serialize(request), serialize(request));
    assert.equal(serialize(request).messages.length, 3);
    assert.equal(request.messages.length, 2);
    runtime.dispose();
});

test('pre-existing serializers still run and their final content is converted', async () => {
    const { events, runtime } = setup();
    const request = {
        messages: baseMessages(),
        toJSON(key) {
            assert.equal(this, request);
            assert.equal(key, '');
            return { messages: [...this.messages, { role: 'system', content: 'Serializer injection' }], custom: 'preserved' };
        },
    };
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
    const outgoing = serialize(request);
    assert.deepEqual(outgoing.messages.at(-1), { role: 'user', content: 'Serializer injection' });
    assert.equal(outgoing.custom, 'preserved');
    runtime.dispose();
});

test('required-source serialization blockers are preserved both before and after the hook', async () => {
    for (const late of [false, true]) {
        const { events, runtime } = setup();
        const block = () => { throw new Error('Required prompt source missing'); };
        const request = { messages: baseMessages() };
        if (late) events.on(types.CHAT_COMPLETION_SETTINGS_READY, data => { data.toJSON = block; });
        else request.toJSON = block;
        await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
        assert.throws(() => JSON.stringify(request), /Required prompt source missing/);
        runtime.dispose();
    }
});

test('cleanup removes hooks and deactivates guards on queued requests', async () => {
    const { events, runtime } = setup();
    const request = { messages: [{ role: 'system', content: 'Tail' }] };
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.equal(serialize(request).messages.at(-1).role, 'user');
    runtime.dispose(); runtime.dispose();
    assert.equal(events.count(), 0);
    assert.equal(serialize(request).messages.at(-1).role, 'system');
    await events.emit(types.GENERATION_STARTED);
    assert.equal(events.count(), 0);
});

test('hosts without makeLast still enforce the final serialized role', async () => {
    const events = new Events();
    events.makeLast = undefined;
    const runtime = createFinalUserRoleRuntime({ events, types, getSettings: () => ({ forceLastUserRole: true }) });
    const request = { messages: baseMessages() };
    await events.emit(types.GENERATION_STARTED);
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.equal(serialize(request).messages.at(-1).role, 'user');
    runtime.dispose();
    assert.equal(events.count(), 0);
});

test('missing request events leave unsupported hosts untouched', () => {
    const events = new Events();
    const runtime = createFinalUserRoleRuntime({ events, types: {}, getSettings: () => ({ forceLastUserRole: true }) });
    assert.equal(events.count(), 0);
    runtime.dispose();
});

test('the native checkbox displays, persists and disables the live setting', () => {
    const settings = applySettingsSchema({ forceLastUserRole: true });
    const handlers = new Map();
    const input = { checked: false, addEventListener: (type, fn) => handlers.set(type, fn) };
    let saves = 0;
    const source = readFileSync(new URL('../ui/settings-ui.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
    const ui = new Script(`${source}\nNemoSettingsUI;`).runInNewContext({
        extension_settings: { NemoPresetExt: settings }, NEMO_EXTENSION_NAME: 'NemoPresetExt',
        document: { getElementById: id => id === 'nemoForceLastUserRole' ? input : null },
        saveSettings: () => { saves++; }, saveSettingsDebounced: () => { saves++; },
    });
    ui._bindCoreSettings();
    assert.equal(input.checked, true);
    input.checked = false; handlers.get('change')();
    assert.equal(settings.forceLastUserRole, false);
    input.checked = true; handlers.get('change')();
    assert.equal(settings.forceLastUserRole, true);
    assert.equal(saves, 4);
});

test('the production runtime initializes once and can restart cleanly after teardown', async () => {
    const events = new Events();
    const source = readFileSync(new URL('../features/final-user-role/runtime.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
    const api = new Script(`${source}\n({ initializeFinalUserRole, cleanupFinalUserRole });`).runInNewContext({
        eventSource: events, event_types: types, extension_settings: { NemoPresetExt: { forceLastUserRole: true } },
        NEMO_EXTENSION_NAME: 'NemoPresetExt', createFinalUserRoleRuntime,
    });
    api.initializeFinalUserRole();
    const count = events.count();
    api.initializeFinalUserRole();
    assert.equal(events.count(), count);
    api.cleanupFinalUserRole();
    assert.equal(events.count(), 0);
    api.initializeFinalUserRole();
    const request = { messages: [{ role: 'assistant', content: 'Tail' }] };
    await events.emit(types.CHAT_COMPLETION_SETTINGS_READY, request);
    assert.equal(serialize(request).messages[0].role, 'user');
    api.cleanupFinalUserRole();
    assert.equal(events.count(), 0);
});
