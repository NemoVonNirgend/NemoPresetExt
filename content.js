import { eventSource, event_types } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { LOG_PREFIX, ensureSettingsNamespace, waitForElement } from './utils.js';
import { NemoPresetManager, loadAndSetDividerRegex } from './prompt-manager.js';
import { NemoCharacterManager } from './character-manager.js';
import { initPresetNavigatorForApi } from './navigator.js';
import { NemoSettingsUI } from './settings-ui.js';
import { NemoGlobalUI } from './global-ui.js'; // Import NemoGlobalUI
import { NemoWorldInfoUI } from './world-info-ui.js';

// --- MAIN INITIALIZATION ---
const MAIN_SELECTORS = {
    promptsContainer: '#completion_prompt_manager_list',
    promptEditorPopup: '.completion_prompt_manager_popup_entry',
};

// Use waitForElement to ensure the main UI is ready before initializing
waitForElement('#left-nav-panel', async () => {
    try {
        console.log(`${LOG_PREFIX} Initializing...`);
        
        ensureSettingsNamespace();
        await loadAndSetDividerRegex();

        // Initialize all modules
        NemoCharacterManager.initialize();
        NemoSettingsUI.initialize();
        NemoGlobalUI.initialize();
        
        if (extension_settings.NemoPresetExt?.enableLorebookOverhaul !== false) {
            NemoWorldInfoUI.initialize();
        }

        const observer = new MutationObserver(() => {
            // Initialize Prompt Manager sections when the list appears
            const promptList = /** @type {HTMLElement} */ (document.querySelector(MAIN_SELECTORS.promptsContainer));
            if (promptList && !promptList.dataset.nemoPromptsInitialized) {
                NemoPresetManager.initializeSearchAndSections(promptList);
            }
            
            // Patch API preset dropdowns with the "Browse..." button
            const apis = ['openai', 'novel', 'kobold', 'textgenerationwebui', 'anthropic', 'claude', 'google', 'scale', 'cohere', 'mistral', 'aix', 'openrouter'];
            apis.forEach(api => {
                const select = /** @type {HTMLElement} */ (document.querySelector(`select[data-preset-manager-for="${api}"]`));
                if (select && !select.dataset.nemoPatched) {
                    initPresetNavigatorForApi(api);
                }
            });
        });

        // Observe the body for dynamically added elements we need to patch
        observer.observe(document.body, { childList: true, subtree: true });
        console.log(`${LOG_PREFIX} Initialization complete and observers are running.`);
    } catch (error) {
        console.error(`${LOG_PREFIX} Critical failure during initialization:`, error);
    }
});