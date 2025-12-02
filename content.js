import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

// Core utilities
import { LOG_PREFIX, ensureSettingsNamespace, waitForElement } from './core/utils.js';
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
import { NemoPromptArchiveUI } from './features/prompts/prompt-archive-ui.js';
import { initCategoryTray } from './features/prompts/category-tray.js';

// Feature modules - Image Generation
import { initPollinationsInterceptor } from './features/pollinations-interceptor.js';
import PollinationsInterceptor from './features/pollinations-interceptor.js';

// Feature modules - Directives
import { initDirectiveUI } from './features/directives/directive-ui.js';
import { initPromptDirectiveHooks, initMessageTriggerHooks } from './features/directives/prompt-directive-hooks.js';
import { initDirectiveAutocomplete } from './features/directives/directive-autocomplete-ui.js';
import { initDirectiveFeatures } from './features/directives/directive-features.js';
import { initDirectiveFeaturesFixes } from './features/directives/directive-features-fixes.js';

// Feature modules - Backgrounds
import { animatedBackgrounds } from './features/backgrounds/animated-backgrounds-module.js';
import { backgroundUIEnhancements } from './features/backgrounds/background-ui-enhancements.js';

// Feature modules - Reasoning
import { applyNemoNetReasoning } from './reasoning/nemonet-reasoning-config.js';
import { initializeHTMLTrimmer, setupAutoTrim } from './reasoning/html-trimmer.js';

// Feature modules - Onboarding/Tutorials
import { tutorialManager } from './features/onboarding/tutorial-manager.js';
import { tutorialLauncher } from './features/onboarding/tutorial-launcher.js';

// Archive modules - these are still in use but may be deprecated in future versions
import { NemoCharacterManager } from './archive/character-manager.js';
import { PresetNavigator } from './archive/navigator.js';
import { NemoWorldInfoUI } from './archive/world-info-ui.js';
import domCache from './archive/dom-cache.js';

// Extension name constant for legacy code compatibility
const NEMO_EXTENSION_NAME = 'NemoPresetExt';

// Initialization guard to prevent double initialization
let extensionInitialized = false;

// --- MAIN INITIALIZATION ---
const MAIN_SELECTORS = {
    promptsContainer: '#completion_prompt_manager_list',
    promptEditorPopup: '.completion_prompt_manager_popup_entry',
};

// 🔧 EMERGENCY: Try immediate initialization first
console.log('🚨 [NemoPresetExt] Starting initialization check...');
console.log('🚨 [NemoPresetExt] Left nav panel exists?:', document.querySelector('#left-nav-panel'));

// Immediate execution if element already exists
const leftNavPanel = document.querySelector('#left-nav-panel');
if (leftNavPanel) {
    console.log('🚨 [NemoPresetExt] Left nav panel found immediately, initializing...');
    initializeExtension();
} else {
    console.log('🚨 [NemoPresetExt] Waiting for left nav panel...');
    // Use waitForElement with increased timeout as fallback
    waitForElement('#left-nav-panel', async () => {
        console.log('🚨 [NemoPresetExt] Left nav panel found via waitForElement');
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

    try {
        console.log('🔧 NemoNet: initializeExtension() called');
        logger.info('Initializing NemoPresetExt...');

        console.log('🔧 NemoNet: Ensuring settings namespace...');
        ensureSettingsNamespace();

        // Initialize storage and run one-time migration from localStorage
        initializeStorage();
        migrateFromLocalStorage();

        // Initialize UI themes early (before other UI elements load)
        console.log('🔧 NemoNet: Initializing UI themes...');
        await initializeThemes();

        await loadAndSetDividerRegex();

        // Initialize all modules
        console.log('🔧 NemoNet: Initializing modules...');
        NemoCharacterManager.initialize();
        console.log('🔧 NemoNet: Calling NemoSettingsUI.initialize()...');
        NemoSettingsUI.initialize();
        console.log('🔧 NemoNet: NemoSettingsUI.initialize() returned');

        // Initialize theme selector UI handlers (after settings UI is loaded)
        initThemeSelector();

        NemoGlobalUI.initialize();
        NemoPromptArchiveUI.initialize();

        // Initialize tab overhauls only if enabled
        if (extension_settings.NemoPresetExt?.enableTabOverhauls !== false) {
            UserSettingsTabs.initialize();
            AdvancedFormattingTabs.initialize();
        }

        if (extension_settings.NemoPresetExt?.enableLorebookOverhaul !== false) {
            NemoWorldInfoUI.initialize();
        }

        // Initialize Animated Backgrounds if enabled
        if (extension_settings.NemoPresetExt?.enableAnimatedBackgrounds !== false) {
            await animatedBackgrounds.initialize();
            animatedBackgrounds.addSettingsToUI();
            await backgroundUIEnhancements.initialize();
        }

        // Initialize directive cache for performance (parse once, use everywhere)
        // This caches all prompt directives so we don't re-parse content repeatedly
        console.log('🔧 NemoNet: Initializing directive cache...');
        setTimeout(() => {
            initializeDirectiveCache();
            console.log('🔧 NemoNet: Directive cache initialized');
        }, 1000); // Delay to ensure promptManager is ready

        // Initialize directive system
        initDirectiveUI();
        initPromptDirectiveHooks();
        initMessageTriggerHooks();  // Message-based auto-enable/disable triggers
        initDirectiveAutocomplete();
        initDirectiveFeatures();

        // Apply fixes for directive features
        initDirectiveFeaturesFixes();

        // Initialize category tray system for quick prompt selection
        initCategoryTray();

        // Initialize Pollinations Interceptor (experimental - opt-in)
        const pollinationsInterceptorEnabled = extension_settings.NemoPresetExt?.nemoEnablePollinationsInterceptor === true;
        if (pollinationsInterceptorEnabled) {
            logger.info('Initializing Pollinations Interceptor (experimental)...');
            initPollinationsInterceptor();
        }

        // Initialize robust reasoning parser for NemoNet CoT
        applyNemoNetReasoning();

        // Initialize HTML trimmer for reducing context usage in old messages
        initializeHTMLTrimmer();
        setupAutoTrim();

        // Initialize tutorial system
        tutorialManager.initialize();
        tutorialLauncher.initialize();

        // Check if welcome tutorial should auto-start (for first-time users)
        tutorialLauncher.checkWelcomeTutorial();

        // Make ExtensionsTabOverhaul available globally for the settings toggle
        window.ExtensionsTabOverhaul = ExtensionsTabOverhaul;

        // Make NemoPresetManager available globally for preset state preservation
        window.NemoPresetManager = NemoPresetManager;

        // Make PollinationsInterceptor available globally for manual testing
        // Usage: window.PollinationsInterceptor.init() - Initialize interceptor
        //        window.PollinationsInterceptor.scan(element) - Scan element for Pollinations images
        //        window.PollinationsInterceptor.interceptAll(element) - Process all images in element
        //        window.PollinationsInterceptor.extractPrompts(html) - Extract prompts without replacing
        window.PollinationsInterceptor = PollinationsInterceptor;

        const isEnabled = extension_settings.NemoPresetExt?.nemoEnableExtensionsTabOverhaul !== false;
        logger.debug('Extensions Tab Overhaul setting check', { isEnabled, fullValue: extension_settings.NemoPresetExt?.nemoEnableExtensionsTabOverhaul });

        if (isEnabled) {
            logger.info('Initializing Extensions Tab Overhaul...');
            ExtensionsTabOverhaul.initialize();
        } else {
            logger.info('Extensions Tab Overhaul is disabled, skipping initialization');
        }

        // Initialize Wide Panels setting - Add or remove CSS that makes panels take 50% width
        const widePanelsEnabled = extension_settings.NemoPresetExt?.nemoEnableWidePanels !== false;
        logger.debug('Wide Panels setting check', { widePanelsEnabled, fullValue: extension_settings.NemoPresetExt?.nemoEnableWidePanels });

        if (widePanelsEnabled) {
            logger.info('Wide Panels enabled, applying 50% width CSS');
            applyWidePanelsStyles();
        } else {
            logger.info('Wide Panels disabled, using SillyTavern default width');
            removeWidePanelsStyles();
        }

        // Add event listener for settings changes to update the panel width behavior
        eventSource.on(event_types.SETTINGS_UPDATED, () => {
            setTimeout(() => {
                const newWidePanelsEnabled = extension_settings.NemoPresetExt?.nemoEnableWidePanels !== false;
                logger.debug('Wide Panels setting changed', { newWidePanelsEnabled });

                if (newWidePanelsEnabled) {
                    logger.info('Wide Panels setting enabled, applying 50% width CSS');
                    applyWidePanelsStyles();
                } else {
                    logger.info('Wide Panels setting disabled, using SillyTavern default width');
                    removeWidePanelsStyles();
                }

                // Refresh directive cache when settings change (prompts may have been modified)
                initializeDirectiveCache();
            }, 100); // Small delay to ensure settings are fully updated
        });

        // Handle viewport resize for wide panels (disable on mobile)
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const widePanelsEnabled = extension_settings.NemoPresetExt?.nemoEnableWidePanels !== false;
                if (widePanelsEnabled) {
                    applyWidePanelsStyles(); // Will auto-disable on mobile
                }
            }, 150);
        });

        // Initialize Mobile Enhancements - auto-detect touch devices
        initializeMobileEnhancements();

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

        // Function to check and initialize preset navigators
        const checkAndInitializePresetNavigators = () => {
            // Initialize Prompt Manager sections when the list appears
            const promptList = document.querySelector(CONSTANTS.SELECTORS.PROMPT_CONTAINER);
            if (promptList && !promptList.dataset.nemoPromptsInitialized) {
                logger.performance('Prompt Manager Initialization', () => {
                    NemoPresetManager.initialize(promptList);
                });
            }

            // Patch API preset dropdowns with the "Browse..." button
            const supportedApis = ['openai', 'novel', 'kobold', 'textgenerationwebui', 'anthropic', 'claude', 'google', 'scale', 'cohere', 'mistral', 'aix', 'openrouter'];
            supportedApis.forEach(api => {
                const select = document.querySelector(`select[data-preset-manager-for="${api}"]`);
                if (select && !select.dataset.nemoPatched) {
                    try {
                        initPresetNavigatorForApiEnhanced(api);
                    } catch (error) {
                        logger.error(`Failed to initialize preset navigator for ${api}`, error);
                    }
                }
            });
        };

        // Check for existing dropdowns immediately
        checkAndInitializePresetNavigators();

        // Also check after a short delay to catch elements that load slightly after initialization
        setTimeout(() => {
            logger.debug('Running delayed preset navigator check');
            checkAndInitializePresetNavigators();
        }, 500);

        // And check again after a longer delay to be extra sure
        setTimeout(() => {
            logger.debug('Running final delayed preset navigator check');
            checkAndInitializePresetNavigators();
        }, 2000);

        // Simple observer for critical functionality only - matches original behavior
        const observer = new MutationObserver((mutations) => {
            checkAndInitializePresetNavigators();
        });

        observer.observe(document.body, { childList: true, subtree: true });
        ExtensionManager.observers.set('mainUI', observer);

        // Event listener management with cleanup
        const eventCleanupFunctions = [];

        // Listen for events that might require UI refresh
        const chatCompletionChangeHandler = () => {
            logger.info('Chat completion source changed, will refresh UI');
            setTimeout(() => {
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
            eventSource.removeListener(event_types.CHATCOMPLETION_SOURCE_CHANGED, chatCompletionChangeHandler);
        });

        // Global cleanup function for extension unload/reload
        window.NemoPresetExtCleanup = () => {
            logger.info('Performing extension cleanup');
            ExtensionManager.disconnectAll();
            eventCleanupFunctions.forEach(cleanup => cleanup());
            eventCleanupFunctions.length = 0;

            // Clean up NemoPresetManager
            if (window.NemoPresetManager && typeof window.NemoPresetManager.destroy === 'function') {
                window.NemoPresetManager.destroy();
            }

            // Reset patched flags
            document.querySelectorAll('[data-nemo-patched]').forEach(el => {
                delete el.dataset.nemoPatched;
            });
            document.querySelectorAll('[data-nemo-prompts-initialized]').forEach(el => {
                delete el.dataset.nemoPromptsInitialized;
            });
            document.querySelectorAll('[data-nemo-state-preservation-patched]').forEach(el => {
                delete el.dataset.nemoStatePreservationPatched;
            });
        };

        logger.info('Initialization complete and observers are running');
    } catch (error) {
        logger.error('Critical failure during initialization', error);
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
    const isEnabled = extension_settings.NemoPresetExt?.enableMobileEnhancements !== false;
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

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
    window.matchMedia('(pointer: coarse)').addEventListener('change', (e) => {
        const isEnabled = extension_settings.NemoPresetExt?.enableMobileEnhancements !== false;
        if (isEnabled && e.matches) {
            document.body.classList.add('nemo-mobile-enhanced');
            logger.info('Touch device detected - enabling mobile enhancements');
        } else if (!e.matches) {
            document.body.classList.remove('nemo-mobile-enhanced');
            logger.info('Non-touch device detected - disabling mobile enhancements');
        }
    });
}

// Keep old function names for backward compatibility
const applyWidePanelsOverride = removeWidePanelsStyles;
const removeWidePanelsOverride = applyWidePanelsStyles;

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

async function initializeNemoSettingsUI() {
    const pollForSettings = setInterval(async () => {
        const container = document.getElementById('extensions_settings');
        if (container && !document.querySelector('.nemo-preset-enhancer-settings')) {
            clearInterval(pollForSettings);
            ensureSettingsNamespace();
            const response = await fetch(`scripts/extensions/third-party/${NEMO_EXTENSION_NAME}/settings.html`);
            if (!response.ok) { console.error(`${LOG_PREFIX} Failed to fetch settings.html`); return; }
            container.insertAdjacentHTML('beforeend', await response.text());

            const regexInput = document.getElementById('nemoDividerRegexPattern');
            const saveButton = document.getElementById('nemoSaveRegexSettings');
            const statusDiv = document.getElementById('nemoRegexStatus');

            regexInput.value = extension_settings[NEMO_EXTENSION_NAME]?.dividerRegexPattern || '';

            saveButton.addEventListener('click', async () => {
                const customPatternString = regexInput.value.trim();

                try {
                    if (customPatternString) {
                        const testPatterns = customPatternString.split(',').map(p => p.trim()).filter(Boolean);
                        testPatterns.forEach(p => new RegExp(p));
                    }

                    extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern = customPatternString;
                    saveSettingsDebounced();

                    await loadAndSetDividerRegex();
                    await NemoPresetManager.organizePrompts();

                    statusDiv.textContent = 'Pattern saved!'; statusDiv.style.color = 'lightgreen';
                } catch(e) {
                    statusDiv.textContent = `Invalid Regex part: ${e.message}`; statusDiv.style.color = 'red';
                }
                setTimeout(() => statusDiv.textContent = '', 4000);
            });
        }
    }, 500);
}
