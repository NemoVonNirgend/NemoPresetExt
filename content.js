import { extension_settings } from '../../../extensions.js';
import { ensureSettingsNamespace, isFeatureEnabled, waitForElement, NEMO_EXTENSION_NAME } from './core/utils.js';
import logger from './core/logger.js';
import { initializeStorage, migrateFromLocalStorage } from './core/storage-migration.js';
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

let initialized = false;
let cleanupInProgress = false;
const cleanupCallbacks = [];

function featureEnabled(key) {
    return isFeatureEnabled(extension_settings[NEMO_EXTENSION_NAME], key);
}

function getDividerPatterns() {
    return getCustomDividerPatterns();
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
        cleanupDirectiveAutocomplete();
        cleanupMessageTriggerHooks();
        cleanupPromptDirectiveHooks();
        cleanupDirectiveUI();
        cleanupNemoEngineInstaller();
        clearDirectiveCache();
        NemoSettingsUI.destroy();
    } finally {
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
        initializeStorage();
        migrateFromLocalStorage();
        validateDividerPatterns();
        await NemoSettingsUI.initialize();

        if (featureEnabled('enableDirectives')) {
            initDirectiveUI();
            initPromptDirectiveHooks();
            initMessageTriggerHooks();
            if (featureEnabled('enableDirectiveAutocomplete')) initDirectiveAutocomplete();
            const cacheTimer = setTimeout(initializeDirectiveCache, 1000);
            cleanupCallbacks.push(() => clearTimeout(cacheTimer));
        }

        if (featureEnabled('enableNemoEngineInstaller')) initNemoEngineInstaller();

        window.NemoPresetExt = Object.freeze({
            cleanup: cleanupExtension,
            getDividerPatterns,
            refreshDividerPatterns: validateDividerPatterns,
        });
        window.NemoPresetExtCleanup = cleanupExtension;
        logger.info('Initialized core directives, dividers, hub, and NemoEngine installer');
    } catch (error) {
        logger.error('Core initialization failed', error);
        cleanupExtension();
    }
}

if (document.querySelector('#left-nav-panel')) {
    void initializeExtension();
} else {
    waitForElement('#left-nav-panel', () => void initializeExtension(), 10000);
}
