import assert from 'node:assert/strict';
import test from 'node:test';
import {
    PROMPT_HOST_MODES,
    REASONING_OWNERS,
    clearPromptCapabilityMarkers,
    detectPromptCapabilities,
    publishPromptCapabilityMarkers,
} from '../features/prompts/compat/capability-detector.js';
import {
    ControlBridgeRegistry,
    findNativeControlGroup,
} from '../features/prompts/compat/control-bridge.js';

class FakeEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.bubbles = Boolean(options.bubbles);
        this.currentTarget = null;
    }
}

class FakeElement {
    constructor({ value = '', checked = false, closest = {} } = {}) {
        this.value = value;
        this.checked = checked;
        this.listeners = new Map();
        this.closestMatches = closest;
        this.ownerDocument = { defaultView: { Event: FakeEvent } };
    }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }

    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }

    dispatchEvent(event) {
        event.currentTarget = this;
        for (const listener of this.listeners.get(event.type) ?? []) {
            listener(event);
        }
        return true;
    }

    closest(selector) {
        return this.closestMatches[selector] ?? null;
    }
}

function createRoot(entries = {}) {
    const styles = new Map();
    return {
        entries,
        body: {
            dataset: {},
            style: {
                setProperty(name, value) {
                    styles.set(name, value);
                },
                removeProperty(name) {
                    styles.delete(name);
                },
            },
        },
        querySelector(selector) {
            return this.entries[selector] ?? null;
        },
        styles,
    };
}

test('standalone mode owns reasoning without requiring Rivelle extensions', () => {
    const promptManager = {};
    const promptList = {};
    const root = createRoot({
        '#completion_prompt_manager': promptManager,
        '#completion_prompt_manager_list': promptList,
    });

    const state = detectPromptCapabilities({ root, globalObject: {} });
    assert.equal(state.chatTabsPresent, false);
    assert.equal(state.chatTabsActive, false);
    assert.equal(state.hostMode, PROMPT_HOST_MODES.NATIVE);
    assert.equal(state.reasoningOwner, REASONING_OWNERS.NEMO);
    assert.equal(state.promptManager, promptManager);
    assert.equal(state.promptList, promptList);
});

test('an installed but disabled Chat Completion Tabs extension does not become a dependency', () => {
    const promptManager = {};
    const promptsHost = { contains: () => false };
    const root = createRoot({
        '#completion_prompt_manager': promptManager,
        '#openai-tab-content-prompts': promptsHost,
    });

    const state = detectPromptCapabilities({
        root,
        globalObject: { ChatCompletionTabs: {} },
    });
    assert.equal(state.chatTabsPresent, true);
    assert.equal(state.chatTabsActive, false);
    assert.equal(state.hostMode, PROMPT_HOST_MODES.NATIVE);
    assert.equal(state.reasoningOwner, REASONING_OWNERS.NEMO);
});

test('active Chat Completion Tabs becomes the host and native reasoning owner', () => {
    const promptManager = {};
    const promptsHost = { contains: node => node === promptManager };
    const root = createRoot({
        '#completion_prompt_manager': promptManager,
        '#openai-tab-content-prompts': promptsHost,
        '#openai-tab-content-parameters': {},
        '.openai-tab-buttons': {},
    });

    const state = detectPromptCapabilities({ root, globalObject: {} });
    assert.equal(state.chatTabsPresent, true);
    assert.equal(state.chatTabsActive, true);
    assert.equal(state.hostMode, PROMPT_HOST_MODES.CHAT_TABS);
    assert.equal(state.reasoningOwner, REASONING_OWNERS.NATIVE);
});

test('Moonlit Echoes is detected through settings without importing its code', () => {
    const root = createRoot();
    const globalObject = {
        SillyTavern: {
            getContext: () => ({
                extensionSettings: {
                    SillyTavernMoonlitEchoesTheme: { enabled: true },
                },
            }),
        },
    };

    const state = detectPromptCapabilities({ root, globalObject });
    assert.equal(state.moonlitPresent, true);

    publishPromptCapabilityMarkers(state, root);
    assert.equal(root.body.dataset.nemoPromptHost, PROMPT_HOST_MODES.NATIVE);
    assert.equal(root.body.dataset.nemoReasoningOwner, REASONING_OWNERS.NEMO);
    assert.equal(root.body.dataset.nemoMoonlit, 'true');

    clearPromptCapabilityMarkers(root);
    assert.deepEqual(root.body.dataset, {});
});

test('control bridge uses native state and rebinds after native nodes are replaced', () => {
    const proxy = new FakeElement({ value: 'low' });
    const firstNative = new FakeElement({ value: 'high' });
    const root = createRoot({
        '#proxy': proxy,
        '#native': firstNative,
    });
    const bridge = new ControlBridgeRegistry({
        root,
        EventConstructor: FakeEvent,
        bindings: [{
            key: 'effort',
            proxy: '#proxy',
            native: '#native',
            property: 'value',
            event: 'change',
        }],
    });

    bridge.reconcile();
    assert.equal(proxy.value, 'high');

    proxy.value = 'max';
    proxy.dispatchEvent(new FakeEvent('change'));
    assert.equal(firstNative.value, 'max');

    const replacementNative = new FakeElement({ value: 'medium' });
    root.entries['#native'] = replacementNative;
    bridge.reconcile();
    assert.equal(proxy.value, 'medium');

    proxy.value = 'min';
    proxy.dispatchEvent(new FakeEvent('change'));
    assert.equal(replacementNative.value, 'min');
    assert.equal(firstNative.value, 'max');

    bridge.destroy();
    proxy.value = 'high';
    proxy.dispatchEvent(new FakeEvent('change'));
    assert.equal(replacementNative.value, 'min');
});

test('native visibility groups are selected only from declared safe ancestors', () => {
    const safeGroup = {};
    const node = new FakeElement({
        closest: {
            '.oneline-dropdown': safeGroup,
            '.range-block': {},
        },
    });
    assert.equal(
        findNativeControlGroup(node, {
            hideNativeGroup: ['.oneline-dropdown', '.range-block'],
        }),
        safeGroup,
    );
    assert.equal(findNativeControlGroup(node, {}), null);
});
