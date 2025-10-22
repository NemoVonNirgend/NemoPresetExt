
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../../scripts/extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';
import { state } from './state.js';
import { EXTENSION_NAME, LOG_PREFIX, API_TO_SELECTOR_MAP, DEFAULT_WRITER_INSTRUCTIONS_TEMPLATE, DEFAULT_AUDITOR_INSTRUCTIONS_TEMPLATE, DEFAULT_REGEX_GENERATION_INSTRUCTIONS, defaultSettings } from './constants.js';
import { generateUUID } from './navigator.js';
import { openai_setting_names, chat_completion_sources } from '../../../../../../../scripts/openai.js';
import { DEFAULT_PAPA_INSTRUCTIONS, DEFAULT_TWINS_VEX_INSTRUCTIONS_BASE, DEFAULT_TWINS_VAX_INSTRUCTIONS_BASE, DEFAULT_MAMA_INSTRUCTIONS } from './projectgremlin.js';

/**
 * Manages all UI interactions for the Prose Polisher extension.
 */
export class UIManager {
    constructor() {
        // This class will be expanded to handle all UI logic.
    }

    /**
     * Shows a reload prompt in the settings drawer.
     */
    showReloadPrompt() {
        let reloadPromptTimeout;
        clearTimeout(reloadPromptTimeout);
        const existingPrompt = document.getElementById('prose-polisher-reload-prompt');
        if (existingPrompt) { existingPrompt.remove(); }

        const promptDiv = document.createElement('div');
        promptDiv.id = 'prose-polisher-reload-prompt';
        promptDiv.style.cssText = `
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.7);
            color: var(--pp-text-color);
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: sans-serif;
            border: 1px solid var(--pp-border-color);
            width: fit-content;
            white-space: nowrap;
        `;
        promptDiv.innerHTML = `
            <span>Settings changed. Reload to apply?</span>
            <button id="prose-polisher-reload-button" style="
                background-color: var(--pp-accent-color);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1em;
                transition: background-color 0.2s;
            ">Reload Now</button>
        `;

        const reloadButton = promptDiv.querySelector('#prose-polisher-reload-button');
        if (reloadButton) {
            reloadButton.addEventListener('mouseenter', () => {
                reloadButton.style.backgroundColor = 'var(--pp-accent-hover)';
            });
            reloadButton.addEventListener('mouseleave', () => {
                reloadButton.style.backgroundColor = 'var(--pp-accent-color)';
            });
        }

        const drawerContent = document.querySelector('.prose-polisher-settings .inline-drawer-content');
        if (drawerContent) {
            drawerContent.style.position = 'relative';
            drawerContent.prepend(promptDiv);
        } else {
            document.body.appendChild(promptDiv);
        }

        document.getElementById('prose-polisher-reload-button').addEventListener('click', () => {
            window.location.reload();
        });

        reloadPromptTimeout = setTimeout(() => {
            promptDiv.remove();
        }, 15000);
    }

    /**
     * Hides Prose Polisher rules from the standard regex UI.
     */
    hideRulesInStandardUI() {
        if (!state.isAppReady) return;
        const regexListItems = document.querySelectorAll('#saved_regex_scripts .regex-script-item');
        regexListItems.forEach(item => {
            const scriptNameEl = item.querySelector('.regex_script_name');
            if (scriptNameEl && scriptNameEl.textContent.startsWith('(PP)')) {
                item.style.display = 'none';
            } else {
                item.style.display = '';
            }
        });
    }

    showFrequencyLeaderboard() {
        if (!state.isAppReady) { window.toastr.info("SillyTavern is still loading, please wait."); return; }

        const { merged: mergedEntries, remaining: remainingEntries } = state.prosePolisherAnalyzer.analyzedLeaderboardData;
        let contentHtml;
        const isProcessedDataAvailable = (mergedEntries && Object.keys(mergedEntries).length > 0) || (remainingEntries && Object.keys(remainingEntries).length > 0);

        if (isProcessedDataAvailable) {
            // Path 1: Show the fully processed, patterned data (the best view)
            const mergedRows = Object.entries(mergedEntries).map(([phrase, score]) => `<tr class="is-pattern"><td>${this.escapeHtml(phrase)}</td><td>${score.toFixed(1)}</td></tr>`).join('');
            const remainingRows = Object.entries(remainingEntries).map(([phrase, score]) => `<tr><td>${this.escapeHtml(phrase)}</td><td>${score.toFixed(1)}</td></tr>`).join('');

            contentHtml = `<p>Showing <strong>processed and patterned</strong> repetition data. Phrases in <strong>bold orange</strong> are detected patterns. This list updates automatically every 10 messages.</p>
                           <table class="prose-polisher-frequency-table">
                               <thead><tr><th>Repetitive Phrase or Pattern</th><th>Repetition Score</th></tr></thead>
                               <tbody>${mergedRows}${remainingRows}</tbody>
                           </table>`;

            // Save the report data to localStorage
            this.saveRepetitionReport({ mergedEntries, remainingEntries, type: 'processed' });
        } else if (state.prosePolisherAnalyzer.ngramFrequencies.size > 0) {
            // Path 2 (Fallback): Show raw, unprocessed data for immediate feedback
            const rawEntries = Array.from(state.prosePolisherAnalyzer.ngramFrequencies.values())
                .filter(data => data.score > 0) // Only show items with a score
                .sort((a, b) => b.score - a.score);

            const rawRows = rawEntries.map(data => `<tr><td>${this.escapeHtml(data.original)}</td><td>${data.score.toFixed(1)}</td></tr>`).join('');

            contentHtml = `<p>Showing <strong>raw, unprocessed</strong> n-grams detected so far. This data is collected on every AI message and will be processed into patterns periodically.</p>
                           <table class="prose-polisher-frequency-table">
                               <thead><tr><th>Detected Phrase</th><th>Repetition Score</th></tr></thead>
                               <tbody>${rawRows}</tbody>
                           </table>`;

            // Save the raw report data
            const rawData = rawEntries.map(data => ({ phrase: data.original, score: data.score }));
            this.saveRepetitionReport({ rawData, type: 'raw' });
        } else {
            // Path 3: Try to load saved report before showing "no data" message
            const savedReport = this.loadRepetitionReport();
            if (savedReport) {
                const timeAgo = this.getTimeAgo(savedReport.timestamp);
                if (savedReport.type === 'processed') {
                    const mergedRows = Object.entries(savedReport.mergedEntries).map(([phrase, score]) => `<tr class="is-pattern"><td>${this.escapeHtml(phrase)}</td><td>${score.toFixed(1)}</td></tr>`).join('');
                    const remainingRows = Object.entries(savedReport.remainingEntries).map(([phrase, score]) => `<tr><td>${this.escapeHtml(phrase)}</td><td>${score.toFixed(1)}</td></tr>`).join('');

                    contentHtml = `<p><em>Showing saved report from ${timeAgo}.</em> Phrases in <strong>bold orange</strong> are detected patterns.</p>
                                   <table class="prose-polisher-frequency-table">
                                       <thead><tr><th>Repetitive Phrase or Pattern</th><th>Repetition Score</th></tr></thead>
                                       <tbody>${mergedRows}${remainingRows}</tbody>
                                   </table>`;
                } else if (savedReport.type === 'raw') {
                    const rawRows = savedReport.rawData.map(data => `<tr><td>${this.escapeHtml(data.phrase)}</td><td>${data.score.toFixed(1)}</td></tr>`).join('');
                    contentHtml = `<p><em>Showing saved raw report from ${timeAgo}.</em></p>
                                   <table class="prose-polisher-frequency-table">
                                       <thead><tr><th>Detected Phrase</th><th>Repetition Score</th></tr></thead>
                                       <tbody>${rawRows}</tbody>
                                   </table>`;
                }
            } else {
                // Path 4 (Final Fallback): Nothing has been detected at all
                contentHtml = '<p>No repetitive phrases have been detected yet. Send some AI messages to begin analysis.</p>';
            }
        }

        callGenericPopup(contentHtml, POPUP_TYPE.TEXT, "Repetition Analysis Report", { wide: true, large: true });
    }

    /**
     * Get a human-readable time ago string
     */
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    }

    /**
     * Save repetition report data to localStorage
     */
    saveRepetitionReport(reportData) {
        try {
            const chatId = getCurrentChatId?.() || 'default';
            const storageKey = `prosepolisher_report_${chatId}`;
            const dataToSave = {
                ...reportData,
                timestamp: Date.now(),
                chatId: chatId
            };
            localStorage.setItem(storageKey, JSON.stringify(dataToSave));
            console.log('[ProsePolisher] Repetition report saved to localStorage');
        } catch (error) {
            console.error('[ProsePolisher] Failed to save repetition report:', error);
        }
    }

    /**
     * Load saved repetition report from localStorage
     */
    loadRepetitionReport() {
        try {
            const chatId = getCurrentChatId?.() || 'default';
            const storageKey = `prosepolisher_report_${chatId}`;
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
                const reportData = JSON.parse(savedData);
                console.log('[ProsePolisher] Loaded saved repetition report from localStorage');
                return reportData;
            }
        } catch (error) {
            console.error('[ProsePolisher] Failed to load repetition report:', error);
        }
        return null;
    }

   escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#x27;");
    }

    showWhitelistManager() {
        if (!state.isAppReady) { window.toastr.info("SillyTavern is still loading, please wait."); return; }
        const settings = extension_settings[EXTENSION_NAME];
        const container = document.createElement('div');
        container.className = 'prose-polisher-whitelist-manager';
        container.innerHTML = `
            <h4>Allowed Words Manager</h4>
            <p>Add words that should never be flagged as repetitive (e.g., character names, specific jargon). Phrases containing these words will be <strong>ignored</strong> by the repetition detector. Common words and names are already included.</p>
            <div class="list-container">
                <ul id="pp-whitelist-list"></ul>
            </div>
            <div class="add-controls">
                <input type="text" id="pp-whitelist-input" class="text_pole" placeholder="Add a word to ignore...">
                <button id="pp-whitelist-add-btn" class="menu_button">Add</button>
            </div>
        `;
        const listElement = container.querySelector('#pp-whitelist-list');
        const inputElement = container.querySelector('#pp-whitelist-input');
        const addButton = container.querySelector('#pp-whitelist-add-btn');

        const renderWhitelist = () => {
            listElement.innerHTML = '';
            (settings.whitelist || []).sort().forEach(originalWord => {
                const item = document.createElement('li');
                item.className = 'list-item';
                const displayWord = this.escapeHtml(originalWord);
                item.innerHTML = `<span>${displayWord}</span><i class="fa-solid fa-trash-can delete-btn" data-word="${originalWord}"></i>`;
                item.querySelector('.delete-btn').addEventListener('pointerup', (event) => {
                    const wordToRemove = event.target.dataset.word; 
                    settings.whitelist = (settings.whitelist || []).filter(w => w !== wordToRemove);
                    saveSettingsDebounced();
                    state.prosePolisherAnalyzer.updateEffectiveWhitelist(); 
                    renderWhitelist();
                });
                listElement.appendChild(item);
            });
        };

        const addWord = () => {
            const newWord = inputElement.value.trim().toLowerCase();
            if (newWord && !(settings.whitelist || []).includes(newWord)) {
                if (!settings.whitelist) settings.whitelist = [];
                settings.whitelist.push(newWord);
                saveSettingsDebounced();
                state.prosePolisherAnalyzer.updateEffectiveWhitelist(); 
                renderWhitelist();
                inputElement.value = '';
            }
            inputElement.focus();
        };

        addButton.addEventListener('pointerup', addWord);
        inputElement.addEventListener('keydown', (event) => { if (event.key === 'Enter') addWord(); });

        renderWhitelist();
        callGenericPopup(container, POPUP_TYPE.DISPLAY, "Allowed Words Manager", { wide: false, large: false });
    }

    showBlacklistManager() {
        if (!state.isAppReady) { window.toastr.info("SillyTavern is still loading, please wait."); return; }
        const settings = extension_settings[EXTENSION_NAME];
        const container = document.createElement('div');
        container.className = 'prose-polisher-blacklist-manager';
        container.innerHTML = `
            <h4>Problem Words Manager</h4>
            <p>Add words that should be flagged as problematic when they appear frequently. Give each word a weight (1-10) - higher weights make phrases more likely to be detected as repetitive.</p>
            <div class="list-container">
                <ul id="pp-blacklist-list"></ul>
            </div>
            <div class="add-controls">
                <input type="text" id="pp-blacklist-input" class="text_pole" placeholder="e.g., suddenly, began to" style="flex-grow: 3;">
                <input type="number" id="pp-blacklist-weight" class="text_pole" placeholder="Weight" value="3" min="1" max="10" style="flex-grow: 1;">
                <button id="pp-blacklist-add-btn" class="menu_button">Add</button>
            </div>
        `;
        const listElement = container.querySelector('#pp-blacklist-list');
        const inputElement = container.querySelector('#pp-blacklist-input');
        const weightElement = container.querySelector('#pp-blacklist-weight');
        const addButton = container.querySelector('#pp-blacklist-add-btn');

        const renderBlacklist = () => {
            listElement.innerHTML = '';
            const sortedBlacklist = Object.entries(settings.blacklist || {}).sort((a, b) => a[0].localeCompare(b[0]));
            
            sortedBlacklist.forEach(([originalWordKey, weight]) => {
                const item = document.createElement('li');
                item.className = 'list-item';
                const displayWord = this.escapeHtml(originalWordKey);
                item.innerHTML = `<span><strong>${displayWord}</strong> (Weight: ${weight})</span><i class="fa-solid fa-trash-can delete-btn" data-word="${originalWordKey}"></i>`;
                
                item.querySelector('.delete-btn').addEventListener('pointerup', (event) => {
                    const wordKeyToRemove = event.target.dataset.word; 
                    if (wordKeyToRemove && settings.blacklist && settings.blacklist.hasOwnProperty(wordKeyToRemove)) {
                        delete settings.blacklist[wordKeyToRemove];
                        saveSettingsDebounced();
                        renderBlacklist(); 
                    }
                });
                listElement.appendChild(item);
            });
        };

        const addWord = () => {
            const newWord = inputElement.value.trim().toLowerCase();
            const weight = parseInt(weightElement.value, 10);

            if (newWord && !isNaN(weight) && weight >= 1 && weight <= 10) {
                if (!settings.blacklist) settings.blacklist = {};
                settings.blacklist[newWord] = weight;
                saveSettingsDebounced();
                renderBlacklist();
                inputElement.value = '';
                inputElement.focus();
            } else {
                window.toastr.warning("Please enter a valid word and a weight between 1 and 10.");
            }
        };

        addButton.addEventListener('pointerup', addWord);
        inputElement.addEventListener('keydown', (event) => { if (event.key === 'Enter') addWord(); });
        weightElement.addEventListener('keydown', (event) => { if (event.key === 'Enter') addWord(); });
        
        renderBlacklist();
        callGenericPopup(container, POPUP_TYPE.DISPLAY, "Problem Words Manager", { wide: false, large: false });
    }

    async showApiEditorPopup(gremlinRole) {
        if (!state.isAppReady) { window.toastr.info("SillyTavern is still loading, please wait."); return; }
        const settings = extension_settings[EXTENSION_NAME];
        const roleUpper = gremlinRole.charAt(0).toUpperCase() + gremlinRole.slice(1);

        // Current settings for this role
        const currentApi = settings[`gremlin${roleUpper}Api`] || 'openai';
        const currentModel = settings[`gremlin${roleUpper}Model`] || '';
        const currentSource = settings[`gremlin${roleUpper}Source`] || '';
        const currentCustomUrl = settings[`gremlin${roleUpper}CustomUrl`] || '';
        const currentProfile = settings[`gremlin${roleUpper}Profile`] || '';

        // *** FIX STARTS HERE: Get the main UI's custom URL value ***
        const mainCustomUrlInput = document.getElementById('custom_api_url_text');
        const mainCustomUrl = mainCustomUrlInput ? mainCustomUrlInput.value.trim() : '';
        // *** FIX ENDS HERE ***

        const popupContent = document.createElement('div');
        popupContent.innerHTML = `
            <div class="pp-custom-binding-inputs" style="display: flex; flex-direction: column; gap: 10px;">
                <div>
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="pp_config_mode" value="profile" id="pp_use_profile_mode" ${currentProfile ? 'checked' : ''}>
                        Use Connection Profile:
                    </label>
                    <select id="pp_popup_profile_selector" class="text_pole" ${!currentProfile ? 'disabled' : ''}></select>
                </div>
                <div style="text-align: center; margin: 5px 0; color: var(--grey70); font-size: 0.9em;">── OR ──</div>
                <div>
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="pp_config_mode" value="manual" id="pp_use_manual_mode" ${!currentProfile ? 'checked' : ''}>
                        Manual Configuration:
                    </label>
                </div>
                <div id="pp_manual_config_group" ${currentProfile ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                    <div>
                        <label for="pp_popup_api_selector">API Provider:</label>
                        <select id="pp_popup_api_selector" class="text_pole"></select>
                    </div>
                    <div id="pp_popup_model_group">
                        <label for="pp_popup_model_selector">Model:</label>
                        <select id="pp_popup_model_selector" class="text_pole"></select>
                    </div>
                    <div id="pp_popup_custom_model_group" style="display: none;">
                        <label for="pp_popup_custom_model_input">Custom Model Name:</label>
                        <input type="text" id="pp_popup_custom_model_input" class="text_pole" placeholder="e.g., My-Fine-Tune-v1">
                    </div>
                    <div id="pp_popup_custom_url_group" style="display: none;">
                        <label for="pp_popup_custom_url_input">Custom API URL:</label>
                        <input type="text" id="pp_popup_custom_url_input" class="text_pole" placeholder="Enter your custom API URL">
                    </div>
                    <div id="pp_popup_source_group" style="display: none;">
                        <label for="pp_popup_source_input">Source (for some OpenAI-compatibles):</label>
                        <input type="text" id="pp_popup_source_input" class="text_pole" placeholder="e.g., DeepSeek">
                    </div>
                </div>
            </div>
            <br>
            <button id="pp-unbind-btn" class="menu_button is_dangerous">Clear All</button>
        `;
    
        const profileSelector = popupContent.querySelector('#pp_popup_profile_selector');
        const useProfileMode = popupContent.querySelector('#pp_use_profile_mode');
        const useManualMode = popupContent.querySelector('#pp_use_manual_mode');
        const manualConfigGroup = popupContent.querySelector('#pp_manual_config_group');
        const apiSelect = popupContent.querySelector('#pp_popup_api_selector');
        const modelSelect = popupContent.querySelector('#pp_popup_model_selector');
        const modelGroup = popupContent.querySelector('#pp_popup_model_group');
        const customModelGroup = popupContent.querySelector('#pp_popup_custom_model_group');
        const customModelInput = popupContent.querySelector('#pp_popup_custom_model_input');
        const customUrlGroup = popupContent.querySelector('#pp_popup_custom_url_group');
        const customUrlInput = popupContent.querySelector('#pp_popup_custom_url_input');
        const sourceGroup = popupContent.querySelector('#pp_popup_source_group');
        const sourceInput = popupContent.querySelector('#pp_popup_source_input');

        // Populate connection profiles
        const connectionProfiles = extension_settings.connectionManager?.profiles || {};
        profileSelector.innerHTML = '<option value="">-- Select a Profile --</option>';

        if (Object.keys(connectionProfiles).length === 0) {
            const noProfilesOption = document.createElement('option');
            noProfilesOption.value = "";
            noProfilesOption.textContent = "-- No Connection Profiles Available --";
            noProfilesOption.disabled = true;
            profileSelector.appendChild(noProfilesOption);
            useProfileMode.disabled = true;
            if (currentProfile) {
                window.toastr.warning(`Connection profile "${currentProfile}" is no longer available for ${roleUpper}.`, "Profile Missing");
            }
        } else {
            Object.keys(connectionProfiles).forEach(profileName => {
                const option = document.createElement('option');
                option.value = profileName;
                option.textContent = profileName;
                profileSelector.appendChild(option);
            });

            // Validate current profile still exists
            if (currentProfile && !connectionProfiles[currentProfile]) {
                window.toastr.warning(`Connection profile "${currentProfile}" is no longer available for ${roleUpper}.`, "Profile Missing");
                profileSelector.value = '';
            } else {
                profileSelector.value = currentProfile;
            }
        }

        // Mode switching handlers
        const toggleMode = () => {
            const isProfileMode = useProfileMode.checked;
            profileSelector.disabled = !isProfileMode;
            manualConfigGroup.style.opacity = isProfileMode ? '0.5' : '1';
            manualConfigGroup.style.pointerEvents = isProfileMode ? 'none' : 'auto';
        };

        useProfileMode.addEventListener('change', toggleMode);
        useManualMode.addEventListener('change', toggleMode);
    
        // Populate API Provider dropdown
        for (const name of Object.values(chat_completion_sources)) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1').trim();
            apiSelect.appendChild(option);
        }
        apiSelect.value = currentApi;
    
        const populateModels = (api) => {
            modelSelect.innerHTML = '';
            let sourceSelect = null;
    
            // CORRECTED: Smartly find the OpenRouter model list, wherever it may be.
            if (api === chat_completion_sources.OPENROUTER) {
                // The Chat Completion UI is primary.
                sourceSelect = document.querySelector('#model_openrouter_select');
                // If it's empty or missing, check the Text Completion UI as a fallback.
                if (!sourceSelect || sourceSelect.options.length <= 1) {
                    console.log(`${LOG_PREFIX} OpenRouter chat completion list not found or empty, checking text completion list...`);
                    sourceSelect = document.querySelector('#openrouter_model');
                }
            } else {
                // Standard logic for all other APIs.
                const sourceSelectorId = API_TO_SELECTOR_MAP[api];
                if (sourceSelectorId) {
                    sourceSelect = document.querySelector(sourceSelectorId);
                }
            }
    
            // Toggle UI elements based on API
            const isCustom = api === chat_completion_sources.CUSTOM;
            modelGroup.style.display = !isCustom ? 'block' : 'none';
            customModelGroup.style.display = isCustom ? 'block' : 'none';
            customUrlGroup.style.display = isCustom ? 'block' : 'none';
            sourceGroup.style.display = ['openai', 'openrouter', 'custom'].includes(api) ? 'block' : 'none';
    
            if (sourceSelect) {
                // Clone all options (including those in optgroups)
                Array.from(sourceSelect.childNodes).forEach(node => {
                    modelSelect.appendChild(node.cloneNode(true));
                });
                if (modelSelect.options.length <= 1) {
                    console.warn(`${LOG_PREFIX} Source selector for ${api} was found, but it's empty.`);
                    modelSelect.innerHTML = '<option value="">-- No models loaded in main UI --</option>';
                }
            } else {
                console.warn(`${LOG_PREFIX} Could not find any source model selector for API: ${api}`);
                modelSelect.innerHTML = '<option value="">-- No models found in main UI --</option>';
            }
        };
    
        populateModels(currentApi);
        apiSelect.addEventListener('change', () => populateModels(apiSelect.value));
    
        modelSelect.value = currentModel;
        customModelInput.value = currentModel;
        // *** FIX STARTS HERE: Pre-fill the Custom URL input ***
        // Use the role's saved URL if it exists, otherwise fall back to the main UI's setting.
        customUrlInput.value = currentCustomUrl || mainCustomUrl;
        // *** FIX ENDS HERE ***
        sourceInput.value = currentSource;
    
        popupContent.querySelector('#pp-unbind-btn').addEventListener('pointerup', () => {
            useManualMode.checked = true;
            useProfileMode.checked = false;
            toggleMode();
            profileSelector.value = '';
            apiSelect.value = 'openai';
            populateModels('openai');
            modelSelect.value = '';
            customModelInput.value = '';
            customUrlInput.value = '';
            sourceInput.value = '';
            window.toastr.info('Cleared inputs. Click "Save" to apply.');
        });

        if (await callGenericPopup(popupContent, POPUP_TYPE.CONFIRM, `Set API/Model for ${roleUpper}`)) {
            if (useProfileMode.checked) {
                // Profile mode - save profile selection and clear manual settings
                settings[`gremlin${roleUpper}Profile`] = profileSelector.value;
                settings[`gremlin${roleUpper}Api`] = '';
                settings[`gremlin${roleUpper}Model`] = '';
                settings[`gremlin${roleUpper}CustomUrl`] = '';
                settings[`gremlin${roleUpper}Source`] = '';
            } else {
                // Manual mode - save manual settings and clear profile
                settings[`gremlin${roleUpper}Profile`] = '';
                const selectedApi = apiSelect.value;
                settings[`gremlin${roleUpper}Api`] = selectedApi;

                if (selectedApi === chat_completion_sources.CUSTOM) {
                    settings[`gremlin${roleUpper}Model`] = customModelInput.value.trim();
                    settings[`gremlin${roleUpper}CustomUrl`] = customUrlInput.value.trim();
                } else {
                    settings[`gremlin${roleUpper}Model`] = modelSelect.value;
                    settings[`gremlin${roleUpper}CustomUrl`] = '';
                }
                settings[`gremlin${roleUpper}Source`] = sourceInput.value.trim();
            }

            saveSettingsDebounced();
            this.updateGremlinApiDisplay(gremlinRole);
            window.toastr.success(`Configuration saved for ${roleUpper}.`);
        }
    }

    updateGremlinApiDisplay(role) {
        if (!state.isAppReady) return;
        const settings = extension_settings[EXTENSION_NAME];
        const roleUpper = role.charAt(0).toUpperCase() + role.slice(1);
        const displayElement = document.getElementById(`pp_gremlin${roleUpper}Display`);
        if (displayElement) {
            const profile = settings[`gremlin${roleUpper}Profile`];
            if (profile) {
                displayElement.textContent = `Profile: ${profile}`;
            } else {
                const api = settings[`gremlin${roleUpper}Api`] || 'None';
                const model = settings[`gremlin${roleUpper}Model`] || 'Not Set';
                displayElement.textContent = `${api} / ${model}`;
            }
        }
    }

    async showInstructionsEditorPopup(gremlinRole) {
        if (!state.isAppReady) { window.toastr.info("SillyTavern is still loading, please wait."); return; }
        const settings = extension_settings[EXTENSION_NAME];
        const roleUpper = gremlinRole.charAt(0).toUpperCase() + gremlinRole.slice(1);
    
        let currentInstructions = '';
        let defaultInstructions = ''; // For single textarea roles
        let instructionSettingKey = `gremlin${roleUpper}Instructions`; // Default key
        let title = `Edit Instructions for ${roleUpper} Gremlin`;
        let placeholdersInfo = '';
        const popupContent = document.createElement('div');
        let textareasHtml = '';
    
        switch (gremlinRole) {
            case 'papa':
                currentInstructions = settings.gremlinPapaInstructions || DEFAULT_PAPA_INSTRUCTIONS;
                defaultInstructions = DEFAULT_PAPA_INSTRUCTIONS;
                instructionSettingKey = 'gremlinPapaInstructions';
                placeholdersInfo = `<small style="display:block; margin-bottom:5px;">This prompt is given to Papa Gremlin to generate the initial blueprint. No dynamic pipeline placeholders are used within this prompt itself.</small>`;
                textareasHtml = `<textarea id="pp_instructions_editor" class="text_pole" style="min-height: 300px; width: 100%; resize: vertical; box-sizing: border-box;">${currentInstructions}</textarea>`;
                break;
            case 'twins':
                title = `Edit Base Instructions for Twin Gremlins (Vex & Vax)`;
                const currentVexBase = settings.gremlinTwinsVexInstructionsBase || DEFAULT_TWINS_VEX_INSTRUCTIONS_BASE;
                const defaultVexBase = DEFAULT_TWINS_VEX_INSTRUCTIONS_BASE;
                const currentVaxBase = settings.gremlinTwinsVaxInstructionsBase || DEFAULT_TWINS_VAX_INSTRUCTIONS_BASE;
                const defaultVaxBase = DEFAULT_TWINS_VAX_INSTRUCTIONS_BASE;
    
                placeholdersInfo = `<small style="display:block; margin-bottom:5px;">These are the core persona instructions for Vex and Vax. They are dynamically inserted into a larger prompt structure that also includes Papa's blueprint and any previous twin ideas. The surrounding structure provides context like "Get inspired! Provide a concise note..."</small>`;
                textareasHtml = `
                    <h4>Vex (Character Depth, Emotion)</h4>
                    <textarea id="pp_instructions_vex_editor" class="text_pole" style="min-height: 150px; width: 100%; resize: vertical; box-sizing: border-box;">${currentVexBase}</textarea>
                    <hr style="margin: 10px 0;">
                    <h4>Vax (Plot, Action, World)</h4>
                    <textarea id="pp_instructions_vax_editor" class="text_pole" style="min-height: 150px; width: 100%; resize: vertical; box-sizing: border-box;">${currentVaxBase}</textarea>
                `;
                break;
            case 'mama':
                currentInstructions = settings.gremlinMamaInstructions || DEFAULT_MAMA_INSTRUCTIONS;
                defaultInstructions = DEFAULT_MAMA_INSTRUCTIONS;
                instructionSettingKey = 'gremlinMamaInstructions';
                placeholdersInfo = `<small style="display:block; margin-bottom:5px;">This prompt is given to Mama Gremlin. Ensure your custom prompt includes these placeholders if needed: <code>{{BLUEPRINT}}</code> (Papa's or initial blueprint), <code>{{TWIN_DELIBERATIONS}}</code> (collected ideas from Vex/Vax), <code>{{BLUEPRINT_SOURCE}}</code> (description of the blueprint's origin, e.g., "Papa's Blueprint").</small>`;
                textareasHtml = `<textarea id="pp_instructions_editor" class="text_pole" style="min-height: 300px; width: 100%; resize: vertical; box-sizing: border-box;">${currentInstructions}</textarea>`;
                break;
            case 'writer':
                currentInstructions = settings.gremlinWriterInstructionsTemplate || DEFAULT_WRITER_INSTRUCTIONS_TEMPLATE;
                defaultInstructions = DEFAULT_WRITER_INSTRUCTIONS_TEMPLATE;
                instructionSettingKey = 'gremlinWriterInstructionsTemplate';
                placeholdersInfo = `<small style="display:block; margin-bottom:5px;">This is a template for the Writer Gremlin. Ensure your custom prompt includes the placeholder: <code>{{BLUEPRINT}}</code> (which will be Mama's final blueprint or the combined plan if Mama is disabled).</small>`;
                textareasHtml = `<textarea id="pp_instructions_editor" class="text_pole" style="min-height: 300px; width: 100%; resize: vertical; box-sizing: border-box;">${currentInstructions}</textarea>`;
                break;
            case 'auditor':
                currentInstructions = settings.gremlinAuditorInstructionsTemplate || DEFAULT_AUDITOR_INSTRUCTIONS_TEMPLATE;
                defaultInstructions = DEFAULT_AUDITOR_INSTRUCTIONS_TEMPLATE;
                instructionSettingKey = 'gremlinAuditorInstructionsTemplate';
                placeholdersInfo = `<small style="display:block; margin-bottom:5px;">This is a template for the Auditor Gremlin. Ensure your custom prompt includes the placeholder: <code>{{WRITER_PROSE}}</code> (the text generated by the Writer Gremlin).</small>`;
                textareasHtml = `<textarea id="pp_instructions_editor" class="text_pole" style="min-height: 300px; width: 100%; resize: vertical; box-sizing: border-box;">${currentInstructions}</textarea>`;
                break;
            case 'regexGen':
                currentInstructions = settings.regexGenerationInstructions || DEFAULT_REGEX_GENERATION_INSTRUCTIONS;
                defaultInstructions = DEFAULT_REGEX_GENERATION_INSTRUCTIONS;
                instructionSettingKey = 'regexGenerationInstructions';
                title = 'Edit Regex Generation Prompt';
                placeholdersInfo = `<small style="display:block; margin-bottom:5px;">This prompt is sent to the AI when generating new regex rules. It should instruct the AI on how to identify patterns and format the output. No dynamic pipeline placeholders are used within this prompt itself.</small>`;
                textareasHtml = `<textarea id="pp_instructions_editor" class="text_pole" style="min-height: 300px; width: 100%; resize: vertical; box-sizing: border-box;">${currentInstructions}</textarea>`;
                break;
            default:
                window.toastr.error(`Unknown Gremlin role for instruction editing: ${gremlinRole}`);
                return;
        }
    
        popupContent.innerHTML = `
            ${placeholdersInfo}
            <div style="margin-top: 10px; margin-bottom: 10px;">
                ${textareasHtml}
            </div>
            <button id="pp_reset_instructions_btn" class="menu_button">Reset to Default</button>
        `;
    
        const resetButton = popupContent.querySelector('#pp_reset_instructions_btn');
        if (resetButton) {
            resetButton.addEventListener('pointerup', () => {
                if (gremlinRole === 'twins') {
                    popupContent.querySelector('#pp_instructions_vex_editor').value = DEFAULT_TWINS_VEX_INSTRUCTIONS_BASE;
                    popupContent.querySelector('#pp_instructions_vax_editor').value = DEFAULT_TWINS_VAX_INSTRUCTIONS_BASE;
                } else {
                    popupContent.querySelector('#pp_instructions_editor').value = defaultInstructions;
                }
                window.toastr.info('Instructions reset to default. Click "OK" to save this reset, or "Cancel" to discard.');
            });
        }
    
        if (await callGenericPopup(popupContent, POPUP_TYPE.CONFIRM, title, { wide: true, large: true, overflowY: 'auto' })) {
            if (gremlinRole === 'twins') {
                const vexInstructions = popupContent.querySelector('#pp_instructions_vex_editor').value;
                const vaxInstructions = popupContent.querySelector('#pp_instructions_vax_editor').value;
                settings.gremlinTwinsVexInstructionsBase = (vexInstructions.trim() === DEFAULT_TWINS_VEX_INSTRUCTIONS_BASE.trim()) ? '' : vexInstructions;
                settings.gremlinTwinsVaxInstructionsBase = (vaxInstructions.trim() === DEFAULT_TWINS_VAX_INSTRUCTIONS_BASE.trim()) ? '' : vaxInstructions;
            } else {
                const newInstructions = popupContent.querySelector('#pp_instructions_editor').value;
                settings[instructionSettingKey] = (newInstructions.trim() === defaultInstructions.trim()) ? '' : newInstructions;
            }
            saveSettingsDebounced();
            window.toastr.success(`Instructions for ${roleUpper} Gremlin saved.`);
        }
    }

    async showWriterChaosConfigPopup() {
        if (!state.isAppReady) { window.toastr.info("SillyTavern is still loading, please wait."); return; }
    
        const container = document.createElement('div');
        container.id = 'pp-chaos-config-popup-content';
        container.innerHTML = `
            <p>Configure multiple API/Model/Preset options for the Writer Gremlin. When Chaos Mode is on, one of these will be chosen randomly for each generation based on its weight.</p>
            <div class="list-container" style="max-height: 400px; overflow-y: auto;">
                <ul id="pp-chaos-options-list"></ul>
            </div>
            <button id="pp-add-chaos-option-btn" class="menu_button"><i class="fa-solid fa-plus"></i> Add New Chaos Option</button>
        `;
    
        const renderChaosOptionsList = () => {
            const settings = extension_settings[EXTENSION_NAME];
            const listElement = container.querySelector('#pp-chaos-options-list');
            listElement.innerHTML = '';
    
            if (!settings.gremlinWriterChaosOptions || settings.gremlinWriterChaosOptions.length === 0) {
                listElement.innerHTML = '<li style="text-align:center; color:var(--text_color_dim); padding: 10px;">No chaos options configured.</li>';
                return;
            }
    
            settings.gremlinWriterChaosOptions.forEach(option => {
                const item = document.createElement('li');
                item.className = 'list-item';
                item.dataset.optionId = option.id;

                const display = option.profile
                    ? `<strong>Profile: ${option.profile}</strong> (Preset: ${option.preset || 'Default'})`
                    : `<strong>${option.api} / ${option.model || 'Not Set'}</strong> (Preset: ${option.preset || 'Default'})`;

                item.innerHTML = `
                    <div style="flex-grow:1; min-width:0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${display}</div>
                    <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                        <label for="chaos-weight-${option.id}" style="font-size:0.9em; margin:0;">Weight:</label>
                        <input type="number" id="chaos-weight-${option.id}" class="text_pole" value="${option.weight || 1}" min="1" max="100" style="width:60px;">
                        <button class="menu_button pp-chaos-edit-btn" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                        <i class="fa-solid fa-trash-can delete-btn" title="Delete"></i>
                    </div>
                `;
    
                item.querySelector('.delete-btn').addEventListener('pointerup', () => {
                    settings.gremlinWriterChaosOptions = settings.gremlinWriterChaosOptions.filter(o => o.id !== option.id);
                    saveSettingsDebounced();
                    renderChaosOptionsList();
                });
    
                item.querySelector('.pp-chaos-edit-btn').addEventListener('pointerup', () => {
                    this.showChaosOptionEditorPopup(option.id, renderChaosOptionsList);
                });
    
                item.querySelector(`#chaos-weight-${option.id}`).addEventListener('change', (e) => {
                    const newWeight = parseInt(e.target.value, 10);
                    if (!isNaN(newWeight) && newWeight > 0) {
                        option.weight = newWeight;
                        saveSettingsDebounced();
                    }
                });
    
                listElement.appendChild(item);
            });
        };
    
        container.querySelector('#pp-add-chaos-option-btn').addEventListener('pointerup', () => {
            this.showChaosOptionEditorPopup(null, renderChaosOptionsList);
        });
    
        renderChaosOptionsList();
        callGenericPopup(container, POPUP_TYPE.DISPLAY, "Writer Chaos Mode Configuration", { wide: true, large: true, addCloseButton: true });
    }

    async showChaosOptionEditorPopup(optionId, onSaveCallback) {
        const settings = extension_settings[EXTENSION_NAME];
        const isNew = optionId === null;
        let option = isNew
            ? { id: generateUUID(), api: 'openai', model: '', source: '', customUrl: '', preset: 'Default', weight: 1 }
            : settings.gremlinWriterChaosOptions.find(o => o.id === optionId);
    
        if (!option) {
            window.toastr.error("Could not find chaos option to edit.");
            return;
        }
    
        // *** FIX STARTS HERE: Get the main UI's custom URL value ***
        const mainCustomUrlInput = document.getElementById('custom_api_url_text');
        const mainCustomUrl = mainCustomUrlInput ? mainCustomUrlInput.value.trim() : '';
        // *** FIX ENDS HERE ***
    
        const popupContent = document.createElement('div');
        popupContent.innerHTML = `
            <div class="pp-custom-binding-inputs" style="display: flex; flex-direction: column; gap: 15px;">
                <div>
                    <label for="pp_chaos_preset_selector">Parameter Preset:</label>
                    <select id="pp_chaos_preset_selector" class="text_pole"></select>
                </div>
                <hr>
                <div>
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="pp_chaos_config_mode" value="profile" id="pp_chaos_use_profile_mode" ${option.profile ? 'checked' : ''}>
                        Use Connection Profile:
                    </label>
                    <select id="pp_chaos_profile_selector" class="text_pole" ${!option.profile ? 'disabled' : ''}></select>
                </div>
                <div style="text-align: center; margin: 5px 0; color: var(--grey70); font-size: 0.9em;">── OR ──</div>
                <div>
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="pp_chaos_config_mode" value="manual" id="pp_chaos_use_manual_mode" ${!option.profile ? 'checked' : ''}>
                        Manual Configuration:
                    </label>
                </div>
                <div id="pp_chaos_manual_config_group" ${option.profile ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                    <div>
                        <label for="pp_chaos_api_selector">API Provider:</label>
                        <select id="pp_chaos_api_selector" class="text_pole"></select>
                    </div>
                    <div id="pp_chaos_model_group">
                        <label for="pp_chaos_model_selector">Model:</label>
                        <select id="pp_chaos_model_selector" class="text_pole"></select>
                    </div>
                    <div id="pp_chaos_custom_model_group" style="display: none;">
                        <label for="pp_chaos_custom_model_input">Custom Model Name:</label>
                        <input type="text" id="pp_chaos_custom_model_input" class="text_pole" placeholder="e.g., My-Fine-Tune-v1">
                    </div>
                    <div id="pp_chaos_custom_url_group" style="display: none;">
                        <label for="pp_chaos_custom_url_input">Custom API URL:</label>
                        <input type="text" id="pp_chaos_custom_url_input" class="text_pole" placeholder="Enter your custom API URL">
                    </div>
                    <div id="pp_chaos_source_group" style="display: none;">
                        <label for="pp_chaos_source_input">Source (for some OpenAI-compatibles):</label>
                        <input type="text" id="pp_chaos_source_input" class="text_pole" placeholder="e.g., DeepSeek">
                    </div>
                </div>
                <hr>
                <div>
                    <label for="pp_chaos_weight_input">Weight (higher is more likely):</label>
                    <input type="number" id="pp_chaos_weight_input" class="text_pole" value="${option.weight}" min="1" max="100">
                </div>
            </div>
        `;
    
        const presetSelect = popupContent.querySelector('#pp_chaos_preset_selector');
        const chaosProfileSelector = popupContent.querySelector('#pp_chaos_profile_selector');
        const chaosUseProfileMode = popupContent.querySelector('#pp_chaos_use_profile_mode');
        const chaosUseManualMode = popupContent.querySelector('#pp_chaos_use_manual_mode');
        const chaosManualConfigGroup = popupContent.querySelector('#pp_chaos_manual_config_group');
        const apiSelect = popupContent.querySelector('#pp_chaos_api_selector');
        const modelSelect = popupContent.querySelector('#pp_chaos_model_selector');
        const modelGroup = popupContent.querySelector('#pp_chaos_model_group');
        const customModelGroup = popupContent.querySelector('#pp_chaos_custom_model_group');
        const customModelInput = popupContent.querySelector('#pp_chaos_custom_model_input');
        const customUrlGroup = popupContent.querySelector('#pp_chaos_custom_url_group');
        const customUrlInput = popupContent.querySelector('#pp_chaos_custom_url_input');
        const sourceGroup = popupContent.querySelector('#pp_chaos_source_group');
        const sourceInput = popupContent.querySelector('#pp_chaos_source_input');
        const weightInput = popupContent.querySelector('#pp_chaos_weight_input');

        // Populate connection profiles for chaos
        const connectionProfiles = extension_settings.connectionManager?.profiles || {};
        chaosProfileSelector.innerHTML = '<option value="">-- Select a Profile --</option>';

        if (Object.keys(connectionProfiles).length === 0) {
            const noProfilesOption = document.createElement('option');
            noProfilesOption.value = "";
            noProfilesOption.textContent = "-- No Connection Profiles Available --";
            noProfilesOption.disabled = true;
            chaosProfileSelector.appendChild(noProfilesOption);
            chaosUseProfileMode.disabled = true;
            if (option.profile) {
                window.toastr.warning(`Connection profile "${option.profile}" is no longer available for chaos option.`, "Profile Missing");
            }
        } else {
            Object.keys(connectionProfiles).forEach(profileName => {
                const profileOption = document.createElement('option');
                profileOption.value = profileName;
                profileOption.textContent = profileName;
                chaosProfileSelector.appendChild(profileOption);
            });

            // Validate current profile still exists
            if (option.profile && !connectionProfiles[option.profile]) {
                window.toastr.warning(`Connection profile "${option.profile}" is no longer available for chaos option.`, "Profile Missing");
                chaosProfileSelector.value = '';
            } else {
                chaosProfileSelector.value = option.profile || '';
            }
        }

        // Mode switching handlers for chaos
        const toggleChaosMode = () => {
            const isProfileMode = chaosUseProfileMode.checked;
            chaosProfileSelector.disabled = !isProfileMode;
            chaosManualConfigGroup.style.opacity = isProfileMode ? '0.5' : '1';
            chaosManualConfigGroup.style.pointerEvents = isProfileMode ? 'none' : 'auto';
        };

        chaosUseProfileMode.addEventListener('change', toggleChaosMode);
        chaosUseManualMode.addEventListener('change', toggleChaosMode);
    
        // Populate Preset dropdown
        const presetOptions = ['<option value="Default">Default</option>', ...Object.keys(openai_setting_names).map(name => `<option value="${name}">${name}</option>`)].join('');
        presetSelect.innerHTML = presetOptions;
        presetSelect.value = option.preset;
    
        // Populate API Provider dropdown
        for (const name of Object.values(chat_completion_sources)) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1').trim();
            apiSelect.appendChild(opt);
        }
        apiSelect.value = option.api;
    
        const populateModels = (api) => {
            modelSelect.innerHTML = '';
            let sourceSelect = null;
    
            // CORRECTED: Smartly find the OpenRouter model list, wherever it may be.
            if (api === chat_completion_sources.OPENROUTER) {
                sourceSelect = document.querySelector('#model_openrouter_select');
                if (!sourceSelect || sourceSelect.options.length <= 1) {
                    sourceSelect = document.querySelector('#openrouter_model');
                }
            } else {
                const sourceSelectorId = API_TO_SELECTOR_MAP[api];
                if (sourceSelectorId) {
                    sourceSelect = document.querySelector(sourceSelectorId);
                }
            }
            const isCustom = api === chat_completion_sources.CUSTOM;
            modelGroup.style.display = !isCustom ? 'block' : 'none';
            customModelGroup.style.display = isCustom ? 'block' : 'none';
            customUrlGroup.style.display = isCustom ? 'block' : 'none';
            sourceGroup.style.display = ['openai', 'openrouter', 'custom'].includes(api) ? 'block' : 'none';
    
            if (sourceSelect) {
                Array.from(sourceSelect.childNodes).forEach(node => modelSelect.appendChild(node.cloneNode(true)));
                if (modelSelect.options.length <= 1) {
                    modelSelect.innerHTML = '<option value="">-- No models loaded in main UI --</option>';
                }
            } else {
                 console.warn(`${LOG_PREFIX} Could not find any source model selector for Chaos Editor API: ${api}`);
                 modelSelect.innerHTML = '<option value="">-- No models found in main UI --</option>';
            }
        };
    
        populateModels(option.api);
        apiSelect.addEventListener('change', () => populateModels(apiSelect.value));
    
        modelSelect.value = option.model;
        customModelInput.value = option.model;
        // *** FIX STARTS HERE: Pre-fill the Custom URL input for Chaos options ***
        customUrlInput.value = option.customUrl || mainCustomUrl;
        // *** FIX ENDS HERE ***
        sourceInput.value = option.source;
    
        if (await callGenericPopup(popupContent, POPUP_TYPE.CONFIRM, isNew ? 'Add Chaos Option' : 'Edit Chaos Option')) {
            let updatedOption;

            if (chaosUseProfileMode.checked) {
                // Profile mode
                updatedOption = {
                    id: option.id,
                    preset: presetSelect.value,
                    profile: chaosProfileSelector.value,
                    api: '',
                    model: '',
                    customUrl: '',
                    source: '',
                    weight: parseInt(weightInput.value, 10) || 1,
                };
            } else {
                // Manual mode
                const newApi = apiSelect.value;
                const newModel = newApi === chat_completion_sources.CUSTOM ? customModelInput.value.trim() : modelSelect.value;

                updatedOption = {
                    id: option.id,
                    preset: presetSelect.value,
                    profile: '',
                    api: newApi,
                    model: newModel,
                    customUrl: newApi === chat_completion_sources.CUSTOM ? customUrlInput.value.trim() : '',
                    source: sourceInput.value.trim(),
                    weight: parseInt(weightInput.value, 10) || 1,
                };
            }

            if (isNew) {
                settings.gremlinWriterChaosOptions.push(updatedOption);
            } else {
                const index = settings.gremlinWriterChaosOptions.findIndex(o => o.id === optionId);
                if (index !== -1) {
                    settings.gremlinWriterChaosOptions[index] = updatedOption;
                }
            }

            saveSettingsDebounced();
            if (onSaveCallback) onSaveCallback();
            window.toastr.success(`Chaos option ${isNew ? 'added' : 'updated'}.`);
        }
    }
}

// Export a singleton instance
export const uiManager = new UIManager();
