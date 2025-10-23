import { eventSource, event_types, saveSettingsDebounced } from '../../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { openai_setting_names } from '../../../../../../../scripts/openai.js';
import { PresetNavigator, injectNavigatorModal } from './navigator.js';
import { state } from './state.js';
import { EXTENSION_NAME, LOG_PREFIX, GREMLIN_ROLES } from './constants.js';
import { ErrorHandler } from './error-handler.js';

/**
 * Handles the initialization of Project Gremlin UI components
 */
export async function initializeProjectGremlin(settings, showApiEditorPopup, showInstructionsEditorPopup, updateGremlinApiDisplay) {
    try {
        // Create Gremlin toggle button
        let buttonContainer = document.getElementById('pp-chat-buttons-container');
        if (!buttonContainer) {
            buttonContainer = document.createElement('div');
            buttonContainer.id = 'pp-chat-buttons-container';
            const sendButtonHolder = document.getElementById('send_but_holder');
            const chatBar = document.getElementById('chat_bar');

            if (sendButtonHolder) sendButtonHolder.parentElement?.insertBefore(buttonContainer, sendButtonHolder.nextSibling);
            else if (chatBar) chatBar.appendChild(buttonContainer);
            else document.querySelector('.mes_controls')?.appendChild(buttonContainer);
        }

        buttonContainer.insertAdjacentHTML('beforeend', `<button id="pp_gremlin_toggle" class="fa-solid fa-hat-wizard" title="Toggle Project Gremlin Pipeline"></button>`);

        const gremlinToggle = document.getElementById('pp_gremlin_toggle');
        const gremlinEnableCheckbox = document.getElementById('pp_projectGremlinEnabled');
        const gremlinSettingsContainer = document.getElementById('pp_projectGremlin_settings_container');

        const updateGremlinSettingsVisibility = () => {
            if (gremlinSettingsContainer) {
                gremlinSettingsContainer.style.display = gremlinEnableCheckbox.checked ? 'block' : 'none';
            }
        };

        const updateGremlinToggleState = () => {
            if (!state.isAppReady) return;
            const enabled = settings.projectGremlinEnabled;
            gremlinToggle?.classList.toggle('active', enabled);
            if (gremlinEnableCheckbox) {
                gremlinEnableCheckbox.checked = enabled;
                updateGremlinSettingsVisibility();
            }
        };

        const toggleGremlin = () => {
            if (!state.isAppReady) {
                ErrorHandler.showUserWarning("SillyTavern is not fully ready yet.");
                return;
            }
            settings.projectGremlinEnabled = !settings.projectGremlinEnabled;
            saveSettingsDebounced();
            updateGremlinToggleState();
            window.toastr.info(`Project Gremlin ${settings.projectGremlinEnabled ? 'enabled' : 'disabled'} for next message.`);

            if (!settings.projectGremlinEnabled) {
                const context = getContext();
                context.executeSlashCommands('/inject id=gremlin_final_plan remove | /inject id=gremlin_adherence_prompt remove');
            }
        };

        gremlinToggle?.addEventListener('pointerup', toggleGremlin);
        gremlinEnableCheckbox?.addEventListener('change', (e) => {
            if (settings.projectGremlinEnabled !== e.target.checked) {
                settings.projectGremlinEnabled = e.target.checked;
                saveSettingsDebounced();
                updateGremlinToggleState();
                updateGremlinSettingsVisibility();
                if (!settings.projectGremlinEnabled) {
                    const context = getContext();
                    context.executeSlashCommands('/inject id=gremlin_final_plan remove | /inject id=gremlin_adherence_prompt remove');
                }
            }
        });

        // Initialize navigator
        injectNavigatorModal();
        const gremlinPresetNavigator = new PresetNavigator();
        gremlinPresetNavigator.init();

        // Wait for OpenAI settings to be available
        await new Promise(resolve => {
            const checkOpenAISettings = () => {
                if (typeof openai_setting_names !== 'undefined' && Object.keys(openai_setting_names).length > 0) {
                    resolve();
                } else {
                    setTimeout(checkOpenAISettings, 100);
                }
            };
            checkOpenAISettings();
        });

        // Setup role-specific UI elements
        const presetOptions = ['<option value="Default">Default</option>', ...Object.keys(openai_setting_names).map(name => `<option value="${name}">${name}</option>`)].join('');

        GREMLIN_ROLES.forEach(role => {
            const roleUpper = role.charAt(0).toUpperCase() + role.slice(1);
            const presetSelectId = `pp_gremlin${roleUpper}Preset`;
            const presetSelect = document.getElementById(presetSelectId);
            const browseBtn = document.querySelector(`.pp-browse-gremlin-preset-btn[data-target-select="${presetSelectId}"]`);
            const apiBtn = document.querySelector(`.pp-select-api-btn[data-gremlin-role="${role}"]`);

            if (presetSelect) {
                presetSelect.innerHTML = presetOptions;
                presetSelect.value = settings[`gremlin${roleUpper}Preset`] || 'Default';
                presetSelect.addEventListener('change', () => {
                    settings[`gremlin${roleUpper}Preset`] = presetSelect.value;
                    saveSettingsDebounced();
                });
            }

            if (browseBtn) browseBtn.addEventListener('pointerup', () => gremlinPresetNavigator.open(presetSelectId));
            if (apiBtn) apiBtn.addEventListener('pointerup', () => showApiEditorPopup(role));
            updateGremlinApiDisplay(role);

            const editInstructionsBtn = document.querySelector(`.pp-edit-instructions-btn[data-gremlin-role="${role}"]`);
            if (editInstructionsBtn) {
                editInstructionsBtn.addEventListener('pointerup', () => showInstructionsEditorPopup(role));
            }
        });

        updateGremlinToggleState();
        return { updateGremlinSettingsVisibility, updateGremlinToggleState };

    } catch (error) {
        console.error(`${LOG_PREFIX} Error initializing Project Gremlin:`, error);
        throw error;
    }
}

/**
 * Sets up regex list UI observers to hide ProsePolisher rules from the main regex UI
 */
export function setupRegexUIObserver() {
    const bodyObserver = new MutationObserver((mutationsList, observer) => {
        const regexListContainer = document.getElementById('saved_regex_scripts');
        if (regexListContainer) {
            const listObserver = new MutationObserver(state.uiManager.hideRulesInStandardUI);
            listObserver.observe(regexListContainer, { childList: true, subtree: true });
            state.uiManager.hideRulesInStandardUI();
            observer.disconnect();
        }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Sets up core event listeners for the extension
 */
export function setupEventListeners(onBeforeGremlinGeneration, onUserMessageRenderedForGremlin) {
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, onBeforeGremlinGeneration);
    eventSource.makeLast(event_types.USER_MESSAGE_RENDERED, (messageId) => onUserMessageRenderedForGremlin(messageId));
    eventSource.on(event_types.chat_id_changed, () => {
        state.processedMessageIds.clear();
        console.log(`${LOG_PREFIX} Chat changed, cleared processed message ID cache.`);
    });
}