import { eventSource, event_types } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { LOG_PREFIX, ensureSettingsNamespace, waitForElement } from './utils.js';
import { NemoPresetManager, loadAndSetDividerRegex } from './prompt-manager.js';
import { NemoCharacterManager } from './character-manager.js';
import { initPresetNavigatorForApi } from './navigator.js';
import { NemoSettingsUI } from './settings-ui.js';
import { NemoGlobalUI } from './global-ui.js';
import { NemoWorldInfoUI } from './world-info-ui.js';
import { UserSettingsTabs } from './user-settings-tabs.js';
import { AdvancedFormattingTabs } from './advanced-formatting-tabs.js';
import { ExtensionsTabOverhaul } from './extensions-tab-overhaul.js';
import { NemoPromptArchiveUI } from './prompt-archive-ui.js';
import { animatedBackgrounds } from './animated-backgrounds-module.js';
import { backgroundUIEnhancements } from './background-ui-enhancements.js';
import { CONSTANTS } from './constants.js';
import logger from './logger.js';
import domCache, { DOMUtils } from './dom-cache.js';

// --- MAIN INITIALIZATION ---
const MAIN_SELECTORS = {
    promptsContainer: '#completion_prompt_manager_list',
    promptEditorPopup: '.completion_prompt_manager_popup_entry',
};

// Use waitForElement to ensure the main UI is ready before initializing
waitForElement('#left-nav-panel', async () => {
    try {
        logger.info('Initializing NemoPresetExt...');
        
        ensureSettingsNamespace();
        await loadAndSetDividerRegex();

        // Initialize all modules
        NemoCharacterManager.initialize();
        NemoSettingsUI.initialize();
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

        // Make ExtensionsTabOverhaul available globally for the settings toggle
        window.ExtensionsTabOverhaul = ExtensionsTabOverhaul;
        
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

        // Simple observer for critical functionality only - matches original behavior
        const observer = new MutationObserver((mutations) => {
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
                        initPresetNavigatorForApi(api);
                    } catch (error) {
                        logger.error(`Failed to initialize preset navigator for ${api}`, error);
                    }
                }
            });
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
            eventSource.off(event_types.CHATCOMPLETION_SOURCE_CHANGED, chatCompletionChangeHandler);
        });

        // Global cleanup function for extension unload/reload
        window.NemoPresetExtCleanup = () => {
            logger.info('Performing extension cleanup');
            ExtensionManager.disconnectAll();
            eventCleanupFunctions.forEach(cleanup => cleanup());
            eventCleanupFunctions.length = 0;
        };

        // Make ExtensionsTabOverhaul globally available for settings toggle
        window.ExtensionsTabOverhaul = ExtensionsTabOverhaul;
        
        logger.info('Initialization complete and observers are running');
    } catch (error) {
        logger.error('Critical failure during initialization', error);
    }
});