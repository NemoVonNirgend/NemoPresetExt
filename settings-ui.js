// settings-ui.js

import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { LOG_PREFIX, NEMO_EXTENSION_NAME, ensureSettingsNamespace } from './utils.js';
import { loadAndSetDividerRegex, NemoPresetManager } from './prompt-manager.js';

export const NemoSettingsUI = {
    initialize: async function() {
        const pollForSettings = setInterval(async () => {
            const container = document.getElementById('extensions_settings');
            if (container && !document.querySelector('.nemo-preset-enhancer-settings')) {
                clearInterval(pollForSettings);
                ensureSettingsNamespace();
                const response = await fetch(`scripts/extensions/third-party/${NEMO_EXTENSION_NAME}/settings.html`);
                if (!response.ok) { console.error(`${LOG_PREFIX} Failed to fetch settings.html`); return; }
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
            }
        }, 500);
    }
};