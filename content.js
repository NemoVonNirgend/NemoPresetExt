import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

// Core utilities
import { LOG_PREFIX, NEMO_EXTENSION_NAME, ensureSettingsNamespace, isFeatureEnabled, waitForElement } from './core/utils.js';
import { CONSTANTS } from './core/constants.js';
import logger from './core/logger.js';
import { initializeStorage, migrateFromLocalStorage } from './core/storage-migration.js';
import { initializeDirectiveCache, clearDirectiveCache } from './core/directive-cache.js';

// UI modules
import { NemoSettingsUI } from './ui/settings-ui.js';
import { NemoGlobalUI } from './ui/global-ui.js';
import { UserSettingsTabs } from './ui/user-settings-tabs.js';
import { AdvancedFormattingTabs } from './ui/advanced-formatting-tabs.js';
import { ExtensionsTabOverhaul } from './ui/extensions-tab-overhaul.js';
import { initializeThemes, initThemeSelector } from './ui/theme-manager.js';

// Feature modules - Prompts
import { NemoPresetManager, loadAndSetDividerRegex } from './features/prompts/prompt-manager.js';
// Legacy prompt archive UI — disabled, replaced by category tray archive
// import { NemoPromptArchiveUI } from './features/prompts/prompt-archive-ui.js';
import { cleanupCategoryTray, initCategoryTray } from './features/prompts/category-tray.js';

// Feature modules - Image Generation
import PollinationsInterceptor, { initPollinationsInterceptor } from './features/pollinations-interceptor.js';

// Feature modules - Directives
import { cleanupDirectiveUI, initDirectiveUI } from './features/directives/directive-ui.js';
import { cleanupMessageTriggerHooks, cleanupPromptDirectiveHooks, initPromptDirectiveHooks, initMessageTriggerHooks } from './features/directives/prompt-directive-hooks.js';
import { cleanupDirectiveAutocomplete, initDirectiveAutocomplete } from './features/directives/directive-autocomplete-ui.js';

// Feature modules - Backgrounds
import { animatedBackgrounds } from './features/backgrounds/animated-backgrounds-module.js';
import { backgroundUIEnhancements } from './features/backgrounds/background-ui-enhancements.js';
import { backgroundOrganizer } from './features/backgrounds/background-organizer.js';

// Feature modules - Reasoning
import { applyNemoNetReasoning, cleanupNemoNetReasoning } from './reasoning/nemonet-reasoning-config.js';
import { cleanupHTMLTrimmer, initializeHTMLTrimmer, setupAutoTrim } from './reasoning/html-trimmer.js';
import { initItalicDialogueRenderer } from './features/formatting/italic-dialogue-renderer.js';

// Feature modules - Onboarding/Tutorials
import { tutorialManager } from './features/onboarding/tutorial-manager.js';
import { tutorialLauncher } from './features/onboarding/tutorial-launcher.js';

// Feature modules - Character Manager & World Info
import { NemoCharacterManager } from './features/character-manager/character-manager.js';
import { NemoWorldInfoUI } from './features/world-info/world-info-ui.js';
import { NemoMarketplace } from './features/marketplace/marketplace.js';
import { NemoPersonaUI } from './features/persona/persona-ui.js';
import { initNemoRewrite, cleanupNemoRewrite } from './features/rewrite/runtime.js';
import { initNemoEngineInstaller, cleanupNemoEngineInstaller } from './features/preset-installer/runtime.js';
import domCache from './features/character-manager/dom-cache.js';

// Feature modules - Emoji Picker
import { EmojiPicker } from './features/emoji-picker/emoji-picker.js';

// Feature modules - Connection/Model Selector, API Router & Pipeline
import { ModelSelector } from './features/connection/model-selector.js';
import { TextCompletionSelector } from './features/connection/textcomp-selector.js';
import { ConnectionPool } from './features/connection/connection-pool.js';
import { ApiRouter } from './features/connection/api-router.js';
import { ModelPipeline } from './features/connection/model-pipeline.js';
import { PipelinePresets } from './features/connection/pipeline-presets.js';

// Archive modules - legacy code kept for reference
import { PresetNavigator } from './archive/navigator.js';

function featureEnabled(key) {
    return isFeatureEnabled(extension_settings[NEMO_EXTENSION_NAME], key);
}

// Supported APIs for preset navigator initialization (module scope for performance optimization)
const SUPPORTED_APIS = ['openai', 'novel', 'kobold', 'textgenerationwebui', 'anthropic', 'claude', 'google', 'scale', 'cohere', 'mistral', 'aix', 'openrouter'];

// Initialization guard to prevent double initialization
let extensionInitialized = false;
let extensionCleanupInProgress = false;
const extensionCleanupFunctions = [];

function cleanupExtension() {
    if (extensionCleanupInProgress || (!extensionInitialized && extensionCleanupFunctions.length === 0)) {
        return;
    }

    extensionCleanupInProgress = true;
    const cleanupFunctions = extensionCleanupFunctions.splice(0);

    try {
        logger.info('Performing extension cleanup');
        for (const cleanup of cleanupFunctions) {
            try {
                cleanup();
            } catch (error) {
                logger.error('Extension cleanup callback failed', error);
            }
        }

        try { window.NemoPresetManager?.destroy?.(); } catch (e) { /* ignore */ }
        try { cleanupPresetNavigatorWrappers(); } catch (e) { /* ignore */ }
        try { cleanupCategoryTray(); } catch (e) { /* ignore */ }
        try { NemoPersonaUI.destroy(); } catch (e) { /* ignore */ }
        try { NemoMarketplace.destroy(); } catch (e) { /* ignore */ }
        try { NemoGlobalUI.destroy(); } catch (e) { /* ignore */ }
        try { EmojiPicker.destroy(); } catch (e) { /* ignore */ }
        try { PollinationsInterceptor.destroy(); } catch (e) { /* ignore */ }
        try { tutorialLauncher.destroy(); } catch (e) { /* ignore */ }
        try { tutorialManager.destroy(); } catch (e) { /* ignore */ }
        try { backgroundOrganizer.destroy(); } catch (e) { /* ignore */ }
        try { backgroundUIEnhancements.destroy(); } catch (e) { /* ignore */ }
        try { animatedBackgrounds.destroy(); } catch (e) { /* ignore */ }
        try { NemoCharacterManager.destroy(); } catch (e) { /* ignore */ }
        try { cleanupNemoRewrite(); } catch (e) { /* ignore */ }
        try { cleanupNemoEngineInstaller(); } catch (e) { /* ignore */ }
        try { cleanupNemoNetReasoning(); } catch (e) { /* ignore */ }
        try { cleanupHTMLTrimmer(); } catch (e) { /* ignore */ }
        try { clearDirectiveCache(); } catch (e) { /* ignore */ }
        try { removeWidePanelsStyles(); } catch (e) { /* ignore */ }
        try { NemoWorldInfoUI.destroy(); } catch (e) { /* ignore */ }
        try { UserSettingsTabs.restoreOriginalLayout(); } catch (e) { /* ignore */ }
        try { UserSettingsTabs.cleanup(); } catch (e) { /* ignore */ }
        try { ExtensionsTabOverhaul.cleanup(); } catch (e) { /* ignore */ }
        try { NemoSettingsUI.destroy(); } catch (e) { /* ignore */ }
        try { ModelSelector.destroy(); } catch (e) { /* ignore */ }
        try { TextCompletionSelector.destroy(); } catch (e) { /* ignore */ }

        document.body?.classList.remove(
            'nemo-extensions-overhaul-enabled',
            'nemo-animated-backgrounds-enabled',
            'nemo-lorebook-overhaul-enabled',
            'nemo-mobile-enhanced',
        );

        document.querySelectorAll('[data-nemo-patched]').forEach(el => {
            delete el.dataset.nemoPatched;
        });
        document.querySelectorAll('[data-nemo-prompts-initialized]').forEach(el => {
            delete el.dataset.nemoPromptsInitialized;
        });
        document.querySelectorAll('[data-nemo-state-preservation-patched]').forEach(el => {
            delete el.dataset.nemoStatePreservationPatched;
        });
    } finally {
        extensionInitialized = false;
        extensionCleanupInProgress = false;
    }
}

window.NemoPresetExtCleanup = cleanupExtension;

// --- MAIN INITIALIZATION ---
const MAIN_SELECTORS = {
    promptsContainer: '#completion_prompt_manager_list',
    promptEditorPopup: '.completion_prompt_manager_popup_entry',
};

const CUSTOM_OPENAI_COMPATIBLE_SOURCE = 'custom';
const CUSTOM_OPENAI_TOP_K_SELECTOR = '#top_k_openai';
const CUSTOM_OPENAI_OMIT_ZERO_FIELDS = ['frequency_penalty', 'presence_penalty', 'repetition_penalty'];

function isZeroNumber(value) {
    return value !== undefined && value !== null && value !== '' && Number(value) === 0;
}

function getNumericInputValue(selector) {
    const value = document.querySelector(selector)?.value;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function addDataSource(element, source) {
    if (!element) return false;

    const sources = String(element.dataset.source || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

    if (sources.includes(source)) {
        return false;
    }

    element.dataset.source = [...sources, source].join(',');
    return true;
}

function syncSourceVisibility(element) {
    const sourceSelect = document.querySelector('#chat_completion_source');
    const selectedSource = sourceSelect?.value;

    if (!element || !selectedSource) return;

    const validSources = String(element.dataset.source || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    const mode = element.dataset.sourceMode;
    const matchesSource = validSources.includes(selectedSource);
    const shouldShow = mode !== 'except' ? matchesSource : !matchesSource;
    const jquery = window.jQuery || window.$;

    if (typeof jquery === 'function') {
        jquery(element).toggle(shouldShow);
    } else {
        element.style.display = shouldShow ? '' : 'none';
    }
}

function patchCustomOpenAiSamplingUi(originalTopKSources) {
    const topKBlock = document.querySelector(CUSTOM_OPENAI_TOP_K_SELECTOR)?.closest('[data-source]');
    if (!topKBlock) return;
    if (!originalTopKSources.has(topKBlock)) {
        originalTopKSources.set(topKBlock, {
            hadAttribute: topKBlock.hasAttribute('data-source'),
            value: topKBlock.getAttribute('data-source'),
        });
    }

    const changed = addDataSource(topKBlock, CUSTOM_OPENAI_COMPATIBLE_SOURCE);
    syncSourceVisibility(topKBlock);

    if (changed) {
        logger.debug('Enabled Top K control for custom OpenAI-compatible endpoints');
    }
}

function normalizeCustomOpenAiSamplingRequest(generateData) {
    if (!generateData || generateData.chat_completion_source !== CUSTOM_OPENAI_COMPATIBLE_SOURCE) {
        return;
    }

    for (const field of CUSTOM_OPENAI_OMIT_ZERO_FIELDS) {
        if (isZeroNumber(generateData[field])) {
            delete generateData[field];
        }
    }

    const topK = getNumericInputValue(CUSTOM_OPENAI_TOP_K_SELECTOR);
    if (topK !== null && topK > 0) {
        generateData.top_k = topK;
    } else if (isZeroNumber(generateData.top_k)) {
        delete generateData.top_k;
    }
}

function initializeCustomOpenAiSamplingPatch(eventCleanupFunctions) {
    const originalTopKSources = new Map();
    patchCustomOpenAiSamplingUi(originalTopKSources);
    const initialPatchTimeout = setTimeout(() => patchCustomOpenAiSamplingUi(originalTopKSources), 1000);

    const requestReadyHandler = (generateData) => {
        normalizeCustomOpenAiSamplingRequest(generateData);
    };

    let sourceChangedTimeout;
    const sourceChangedHandler = () => {
        clearTimeout(sourceChangedTimeout);
        sourceChangedTimeout = setTimeout(() => patchCustomOpenAiSamplingUi(originalTopKSources), 0);
    };

    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, requestReadyHandler);
    eventSource.on(event_types.CHATCOMPLETION_SOURCE_CHANGED, sourceChangedHandler);

    eventCleanupFunctions.push(() => {
        clearTimeout(initialPatchTimeout);
        eventSource.removeListener(event_types.CHAT_COMPLETION_SETTINGS_READY, requestReadyHandler);
        clearTimeout(sourceChangedTimeout);
        for (const [element, originalSource] of originalTopKSources) {
            if (originalSource.hadAttribute) {
                element.dataset.source = originalSource.value;
            } else {
                element.removeAttribute('data-source');
            }
            syncSourceVisibility(element);
        }
        originalTopKSources.clear();
        eventSource.removeListener(event_types.CHATCOMPLETION_SOURCE_CHANGED, sourceChangedHandler);
    });
}

// Immediate execution if element already exists
const leftNavPanel = document.querySelector('#left-nav-panel');
if (leftNavPanel) {
    initializeExtension();
} else {
    // Use waitForElement with increased timeout as fallback
    waitForElement('#left-nav-panel', async () => {
        initializeExtension();
    }, 10000); // Increased to 10 seconds
}

async function initializeExtension() {
    // Prevent double initialization
    if (extensionInitialized) {
        console.warn('🚨 [NemoPresetExt] Already initialized, skipping duplicate call');
        return;
    }
    extensionInitialized = true;
    extensionCleanupFunctions.length = 0;
    const eventCleanupFunctions = extensionCleanupFunctions;

    try {
        console.log('🔧 NemoNet: initializeExtension() called');
        logger.info('Initializing NemoPresetExt...');

        console.log('🔧 NemoNet: Ensuring settings namespace...');
        ensureSettingsNamespace();
        document.body.classList.toggle('nemo-extensions-overhaul-enabled', featureEnabled('nemoEnableExtensionsTabOverhaul'));
        document.body.classList.toggle('nemo-animated-backgrounds-enabled', featureEnabled('enableAnimatedBackgrounds'));
        document.body.classList.toggle('nemo-lorebook-overhaul-enabled', featureEnabled('enableLorebookOverhaul'));
        NemoSettingsUI.applyDropdownTheme(extension_settings.NemoPresetExt?.dropdownTheme || 'st');

        // Initialize storage and run one-time migration from localStorage
        initializeStorage();
        migrateFromLocalStorage();

        // Register capture before slower UI/feature initialization so a response
        // completed during startup is handled by the live message lifecycle.
        if (featureEnabled('enableReasoningCapture')) {
            applyNemoNetReasoning();
        }

        // Initialize UI themes early (before other UI elements load)
        console.log('🔧 NemoNet: Initializing UI themes...');
        await initializeThemes();

        if (featureEnabled('enablePromptManager')) {
            await loadAndSetDividerRegex();
        }

        // Initialize all modules
        console.log('🔧 NemoNet: Initializing modules...');
        if (featureEnabled('enableCharacterNavigator')) {
            NemoCharacterManager.initialize();
        }
        console.log('🔧 NemoNet: Calling NemoSettingsUI.initialize()...');
        await NemoSettingsUI.initialize();
        console.log('🔧 NemoNet: NemoSettingsUI.initialize() returned');

        // Initialize theme selector UI handlers (after settings UI is loaded)
        initThemeSelector();

        if (featureEnabled('enableConnectionPanelOverhaul')) {
            NemoGlobalUI.initialize();
        } else {
            logger.info('Connection panel overhaul is disabled, preserving native SillyTavern layout');
        }
        if (featureEnabled('enableMarketplace')) {
            NemoMarketplace.initialize();
        }
        if (featureEnabled('enablePersonaEnhancements')) {
            NemoPersonaUI.initialize();
        }
        // NemoPromptArchiveUI.initialize(); // Disabled — replaced by category tray archive

        if (featureEnabled('enableRewrite')) {
            try {
                await initNemoRewrite();
            } catch (error) {
                logger.error('Nemo Rewrite failed to initialize; continuing with core NemoPresetExt UI', error);
            }
        }

        // Initialize tab overhauls only if enabled
        if (featureEnabled('enableTabOverhauls')) {
            UserSettingsTabs.initialize(); // Handles both User Settings AND Advanced Formatting tabs
            // AdvancedFormattingTabs.initialize(); // Disabled - absorbed into UserSettingsTabs
        }

        if (featureEnabled('enableLorebookOverhaul')) {
            NemoWorldInfoUI.initialize();
        }

        // Initialize Animated Backgrounds if enabled
        if (featureEnabled('enableAnimatedBackgrounds')) {
            await animatedBackgrounds.initialize();
            animatedBackgrounds.addSettingsToUI();
            await backgroundUIEnhancements.initialize();
            await backgroundOrganizer.initialize();
        }

        // Initialize the supported directive runtime as one lifecycle-managed bundle.
        // Legacy duplicate panels stay disconnected; the shared cache feeds the prompt tray.
        if (featureEnabled('enableDirectives')) {
            eventCleanupFunctions.push(() => {
                cleanupDirectiveAutocomplete();
                cleanupMessageTriggerHooks();
                cleanupPromptDirectiveHooks();
                cleanupDirectiveUI();
            });

            initDirectiveUI();
            initPromptDirectiveHooks();
            initMessageTriggerHooks();
            if (featureEnabled('enableDirectiveAutocomplete')) {
                initDirectiveAutocomplete();
            }
            console.log('🔧 NemoNet: Initializing directive cache...');
            const directiveCacheTimeout = setTimeout(() => {
                initializeDirectiveCache();
                console.log('🔧 NemoNet: Directive cache initialized');
            }, 1000); // Delay to ensure promptManager is ready
            eventCleanupFunctions.push(() => clearTimeout(directiveCacheTimeout));
        }


        // Initialize category tray system for quick prompt selection
        if (featureEnabled('enablePromptManager')) {
            initCategoryTray();
        }

        // Initialize Pollinations Interceptor (experimental - opt-in)
        const pollinationsInterceptorEnabled = featureEnabled('nemoEnablePollinationsInterceptor');
        if (pollinationsInterceptorEnabled) {
            logger.info('Initializing Pollinations Interceptor (experimental)...');
            initPollinationsInterceptor();
        }

        // Initialize HTML trimmer for reducing context usage in old messages
        if (featureEnabled('enableHTMLTrimming')) {
            initializeHTMLTrimmer();
            setupAutoTrim();
        }

        // Initialize Emoji Picker
        if (featureEnabled('enableEmojiPicker')) {
            EmojiPicker.initialize();
        }

        if (featureEnabled('enableTutorials')) {
            tutorialManager.initialize();
            tutorialLauncher.initialize();
            tutorialLauncher.checkWelcomeTutorial();
        }

        if (featureEnabled('enableNemoEngineInstaller')) {
            initNemoEngineInstaller();
        }

        // Make ExtensionsTabOverhaul available globally for the settings toggle
        window.ExtensionsTabOverhaul = ExtensionsTabOverhaul;

        // Make NemoPresetManager available globally for preset state preservation
        window.NemoPresetManager = NemoPresetManager;

        if (featureEnabled('enableApiRouter')) {
            ConnectionPool.load();
            window.NemoConnectionPool = ConnectionPool;
            window.NemoApiRouter = ApiRouter;
            window.NemoModelPipeline = ModelPipeline;
            window.NemoPipelinePresets = PipelinePresets;
            logger.info('API Router + Model Pipeline initialized');
        }

        // Make PollinationsInterceptor available globally for manual testing
        // Usage: window.PollinationsInterceptor.init() - Initialize interceptor
        //        window.PollinationsInterceptor.scan(element) - Scan element for Pollinations images
        //        window.PollinationsInterceptor.interceptAll(element) - Process all images in element
        //        window.PollinationsInterceptor.extractPrompts(html) - Extract prompts without replacing
        window.PollinationsInterceptor = PollinationsInterceptor;

        // Event listener management with cleanup
        initializeCustomOpenAiSamplingPatch(eventCleanupFunctions);
        if (featureEnabled('enableItalicDialogueRenderer')) {
            initItalicDialogueRenderer(eventCleanupFunctions);
        }

        const extensionsOverhaulEnabled = featureEnabled('nemoEnableExtensionsTabOverhaul');
        logger.debug('Extensions Tab Overhaul setting check', { enabled: extensionsOverhaulEnabled });

        if (extensionsOverhaulEnabled) {
            logger.info('Initializing Extensions Tab Overhaul...');
            ExtensionsTabOverhaul.initialize();
        } else {
            logger.info('Extensions Tab Overhaul is disabled, skipping initialization');
        }

        // Initialize Wide Panels setting - Add or remove CSS that makes panels take 50% width
        const widePanelsEnabled = featureEnabled('nemoEnableWidePanels');
        logger.debug('Wide Panels setting check', { widePanelsEnabled, fullValue: extension_settings.NemoPresetExt?.nemoEnableWidePanels });

        if (widePanelsEnabled) {
            logger.info('Wide Panels enabled, applying 50% width CSS');
            applyWidePanelsStyles();
        } else {
            logger.info('Wide Panels disabled, using SillyTavern default width');
            removeWidePanelsStyles();
        }

        // Add event listener for settings changes to update the panel width behavior
        let settingsUpdateTimeout;
        const settingsUpdatedHandler = () => {
            clearTimeout(settingsUpdateTimeout);
            settingsUpdateTimeout = setTimeout(() => {
                const newWidePanelsEnabled = featureEnabled('nemoEnableWidePanels');
                logger.debug('Wide Panels setting changed', { newWidePanelsEnabled });

                if (newWidePanelsEnabled) {
                    logger.info('Wide Panels setting enabled, applying 50% width CSS');
                    applyWidePanelsStyles();
                } else {
                    logger.info('Wide Panels setting disabled, using SillyTavern default width');
                    removeWidePanelsStyles();
                }

                // Refresh directive cache when settings change (prompts may have been modified)
                if (featureEnabled('enableDirectives')) {
                    initializeDirectiveCache();
                }
            }, 100); // Small delay to ensure settings are fully updated
        };
        eventSource.on(event_types.SETTINGS_UPDATED, settingsUpdatedHandler);
        eventCleanupFunctions.push(() => {
            clearTimeout(settingsUpdateTimeout);
            eventSource.removeListener(event_types.SETTINGS_UPDATED, settingsUpdatedHandler);
        });

        // Handle viewport resize for wide panels (disable on mobile)
        let resizeTimeout;
        const resizeHandler = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const widePanelsEnabled = featureEnabled('nemoEnableWidePanels');
                if (widePanelsEnabled) {
                    applyWidePanelsStyles(); // Will auto-disable on mobile
                }
            }, 150);
        };
        window.addEventListener('resize', resizeHandler);
        eventCleanupFunctions.push(() => {
            clearTimeout(resizeTimeout);
            window.removeEventListener('resize', resizeHandler);
        });

        // Initialize Mobile Enhancements - auto-detect touch devices
        if (featureEnabled('enableMobileEnhancements')) {
            const cleanupMobileEnhancements = initializeMobileEnhancements();
            if (typeof cleanupMobileEnhancements === 'function') {
                eventCleanupFunctions.push(cleanupMobileEnhancements);
            }
        } else {
            document.body.classList.remove('nemo-mobile-enhanced');
        }

        // Initialize Enhanced Model Selector (searchable dropdowns + favorites + chips)
        // Must run LATE - after ST's own Select2 init on OpenRouter/etc.
        if (featureEnabled('enableModelSelector')) {
            const modelSelectorTimeout = setTimeout(() => {
                try {
                    ModelSelector.initialize();
                    logger.info('Enhanced Model Selector initialized');
                } catch (err) {
                    logger.error('Failed to initialize Model Selector', err);
                }
                try {
                    TextCompletionSelector.initialize();
                    logger.info('Text Completion Selector initialized');
                } catch (err) {
                    logger.error('Failed to initialize Text Completion Selector', err);
                }
            }, 1500); // Delay to ensure ST's own Select2 init has completed
            eventCleanupFunctions.push(() => clearTimeout(modelSelectorTimeout));
        }

        // Observer management with proper cleanup
        const ExtensionManager = {
            observers: new Map(),

            createObserver(name, callback, options = { childList: true, subtree: true }) {
                // Disconnect existing observer if it exists
                this.disconnectObserver(name);

                const observer = new MutationObserver(callback);
                this.observers.set(name, observer);
                observer.observe(document.body, options);
                logger.debug(`Created observer: ${name}`);
                return observer;
            },

            disconnectObserver(name) {
                const observer = this.observers.get(name);
                if (observer) {
                    observer.disconnect();
                    this.observers.delete(name);
                    logger.debug(`Disconnected observer: ${name}`);
                }
            },

            disconnectAll() {
                this.observers.forEach((observer, name) => {
                    observer.disconnect();
                    logger.debug(`Disconnected observer: ${name}`);
                });
                this.observers.clear();
                domCache.destroy();
                logger.info('All observers disconnected and cache cleared');
            }
        };
        eventCleanupFunctions.unshift(() => ExtensionManager.disconnectAll());

        // Track initialization state for early exit optimization
        const nemoInitState = {
            promptList: false,
            apis: new Set(),
            isFirstRun: true  // Track if this is the first run (for RAF optimization)
        };

        const promptManagerEnabled = featureEnabled('enablePromptManager');
        const presetNavigatorEnabled = featureEnabled('enablePresetNavigator');

        // Core initialization logic - separated for reuse
        const performNavigatorCheck = () => {
            if (!promptManagerEnabled && !presetNavigatorEnabled) {
                return;
            }

            const promptManagerReady = !promptManagerEnabled || nemoInitState.promptList;
            const presetNavigatorReady = !presetNavigatorEnabled || nemoInitState.apis.size === SUPPORTED_APIS.length;
            if (promptManagerReady && presetNavigatorReady) {
                const wrapperExists = !promptManagerEnabled || document.getElementById('nemoSearchAndStatusWrapper');
                if (wrapperExists) {
                    return;
                }
            }

            if (promptManagerEnabled) {
                const promptList = document.querySelector(CONSTANTS.SELECTORS.PROMPT_CONTAINER);
                const wrapperExists = document.getElementById('nemoSearchAndStatusWrapper');

                if (promptList && (!promptList.dataset.nemoPromptsInitialized || !wrapperExists)) {
                    logger.performance('Prompt Manager Initialization', () => {
                        delete promptList.dataset.nemoPromptsInitialized;
                        NemoPresetManager.initialize(promptList);
                    });
                    nemoInitState.promptList = true;
                }
            }

            if (presetNavigatorEnabled) {
                SUPPORTED_APIS.forEach(api => {
                    if (nemoInitState.apis.has(api)) return;
                    const select = document.querySelector(`select[data-preset-manager-for="${api}"]`);
                    if (select && !select.dataset.nemoPatched) {
                        try {
                            initPresetNavigatorForApiEnhanced(api);
                            nemoInitState.apis.add(api);
                        } catch (error) {
                            logger.error(`Failed to initialize preset navigator for ${api}`, error);
                        }
                    }
                });
            }
        };

        // Debounced navigator initialization (for subsequent runs)
        let navigatorCheckTimeout;
        const debouncedCheckNavigators = () => {
            clearTimeout(navigatorCheckTimeout);
            navigatorCheckTimeout = setTimeout(performNavigatorCheck, 100);
        };

        // Function to check and initialize preset navigators
        // Runs synchronously to avoid race conditions with other DOM manipulations
        const checkAndInitializePresetNavigators = () => {
            if (nemoInitState.isFirstRun) {
                nemoInitState.isFirstRun = false;
                // Run synchronously on first run to prevent race conditions
                performNavigatorCheck();
            } else {
                // Subsequent runs: use debounce to coalesce rapid mutations
                debouncedCheckNavigators();
            }
        };

        // Check for existing dropdowns immediately
        checkAndInitializePresetNavigators();

        // Also check after a short delay to catch elements that load slightly after initialization
        const delayedNavigatorCheckTimeout = setTimeout(() => {
            logger.debug('Running delayed preset navigator check');
            checkAndInitializePresetNavigators();
        }, 500);

        // And check again after a longer delay to be extra sure
        const finalNavigatorCheckTimeout = setTimeout(() => {
            logger.debug('Running final delayed preset navigator check');
            checkAndInitializePresetNavigators();
        }, 2000);
        eventCleanupFunctions.push(() => {
            clearTimeout(navigatorCheckTimeout);
            clearTimeout(delayedNavigatorCheckTimeout);
            clearTimeout(finalNavigatorCheckTimeout);
        });

        // Track the current observe target for re-attachment
        let currentObserveTarget = null;

        // Create the main UI observer
        const createMainObserver = (target) => {
            const observer = new MutationObserver((mutations) => {
                // Only trigger on added nodes to reduce noise
                const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
                if (hasAddedNodes) {
                    checkAndInitializePresetNavigators();
                }
            });
            observer.observe(target, { childList: true, subtree: true });
            return observer;
        };

        // Attach observer to the best available target
        const attachMainObserver = () => {
            const leftNavPanel = document.getElementById('left-nav-panel');
            const newTarget = leftNavPanel || document.body;

            // Only re-attach if target changed
            if (newTarget !== currentObserveTarget) {
                // Disconnect existing observer
                ExtensionManager.disconnectObserver('mainUI');

                // Create and attach new observer
                const observer = createMainObserver(newTarget);
                ExtensionManager.observers.set('mainUI', observer);
                currentObserveTarget = newTarget;

                if (leftNavPanel) {
                    logger.debug('Observer attached to #left-nav-panel (scoped)');
                } else {
                    logger.debug('Observer attached to document.body (fallback)');
                }
            }
        };

        // Initial attachment
        attachMainObserver();

        // Sentinel observer: watches for #left-nav-panel appearing/disappearing
        // This handles cases where SillyTavern's virtual DOM recreates the panel
        const sentinelObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Check added nodes for our target
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
                        if (element.id === 'left-nav-panel' || element.querySelector?.('#left-nav-panel')) {
                            logger.debug('Detected #left-nav-panel appearance, re-attaching observer');
                            attachMainObserver();
                            return;
                        }
                    }
                }
                // Check removed nodes - if our target was removed, fall back to body
                for (const node of mutation.removedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
                        if (element.id === 'left-nav-panel' || element.querySelector?.('#left-nav-panel')) {
                            logger.debug('Detected #left-nav-panel removal, falling back to body observer');
                            currentObserveTarget = null; // Force re-evaluation
                            attachMainObserver();
                            return;
                        }
                    }
                }
            }
        });

        // Sentinel only watches direct children of body (lightweight)
        sentinelObserver.observe(document.body, { childList: true, subtree: false });
        ExtensionManager.observers.set('sentinel', sentinelObserver);

        // Listen for events that might require UI refresh
        let chatCompletionRefreshTimeout;
        const chatCompletionChangeHandler = () => {
            logger.info('Chat completion source changed, will refresh UI');
            clearTimeout(chatCompletionRefreshTimeout);
            chatCompletionRefreshTimeout = setTimeout(() => {
                const promptList = document.querySelector(CONSTANTS.SELECTORS.PROMPT_CONTAINER);
                if (promptList && promptList.dataset.nemoPromptsInitialized) {
                    logger.performance('UI Refresh', () => {
                        NemoPresetManager.refreshUI();
                    });
                }
            }, CONSTANTS.TIMEOUTS.UI_REFRESH_DELAY);
        };

        eventSource.on(event_types.CHATCOMPLETION_SOURCE_CHANGED, chatCompletionChangeHandler);
        eventCleanupFunctions.push(() => {
            clearTimeout(chatCompletionRefreshTimeout);
            eventSource.removeListener(event_types.CHATCOMPLETION_SOURCE_CHANGED, chatCompletionChangeHandler);
        });

        logger.info('Initialization complete and observers are running');
    } catch (error) {
        logger.error('Critical failure during initialization', error);
        cleanupExtension();
        console.error('🚨 [NemoPresetExt] CRITICAL ERROR:', error);
        console.error('🚨 [NemoPresetExt] Stack trace:', error.stack);
    }
}

// CSS functions for Wide Panels feature - conditionally load the styles
function applyWidePanelsStyles() {
    // Skip on mobile devices - wide panels don't make sense on small screens
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
        logger.debug('Wide panels disabled on mobile viewport');
        removeWidePanelsStyles();
        return;
    }

    // Remove any existing styles first
    let styleEl = document.getElementById('nemo-wide-panels-styles');
    if (styleEl) {
        styleEl.remove();
    }

    // Add the wide panels CSS with media query to prevent mobile application
    styleEl = document.createElement('style');
    styleEl.id = 'nemo-wide-panels-styles';
    styleEl.textContent = `
        /* Wide navigation panels - 50% viewport width (desktop only) */
        @media (min-width: 769px) {
            #right-nav-panel {
                width: 50vw !important;
                right: 0 !important;
                left: auto !important;
            }
            #left-nav-panel {
                width: 50vw !important;
                left: 0 !important;
            }
        }
    `;
    document.head.appendChild(styleEl);
    logger.debug('Applied wide panels styles (50% width, desktop only)');
}

function removeWidePanelsStyles() {
    const styleEl = document.getElementById('nemo-wide-panels-styles');
    if (styleEl) {
        styleEl.remove();
        logger.debug('Removed wide panels styles (using SillyTavern default width)');
    }
}

// Mobile Enhancements - Auto-detect touch devices and apply enhanced mobile styles
function initializeMobileEnhancements() {
    const isEnabled = featureEnabled('enableMobileEnhancements');
    const touchMediaQuery = window.matchMedia('(pointer: coarse)');
    const isTouchDevice = touchMediaQuery.matches;

    logger.debug('Mobile enhancements check', { isEnabled, isTouchDevice });

    if (isEnabled && isTouchDevice) {
        document.body.classList.add('nemo-mobile-enhanced');
        logger.info('Mobile enhancements enabled - touch device detected');
    } else {
        document.body.classList.remove('nemo-mobile-enhanced');
        if (!isEnabled) {
            logger.info('Mobile enhancements disabled by user setting');
        } else {
            logger.debug('Mobile enhancements not applied - not a touch device');
        }
    }

    // Listen for device changes (e.g., connecting external mouse on tablet)
    const pointerChangeHandler = (e) => {
        const isEnabled = featureEnabled('enableMobileEnhancements');
        if (isEnabled && e.matches) {
            document.body.classList.add('nemo-mobile-enhanced');
            logger.info('Touch device detected - enabling mobile enhancements');
        } else if (!e.matches) {
            document.body.classList.remove('nemo-mobile-enhanced');
            logger.info('Non-touch device detected - disabling mobile enhancements');
        }
    };

    if (typeof touchMediaQuery.addEventListener === 'function') {
        touchMediaQuery.addEventListener('change', pointerChangeHandler);
        return () => touchMediaQuery.removeEventListener('change', pointerChangeHandler);
    }

    if (typeof touchMediaQuery.addListener === 'function') {
        touchMediaQuery.addListener(pointerChangeHandler);
        return () => touchMediaQuery.removeListener(pointerChangeHandler);
    }

    return undefined;
}

// Enhanced preset navigator initialization that works with both new and legacy code
function initPresetNavigatorForApiEnhanced(apiType) {
    const selector = `select[data-preset-manager-for="${apiType}"]`;
    const originalSelect = document.querySelector(selector);
    if (!originalSelect || originalSelect.dataset.nemoPatched) return;

    originalSelect.dataset.nemoPatched = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'nemo-preset-selector-wrapper';

    const browseButton = document.createElement('button');
    browseButton.textContent = 'Browse...';
    browseButton.className = 'menu_button interactable';

    browseButton.addEventListener('click', (event) => {
        const navigator = new PresetNavigator(apiType);
        navigator.open();
    });

    originalSelect.parentElement.insertBefore(wrapper, originalSelect);
    wrapper.appendChild(originalSelect);
    wrapper.appendChild(browseButton);
}

function cleanupPresetNavigatorWrappers() {
    document.querySelectorAll('.nemo-preset-selector-wrapper').forEach(wrapper => {
        const select = wrapper.querySelector(':scope > select[data-preset-manager-for]');
        if (select && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(select, wrapper);
            delete select.dataset.nemoPatched;
        }
        wrapper.remove();
    });
    document.querySelectorAll('.nemo-favorites-container').forEach(container => container.remove());
}
