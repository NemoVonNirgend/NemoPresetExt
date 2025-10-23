import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

// Core utilities
import { LOG_PREFIX, ensureSettingsNamespace, waitForElement } from './core/utils.js';
import { CONSTANTS } from './core/constants.js';
import logger from './core/logger.js';
import { initializeStorage, migrateFromLocalStorage } from './core/storage-migration.js';

// UI modules
import { NemoSettingsUI } from './ui/settings-ui.js';
import { NemoGlobalUI } from './ui/global-ui.js';
import { UserSettingsTabs } from './ui/user-settings-tabs.js';
import { AdvancedFormattingTabs } from './ui/advanced-formatting-tabs.js';
import { ExtensionsTabOverhaul } from './ui/extensions-tab-overhaul.js';

// Feature modules - Prompts
import { NemoPresetManager, loadAndSetDividerRegex } from './features/prompts/prompt-manager.js';
import { NemoPromptArchiveUI } from './features/prompts/prompt-archive-ui.js';

// Feature modules - Directives
import { initDirectiveUI } from './features/directives/directive-ui.js';
import { initPromptDirectiveHooks } from './features/directives/prompt-directive-hooks.js';
import { initDirectiveAutocomplete } from './features/directives/directive-autocomplete-ui.js';
import { initDirectiveFeatures } from './features/directives/directive-features.js';

// Feature modules - Backgrounds
import { animatedBackgrounds } from './features/backgrounds/animated-backgrounds-module.js';
import { backgroundUIEnhancements } from './features/backgrounds/background-ui-enhancements.js';

// Feature modules - Card Emporium
// TEMPORARILY DISABLED - not functioning
// import { NemoCardEmporium } from './features/card-emporium/card-emporium.js';

// Feature modules - Ember
import { Ember2Extension } from './features/ember/ember-main.js';

// Feature modules - NemoLore
import { NemoLoreExtension } from './features/nemolore/nemolore-main.js';

// Feature modules - ProsePolisher
import { ProsePolisherExtension } from './features/prosepolisher/prosepolisher-main.js';

// Feature modules - MoodMusic
import { MoodMusicExtension } from './features/moodmusic/moodmusic-main.js';

// Feature modules - NEMO-VRM
import { NemoVRMExtension } from './features/nemovrm/nemovrm-main.js';

// Feature modules - Reasoning
import { applyNemoNetReasoning } from './reasoning/nemonet-reasoning-config.js';

// Feature modules - Onboarding/Tutorials
import { tutorialManager } from './features/onboarding/tutorial-manager.js';
import { tutorialLauncher } from './features/onboarding/tutorial-launcher.js';

// Feature modules - Panel Toggle
import { panelToggle } from './features/panel-toggle/panel-toggle.js';

// Archived/deprecated modules (loaded from archive)
import { NemoCharacterManager } from './archive/character-manager.js';
import { initPresetNavigatorForApi, PresetNavigator } from './archive/navigator.js';
import { NemoWorldInfoUI } from './archive/world-info-ui.js';
import domCache, { DOMUtils } from './archive/dom-cache.js';

// Extension name constant for legacy code compatibility
const NEMO_EXTENSION_NAME = 'NemoPresetExt';

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
    try {
        logger.info('Initializing NemoPresetExt...');

        ensureSettingsNamespace();

        // Initialize storage and run one-time migration from localStorage
        initializeStorage();
        migrateFromLocalStorage();

        await loadAndSetDividerRegex();

        // Initialize all modules
        NemoCharacterManager.initialize();
        // TEMPORARILY DISABLED - Card Emporium not functioning
        // NemoCardEmporium.initialize();
        NemoSettingsUI.initialize();
        NemoGlobalUI.initialize();
        NemoPromptArchiveUI.initialize();

        // Initialize Ember if enabled
        if (extension_settings.NemoPresetExt?.enableEmber === true) {
            const ember2 = new Ember2Extension();
            await ember2.initialize();
            window.Ember2 = ember2;
            logger.info('Ember 2.0 initialized successfully');
        }

        // Always initialize NemoLore UI (dashboard/settings), but functionality respects the enabled setting
        const nemoLore = new NemoLoreExtension();
        await nemoLore.initialize();
        window.NemoLore = nemoLore;

        if (extension_settings.NemoPresetExt?.enableNemoLore === true) {
            logger.info('NemoLore initialized successfully (enabled)');
        } else {
            logger.info('NemoLore UI initialized (functionality disabled - can be enabled via dashboard)');
        }

        // Initialize ProsePolisher if enabled
        console.log('🚨 [NemoPresetExt] Checking ProsePolisher initialization...');
        console.log('🚨 [NemoPresetExt] enableProsePolisher setting:', extension_settings.NemoPresetExt?.enableProsePolisher);

        if (extension_settings.NemoPresetExt?.enableProsePolisher === true) {
            console.log('🚨 [NemoPresetExt] Creating ProsePolisher instance...');
            try {
                const prosePolisher = new ProsePolisherExtension();
                console.log('🚨 [NemoPresetExt] ProsePolisher instance created, calling initialize...');
                await prosePolisher.initialize();
                console.log('🚨 [NemoPresetExt] ProsePolisher initialized, setting window.ProsePolisher...');
                window.ProsePolisher = prosePolisher;
                console.log('🚨 [NemoPresetExt] ✅ window.ProsePolisher set successfully!');
                logger.info('ProsePolisher initialized successfully');
            } catch (ppError) {
                console.error('🚨 [NemoPresetExt] ❌ ProsePolisher initialization FAILED:', ppError);
                console.error('🚨 [NemoPresetExt] Stack:', ppError.stack);
            }
        } else {
            console.log('🚨 [NemoPresetExt] ⚠️ ProsePolisher initialization skipped (disabled in settings)');
        }

        // Initialize MoodMusic if enabled
        if (extension_settings.NemoPresetExt?.enableMoodMusic === true) {
            const moodMusic = new MoodMusicExtension();
            await moodMusic.initialize();
            window.MoodMusic = moodMusic;
            logger.info('MoodMusic initialized successfully');
        }

        // Initialize NEMO-VRM if enabled
        if (extension_settings.NemoPresetExt?.enableNemoVRM === true) {
            const nemoVRM = new NemoVRMExtension();
            await nemoVRM.initialize();
            window.NemoVRM = nemoVRM;
            logger.info('NEMO-VRM initialized successfully');
        }

        // Note: initializeNemoSettingsUI() removed - NemoSettingsUI.initialize() handles this now

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

        // Initialize directive system
        initDirectiveUI();
        initPromptDirectiveHooks();
        initDirectiveAutocomplete();
        initDirectiveFeatures();

        // Initialize robust reasoning parser for NemoNet CoT
        applyNemoNetReasoning();

        // Initialize tutorial system
        tutorialManager.initialize();
        tutorialLauncher.initialize();

        // Check if welcome tutorial should auto-start (for first-time users)
        tutorialLauncher.checkWelcomeTutorial();

        // Initialize panel width toggle (always initialize - it's controlled by settings)
        panelToggle.initialize();

        // Make ExtensionsTabOverhaul available globally for the settings toggle
        window.ExtensionsTabOverhaul = ExtensionsTabOverhaul;

        // Make NemoPresetManager available globally for preset state preservation
        window.NemoPresetManager = NemoPresetManager;
        
        const isEnabled = extension_settings.NemoPresetExt?.nemoEnableExtensionsTabOverhaul !== false;
        logger.debug('Extensions Tab Overhaul setting check', { isEnabled, fullValue: extension_settings.NemoPresetExt?.nemoEnableExtensionsTabOverhaul });
        
        if (isEnabled) {
            logger.info('Initializing Extensions Tab Overhaul...');
            ExtensionsTabOverhaul.initialize();
        } else {
            logger.info('Extensions Tab Overhaul is disabled, skipping initialization');
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

// Generate interceptor for NemoLore
// This function is called by SillyTavern before each generation
// It modifies the chat context (messages array) to hide/summarize old messages
async function nemo_generate_interceptor(chat, contextSize, abort, type) {
    // Check if NemoLore is initialized and has the interceptor registered
    if (typeof window.nemolore_intercept_messages === 'function') {
        // Call the NemoLore interceptor which modifies the chat array in-place
        // Returns false to signal that processing occurred, or true to skip
        return await window.nemolore_intercept_messages(chat, contextSize, abort, type);
    }
    // If NemoLore is not available, don't modify the context
    return false;
}