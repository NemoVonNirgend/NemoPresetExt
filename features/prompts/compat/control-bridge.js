export const REASONING_CONTROL_BINDINGS = Object.freeze([
    {
        key: 'start-reply-with',
        proxy: '#nemo-start-reply-with',
        native: '#start_reply_with',
        property: 'value',
        event: 'input',
        hideNativeGroup: ['.range-block'],
    },
    {
        key: 'show-reply-prefix',
        proxy: '#nemo-chat-show-reply-prefix-checkbox',
        native: '#chat-show-reply-prefix-checkbox',
        property: 'checked',
        event: 'change',
    },
    {
        key: 'reasoning-auto-parse',
        proxy: '#nemo-reasoning-auto-parse',
        native: '#reasoning_auto_parse',
        property: 'checked',
        event: 'change',
        hideNativeGroup: ['.range-block'],
    },
    {
        key: 'reasoning-auto-expand',
        proxy: '#nemo-reasoning-auto-expand',
        native: '#reasoning_auto_expand',
        property: 'checked',
        event: 'change',
    },
    {
        key: 'reasoning-show-hidden',
        proxy: '#nemo-reasoning-show-hidden',
        native: '#reasoning_show_hidden',
        property: 'checked',
        event: 'change',
    },
    {
        key: 'reasoning-add-to-prompts',
        proxy: '#nemo-reasoning-add-to-prompts',
        native: '#reasoning_add_to_prompts',
        property: 'checked',
        event: 'change',
    },
    {
        key: 'reasoning-max-additions',
        proxy: '#nemo-reasoning-max-additions',
        native: '#reasoning_max_additions',
        property: 'value',
        event: 'input',
    },
    {
        key: 'request-model-reasoning',
        proxy: '#nemo-openai-show-thoughts',
        native: '#openai_show_thoughts',
        property: 'checked',
        event: 'change',
        hideNativeGroup: ['.range-block'],
    },
    {
        key: 'reasoning-effort',
        proxy: '#nemo-openai-reasoning-effort',
        native: '#openai_reasoning_effort',
        property: 'value',
        event: 'change',
        hideNativeGroup: ['.oneline-dropdown', '.flex-container.flexFlowColumn', '.range-block'],
    },
    {
        key: 'reasoning-template',
        proxy: '#nemo-reasoning-select',
        native: '#reasoning_select',
        property: 'value',
        event: 'change',
        hideNativeGroup: ['.inline-drawer', '.range-block'],
    },
    {
        key: 'reasoning-prefix',
        proxy: '#nemo-reasoning-prefix',
        native: '#reasoning_prefix',
        property: 'value',
        event: 'input',
    },
    {
        key: 'reasoning-suffix',
        proxy: '#nemo-reasoning-suffix',
        native: '#reasoning_suffix',
        property: 'value',
        event: 'input',
    },
    {
        key: 'reasoning-separator',
        proxy: '#nemo-reasoning-separator',
        native: '#reasoning_separator',
        property: 'value',
        event: 'input',
    },
]);

function safeQuery(root, selector) {
    return root?.querySelector?.(selector) ?? null;
}

function safeClosest(node, selectors = []) {
    if (!node?.closest) return null;
    for (const selector of selectors) {
        const match = node.closest(selector);
        if (match) return match;
    }
    return null;
}

export function findNativeControlGroup(node, binding) {
    return safeClosest(node, binding?.hideNativeGroup);
}

export class ControlBridgeRegistry {
    constructor({
        root = globalThis.document,
        bindings = REASONING_CONTROL_BINDINGS,
        EventConstructor = globalThis.Event,
    } = {}) {
        this.root = root;
        this.bindings = bindings;
        this.EventConstructor = EventConstructor;
        this.records = new Map();
        this.syncing = new Set();
    }

    setRoot(root) {
        if (root === this.root) return;
        this.destroy();
        this.root = root;
    }

    getBinding(key) {
        return this.bindings.find(binding => binding.key === key) ?? null;
    }

    getNativeNode(key) {
        const binding = this.getBinding(key);
        return binding ? safeQuery(this.root, binding.native) : null;
    }

    reconcile() {
        for (const binding of this.bindings) {
            this.#reconcileBinding(binding);
        }
    }

    #reconcileBinding(binding) {
        const proxyNode = safeQuery(this.root, binding.proxy);
        const nativeNode = safeQuery(this.root, binding.native);
        const previous = this.records.get(binding.key);

        if (previous?.proxyNode === proxyNode && previous?.nativeNode === nativeNode) {
            this.#copy(nativeNode, proxyNode, binding);
            return;
        }

        this.#cleanupRecord(previous);

        const record = {
            proxyNode,
            nativeNode,
            removers: [],
        };
        this.records.set(binding.key, record);

        if (!proxyNode || !nativeNode || proxyNode === nativeNode) return;

        this.#copy(nativeNode, proxyNode, binding);

        const onProxyChange = () => {
            if (this.syncing.has(binding.key)) return;
            const currentNative = safeQuery(this.root, binding.native);
            const currentProxy = safeQuery(this.root, binding.proxy);
            if (!currentNative || !currentProxy || currentNative === currentProxy) return;

            this.syncing.add(binding.key);
            try {
                this.#copy(currentProxy, currentNative, binding);
                this.#dispatch(currentNative, binding.event);
            } finally {
                this.syncing.delete(binding.key);
            }
        };

        const onNativeChange = event => {
            const currentProxy = safeQuery(this.root, binding.proxy);
            const source = event?.currentTarget ?? safeQuery(this.root, binding.native);
            this.#copy(source, currentProxy, binding);
        };

        record.removers.push(this.#listen(proxyNode, binding.event, onProxyChange));
        record.removers.push(this.#listen(nativeNode, binding.event, onNativeChange));
    }

    #listen(node, eventName, handler) {
        if (!node?.addEventListener) return () => {};
        node.addEventListener(eventName, handler);
        return () => node.removeEventListener?.(eventName, handler);
    }

    #copy(source, target, binding) {
        if (!source || !target) return;
        const property = binding.property ?? 'value';
        const nextValue = source[property];
        if (target[property] !== nextValue) {
            target[property] = nextValue;
        }
    }

    #dispatch(node, eventName) {
        if (!node?.dispatchEvent || !eventName) return;
        const EventType = node.ownerDocument?.defaultView?.Event ?? this.EventConstructor;
        if (typeof EventType === 'function') {
            node.dispatchEvent(new EventType(eventName, { bubbles: true }));
            return;
        }
        node.dispatchEvent({ type: eventName, bubbles: true });
    }

    #cleanupRecord(record) {
        if (!record) return;
        for (const remove of record.removers ?? []) {
            try {
                remove();
            } catch {
                // A detached third-party node may already have discarded its listeners.
            }
        }
    }

    destroy() {
        for (const record of this.records.values()) {
            this.#cleanupRecord(record);
        }
        this.records.clear();
        this.syncing.clear();
    }
}
