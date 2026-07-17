import { eventSource, event_types } from '../../../../../script.js';
import { LOG_PREFIX } from '../core/utils.js';

const SELECTORS = {
    stopButton: '#send_form_stop_button',
    leftNavPanel: '#left-nav-panel',
};

export const NemoGlobalUI = {
    _initialized: false,
    _bodyObserver: null,
    _panelObserver: null,
    _visibilityObservers: new Set(),
    _moveRecords: [],
    _createdElements: new Set(),
    _stopButton: null,
    _generationHandlers: null,

    _recordMove: function (element) {
        if (!element?.parentNode || this._moveRecords.some(record => record.element === element)) return;
        this._moveRecords.push({
            element,
            parent: element.parentNode,
            nextSibling: element.nextSibling,
        });
    },

    _restoreMoves: function () {
        for (const { element, parent, nextSibling } of this._moveRecords.reverse()) {
            if (!element || !parent?.isConnected) continue;
            const anchor = nextSibling?.parentNode === parent ? nextSibling : null;
            parent.insertBefore(element, anchor);
        }
        this._moveRecords.length = 0;
    },

    convertToInlineDrawer: function (target, title, isOpenByDefault = false, uniqueId = null) {
        const targetElement = typeof target === 'string'
            ? document.querySelector(target)
            : target;
        if (!targetElement || targetElement.closest('.nemo-converted-drawer')) return;
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

        // Insert wrapper BEFORE target, then move target INSIDE wrapper content.
        this._recordMove(targetElement);
        targetElement.parentNode.insertBefore(drawer, targetElement);
        drawerContent.appendChild(targetElement);

        drawer.appendChild(drawerToggle);
        drawer.appendChild(drawerContent);
        this._createdElements.add(drawer);

        // Sync visibility: ST's changeMainAPI() directly hides/shows elements
        // like #range_block_novel via jQuery .hide()/.show(). Since the target
        // is now inside our wrapper, we must propagate its visibility to the
        // drawer so the header doesn't show when the content is hidden.
        const syncVisibility = () => {
            const hidden = targetElement.style.display === 'none' ||
                           targetElement.classList.contains('displayNone');
            drawer.style.display = hidden ? 'none' : '';
        };
        const visObserver = new MutationObserver(syncVisibility);
        visObserver.observe(targetElement, { attributes: true, attributeFilter: ['style', 'class'] });
        this._visibilityObservers.add(visObserver);
        // Initial sync (ST may have already hidden the element)
        syncVisibility();
    },

    findTargetWithDescendant: function (rootSelector, candidateSelector, descendantSelector, directChildren = false) {
        const root = document.querySelector(rootSelector);
        if (!root) return null;

        const candidates = directChildren
            ? Array.from(root.children).filter(element => element.matches(candidateSelector))
            : Array.from(root.querySelectorAll(candidateSelector));

        return candidates.find(element => element.querySelector(descendantSelector)) || null;
    },

    findInlineDrawerByHeading: function (container, heading) {
        const match = Array.from(container.querySelectorAll('.inline-drawer')).find(drawer => {
            const titleElement = drawer.querySelector('.inline-drawer-header b');
            if (!titleElement) return false;
            return titleElement.textContent.trim() === heading;
        });
        return match ? match : null;
    },

    moveNestedPromptDrawers: function () {
        const openaiSettingsDrawer = document.getElementById('nemo-drawer-openai_chat_settings');
        if (!openaiSettingsDrawer) return;

        const openaiSettingsContent = openaiSettingsDrawer.querySelector('.inline-drawer-content');
        if (!openaiSettingsContent) return;

        const quickPromptsDrawer = this.findInlineDrawerByHeading(openaiSettingsContent, 'Quick Prompts Edit');
        const utilityPromptsDrawer = this.findInlineDrawerByHeading(openaiSettingsContent, 'Utility Prompts');

        if (quickPromptsDrawer) {
            this._recordMove(quickPromptsDrawer);
            openaiSettingsDrawer.parentNode.insertBefore(quickPromptsDrawer, openaiSettingsDrawer.nextSibling);
        }
        if (utilityPromptsDrawer) {
            this._recordMove(utilityPromptsDrawer);
            openaiSettingsDrawer.parentNode.insertBefore(utilityPromptsDrawer, openaiSettingsDrawer.nextSibling);
        }
    },

    groupNemoExtensions: function () {
        const nemoExtensions = [
            'NemoPresetExt',
            'Nemo Rewrite',
            'Prose Polisher (Regex + AI)',
            'Mood Music Settings',
            'Qvink Memory',
            'LoreManager',
            'Chat History Super Manager',
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
            this._createdElements.add(nemoSuiteDrawer);
        }

        const nemoSuiteContent = nemoSuiteDrawer.querySelector('.inline-drawer-content');
        const nemoPresetSettings = document.getElementById('nemo-preset-ext-settings-host');
        if (nemoPresetSettings && nemoPresetSettings.parentElement !== nemoSuiteContent) {
            this._recordMove(nemoPresetSettings);
            nemoSuiteContent.appendChild(nemoPresetSettings);
        }

        const allDrawers = Array.from(extensionsContainer.querySelectorAll('.inline-drawer'));

        allDrawers.forEach(drawer => {
            const titleElement = drawer.querySelector('.inline-drawer-header b');
            if (titleElement && nemoExtensions.includes(titleElement.textContent.trim())) {
                if (drawer.id !== 'nemo-suite-drawer') {
                    this._recordMove(drawer);
                    nemoSuiteContent.appendChild(drawer);
                }
            }
        });
    },

    initializeStopButtonAnimation: function () {
        const stopButton = document.querySelector(SELECTORS.stopButton);
        if (!stopButton || this._generationHandlers) return;
        const started = () => stopButton.classList.add('nemo-generating-animation');
        const stopped = () => stopButton.classList.remove('nemo-generating-animation');
        eventSource.on(event_types.GENERATION_STARTED, started);
        eventSource.on(event_types.GENERATION_ENDED, stopped);
        eventSource.on(event_types.GENERATION_STOPPED, stopped);
        this._stopButton = stopButton;
        this._generationHandlers = { started, stopped };
    },

    initialize: function () {
        if (this._initialized) return;
        this._initialized = true;
        console.log(`${LOG_PREFIX} Initializing Global UI module...`);

        const drawerTargetsConfig = [
            { selector: '#max_context_block', title: 'Context Configuration', id: 'context_config' },
            { selector: '#instruct_mode_block', title: 'Instruct Mode Settings', id: 'instruct_mode' },
            { selector: '#response_configuration_block', title: 'AI Response Formatting', id: 'response_format' },
            { selector: '#model_specific_block', title: 'Model Specific Behavior', id: 'model_behavior' },
            { selector: '#openai_api-presets + #common-gen-settings-block', title: 'Common Generation Settings', id: 'common_gen_settings' },
            { selector: '#openai_settings', title: 'Chat Completion Settings', id: 'openai_chat_settings' },
            { selector: '#range_block_openai', title: 'OpenAI Sampling', id: 'openai_sampling_specific' },
            { selector: '#range_block_novel', title: 'NovelAI Sampling', id: 'novel_sampling_specific' },
            { root: '#textgenerationwebui_api-settings', candidate: '.flex-container', descendant: '#temp_textgenerationwebui', directChildren: true, title: 'Text Completion Sampling', id: 'textgen_sampling_specific' },
            { root: '#kobold_api-settings', candidate: '.flex-container', descendant: '#temp', directChildren: true, title: 'KoboldAI Sampling', id: 'kobold_sampling_specific' },
            { root: '#anthropic_api_settings_block', candidate: '.settings_group', descendant: '#anthropic_temp', title: 'Anthropic Sampling', id: 'anthropic_sampling_specific' },
        ];

        const setupPanelObserver = (leftNavPanel) => {
            const convertTargets = () => {
                // Convert standard sections to drawers
                drawerTargetsConfig.forEach(config => {
                    const elementToConvert = config.descendant
                        ? this.findTargetWithDescendant(
                            config.root,
                            config.candidate,
                            config.descendant,
                            config.directChildren,
                        )
                        : document.querySelector(config.selector);
                    if (elementToConvert && !elementToConvert.closest('.inline-drawer')) {
                        this.convertToInlineDrawer(elementToConvert, config.title, false, config.id);
                    }
                });

                // Move the prompt manager to be after the chat settings drawer
                const promptManager = document.querySelector('#completion_prompt_manager');
                const openaiChatSettingsDrawer = document.getElementById('nemo-drawer-openai_chat_settings');
                if (promptManager && openaiChatSettingsDrawer && !promptManager.dataset.nemoStandalone) {
                    this._recordMove(promptManager);
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

            this._panelObserver?.disconnect();
            const panelObserver = new MutationObserver(convertTargets);
            panelObserver.observe(leftNavPanel, { childList: true, subtree: true });
            this._panelObserver = panelObserver;
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

        // Check immediately if the panel already exists
        const existingPanel = document.querySelector(SELECTORS.leftNavPanel);
        if (existingPanel) {
            setupPanelObserver(existingPanel);
            const stopButton = document.querySelector(SELECTORS.stopButton);
            if (stopButton && !stopButton.dataset.nemoAnimated) {
                this.initializeStopButtonAnimation();
                stopButton.dataset.nemoAnimated = 'true';
            }
        } else {
            bodyObserver.observe(document.body, { childList: true, subtree: true });
            this._bodyObserver = bodyObserver;
        }
        console.log(`${LOG_PREFIX} Global UI module initialized.`);
    },

    destroy: function () {
        this._bodyObserver?.disconnect();
        this._panelObserver?.disconnect();
        this._bodyObserver = null;
        this._panelObserver = null;
        for (const observer of this._visibilityObservers) observer.disconnect();
        this._visibilityObservers.clear();

        if (this._generationHandlers) {
            const { started, stopped } = this._generationHandlers;
            eventSource.removeListener(event_types.GENERATION_STARTED, started);
            eventSource.removeListener(event_types.GENERATION_ENDED, stopped);
            eventSource.removeListener(event_types.GENERATION_STOPPED, stopped);
        }
        if (this._stopButton) {
            this._stopButton.classList.remove('nemo-generating-animation');
            delete this._stopButton.dataset.nemoAnimated;
        }
        this._stopButton = null;
        this._generationHandlers = null;

        document.querySelectorAll('[data-nemo-standalone]').forEach(element => {
            delete element.dataset.nemoStandalone;
        });
        document.querySelectorAll('[data-nemo-grouped]').forEach(element => {
            delete element.dataset.nemoGrouped;
        });

        this._restoreMoves();
        for (const element of this._createdElements) element.remove();
        this._createdElements.clear();
        this._initialized = false;
    },
};
