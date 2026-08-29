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
import { reconcileOwnedPromptElements } from '../features/prompts/compat/prompt-compatibility.js';

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


class TreeNode {
    constructor(name) {
        this.name = name;
        this.parentElement = null;
    }

    get parentNode() {
        return this.parentElement;
    }

    get nextSibling() {
        if (!this.parentElement) return null;
        const index = this.parentElement.children.indexOf(this);
        return this.parentElement.children[index + 1] ?? null;
    }

    get nextElementSibling() {
        return this.nextSibling;
    }

    get previousElementSibling() {
        if (!this.parentElement) return null;
        const index = this.parentElement.children.indexOf(this);
        return index > 0 ? this.parentElement.children[index - 1] : null;
    }
}

class TreeContainer extends TreeNode {
    constructor(name, children = []) {
        super(name);
        this.children = [];
        for (const child of children) this.insertBefore(child, null);
    }

    insertBefore(node, reference) {
        if (node.parentElement) {
            const oldIndex = node.parentElement.children.indexOf(node);
            if (oldIndex >= 0) node.parentElement.children.splice(oldIndex, 1);
        }
        const index = reference ? this.children.indexOf(reference) : -1;
        if (index >= 0) this.children.splice(index, 0, node);
        else this.children.push(node);
        node.parentElement = this;
        return node;
    }

    contains(node) {
        if (this.children.includes(node)) return true;
        return this.children.some(child => child instanceof TreeContainer && child.contains(node));
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
        '#nemoReasoningSection': {},
    });

    const state = detectPromptCapabilities({ root, globalObject: {} });
    assert.equal(state.chatTabsPresent, false);
    assert.equal(state.chatTabsActive, false);
    assert.equal(state.hostMode, PROMPT_HOST_MODES.NATIVE);
    assert.equal(state.reasoningOwner, REASONING_OWNERS.NEMO);
    assert.equal(state.promptManager, promptManager);
    assert.equal(state.promptList, promptList);
});

test('native reasoning remains visible when Nemo reasoning controls are disabled', () => {
    const root = createRoot({
        '#completion_prompt_manager': {},
        '#completion_prompt_manager_list': {},
    });

    const state = detectPromptCapabilities({ root, globalObject: {} });
    assert.equal(state.hostMode, PROMPT_HOST_MODES.NATIVE);
    assert.equal(state.reasoningOwner, REASONING_OWNERS.NATIVE);
});

test('an installed but disabled Chat Completion Tabs extension does not become a dependency', () => {
    const promptManager = {};
    const promptsHost = { contains: () => false };
    const root = createRoot({
        '#completion_prompt_manager': promptManager,
        '#openai-tab-content-prompts': promptsHost,
        '#nemoReasoningSection': {},
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
    const root = createRoot({
        '#nemoReasoningSection': {},
    });
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


test('owned prompt controls follow the live Chat Completion Tabs host and restore cleanly', () => {
    const header = new TreeNode('header');
    const promptList = new TreeNode('prompt-list');
    const promptManager = new TreeContainer('prompt-manager', [header, promptList]);
    const searchTools = new TreeNode('search-tools');
    const displaced = new TreeContainer('displaced', [searchTools]);

    const nativeAnchor = new TreeNode('native-anchor');
    const lorebook = new TreeNode('lorebook');
    const nativeHost = new TreeContainer('native-host', [nativeAnchor, lorebook]);

    const afterPromptManager = new TreeNode('after-prompt-manager');
    const promptsHost = new TreeContainer('prompts-host', [promptManager, afterPromptManager]);

    const root = createRoot({
        '#nemoSearchAndStatusWrapper': searchTools,
        '#nemoLorebookSection': lorebook,
        '#nemoReasoningSection': nativeAnchor,
    });

    reconcileOwnedPromptElements(root, {
        chatTabsActive: true,
        promptManager,
        promptList,
        promptsHost,
    });

    assert.deepEqual(promptManager.children.map(node => node.name), [
        'header',
        'search-tools',
        'prompt-list',
    ]);
    assert.deepEqual(promptsHost.children.map(node => node.name), [
        'prompt-manager',
        'lorebook',
        'after-prompt-manager',
    ]);
    assert.deepEqual(displaced.children, []);

    reconcileOwnedPromptElements(root, {
        chatTabsActive: false,
        promptManager,
        promptList,
        promptsHost: null,
    });
    assert.deepEqual(nativeHost.children.map(node => node.name), [
        'native-anchor',
        'lorebook',
    ]);
});
