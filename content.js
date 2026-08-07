import { extension_settings } from '../../../extensions.js';
import { ensureSettingsNamespace, isFeatureEnabled, waitForElement, NEMO_EXTENSION_NAME } from './core/utils.js';
import logger from './core/logger.js';
import { initializeDirectiveCache, clearDirectiveCache } from './core/directive-cache.js';
import { NemoSettingsUI } from './ui/settings-ui.js';
import { getCustomDividerPatterns, validateDividerPatterns } from './core/divider-patterns.js';
import { cleanupDirectiveUI, initDirectiveUI } from './features/directives/directive-ui.js';
import {
    cleanupMessageTriggerHooks,
    cleanupPromptDirectiveHooks,
    initMessageTriggerHooks,
    initPromptDirectiveHooks,
} from './features/directives/prompt-directive-hooks.js';
import { cleanupDirectiveAutocomplete, initDirectiveAutocomplete } from './features/directives/directive-autocomplete-ui.js';
import { cleanupNemoEngineInstaller, initNemoEngineInstaller } from './features/preset-installer/runtime.js';
import { cleanupPromptTools, initializePromptTools } from './features/prompt-tools/runtime.js';

let initialized = false;
let cleanupInProgress = false;
const cleanupCallbacks = [];

const CAPABILITIES = Object.freeze({
    promptTools: true,
    promptUiModes: Object.freeze(['classic', 'modern', 'classicPlus']),
    directives: true,
    customDividers: true,
    nemoEngineInstaller: true,
    hub: true,
});

function featureEnabled(key) {
    return isFeatureEnabled(extension_settings[NEMO_EXTENSION_NAME], key);
}

function getDividerPatterns() {
    return getCustomDividerPatterns();
}

function publishPublicApi() {
    const api = Object.freeze({
        capabilities: CAPABILITIES,
        cleanup: cleanupExtension,
        getDividerPatterns,
        refreshDividerPatterns: validateDividerPatterns,
        getPromptTools: () => window.NemoPromptTools ?? null,
    });
    window.NemoPresetExt = api;
    window.NemoPresetExtCleanup = cleanupExtension;
    window.dispatchEvent(new CustomEvent('nemo:preset-ext-capabilities', {
        detail: CAPABILITIES,
    }));
    return api;
}

export function cleanupExtension() {
    if (cleanupInProgress || (!initialized && cleanupCallbacks.length === 0)) return;
    cleanupInProgress = true;
    try {
        for (const cleanup of cleanupCallbacks.splice(0).reverse()) {
            try {
                cleanup();
            } catch (error) {
                logger.error('Core cleanup callback failed', error);
            }
        }
        cleanupPromptTools();
        cleanupDirectiveAutocomplete();
        cleanupMessageTriggerHooks();
        cleanupPromptDirectiveHooks();
        cleanupDirectiveUI();
        cleanupNemoEngineInstaller();
        clearDirectiveCache();
        NemoSettingsUI.destroy();
    } finally {
        if (window.NemoPresetExt?.capabilities === CAPABILITIES) delete window.NemoPresetExt;
        if (window.NemoPresetExtCleanup === cleanupExtension) delete window.NemoPresetExtCleanup;
        initialized = false;
        cleanupInProgress = false;
    }
}

export async function initializeExtension() {
    if (initialized) return;
    initialized = true;
    cleanupCallbacks.length = 0;

    try {
        ensureSettingsNamespace();
        validateDividerPatterns();
        await NemoSettingsUI.initialize();

        await initializePromptTools();

        if (featureEnabled('enableDirectives')) {
            initDirectiveUI();
            initPromptDirectiveHooks();
            initMessageTriggerHooks();
            if (featureEnabled('enableDirectiveAutocomplete')) initDirectiveAutocomplete();
            const cacheTimer = setTimeout(initializeDirectiveCache, 1000);
            cleanupCallbacks.push(() => clearTimeout(cacheTimer));
        }

        if (featureEnabled('enableNemoEngineInstaller')) initNemoEngineInstaller();

        publishPublicApi();
        logger.info('Initialized prompt workstation, directives, dividers, hub, and NemoEngine installer');
    } catch (error) {
        logger.error('Core initialization failed', error);
        cleanupExtension();
    }
}

publishPublicApi();

if (document.querySelector('#left-nav-panel')) {
    void initializeExtension();
} else {
    waitForElement('#left-nav-panel', () => void initializeExtension(), 10000);
}
