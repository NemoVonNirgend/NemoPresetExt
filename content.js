import { eventSource, event_types } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { LOG_PREFIX, ensureSettingsNamespace, waitForElement } from './utils.js';
import { NemoPresetManager, loadAndSetDividerRegex } from './prompt-manager.js';
import { NemoCharacterManager } from './character-manager.js';
import { initPresetNavigatorForApi } from './navigator.js';
import { NemoSettingsUI } from './settings-ui.js';
import { NemoGlobalUI } from './global-ui.js'; // Import NemoGlobalUI
import { NemoWorldInfoUI } from './world-info-ui.js';
import { UserSettingsTabs } from './user-settings-tabs.js';
import { AdvancedFormattingTabs } from './advanced-formatting-tabs.js';
import { ExtensionsTabOverhaul } from './extensions-tab-overhaul.js';
import { NemoPromptArchiveUI } from './prompt-archive-ui.js';

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
        NemoPromptArchiveUI.initialize();
        
        // Initialize tab overhauls only if enabled
        if (extension_settings.NemoPresetExt?.enableTabOverhauls !== false) {
            UserSettingsTabs.initialize();
            AdvancedFormattingTabs.initialize();
        }
        
        if (extension_settings.NemoPresetExt?.enableLorebookOverhaul !== false) {
            NemoWorldInfoUI.initialize();
        }

        // Make ExtensionsTabOverhaul available globally for the settings toggle
        window.ExtensionsTabOverhaul = ExtensionsTabOverhaul;
        
        const isEnabled = extension_settings.NemoPresetExt?.nemoEnableExtensionsTabOverhaul !== false;
        console.log(`${LOG_PREFIX} Extensions Tab Overhaul setting check:`, isEnabled);
        console.log(`${LOG_PREFIX} Full setting value:`, extension_settings.NemoPresetExt?.nemoEnableExtensionsTabOverhaul);
        
        if (isEnabled) {
            console.log(`${LOG_PREFIX} Initializing Extensions Tab Overhaul...`);
            ExtensionsTabOverhaul.initialize();
        } else {
            console.log(`${LOG_PREFIX} Extensions Tab Overhaul is disabled, skipping initialization`);
        }

        const observer = new MutationObserver(() => {
            // Initialize Prompt Manager sections when the list appears
            const promptList = /** @type {HTMLElement} */ (document.querySelector(MAIN_SELECTORS.promptsContainer));
            if (promptList && !promptList.dataset.nemoPromptsInitialized) {
                NemoPresetManager.initialize(promptList);
            } else if (promptList && promptList.dataset.nemoPromptsInitialized) {
                // Check if the UI needs refreshing (e.g., after preset changes)
                const snapshotBtn = document.getElementById('nemoTakeSnapshotBtn');
                if (!snapshotBtn) {
                    console.log(`${LOG_PREFIX} Snapshot button missing, refreshing UI...`);
                    NemoPresetManager.refreshUI();
                }
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

        // Listen for events that might require UI refresh
        eventSource.on(event_types.CHATCOMPLETION_SOURCE_CHANGED, () => {
            console.log(`${LOG_PREFIX} Chat completion source changed, will refresh UI`);
            setTimeout(() => {
                const promptList = document.querySelector(MAIN_SELECTORS.promptsContainer);
                if (promptList && promptList.dataset.nemoPromptsInitialized) {
                    NemoPresetManager.refreshUI();
                }
            }, 500);
        });

        // Observe the body for dynamically added elements we need to patch
        observer.observe(document.body, { childList: true, subtree: true });
        console.log(`${LOG_PREFIX} Initialization complete and observers are running.`);
    } catch (error) {
        console.error(`${LOG_PREFIX} Critical failure during initialization:`, error);
    }
});