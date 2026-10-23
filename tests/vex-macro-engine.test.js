import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requireNativeVexMacros } from '../features/vex-runtime/macro-engine.js';
import { createVexRuntime } from '../features/vex-runtime/controller.js';
import { ASSEMBLE, BANKS, RESET } from '../features/vex-runtime/format.js';
import { fixture, harness, TYPES } from './vex-runtime-fixture.mjs';

const recovery = /Enable "Experimental Macro Engine" in User Settings, then fully reload/;
const supported = () => 'nemo-vex-native-ready';

test('legacy macro engine is rejected without running a probe or changing settings', () => {
    const settings = { experimental_macro_engine: false };
    assert.throws(() => requireNativeVexMacros({ powerUserSettings: settings,
        substituteParams() { assert.fail('Disabled engine must not be probed'); },
    }), recovery);
    assert.deepEqual(settings, { experimental_macro_engine: false });
});

test('native probe uses only nested conditionals, without accessing chat variables', () => {
    requireNativeVexMacros({ powerUserSettings: { experimental_macro_engine: true },
        variables: new Proxy({}, { get() { assert.fail('Probe must not access variables'); } }),
        substituteParams(text) {
            assert.equal(text, '{{#if 1}}{{#if 0}}unsupported{{else}}nemo-vex-native-ready{{/if}}{{/if}}');
            return supported();
        },
    });
});

test('forks without the setting can demonstrate native support through the probe', () => {
    assert.doesNotThrow(() => requireNativeVexMacros({ substituteParams: supported }));
    assert.doesNotThrow(() => requireNativeVexMacros({ powerUserSettings: { experimental_macro_engine: true } }));
    assert.throws(() => requireNativeVexMacros({}), /update SillyTavern first/);
});

for (const substituteParams of [text => text, () => '', () => { throw new Error('Engine unavailable'); }]) {
    test('an enabled setting cannot hide a failing native macro engine', () => {
        assert.throws(() => requireNativeVexMacros({
            powerUserSettings: { experimental_macro_engine: true }, substituteParams,
        }), recovery);
    });
}

function withEngine() {
    const settings = { experimental_macro_engine: true };
    const h = harness(undefined, undefined, {
        checkMacroEngine: () => requireNativeVexMacros({ powerUserSettings: settings, substituteParams: supported }),
    });
    return { h, settings };
}

test('portable import with a disabled engine retains every original byte and makes no storage writes', async () => {
    const { h, settings } = withEngine();
    const original = JSON.stringify(h.f.preset);
    settings.experimental_macro_engine = false;
    try {
        await h.runtime.importReady({ data: h.f.preset });
        assert.equal(JSON.stringify(h.f.preset), original);
        assert.equal(h.io.calls.length, 0);
        assert.match(h.runtime.getStats().compatibility.reason, recovery);
        assert(h.notices.some(([message, level]) => level === 'warning' && recovery.test(message)));
    } finally { h.runtime.dispose(); }
});

test('cached preparation checks engine changes before loading or running native prompts', async () => {
    const { h, settings } = withEngine();
    try {
        await h.import();
        const requests = h.io.calls.length;
        settings.experimental_macro_engine = false;
        await assert.rejects(h.runtime.ready(), recovery);
        assert.equal(h.io.calls.length, requests);
        assert.throws(() => h.manager.preparePrompt(h.f.preset.prompts.find(p => p.identifier === RESET)), recovery);
        assert.equal(h.seen.length, 0);
        assert.deepEqual({ ...h.state }, {});
    } finally { h.runtime.dispose(); }
});

test('failed preflight aborts serialization, then a supported retry clears the old fault on a cache hit', async () => {
    const { h, settings } = withEngine();
    try {
        await h.import();
        settings.experimental_macro_engine = false;
        let aborted = false;
        assert.equal(await h.runtime.preflight([], 1, () => { aborted = true; }, 'normal'), false);
        assert.equal(aborted, true);
        const blocked = { messages: [] };
        await h.events.emit(TYPES.CHAT_COMPLETION_SETTINGS_READY, blocked);
        assert.throws(() => JSON.stringify(blocked), recovery);

        settings.experimental_macro_engine = true;
        await h.runtime.ready();
        h.generate();
        const request = { messages: [] };
        await h.events.emit(TYPES.CHAT_COMPLETION_SETTINGS_READY, request);
        assert.doesNotThrow(() => JSON.stringify(request));
        assert.equal(h.state.VexPersona, 'First 🧩 original.');
    } finally { h.runtime.dispose(); }
});

test('portable full and partial exports remain available with the macro engine disabled', async () => {
    const { h, settings } = withEngine(), original = structuredClone(h.f.preset);
    try {
        await h.import();
        settings.experimental_macro_engine = false;
        const copy = structuredClone(h.f.preset);
        await h.runtime.exportReady(copy);
        assert.deepEqual(copy, original);
        const partial = await h.manager.export({ prompts: h.f.preset.prompts.filter(p => p.identifier === BANKS[0]) });
        assert.deepEqual(partial.prompts, original.prompts.filter(p => p.identifier === BANKS[0]));
    } finally { h.runtime.dispose(); }
});

test('a successful engine check and cache hit do not forgive genuine route divergence', async () => {
    const { h } = withEngine();
    try {
        await h.import();
        h.generate();
        h.state.NVCR1_code = 'wrong';
        assert.throws(() => h.manager.preparePrompt(h.f.preset.prompts.find(p => p.identifier === ASSEMBLE)), /diverged/);
        await h.runtime.ready();
        const request = { messages: [] };
        await h.events.emit(TYPES.CHAT_COMPLETION_SETTINGS_READY, request);
        assert.throws(() => JSON.stringify(request), /diverged/);
    } finally { h.runtime.dispose(); }
});

test('unrelated presets do not require the Vex macro engine', async () => {
    const { h, settings } = withEngine();
    settings.experimental_macro_engine = false;
    try {
        const unrelated = { prompts: [], prompt_order: [] };
        await h.runtime.importReady({ data: unrelated });
        assert.equal(await h.runtime.ready(unrelated), null);
        assert.equal(h.io.calls.length, 0);
    } finally { h.runtime.dispose(); }
});

test('legacy single-pass regex semantics reproduce NVCR1_code divergence independently of preflight', async () => {
    const h = harness(fixture());
    h.runtime.dispose();
    // SillyTavern release/public/scripts/variables.js at 06bde939fb1e:
    // the legacy variable macros run setvar, addvar, then getvar, once each.
    // This deliberately does not use Nemo's compile/execute implementation.
    h.manager.preparePrompt = prompt => ({ ...prompt, content: prompt.content
        .replace(/{{setvar::([^:]+)::([^}]*)}}/gi, (_, name, value) => { h.state[name.trim()] = value; return ''; })
        .replace(/{{addvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => { h.state[name.trim()] = Number(h.state[name.trim()] || 0) + Number(value); return ''; })
        .replace(/{{getvar::([^}]+)}}/gi, (_, name) => h.context.variables.local.get(name.trim())),
    });
    const runtime = createVexRuntime({ events: h.events, types: TYPES, getManager: () => h.manager,
        getContext: () => h.context, store: h.io.store, validate: h.f.validate, planImport: h.f.planImport,
    });
    try {
        await runtime.importReady({ data: h.f.preset });
        await runtime.ready();
        assert.throws(() => h.generate(), /native Vex route diverged at NVCR1_code/);
        assert.equal(h.state.NVCR1_code, 'x{{getvar::NVCR1_state_happy');
    } finally { runtime.dispose(); }
});

test('production adapter supplies the native host compatibility check', () => {
    const source = readFileSync(new URL('../features/vex-runtime/runtime.js', import.meta.url), 'utf8');
    assert.match(source, /checkMacroEngine: \(\) => requireNativeVexMacros\(getContext\(\)\)/);
});
