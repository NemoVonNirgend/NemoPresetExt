import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { LOG_PREFIX, ensureSettingsNamespace, waitForElement } from './utils.js';
import { NemoPresetManager, loadAndSetDividerRegex } from './prompt-manager.js';
import { NemoCharacterManager } from './character-manager.js';
import { initPresetNavigatorForApi, PresetNavigator } from './navigator.js';
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

// Extension name constant for legacy code compatibility
const NEMO_EXTENSION_NAME = 'NemoPresetExt';

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

        // Initialize legacy settings UI for backward compatibility
        await initializeNemoSettingsUI();
        
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
                        initPresetNavigatorForApiEnhanced(api);
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
        
        logger.info('Initialization complete and observers are running');
    } catch (error) {
        logger.error('Critical failure during initialization', error);
    }
});

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