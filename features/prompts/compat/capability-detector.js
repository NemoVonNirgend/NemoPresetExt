const CHAT_TABS_SELECTORS = Object.freeze({
    buttons: '.openai-tab-buttons',
    promptsHost: '#openai-tab-content-prompts',
    parametersHost: '#openai-tab-content-parameters',
    promptManager: '#completion_prompt_manager',
    promptList: '#completion_prompt_manager_list',
    nemoReasoningSection: '#nemoReasoningSection',
});

const MOONLIT_SELECTORS = Object.freeze([
    '#moonlit_sidebar_button',
    '#moonlit_echoes_popout',
    '#moonlit-header-fix-style',
]);

export const PROMPT_HOST_MODES = Object.freeze({
    NATIVE: 'native',
    CHAT_TABS: 'chat-tabs',
});

export const REASONING_OWNERS = Object.freeze({
    NEMO: 'nemo',
    NATIVE: 'native',
});

function query(root, selector) {
    return root?.querySelector?.(selector) ?? null;
}

function readExtensionSettings(globalObject) {
    try {
        return globalObject?.SillyTavern?.getContext?.()?.extensionSettings ?? {};
    } catch {
        return {};
    }
}

export function detectPromptCapabilities({
    root = globalThis.document,
    globalObject = globalThis,
} = {}) {
    const promptManager = query(root, CHAT_TABS_SELECTORS.promptManager);
    const promptList = query(root, CHAT_TABS_SELECTORS.promptList);
    const tabButtons = query(root, CHAT_TABS_SELECTORS.buttons);
    const promptsHost = query(root, CHAT_TABS_SELECTORS.promptsHost);
    const parametersHost = query(root, CHAT_TABS_SELECTORS.parametersHost);
    const nemoReasoningSection = query(root, CHAT_TABS_SELECTORS.nemoReasoningSection);
    const extensionSettings = readExtensionSettings(globalObject);

    const chatTabsPresent = Boolean(
        globalObject?.ChatCompletionTabs
        || tabButtons
        || promptsHost
        || parametersHost
    );
    const chatTabsActive = Boolean(
        promptsHost
        && promptManager
        && typeof promptsHost.contains === 'function'
        && promptsHost.contains(promptManager)
    );
    const moonlitPresent = Boolean(
        extensionSettings.SillyTavernMoonlitEchoesTheme
        || MOONLIT_SELECTORS.some(selector => query(root, selector))
    );

    return Object.freeze({
        chatTabsPresent,
        chatTabsActive,
        moonlitPresent,
        promptManager,
        promptList,
        tabButtons,
        promptsHost,
        parametersHost,
        nemoReasoningSection,
        hostMode: chatTabsActive ? PROMPT_HOST_MODES.CHAT_TABS : PROMPT_HOST_MODES.NATIVE,
        reasoningOwner: chatTabsActive || !nemoReasoningSection
            ? REASONING_OWNERS.NATIVE
            : REASONING_OWNERS.NEMO,
    });
}

export function publishPromptCapabilityMarkers(state, root = globalThis.document) {
    const body = root?.body;
    if (!body?.dataset || !state) return;
    body.dataset.nemoPromptHost = state.hostMode;
    body.dataset.nemoReasoningOwner = state.reasoningOwner;
    body.dataset.nemoMoonlit = state.moonlitPresent ? 'true' : 'false';
}

export function clearPromptCapabilityMarkers(root = globalThis.document) {
    const body = root?.body;
    if (!body?.dataset) return;
    delete body.dataset.nemoPromptHost;
    delete body.dataset.nemoReasoningOwner;
    delete body.dataset.nemoMoonlit;
    body.style?.removeProperty?.('--nemo-external-tab-height');
}

export const PROMPT_COMPATIBILITY_SELECTORS = Object.freeze({
    ...CHAT_TABS_SELECTORS,
    moonlit: MOONLIT_SELECTORS,
});
