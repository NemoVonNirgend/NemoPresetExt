import { eventSource, event_types } from '../../../../../script.js';
import { LOG_PREFIX } from '../core/utils.js';

const SELECTORS = {
    stopButton: '#send_form_stop_button',
    leftNavPanel: '#left-nav-panel',
};

export const NemoGlobalUI = {
    convertToInlineDrawer: function(selector, title, isOpenByDefault = false, uniqueId = null) {
        const targetElement = document.querySelector(selector);
        if (!targetElement || targetElement.closest('.inline-drawer')) return;
        if (uniqueId && document.getElementById(`nemo-drawer-${uniqueId}`)) return;

        const drawer = document.createElement('div');
        drawer.className = 'inline-drawer wide100p nemo-converted-drawer';
        if (uniqueId) drawer.id = `nemo-drawer-${uniqueId}`;

        const drawerToggle = document.createElement('div');
        drawerToggle.className = 'inline-drawer-toggle inline-drawer-header interactable';
        drawerToggle.tabIndex = 0;
        drawerToggle.innerHTML = `<b>${title}</b><div class="inline-drawer-icon fa-solid fa-chevron-down ${isOpenByDefault ? 'up' : 'down'}"></div>`;

        const drawerContent = document.createElement('div');
        drawerContent.className = 'inline-drawer-content';
        if (!isOpenByDefault) drawerContent.style.display = 'none';

        // Use a DocumentFragment to batch append operations for performance
        const fragment = document.createDocumentFragment();
        while (targetElement.firstChild) {
            fragment.appendChild(targetElement.firstChild);
        }
        drawerContent.appendChild(fragment);

        drawer.appendChild(drawerToggle);
        drawer.appendChild(drawerContent);

        targetElement.parentNode.insertBefore(drawer, targetElement);
        targetElement.remove();
    },

    moveNestedPromptDrawers: function() {
        const openaiSettingsDrawer = document.getElementById('nemo-drawer-openai_chat_settings');
        if (!openaiSettingsDrawer) return;

        const openaiSettingsContent = openaiSettingsDrawer.querySelector('.inline-drawer-content');
        if (!openaiSettingsContent) return;

        const quickPromptsDrawer = openaiSettingsContent.querySelector('.inline-drawer:has(b[data-i18n="Quick Prompts Edit"])');
        const utilityPromptsDrawer = openaiSettingsContent.querySelector('.inline-drawer:has(b[data-i18n="Utility Prompts"])');

        if (quickPromptsDrawer) {
            openaiSettingsDrawer.parentNode.insertBefore(quickPromptsDrawer, openaiSettingsDrawer.nextSibling);
        }
        if (utilityPromptsDrawer) {
            openaiSettingsDrawer.parentNode.insertBefore(utilityPromptsDrawer, openaiSettingsDrawer.nextSibling);
        }
    },

    groupNemoExtensions: function() {
        const nemoExtensions = [
            'NemoPresetExt',
            'Prose Polisher (Regex + AI)',
            'Mood Music Settings',
            'Qvink Memory',
            'LoreManager',
            'Chat History Super Manager'
        ];
        const extensionsContainer = document.querySelector('#extensions_settings');
        if (!extensionsContainer) return;

        let nemoSuiteDrawer = document.getElementById('nemo-suite-drawer');
        if (!nemoSuiteDrawer) {
            nemoSuiteDrawer = document.createElement('div');
            nemoSuiteDrawer.id = 'nemo-suite-drawer';
            nemoSuiteDrawer.className = 'inline-drawer wide100p nemo-converted-drawer';
            nemoSuiteDrawer.innerHTML = `
                <div class="inline-drawer-toggle inline-drawer-header interactable" tabindex="0">
                    <b>Nemo Suite</b>
                    <div class="inline-drawer-icon fa-solid fa-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content" style="display: none;"></div>
            `;
            extensionsContainer.prepend(nemoSuiteDrawer);
        }

        const nemoSuiteContent = nemoSuiteDrawer.querySelector('.inline-drawer-content');
        const allDrawers = Array.from(extensionsContainer.querySelectorAll('.inline-drawer'));

        allDrawers.forEach(drawer => {
            const titleElement = drawer.querySelector('.inline-drawer-header b');
            if (titleElement && nemoExtensions.includes(titleElement.textContent.trim())) {
                if (drawer.id !== 'nemo-suite-drawer') {
                    nemoSuiteContent.appendChild(drawer);
                }
            }
        });
    },

    initializeStopButtonAnimation: function() {
        const stopButton = document.querySelector(SELECTORS.stopButton);
        if (!stopButton) return;
        eventSource.on(event_types.GENERATION_STARTED, () => stopButton.classList.add('nemo-generating-animation'));
        eventSource.on(event_types.GENERATION_ENDED, () => stopButton.classList.remove('nemo-generating-animation'));
        eventSource.on(event_types.GENERATION_STOPPED, () => stopButton.classList.remove('nemo-generating-animation'));
    },

    initialize: function() {
        console.log(`${LOG_PREFIX} Initializing Global UI module...`);

        const drawerTargetsConfig = [
            { selector: '#max_context_block', title: 'Context Configuration', id: 'context_config' },
            { selector: '#instruct_mode_block', title: 'Instruct Mode Settings', id: 'instruct_mode'},
            { selector: '#response_configuration_block', title: 'AI Response Formatting', id: 'response_format' },
            { selector: '#model_specific_block', title: 'Model Specific Behavior', id: 'model_behavior' },
            { selector: '#openai_api-presets + #common-gen-settings-block', title: 'Common Generation Settings', id: 'common_gen_settings'},
            { selector: '#openai_settings', title: 'Chat Completion Settings', id: 'openai_chat_settings'},
            { selector: '#range_block_openai', title: 'OpenAI Sampling', id: 'openai_sampling_specific' },
            { selector: '#range_block_novel', title: 'NovelAI Sampling', id: 'novel_sampling_specific' },
            { selector: '#textgenerationwebui_api-settings > .flex-container:has(#temp_textgenerationwebui)', title: 'Text Completion Sampling', id: 'textgen_sampling_specific' },
            { selector: '#kobold_api-settings > .flex-container:has(#temp)', title: 'KoboldAI Sampling', id: 'kobold_sampling_specific'},
            { selector: '#anthropic_api_settings_block .settings_group:has(#anthropic_temp)', title: 'Anthropic Sampling', id: 'anthropic_sampling_specific'},
        ];

        const setupPanelObserver = (leftNavPanel) => {
            const convertTargets = () => {
                // Convert standard sections to drawers
                drawerTargetsConfig.forEach(config => {
                    const elementToConvert = document.querySelector(config.selector);
                    if (elementToConvert && elementToConvert.offsetParent !== null && !elementToConvert.closest('.inline-drawer')) {
                        this.convertToInlineDrawer(config.selector, config.title, false, config.id);
                    }
                });

                // Move the prompt manager to be after the chat settings drawer
                const promptManager = document.querySelector('#completion_prompt_manager');
                const openaiChatSettingsDrawer = document.getElementById('nemo-drawer-openai_chat_settings');
                if (promptManager && openaiChatSettingsDrawer && !promptManager.dataset.nemoStandalone) {
                    openaiChatSettingsDrawer.parentNode.insertBefore(promptManager, openaiChatSettingsDrawer.nextSibling);
                    promptManager.dataset.nemoStandalone = 'true';
                }

                // Group extensions if the container exists and hasn't been processed
                const extensionsContainer = document.querySelector('#extensions_settings');
                if (extensionsContainer && !extensionsContainer.dataset.nemoGrouped) {
                    this.groupNemoExtensions();
                    extensionsContainer.dataset.nemoGrouped = 'true';
                }
            };

            const panelObserver = new MutationObserver(convertTargets);
            panelObserver.observe(leftNavPanel, { childList: true, subtree: true });
            convertTargets(); // Initial run
        };

        // This observer's only job is to find the left panel and then stop.
        const bodyObserver = new MutationObserver((mutations, obs) => {
            const leftNavPanel = document.querySelector(SELECTORS.leftNavPanel);
            if (leftNavPanel) {
                obs.disconnect(); // Stop watching the body to prevent observer wars.

                // Start the specific, targeted observer for the left panel.
                setupPanelObserver(leftNavPanel);

                // Initialize global elements that are not in the left panel.
                const stopButton = document.querySelector(SELECTORS.stopButton);
                if (stopButton && !stopButton.dataset.nemoAnimated) {
                    this.initializeStopButtonAnimation();
                    stopButton.dataset.nemoAnimated = 'true';
                }
            }
        });

        bodyObserver.observe(document.body, { childList: true, subtree: true });
        console.log(`${LOG_PREFIX} Global UI module initialized and observing body for left panel.`);
    }
};