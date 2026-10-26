import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { applySettingsSchema } from '../core/feature-settings.js';
import {
    DEFAULT_RESWIPE_INSTRUCTION, RESWIPE_MARKER, buildReSwipeGuidance,
    createReSwipeRuntime, getReSwipeInstruction, injectRejectedSwipe,
} from '../features/reswipe/controller.js';

function fixture(settings = { enableReSwipe: true }) {
    const chat = [
        { name: 'You', is_user: true, mes: 'What happens next?' },
        {
            name: 'Character', is_user: false, mes: 'The rejected answer.',
            swipe_id: 1, swipes: ['The rejected answer.'],
            extra: { reasoning: 'Private reasoning', tool_invocations: [{ name: 'tool' }], media: [{ url: 'attachment' }] },
        },
    ];
    return { context: { chat, name1: 'You' }, prompt: [structuredClone(chat[0])], settings };
}

test('ReSwipe defaults off for new namespaces and upgrades; explicit opt-in survives reload', () => {
    for (const source of [{}, { _settingsSchemaVersion: 5, forceLastUserRole: true }]) {
        const settings = applySettingsSchema(source);
        assert.equal(settings.enableReSwipe, false);
        assert.equal(settings.reSwipeInstruction, '');
        const { context, prompt } = fixture();
        assert.equal(injectRejectedSwipe(prompt, context, 'swipe', settings), false);
    }
    const enabled = applySettingsSchema({ enableReSwipe: true, reSwipeInstruction: 'Try another opening.' });
    assert.deepEqual(applySettingsSchema(JSON.parse(JSON.stringify(enabled))), enabled);
});

test('only explicit boolean true opts in', () => {
    for (const value of [undefined, null, false, 1, 'true', 'false']) {
        const { context, prompt } = fixture();
        assert.equal(injectRejectedSwipe(prompt, context, 'swipe', { enableReSwipe: value }), false);
        assert.equal(prompt.length, 1);
    }
});

test('new swipe gets one user message with the complete rejected response and default instructions', () => {
    const { context, prompt, settings } = fixture();
    assert.equal(injectRejectedSwipe(prompt, context, 'swipe', settings), true);
    assert.equal(prompt.length, 2);
    assert.equal(prompt[1].is_user, true);
    assert.equal(prompt[1].is_system, false);
    assert.equal(prompt[1].name, 'You');
    assert.ok(prompt[1].mes.includes(DEFAULT_RESWIPE_INSTRUCTION));
    assert.ok(prompt[1].mes.includes(context.chat.at(-1).mes));
});

test('saved chat, swipe history, settings, and existing prompt entries remain unchanged', () => {
    const { context, prompt, settings } = fixture();
    const before = structuredClone({ context, prompt, settings });
    injectRejectedSwipe(prompt, context, 'swipe', settings);
    assert.deepEqual(context, before.context);
    assert.deepEqual(settings, before.settings);
    assert.deepEqual(prompt.slice(0, -1), before.prompt);
    const injected = JSON.stringify(prompt.at(-1));
    for (const value of ['Private reasoning', 'attachment', 'tool_invocations', 'swipe_id', 'swipes']) {
        assert.equal(injected.includes(value), false);
    }
});

test('refuses to mutate a live chat array from an incompatible host', () => {
    const { context, settings } = fixture();
    const before = structuredClone(context.chat);
    assert.equal(injectRejectedSwipe(context.chat, context, 'swipe', settings), false);
    assert.deepEqual(context.chat, before);
});

test('repeated calls and a standalone prototype injection cannot duplicate guidance', () => {
    const { context, prompt, settings } = fixture();
    assert.equal(injectRejectedSwipe(prompt, context, 'swipe', settings), true);
    assert.equal(injectRejectedSwipe(prompt, context, 'swipe', settings), false);
    assert.equal(prompt.length, 2);
    const prior = [{ is_user: true, mes: 'Standalone guidance', extra: { [RESWIPE_MARKER]: true } }];
    assert.equal(injectRejectedSwipe(prior, context, 'swipe', settings), false);
    assert.equal(prior.length, 1);
});

test('uses the visible edited response, including generation from an earlier selected swipe', () => {
    const { context, prompt, settings } = fixture();
    Object.assign(context.chat.at(-1), {
        mes: 'An edited first swipe.', swipe_id: 0,
        swipes: ['An unedited first swipe.', 'A later saved swipe.'],
    });
    injectRejectedSwipe(prompt, context, 'swipe', settings);
    assert.ok(prompt.at(-1).mes.includes('An edited first swipe.'));
    assert.equal(prompt.at(-1).mes.includes('A later saved swipe.'), false);
    assert.equal(prompt.at(-1).mes.includes('An unedited first swipe.'), false);
});

test('each new swipe includes only the newly rejected response', () => {
    const { context, prompt, settings } = fixture();
    injectRejectedSwipe(prompt, context, 'swipe', settings);
    context.chat.at(-1).mes = 'The second rejected response.';
    const nextPrompt = [structuredClone(context.chat[0])];
    injectRejectedSwipe(nextPrompt, context, 'swipe', settings);
    assert.ok(nextPrompt.at(-1).mes.includes('The second rejected response.'));
    assert.equal(nextPrompt.at(-1).mes.includes('The rejected answer.'), false);
});

for (const type of [undefined, 'normal', 'continue', 'regenerate', 'quiet', 'impersonate']) {
    test(`leaves ${String(type)} generations unchanged even after a failed swipe`, () => {
        const { context, prompt, settings } = fixture();
        injectRejectedSwipe(prompt, context, 'swipe', settings);
        const next = [structuredClone(context.chat[0])];
        assert.equal(injectRejectedSwipe(next, context, type, settings), false);
        assert.deepEqual(next, [context.chat[0]]);
    });
}

test('instructions support customization and fall back safely for blank or malformed values', () => {
    for (const reSwipeInstruction of ['', ' \n ', null, 17, {}]) {
        const source = { reSwipeInstruction };
        const before = structuredClone(source);
        assert.equal(getReSwipeInstruction(source), DEFAULT_RESWIPE_INSTRUCTION);
        assert.deepEqual(source, before);
    }
    const { context, prompt, settings } = fixture({ enableReSwipe: true, reSwipeInstruction: 'Try another opening.' });
    injectRejectedSwipe(prompt, context, 'swipe', settings);
    assert.ok(prompt.at(-1).mes.startsWith('Try another opening.'));
});

test('empty chats, user/system tails, and missing text are ignored', () => {
    const { context, settings } = fixture();
    for (const tail of [undefined, { is_user: true, mes: 'User' }, { is_system: true, mes: 'System' }, { mes: '' }, { mes: ' \n' }, { mes: null }, { mes: 42 }]) {
        const prompt = [];
        context.chat = tail ? [tail] : [];
        assert.equal(injectRejectedSwipe(prompt, context, 'swipe', settings), false);
        assert.deepEqual(prompt, []);
    }
    assert.equal(injectRejectedSwipe(null, context, 'swipe', settings), false);
    assert.equal(injectRejectedSwipe([], undefined, 'swipe', settings), false);
});

test('Unicode and code-containing responses are quoted without truncation or macro evaluation', () => {
    const rejected = '  🧡日本語\n```js\n{{setvar::sample::value}}\n```\n' + 'A'.repeat(50000) + '\n';
    const result = buildReSwipeGuidance(rejected);
    assert.ok(result.includes(`\n\`\`\`\`\n${rejected}\n\`\`\`\``));
    assert.ok(result.includes('{{setvar::sample::value}}'));
});

function runtimeFixture(previousPreflight) {
    const data = fixture();
    const state = { context: data.context, settings: data.settings };
    const runtime = createReSwipeRuntime({ previousPreflight, getContext: () => state.context, getSettings: () => state.settings });
    return { ...data, state, runtime };
}

test('existing preflight runs before guidance, with generation type and arguments forwarded', async () => {
    const calls = [];
    const { runtime, prompt } = runtimeFixture(async (chat, size, _abort, type, extra) => {
        calls.push([chat.length, size, type, extra]);
        assert.equal(chat.at(-1).mes, 'What happens next?');
    });
    await runtime.preflight(prompt, 8192, () => assert.fail('unexpected abort'), 'swipe', 'extra');
    assert.deepEqual(calls, [[1, 8192, 'swipe', 'extra']]);
    assert.equal(prompt.at(-1).is_user, true);
    assert.ok(prompt.at(-1).mes.includes(DEFAULT_RESWIPE_INSTRUCTION));
});

for (const immediately of [true, false]) {
    test(`existing abort(${immediately}) is forwarded and prevents ReSwipe injection`, async () => {
        const { runtime, prompt } = runtimeFixture(async (_chat, _size, abort) => { abort(immediately); });
        const calls = [];
        await runtime.preflight(prompt, 8192, value => calls.push(value), 'swipe');
        assert.deepEqual(calls, [immediately]);
        assert.equal(prompt.length, 1);
    });
}

test('preflight exceptions and failed checks cannot attach guidance', async () => {
    const failed = runtimeFixture(async () => { throw new Error('Blocked preset'); });
    await assert.rejects(failed.runtime.preflight(failed.prompt, 8192, () => {}, 'swipe'), /Blocked preset/);
    assert.equal(failed.prompt.length, 1);
    const denied = runtimeFixture(async () => false);
    assert.equal(await denied.runtime.preflight(denied.prompt, 8192, () => {}, 'swipe'), false);
    assert.equal(denied.prompt.length, 1);
});

test('the live setting can be enabled, customized, and disabled without a reload', async () => {
    const calls = [];
    const { runtime, state } = runtimeFixture((...args) => calls.push(args));
    const abort = () => {};
    state.settings = { enableReSwipe: false };
    const off = [];
    await runtime.preflight(off, 1000, abort, 'swipe');
    assert.equal(off.length, 0);
    assert.equal(calls[0][2], abort);
    state.settings = { enableReSwipe: true, reSwipeInstruction: 'New approach.' };
    const on = [];
    await runtime.preflight(on, 1000, abort, 'swipe');
    assert.ok(on[0].mes.startsWith('New approach.'));
    state.settings.enableReSwipe = false;
    const offAgain = [];
    await runtime.preflight(offAgain, 1000, abort, 'swipe');
    assert.equal(offAgain.length, 0);
    assert.equal(calls.length, 3);
});

for (const change of ['chat switch', 'message replaced', 'message edited', 'disabled', 'disposed']) {
    test(`${change} during async preflight prevents stale guidance`, async () => {
        let resume;
        const { runtime, state, prompt } = runtimeFixture(() => new Promise(resolve => { resume = resolve; }));
        const pending = runtime.preflight(prompt, 8192, () => {}, 'swipe');
        if (change === 'chat switch') state.context = fixture().context;
        if (change === 'message replaced') state.context.chat[state.context.chat.length - 1] = { mes: 'Other response' };
        if (change === 'message edited') state.context.chat.at(-1).mes = 'Edited while waiting';
        if (change === 'disabled') state.settings.enableReSwipe = false;
        if (change === 'disposed') runtime.dispose();
        resume();
        await pending;
        assert.equal(prompt.length, 1);
    });
}

test('production initialization is idempotent and cleanup restores the earlier interceptor', async () => {
    const { context, settings } = fixture();
    let checks = 0;
    const previous = async () => { checks++; };
    const sandbox = { getContext: () => context, extension_settings: { NemoPresetExt: settings }, createReSwipeRuntime, nemoRecipeRuntimePreflight: previous };
    const source = readFileSync(new URL('../features/reswipe/runtime.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
    const api = new Script(`${source}\n({ initializeReSwipe, cleanupReSwipe });`).runInNewContext(sandbox);
    api.initializeReSwipe();
    const wrapped = sandbox.nemoRecipeRuntimePreflight;
    api.initializeReSwipe();
    assert.equal(sandbox.nemoRecipeRuntimePreflight, wrapped);
    const prompt = [];
    await wrapped(prompt, 8192, () => {}, 'swipe');
    assert.equal(prompt.length, 1);
    assert.equal(checks, 1);
    api.cleanupReSwipe(); api.cleanupReSwipe();
    assert.equal(sandbox.nemoRecipeRuntimePreflight, previous);
    const late = [];
    await wrapped(late, 8192, () => {}, 'swipe');
    assert.equal(late.length, 0);
    api.initializeReSwipe();
    const restarted = [];
    await sandbox.nemoRecipeRuntimePreflight(restarted, 8192, () => {}, 'swipe');
    assert.equal(restarted.length, 1);
    const externalWrapper = () => {};
    sandbox.nemoRecipeRuntimePreflight = externalWrapper;
    api.cleanupReSwipe();
    assert.equal(sandbox.nemoRecipeRuntimePreflight, externalWrapper);
});

test('settings start unchecked, persist edits, and keep the live feature off until explicitly enabled', () => {
    const settings = applySettingsSchema({ _settingsSchemaVersion: 5 });
    const nodes = new Map(['nemoEnableReSwipe', 'nemoReSwipeInstruction', 'nemoResetReSwipeInstruction'].map(id => [id, {
        checked: false, value: '', disabled: false, handlers: new Map(),
        addEventListener(event, callback) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]); },
        emit(event) { for (const callback of this.handlers.get(event) ?? []) callback(); },
    }]));
    let saves = 0;
    const source = readFileSync(new URL('../ui/settings-ui.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
    const ui = new Script(`${source}\nNemoSettingsUI;`).runInNewContext({
        extension_settings: { NemoPresetExt: settings }, NEMO_EXTENSION_NAME: 'NemoPresetExt',
        document: { getElementById: id => nodes.get(id) ?? null },
        DEFAULT_RESWIPE_INSTRUCTION, getReSwipeInstruction,
        saveSettings: () => { saves++; }, saveSettingsDebounced: () => { saves++; },
    });
    ui._bindCoreSettings();
    const toggle = nodes.get('nemoEnableReSwipe'), input = nodes.get('nemoReSwipeInstruction'), reset = nodes.get('nemoResetReSwipeInstruction');
    assert.equal(toggle.checked, false);
    assert.equal(input.disabled, true);
    assert.equal(reset.disabled, true);
    assert.equal(input.value, DEFAULT_RESWIPE_INSTRUCTION);
    assert.equal(saves, 0);
    toggle.checked = true; toggle.emit('change');
    assert.equal(settings.enableReSwipe, true);
    assert.equal(input.disabled, false);
    input.value = 'A different beginning.'; input.emit('input');
    assert.equal(settings.reSwipeInstruction, 'A different beginning.');
    reset.emit('click');
    assert.equal(settings.reSwipeInstruction, DEFAULT_RESWIPE_INSTRUCTION);
    toggle.checked = false; toggle.emit('change');
    assert.equal(settings.enableReSwipe, false);
    assert.equal(input.disabled, true);
    assert.equal(saves, 7);
});
