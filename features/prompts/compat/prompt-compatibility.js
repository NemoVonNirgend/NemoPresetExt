import {
    clearPromptCapabilityMarkers,
    detectPromptCapabilities,
    publishPromptCapabilityMarkers,
} from './capability-detector.js';
import {
    ControlBridgeRegistry,
    REASONING_CONTROL_BINDINGS,
    findNativeControlGroup,
} from './control-bridge.js';

const runtimeState = {
    initialized: false,
    root: null,
    globalObject: null,
    manager: null,
    bridge: null,
    current: null,
    legacyController: null,
    nativeGroups: new Set(),
    tabButtons: null,
    resizeObserver: null,
};

function query(root, selector) {
    return root?.querySelector?.(selector) ?? null;
}

function compactState(state) {
    if (!state) return null;
    return Object.freeze({
        chatTabsPresent: state.chatTabsPresent,
        chatTabsActive: state.chatTabsActive,
        moonlitPresent: state.moonlitPresent,
        hostMode: state.hostMode,
        reasoningOwner: state.reasoningOwner,
    });
}

function clearNativeGroupMarkers() {
    for (const group of runtimeState.nativeGroups) {
        group?.removeAttribute?.('data-nemo-native-reasoning-group');
    }
    runtimeState.nativeGroups.clear();
}

function markNativeReasoningGroups(root) {
    clearNativeGroupMarkers();
    for (const binding of REASONING_CONTROL_BINDINGS) {
        if (!binding.hideNativeGroup) continue;
        const nativeNode = query(root, binding.native);
        const group = findNativeControlGroup(nativeNode, binding);
        if (!group || group.closest?.('#nemoReasoningSection')) continue;
        group.setAttribute?.('data-nemo-native-reasoning-group', 'true');
        runtimeState.nativeGroups.add(group);
    }
}

function takeOverLegacyReasoningSync(manager) {
    const controller = manager?._reasoningSyncAbortController;
    if (!controller || controller === runtimeState.legacyController) return;
    controller.abort?.();
    runtimeState.legacyController = controller;
    if (manager._reasoningSyncAbortController === controller) {
        manager._reasoningSyncAbortController = null;
    }
}

function placeBefore(node, reference) {
    const parent = reference?.parentElement ?? reference?.parentNode;
    if (!node || !reference || !parent?.insertBefore) return;
    if (node.parentElement !== parent || node.nextElementSibling !== reference) {
        parent.insertBefore(node, reference);
    }
}

function placeAfter(node, reference, parent = reference?.parentElement ?? reference?.parentNode) {
    if (!node || !reference || !parent?.insertBefore) return;
    const nextSibling = reference.nextSibling ?? null;
    if (node.parentElement !== parent || node.previousElementSibling !== reference) {
        parent.insertBefore(node, nextSibling);
    }
}

export function reconcileOwnedPromptElements(root, capabilities) {
    if (!root || !capabilities) return;

    const searchTools = query(root, '#nemoSearchAndStatusWrapper');
    if (searchTools && capabilities.promptList) {
        placeBefore(searchTools, capabilities.promptList);
    }

    const lorebookSection = query(root, '#nemoLorebookSection');
    if (!lorebookSection) return;

    if (capabilities.chatTabsActive && capabilities.promptsHost && capabilities.promptManager) {
        placeAfter(lorebookSection, capabilities.promptManager, capabilities.promptsHost);
        return;
    }

    const nativeAnchor = query(root, '#nemoReasoningSection')
        ?? query(root, '#nemo-drawer-openai_chat_settings');
    if (nativeAnchor) {
        placeAfter(lorebookSection, nativeAnchor);
    }
}

function measureTabButtons() {
    const root = runtimeState.root;
    const body = root?.body;
    const buttons = runtimeState.tabButtons;
    if (!body?.style) return;
    if (!buttons) {
        body.style.removeProperty?.('--nemo-external-tab-height');
        return;
    }

    const measured = buttons.getBoundingClientRect?.().height ?? buttons.offsetHeight ?? 0;
    const height = Number.isFinite(measured) ? Math.max(0, Math.ceil(measured)) : 0;
    body.style.setProperty?.('--nemo-external-tab-height', `${height}px`);
}

function syncTabMeasurement(capabilities) {
    const nextButtons = capabilities.chatTabsActive ? capabilities.tabButtons : null;
    if (nextButtons === runtimeState.tabButtons) {
        measureTabButtons();
        return;
    }

    runtimeState.resizeObserver?.disconnect?.();
    runtimeState.resizeObserver = null;
    runtimeState.tabButtons = nextButtons;

    if (!nextButtons) {
        measureTabButtons();
        return;
    }

    const ResizeObserverType = runtimeState.globalObject?.ResizeObserver;
    if (typeof ResizeObserverType === 'function') {
        runtimeState.resizeObserver = new ResizeObserverType(measureTabButtons);
        runtimeState.resizeObserver.observe(nextButtons);
    }
    measureTabButtons();
}

function dispatchCompatibilityChange(state) {
    const target = runtimeState.globalObject;
    const CustomEventType = target?.CustomEvent;
    if (!target?.dispatchEvent || typeof CustomEventType !== 'function') return;
    target.dispatchEvent(new CustomEventType('nemo:prompt-compatibility-changed', {
        detail: compactState(state),
    }));
}

export function initializePromptCompatibility({
    root = globalThis.document,
    globalObject = globalThis,
    manager = null,
} = {}) {
    if (
        runtimeState.initialized
        && runtimeState.root === root
        && runtimeState.globalObject === globalObject
    ) {
        runtimeState.manager = manager ?? runtimeState.manager;
        return cleanupPromptCompatibility;
    }

    cleanupPromptCompatibility();
    runtimeState.initialized = true;
    runtimeState.root = root;
    runtimeState.globalObject = globalObject;
    runtimeState.manager = manager;
    runtimeState.bridge = new ControlBridgeRegistry({
        root,
        EventConstructor: globalObject?.Event,
    });
    return cleanupPromptCompatibility;
}

export function reconcilePromptCompatibility({ manager = null } = {}) {
    if (!runtimeState.initialized) {
        initializePromptCompatibility({ manager });
    } else if (manager) {
        runtimeState.manager = manager;
    }

    const root = runtimeState.root;
    const globalObject = runtimeState.globalObject;
    const state = detectPromptCapabilities({ root, globalObject });

    takeOverLegacyReasoningSync(runtimeState.manager);
    runtimeState.bridge?.reconcile();
    markNativeReasoningGroups(root);
    reconcileOwnedPromptElements(root, state);
    publishPromptCapabilityMarkers(state, root);
    syncTabMeasurement(state);

    const previous = runtimeState.current;
    runtimeState.current = state;
    if (
        !previous
        || previous.hostMode !== state.hostMode
        || previous.reasoningOwner !== state.reasoningOwner
        || previous.moonlitPresent !== state.moonlitPresent
    ) {
        dispatchCompatibilityChange(state);
    }

    const templateSelect = query(root, '#nemo-reasoning-select');
    templateSelect?.setAttribute?.('aria-label', 'Reasoning format template');
    templateSelect?.setAttribute?.('title', 'Select the formatting used to parse and display reasoning.');

    return compactState(state);
}

export function getPromptCompatibilityState() {
    return compactState(runtimeState.current);
}

export function cleanupPromptCompatibility() {
    if (!runtimeState.initialized && !runtimeState.bridge) return;

    const root = runtimeState.root;
    const lorebookSection = query(root, '#nemoLorebookSection');
    const nativeAnchor = query(root, '#nemoReasoningSection')
        ?? query(root, '#nemo-drawer-openai_chat_settings');
    if (lorebookSection && nativeAnchor) {
        placeAfter(lorebookSection, nativeAnchor);
    }

    runtimeState.resizeObserver?.disconnect?.();
    runtimeState.resizeObserver = null;
    runtimeState.tabButtons = null;
    runtimeState.bridge?.destroy();
    runtimeState.bridge = null;
    clearNativeGroupMarkers();
    clearPromptCapabilityMarkers(root);

    runtimeState.initialized = false;
    runtimeState.root = null;
    runtimeState.globalObject = null;
    runtimeState.manager = null;
    runtimeState.current = null;
    runtimeState.legacyController = null;
}
