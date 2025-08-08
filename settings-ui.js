// settings-ui.js

import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { LOG_PREFIX, NEMO_EXTENSION_NAME, ensureSettingsNamespace } from './utils.js';
import { loadAndSetDividerRegex, NemoPresetManager } from './prompt-manager.js';
import logger from './logger.js';

export const NemoSettingsUI = {
    initialize: async function() {
        const pollForSettings = setInterval(async () => {
            const container = document.getElementById('extensions_settings');
            if (container && !document.querySelector('.nemo-preset-enhancer-settings')) {
                clearInterval(pollForSettings);
                ensureSettingsNamespace();
                const response = await fetch(`scripts/extensions/third-party/${NEMO_EXTENSION_NAME}/settings.html`);
                if (!response.ok) { logger.error('Failed to fetch settings.html'); return; }
                container.insertAdjacentHTML('beforeend', await response.text());

                // Regex Settings
                const regexInput = /** @type {HTMLInputElement} */ (document.getElementById('nemoDividerRegexPattern'));
                const saveButton = document.getElementById('nemoSaveRegexSettings');
                const statusDiv = document.getElementById('nemoRegexStatus');

                regexInput.value = extension_settings[NEMO_EXTENSION_NAME]?.dividerRegexPattern || '';
                saveButton.addEventListener('click', async () => {
                    const customPatternString = regexInput.value.trim();
                    try {
                        if (customPatternString) {
                            customPatternString.split(',').map(p => p.trim()).filter(Boolean).forEach(p => new RegExp(p));
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

                // *** Character Folder Display Mode Settings (REMOVED) ***

                // Lorebook Overhaul Setting
                const lorebookToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableLorebookOverhaul'));
                lorebookToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableLorebookOverhaul ?? true;
                lorebookToggle.addEventListener('change', () => {
                    extension_settings[NEMO_EXTENSION_NAME].enableLorebookOverhaul = lorebookToggle.checked;
                    saveSettingsDebounced();
                });

                // Reasoning Section Setting
                const reasoningToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableReasoningSection'));
                reasoningToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableReasoningSection ?? true;
                reasoningToggle.addEventListener('change', () => {
                    extension_settings[NEMO_EXTENSION_NAME].enableReasoningSection = reasoningToggle.checked;
                    saveSettingsDebounced();
                    // Refresh the UI to show/hide the reasoning section
                    NemoPresetManager.refreshUI();
                });

                // Lorebook Management Setting
                const lorebookManagementToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableLorebookManagement'));
                lorebookManagementToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableLorebookManagement ?? true;
                lorebookManagementToggle.addEventListener('change', () => {
                    extension_settings[NEMO_EXTENSION_NAME].enableLorebookManagement = lorebookManagementToggle.checked;
                    saveSettingsDebounced();
                    // Refresh the UI to show/hide the lorebook management section
                    NemoPresetManager.refreshUI();
                });

                // Tab Overhauls Setting
                const tabOverhaulsToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableTabOverhauls'));
                tabOverhaulsToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.enableTabOverhauls ?? true;
                tabOverhaulsToggle.addEventListener('change', () => {
                    extension_settings[NEMO_EXTENSION_NAME].enableTabOverhauls = tabOverhaulsToggle.checked;
                    saveSettingsDebounced();
                    
                    // Show refresh notification
                    const notification = document.createElement('div');
                    notification.innerHTML = '<i class="fa-solid fa-refresh"></i> Page refresh required for changes to take effect.';
                    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--SmartThemeQuoteColor); color: white; padding: 15px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 8px rgba(0,0,0,0.3);';
                    document.body.appendChild(notification);
                    
                    setTimeout(() => {
                        notification.remove();
                    }, 5000);
                });

                // Extensions Tab Overhaul Setting
                const extensionsTabOverhaulToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemoEnableExtensionsTabOverhaul'));
                extensionsTabOverhaulToggle.checked = extension_settings[NEMO_EXTENSION_NAME]?.nemoEnableExtensionsTabOverhaul ?? true;
                extensionsTabOverhaulToggle.addEventListener('change', () => {
                    logger.debug(`Toggle changed to: ${extensionsTabOverhaulToggle.checked}`);
                    extension_settings[NEMO_EXTENSION_NAME].nemoEnableExtensionsTabOverhaul = extensionsTabOverhaulToggle.checked;
                    saveSettingsDebounced();
                    
                    logger.debug('Setting saved. ExtensionsTabOverhaul available', { available: !!window.ExtensionsTabOverhaul });
                    logger.debug('ExtensionsTabOverhaul initialized', { initialized: window.ExtensionsTabOverhaul?.initialized });
                    
                    // Immediately apply the changes without requiring page refresh
                    if (extensionsTabOverhaulToggle.checked) {
                        // Enable the extensions tab overhaul
                        logger.info('Attempting to enable extensions tab overhaul...');
                        if (window.ExtensionsTabOverhaul && !window.ExtensionsTabOverhaul.initialized) {
                            window.ExtensionsTabOverhaul.initialize();
                        }
                        
                        // Show enable notification
                        const enableNotification = document.createElement('div');
                        enableNotification.innerHTML = '<i class="fa-solid fa-check"></i> Extensions Tab Overhaul enabled!';
                        enableNotification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 8px rgba(0,0,0,0.3);';
                        document.body.appendChild(enableNotification);
                        setTimeout(() => enableNotification.remove(), 3000);
                    } else {
                        // Disable the extensions tab overhaul
                        console.log(`[NemoPresetExt] Attempting to disable extensions tab overhaul...`);
                        if (window.ExtensionsTabOverhaul && window.ExtensionsTabOverhaul.initialized) {
                            console.log(`[NemoPresetExt] Calling cleanup function...`);
                            window.ExtensionsTabOverhaul.cleanup();
                        } else {
                            console.log(`[NemoPresetExt] ExtensionsTabOverhaul not available or not initialized`);
                        }
                        
                        // Show disable notification
                        const disableNotification = document.createElement('div');
                        disableNotification.innerHTML = '<i class="fa-solid fa-times"></i> Extensions Tab Overhaul disabled!';
                        disableNotification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff9800; color: white; padding: 15px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 8px rgba(0,0,0,0.3);';
                        document.body.appendChild(disableNotification);
                        setTimeout(() => disableNotification.remove(), 3000);
                    }
                });
                
                // Message Theme Setting
                const themeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('nemo-message-theme-select'));
                if (themeSelect) {
                    themeSelect.value = extension_settings[NEMO_EXTENSION_NAME]?.messageTheme || 'default';
                    this.applyMessageTheme(themeSelect.value);

                    themeSelect.addEventListener('change', () => {
                        const selectedTheme = themeSelect.value;
                        extension_settings[NEMO_EXTENSION_NAME].messageTheme = selectedTheme;
                        saveSettingsDebounced();
                        this.applyMessageTheme(selectedTheme);
                    });
                }
            }
        }, 500);
    },

    applyMessageTheme: function(themeName) {
        document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim();
        if (themeName && themeName !== 'default') {
            document.body.classList.add(`theme-${themeName}`);
        }
    }
};