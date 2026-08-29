import { extension_settings } from '../../../../../extensions.js';
import { NEMO_EXTENSION_NAME, isFeatureEnabled } from '../../core/utils.js';
import logger from '../../core/logger.js';
import { initializeStorage, migrateFromLocalStorage } from '../../core/storage-migration.js';
import { NemoCharacterManager } from '../character-manager/character-manager.js';
import { initPresetNavigatorForApi } from '../../archive/navigator.js';
import { loadAndSetDividerRegex, NemoPresetManager } from '../prompts/prompt-manager.js';
import { cleanupCategoryTray, initCategoryTray } from '../prompts/category-tray.js';
import {
    cleanupPromptCompatibility,
    getPromptCompatibilityState,
    initializePromptCompatibility,
    reconcilePromptCompatibility,
} from '../prompts/compat/prompt-compatibility.js';
import { applyNemoNetReasoning, cleanupNemoNetReasoning } from '../../reasoning/nemonet-reasoning-config.js';
import {
    applyPromptUiMode,
    cleanupPromptUiMode,
    usesFullPromptFeatures,
} from '../prompts/ui-mode.js';

const SUPPORTED_APIS = Object.freeze([
    'openai',
    'textgenerationwebui',
    'novel',
    'kobold',
    'horde',
    'anthropic',
    'claude',
    'google',
    'scale',
    'cohere',
    'mistral',
    'aix',
    'openrouter',
]);

const runtimeState = {
    initialized: false,
    promptList: null,
    characterNavigatorInitialized: false,
    reasoningCaptureInitialized: false,
    categoryTrayInitialized: false,
    observer: null,
    reconcileTimer: null,
    modeHandler: null,
    activeModeKey: null,
};

function getSettings() {
    return extension_settings[NEMO_EXTENSION_NAME] ?? {};
}

function featureEnabled(key) {
    return isFeatureEnabled(getSettings(), key);
}

function cleanupPresetNavigatorWrappers() {
    document.querySelectorAll('.nemo-preset-selector-wrapper').forEach(wrapper => {
        const select = wrapper.querySelector('select[data-preset-manager-for]');
        if (select && wrapper.parentElement) {
            wrapper.parentElement.insertBefore(select, wrapper);
            delete select.dataset.nemoPatched;
        }
        wrapper.remove();
    });
    document.querySelectorAll('.nemo-favorites-container').forEach(element => element.remove());
    document.querySelectorAll('select[data-preset-manager-for][data-nemo-patched]').forEach(select => {
        delete select.dataset.nemoPatched;
    });
}

function syncFeatureProfile(settings, forceRefresh = false) {
    const descriptor = applyPromptUiMode(settings);
    const modeKey = `${descriptor.mode}:${descriptor.featureProfile}`;
    const modeChanged = runtimeState.activeModeKey !== modeKey;
    const shouldUseCategoryTray = featureEnabled('enablePromptManager') && usesFullPromptFeatures(settings);
    let trayChanged = false;

    if (shouldUseCategoryTray && !runtimeState.categoryTrayInitialized) {
        initCategoryTray();
        runtimeState.categoryTrayInitialized = true;
        trayChanged = true;
    } else if (!shouldUseCategoryTray && runtimeState.categoryTrayInitialized) {
        cleanupCategoryTray();
        runtimeState.categoryTrayInitialized = false;
        trayChanged = true;
    }

    runtimeState.activeModeKey = modeKey;
    if (modeChanged || trayChanged || forceRefresh) {
        NemoPresetManager.refreshUI?.();
    }
}

async function reconcileRuntime() {
    const settings = getSettings();
    applyPromptUiMode(settings);

    if (featureEnabled('enableReasoningCapture') && !runtimeState.reasoningCaptureInitialized) {
        applyNemoNetReasoning();
        runtimeState.reasoningCaptureInitialized = true;
    }

    if (featureEnabled('enableCharacterNavigator') && !runtimeState.characterNavigatorInitialized) {
        await NemoCharacterManager.initialize();
        runtimeState.characterNavigatorInitialized = true;
    }

    if (featureEnabled('enablePromptManager')) {
        window.NemoPresetManager = NemoPresetManager;
        window.NemoPromptManager = NemoPresetManager;

        const promptList = document.querySelector('#completion_prompt_manager_list');
        const missingControls = !document.getElementById('nemoSearchAndStatusWrapper');
        if (promptList && (promptList !== runtimeState.promptList || missingControls)) {
            runtimeState.promptList = promptList;
            delete promptList.dataset.nemoPromptsInitialized;
            await NemoPresetManager.initialize(promptList);
        }
    }

    reconcilePromptCompatibility({ manager: NemoPresetManager });

    if (featureEnabled('enablePresetNavigator')) {
        SUPPORTED_APIS.forEach(initPresetNavigatorForApi);
    }

    syncFeatureProfile(settings);
}

function scheduleReconcile() {
    clearTimeout(runtimeState.reconcileTimer);
    runtimeState.reconcileTimer = setTimeout(() => {
        runtimeState.reconcileTimer = null;
        void reconcileRuntime().catch(error => logger.error('Prompt workstation reconciliation failed', error));
    }, 75);
}

export async function initializePromptTools() {
    if (runtimeState.initialized) return cleanupPromptTools;
    runtimeState.initialized = true;

    initializeStorage();
    migrateFromLocalStorage();
    applyPromptUiMode(getSettings());
    initializePromptCompatibility({ manager: NemoPresetManager });

    if (featureEnabled('enablePromptManager')) {
        await loadAndSetDividerRegex();
    }

    runtimeState.modeHandler = () => syncFeatureProfile(getSettings(), true);
    document.body.addEventListener('nemo:prompt-ui-mode-changed', runtimeState.modeHandler);

    runtimeState.observer = new MutationObserver(mutations => {
        const relevant = mutations.some(mutation =>
            mutation.type === 'childList'
            && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
        );
        if (relevant) scheduleReconcile();
    });
    runtimeState.observer.observe(document.body, { childList: true, subtree: true });

    await reconcileRuntime();

    window.NemoPromptTools = Object.freeze({
        mergedIntoCore: true,
        NemoCharacterManager,
        NemoPresetManager,
        initPresetNavigatorForApi,
        getSettings,
        getCompatibilityState: getPromptCompatibilityState,
        applyPromptUiMode: mode => {
            getSettings().promptUiMode = mode;
            return applyPromptUiMode(getSettings());
        },
    });

    logger.info('Merged prompt workstation initialized');
    return cleanupPromptTools;
}

export function cleanupPromptTools() {
    clearTimeout(runtimeState.reconcileTimer);
    runtimeState.reconcileTimer = null;
    runtimeState.observer?.disconnect();
    runtimeState.observer = null;

    if (runtimeState.modeHandler) {
        document.body.removeEventListener('nemo:prompt-ui-mode-changed', runtimeState.modeHandler);
        runtimeState.modeHandler = null;
    }

    if (runtimeState.categoryTrayInitialized) {
        cleanupCategoryTray();
        runtimeState.categoryTrayInitialized = false;
    }
    if (runtimeState.reasoningCaptureInitialized) {
        cleanupNemoNetReasoning();
        runtimeState.reasoningCaptureInitialized = false;
    }
    if (runtimeState.characterNavigatorInitialized) {
        NemoCharacterManager.destroy?.();
        runtimeState.characterNavigatorInitialized = false;
    }

    cleanupPromptCompatibility();
    try {
        NemoPresetManager.destroy?.();
    } catch (error) {
        logger.warn('Prompt manager cleanup reported an error', error);
    }
    cleanupPresetNavigatorWrappers();
    cleanupPromptUiMode();

    if (window.NemoPromptTools?.mergedIntoCore) delete window.NemoPromptTools;
    if (window.NemoPresetManager === NemoPresetManager) delete window.NemoPresetManager;
    if (window.NemoPromptManager === NemoPresetManager) delete window.NemoPromptManager;

    runtimeState.promptList = null;
    runtimeState.activeModeKey = null;
    runtimeState.initialized = false;
}
