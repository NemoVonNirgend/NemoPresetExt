// user-settings-tabs.js
// Overhauls the User Settings tab to use a tabbed interface, absorbing Advanced Formatting content

import { eventSource, event_types } from '../../../../../script.js';
import { LOG_PREFIX, NEMO_EXTENSION_NAME } from '../core/utils.js';
import logger from '../core/logger.js';

// AF tabs that are irrelevant in Chat Completion mode
const CC_HIDDEN_TABS = ['context-template', 'instruct-template', 'system-prompt'];

// The 3 checkboxes useful in CC mode (moved to Reasoning/Misc when in CC mode)
// We identify them by their checkbox IDs inside #ContextSettings
const CC_USEFUL_CHECKBOX_IDS = [
    'collapse-newlines-checkbox',
    'trim_spaces',
    'trim_sentences_checkbox',
];

export const UserSettingsTabs = {
    initialized: false,
    activeTab: 'ui-theme',

    // Tracks whether we're in CC mode
    _isCCMode: false,

    // Stash for the 3 checkboxes when moved to Reasoning/Misc
    _ccCheckboxStash: null,

    initialize: function() {
        if (this.initialized) return;

        // Cleanup any existing tab interface first
        this.cleanup();

        // Wait for both the user settings block AND the Advanced Formatting drawer to be available
        const pollForContent = setInterval(() => {
            const userSettingsBlock = document.getElementById('user-settings-block');
            const userSettingsContent = document.getElementById('user-settings-block-content');
            const advancedFormattingDrawer = document.getElementById('AdvancedFormatting');

            if (userSettingsBlock && userSettingsContent &&
                !userSettingsBlock.querySelector('.nemo-user-settings-tabs') &&
                userSettingsContent.children.length > 0 &&
                advancedFormattingDrawer &&
                advancedFormattingDrawer.querySelector('.flex-container.spaceEvenly')) {
                clearInterval(pollForContent);

                // Small delay to ensure all content is loaded
                setTimeout(() => {
                    this.createTabbedInterface();
                    this.initialized = true;
                    logger.info('User Settings Tabs (combined) initialized');
                }, 150);
            }
        }, 500);
    },

    createTabbedInterface: function() {
        try {
            const userSettingsContent = document.getElementById('user-settings-block-content');
            if (!userSettingsContent) {
                logger.error('Could not find user-settings-block-content');
                return;
            }

            // Detect current API mode before building
            this._isCCMode = this._detectCCMode();

            // Create tab navigation with all 7 tabs
            const tabNavigation = document.createElement('div');
            tabNavigation.className = 'nemo-user-settings-tabs';
            tabNavigation.innerHTML = `
                <button class="nemo-user-settings-tab active" data-tab="ui-theme">
                    <i class="fa-solid fa-palette"></i> UI Theme
                </button>
                <button class="nemo-user-settings-tab" data-tab="character-handling">
                    <i class="fa-solid fa-users"></i> Character Handling
                </button>
                <button class="nemo-user-settings-tab" data-tab="chat-messages">
                    <i class="fa-solid fa-comments"></i> Chat Messages
                </button>
                <button class="nemo-user-settings-tab" data-tab="context-template">
                    <i class="fa-solid fa-file-lines"></i> Context Template
                </button>
                <button class="nemo-user-settings-tab" data-tab="instruct-template">
                    <i class="fa-solid fa-clipboard-list"></i> Instruct Template
                </button>
                <button class="nemo-user-settings-tab" data-tab="system-prompt">
                    <i class="fa-solid fa-cogs"></i> System Prompt
                </button>
                <button class="nemo-user-settings-tab" data-tab="reasoning-misc">
                    <i class="fa-solid fa-brain"></i> Reasoning/Misc
                </button>
            `;

            // Insert tab navigation before the content
            userSettingsContent.parentNode.insertBefore(tabNavigation, userSettingsContent);

            // Reorganize content into tabs (user settings + AF)
            this.reorganizeContent();

            // Hide the AF drawer from the left nav (we've absorbed its content)
            this._hideAFDrawer();

            // Apply CC mode visibility
            this._applyCCMode(this._isCCMode, /* initial */ true);

            // Add tab click handlers
            this.addTabHandlers();

            // Add custom input handlers
            this.addCustomInputHandlers();

            // Add search functionality
            this.addSearchHandler();

            // Listen for API changes
            this._listenForApiChanges();

        } catch (error) {
            logger.error('Error creating tabbed interface', error);
        }
    },

    reorganizeContent: function() {
        const userSettingsContent = document.getElementById('user-settings-block-content');

        // --- User Settings columns ---
        const originalElements = {
            uiThemeBlock: document.querySelector('[name="UserSettingsFirstColumn"]'),
            secondColumn: document.querySelector('[name="UserSettingsSecondColumn"]'),
            thirdColumn: document.querySelector('[name="UserSettingsThirdColumn"]')
        };

        // --- Advanced Formatting columns ---
        const contextSettingsColumn = document.getElementById('ContextSettings');
        const instructSettingsColumn = document.getElementById('InstructSettingsColumn');
        const systemPromptColumn = document.getElementById('SystemPromptColumn');

        // Create tab content containers
        const uiThemeTab = document.createElement('div');
        uiThemeTab.className = 'nemo-user-settings-tab-content active';
        uiThemeTab.id = 'nemo-tab-ui-theme';

        const characterHandlingTab = document.createElement('div');
        characterHandlingTab.className = 'nemo-user-settings-tab-content';
        characterHandlingTab.id = 'nemo-tab-character-handling';

        const chatMessagesTab = document.createElement('div');
        chatMessagesTab.className = 'nemo-user-settings-tab-content';
        chatMessagesTab.id = 'nemo-tab-chat-messages';

        const contextTemplateTab = document.createElement('div');
        contextTemplateTab.className = 'nemo-user-settings-tab-content';
        contextTemplateTab.id = 'nemo-tab-context-template';

        const instructTemplateTab = document.createElement('div');
        instructTemplateTab.className = 'nemo-user-settings-tab-content';
        instructTemplateTab.id = 'nemo-tab-instruct-template';

        const systemPromptTab = document.createElement('div');
        systemPromptTab.className = 'nemo-user-settings-tab-content';
        systemPromptTab.id = 'nemo-tab-system-prompt';

        const reasoningMiscTab = document.createElement('div');
        reasoningMiscTab.className = 'nemo-user-settings-tab-content';
        reasoningMiscTab.id = 'nemo-tab-reasoning-misc';

        // ---- Populate UI Theme tab ----
        if (originalElements.uiThemeBlock) {
            const uiPresetBlock = originalElements.uiThemeBlock.querySelector('#UI-presets-block');
            const themeElements = originalElements.uiThemeBlock.querySelector('[name="themeElements"]');

            if (uiPresetBlock) {
                uiThemeTab.appendChild(uiPresetBlock);

                // Merge import/export/delete buttons from the H4 into the dropdown row
                const presetH4 = uiPresetBlock.querySelector('h4');
                // The dropdown row has class "flexnowrap" — the H4's inner flex-container does not
                const dropdownRow = uiPresetBlock.querySelector('.flex-container.flexnowrap');
                if (presetH4 && dropdownRow) {
                    const buttonContainer = presetH4.querySelector('.flex-container');
                    if (buttonContainer) {
                        // Move each button into the dropdown row
                        Array.from(buttonContainer.children).forEach(btn => {
                            dropdownRow.appendChild(btn);
                        });
                    }
                    // Also move the hidden file input for import
                    const importFileInput = presetH4.querySelector('#ui_preset_import_file');
                    if (importFileInput) {
                        dropdownRow.appendChild(importFileInput);
                    }
                }
            }

            const mainContentWrapper = document.createElement('div');
            mainContentWrapper.className = 'nemo-ui-theme-main-content';

            if (themeElements) {
                mainContentWrapper.appendChild(themeElements);
            }

            if (originalElements.secondColumn) {
                const customCSSBlock = originalElements.secondColumn.querySelector('#CustomCSS-block');
                if (customCSSBlock) {
                    customCSSBlock.remove();
                    mainContentWrapper.appendChild(customCSSBlock);
                }
            }

            uiThemeTab.appendChild(mainContentWrapper);
        }

        // ---- Populate Character Handling tab ----
        if (originalElements.secondColumn) {
            const characterHandlingToggles = originalElements.secondColumn.querySelector('[name="CharacterHandlingToggles"]');
            const miscellaneousToggles = originalElements.secondColumn.querySelector('[name="MiscellaneousToggles"]');

            if (characterHandlingToggles) {
                characterHandlingTab.appendChild(characterHandlingToggles);
            }
            if (miscellaneousToggles) {
                characterHandlingTab.appendChild(miscellaneousToggles);
            }
        }

        // ---- Populate Chat Messages tab ----
        if (originalElements.thirdColumn) {
            const powerUserOptions = originalElements.thirdColumn.querySelector('#power-user-option-checkboxes');
            if (powerUserOptions) {
                chatMessagesTab.appendChild(powerUserOptions);
            }
        }

        // ---- Populate Context Template tab (from AF) ----
        if (contextSettingsColumn) {
            // Find and extract the Import/Export buttons (if any) to preserve them
            const importExportBar = contextSettingsColumn.querySelector('.advanced_formatting_controls, [id*="import"], [id*="export"]');
            if (importExportBar) {
                contextTemplateTab.appendChild(importExportBar);
            }
            contextTemplateTab.appendChild(contextSettingsColumn);
        }

        // ---- Populate Instruct Template tab (from AF) ----
        if (instructSettingsColumn) {
            instructTemplateTab.appendChild(instructSettingsColumn);
        }

        // ---- Populate System Prompt and Reasoning/Misc tabs (from AF SystemPromptColumn) ----
        if (systemPromptColumn) {
            const systemPromptChildren = Array.from(systemPromptColumn.children);
            systemPromptChildren.forEach(child => {
                const childText = child.textContent || '';
                const childId = child.getAttribute('name') || child.id || '';

                if (childText.includes('System Prompt') || childId === 'SystemPromptBlock' ||
                    child.querySelector('#sysprompt_select') || child.querySelector('#sysprompt_content')) {
                    systemPromptTab.appendChild(child);
                } else {
                    reasoningMiscTab.appendChild(child);
                }
            });
        }

        // ---- Clear original content and add all tabs ----
        userSettingsContent.innerHTML = '';
        userSettingsContent.appendChild(uiThemeTab);
        userSettingsContent.appendChild(characterHandlingTab);
        userSettingsContent.appendChild(chatMessagesTab);
        userSettingsContent.appendChild(contextTemplateTab);
        userSettingsContent.appendChild(instructTemplateTab);
        userSettingsContent.appendChild(systemPromptTab);
        userSettingsContent.appendChild(reasoningMiscTab);
    },

    _hideAFDrawer: function() {
        // #AdvancedFormatting sits inside #advanced-formatting-button.drawer
        // Hiding the parent hides both the icon toggle and the drawer content
        const afButton = document.getElementById('advanced-formatting-button');
        if (afButton) {
            afButton.style.display = 'none';
            return;
        }
        // Fallback: if the wrapper id ever changes, hide AdvancedFormatting's direct parent
        const afDrawer = document.getElementById('AdvancedFormatting');
        if (afDrawer && afDrawer.parentElement) {
            afDrawer.parentElement.style.display = 'none';
        }
    },

    _detectCCMode: function() {
        const mainApiSelect = document.getElementById('main_api');
        return mainApiSelect ? mainApiSelect.value === 'openai' : false;
    },

    _applyCCMode: function(isCC, initial) {
        const tabNavigation = document.querySelector('.nemo-user-settings-tabs');
        if (!tabNavigation) return;

        CC_HIDDEN_TABS.forEach(tabName => {
            const btn = tabNavigation.querySelector(`[data-tab="${tabName}"]`);
            if (btn) {
                btn.style.display = isCC ? 'none' : '';
            }
        });

        if (isCC) {
            // Move the 3 CC-useful checkboxes into the Reasoning/Misc tab
            this._moveCheckboxesToReasoning();

            // If the active tab is one being hidden, switch to first visible
            if (CC_HIDDEN_TABS.includes(this.activeTab)) {
                this.switchTab('reasoning-misc');
            }
        } else {
            // Move them back to Context Template (ContextSettings)
            this._restoreCheckboxesToContext();

            // Restore whatever the active tab was (if it's now visible, keep it)
        }
    },

    _moveCheckboxesToReasoning: function() {
        const contextSettings = document.getElementById('ContextSettings');
        const reasoningMiscTab = document.getElementById('nemo-tab-reasoning-misc');
        if (!contextSettings || !reasoningMiscTab) return;

        // Find the "Context Formatting" h4 block
        const contextFormattingH4 = Array.from(contextSettings.querySelectorAll('h4')).find(
            h => h.textContent && h.textContent.toLowerCase().includes('context formatting')
        );

        if (!contextFormattingH4) {
            // Fallback: find the 3 checkboxes by ID directly
            this._moveCheckboxesByIds(contextSettings, reasoningMiscTab);
            return;
        }

        // Collect checkbox rows that follow the h4 (siblings until next h4 or section end)
        const checkboxRows = [];
        let sibling = contextFormattingH4.nextElementSibling;
        while (sibling && sibling.tagName !== 'H4') {
            // Only grab label/flex rows that contain our target checkboxes
            const hasTarget = CC_USEFUL_CHECKBOX_IDS.some(id => sibling.querySelector(`#${id}`) || sibling.id === id);
            if (hasTarget) {
                checkboxRows.push(sibling);
            }
            sibling = sibling.nextElementSibling;
        }

        if (checkboxRows.length === 0) {
            this._moveCheckboxesByIds(contextSettings, reasoningMiscTab);
            return;
        }

        // Create a stash container to hold original positions
        if (!this._ccCheckboxStash) {
            this._ccCheckboxStash = document.createElement('div');
            this._ccCheckboxStash.id = 'nemo-cc-checkbox-stash';
            this._ccCheckboxStash.style.display = 'none';
            contextSettings.appendChild(this._ccCheckboxStash);
        }

        // Create a visible wrapper in reasoning/misc
        let ccCheckboxWrapper = document.getElementById('nemo-cc-checkboxes-in-reasoning');
        if (!ccCheckboxWrapper) {
            ccCheckboxWrapper = document.createElement('div');
            ccCheckboxWrapper.id = 'nemo-cc-checkboxes-in-reasoning';
            ccCheckboxWrapper.className = 'nemo-cc-checkboxes-section';
            ccCheckboxWrapper.innerHTML = '<h4 data-i18n="Context Formatting">Context Formatting</h4>';
        } else {
            // Clear previous children except the header
            while (ccCheckboxWrapper.children.length > 1) {
                this._ccCheckboxStash.appendChild(ccCheckboxWrapper.children[1]);
            }
        }

        checkboxRows.forEach(row => {
            // Place original in stash (hidden), put it in reasoning wrapper
            ccCheckboxWrapper.appendChild(row);
        });

        reasoningMiscTab.insertBefore(ccCheckboxWrapper, reasoningMiscTab.firstChild);
    },

    _moveCheckboxesByIds: function(contextSettings, reasoningMiscTab) {
        // Fallback: move rows containing the target checkbox IDs
        let ccCheckboxWrapper = document.getElementById('nemo-cc-checkboxes-in-reasoning');
        if (!ccCheckboxWrapper) {
            ccCheckboxWrapper = document.createElement('div');
            ccCheckboxWrapper.id = 'nemo-cc-checkboxes-in-reasoning';
            ccCheckboxWrapper.className = 'nemo-cc-checkboxes-section';
            ccCheckboxWrapper.innerHTML = '<h4 data-i18n="Context Formatting">Context Formatting</h4>';
        }

        CC_USEFUL_CHECKBOX_IDS.forEach(id => {
            const checkbox = document.getElementById(id);
            if (!checkbox) return;
            // Find the label/row container
            let row = checkbox.closest('label') || checkbox.closest('.flex-container') || checkbox.parentElement;
            if (row && row !== contextSettings) {
                ccCheckboxWrapper.appendChild(row);
            }
        });

        if (ccCheckboxWrapper.children.length > 1) {
            reasoningMiscTab.insertBefore(ccCheckboxWrapper, reasoningMiscTab.firstChild);
        }
    },

    _restoreCheckboxesToContext: function() {
        const ccCheckboxWrapper = document.getElementById('nemo-cc-checkboxes-in-reasoning');
        if (!ccCheckboxWrapper) return;

        const contextSettings = document.getElementById('ContextSettings');
        if (!contextSettings) return;

        // Find the Context Formatting h4 in ContextSettings to insert after
        const contextFormattingH4 = Array.from(contextSettings.querySelectorAll('h4')).find(
            h => h.textContent && h.textContent.toLowerCase().includes('context formatting')
        );

        // Move all children (except the h4 header we added) back to contextSettings
        const children = Array.from(ccCheckboxWrapper.children).slice(1); // skip our added h4
        children.forEach(child => {
            if (contextFormattingH4) {
                // Insert after the h4
                contextFormattingH4.insertAdjacentElement('afterend', child);
            } else {
                contextSettings.appendChild(child);
            }
        });

        ccCheckboxWrapper.remove();
    },

    _listenForApiChanges: function() {
        // Listen for SillyTavern's event when CC source changes
        eventSource.on(event_types.CHATCOMPLETION_SOURCE_CHANGED, () => {
            setTimeout(() => {
                const isCC = this._detectCCMode();
                if (isCC !== this._isCCMode) {
                    this._isCCMode = isCC;
                    this._applyCCMode(isCC, false);
                }
            }, 200);
        });

        // Also observe the #main_api select directly for any change
        const mainApiSelect = document.getElementById('main_api');
        if (mainApiSelect) {
            mainApiSelect.addEventListener('change', () => {
                const isCC = mainApiSelect.value === 'openai';
                if (isCC !== this._isCCMode) {
                    this._isCCMode = isCC;
                    this._applyCCMode(isCC, false);
                }
            });
        }
    },

    addTabHandlers: function() {
        const tabs = document.querySelectorAll('.nemo-user-settings-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
    },

    switchTab: function(tabName) {
        // Update active tab button
        const tabs = document.querySelectorAll('.nemo-user-settings-tab');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update active tab content
        const tabContents = document.querySelectorAll('.nemo-user-settings-tab-content');
        tabContents.forEach(content => {
            if (content.id === `nemo-tab-${tabName}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        this.activeTab = tabName;
    },

    addCustomInputHandlers: function() {
        // Handle chat truncation input to show "Unlimited" when value is 0
        const chatTruncationCounter = document.getElementById('chat_truncation_counter');
        if (chatTruncationCounter) {
            const updateDisplay = () => {
                if (chatTruncationCounter.value === '0') {
                    chatTruncationCounter.setAttribute('data-original-value', '0');
                    chatTruncationCounter.value = 'Unlimited';
                    chatTruncationCounter.style.color = 'var(--nemo-primary-accent, #4a9eff)';
                } else if (chatTruncationCounter.hasAttribute('data-original-value')) {
                    chatTruncationCounter.removeAttribute('data-original-value');
                    chatTruncationCounter.style.color = '';
                }
            };

            const handleFocus = () => {
                if (chatTruncationCounter.value === 'Unlimited') {
                    chatTruncationCounter.value = '0';
                    chatTruncationCounter.style.color = '';
                }
            };

            const handleBlur = () => {
                updateDisplay();
            };

            updateDisplay();

            chatTruncationCounter.addEventListener('input', updateDisplay);
            chatTruncationCounter.addEventListener('focus', handleFocus);
            chatTruncationCounter.addEventListener('blur', handleBlur);
        }
    },

    addSearchHandler: function() {
        const userSettingsBlock = document.getElementById('user-settings-block');
        if (userSettingsBlock) {
            const searchInput = userSettingsBlock.querySelector('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]');

            if (searchInput) {
                const handleSearch = (searchTerm) => {
                    if (!searchTerm || searchTerm.length < 2) {
                        this.clearSearchFilter();
                        return;
                    }
                    this.applySearchFilter(searchTerm);
                };

                searchInput.addEventListener('input', (e) => {
                    handleSearch(e.target.value);
                });

                searchInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') {
                        handleSearch(e.target.value);
                    }
                });
            } else {
                this.createSearchInput();
            }
        }
    },

    createSearchInput: function() {
        const userSettingsBlock = document.getElementById('user-settings-block');
        const tabNavigation = document.querySelector('.nemo-user-settings-tabs');

        if (userSettingsBlock && tabNavigation) {
            const searchContainer = document.createElement('div');
            searchContainer.className = 'nemo-user-settings-search';
            searchContainer.innerHTML = `
                <div class="flex-container alignItemsCenter" style="margin-bottom: 15px; gap: 10px;">
                    <i class="fa-solid fa-search" style="color: var(--nemo-text-color); opacity: 0.7;"></i>
                    <input type="search" id="nemo-user-settings-search"
                           placeholder="Search settings..."
                           style="flex: 1; padding: 8px 12px; border: 1px solid var(--nemo-border-color);
                                  border-radius: 4px; background: var(--nemo-tertiary-bg);
                                  color: var(--nemo-text-color); font-size: 14px;">
                </div>
            `;

            userSettingsBlock.insertBefore(searchContainer, tabNavigation);

            const searchInput = document.getElementById('nemo-user-settings-search');
            if (searchInput) {
                const handleSearch = (searchTerm) => {
                    if (!searchTerm || searchTerm.length < 2) {
                        this.clearSearchFilter();
                        return;
                    }
                    this.applySearchFilter(searchTerm);
                };

                searchInput.addEventListener('input', (e) => {
                    handleSearch(e.target.value);
                });

                searchInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') {
                        handleSearch(e.target.value);
                    }
                });
            }
        }
    },

    applySearchFilter: function(searchTerm) {
        const term = searchTerm.toLowerCase();
        const tabNavigation = document.querySelector('.nemo-user-settings-tabs');
        const userSettingsContent = document.getElementById('user-settings-block-content');

        if (!tabNavigation || !userSettingsContent) return;

        tabNavigation.style.display = 'none';

        let searchResults = document.getElementById('nemo-search-results');
        if (!searchResults) {
            searchResults = document.createElement('div');
            searchResults.id = 'nemo-search-results';
            searchResults.className = 'nemo-search-results-container';
            userSettingsContent.parentNode.insertBefore(searchResults, userSettingsContent);
        }

        userSettingsContent.style.display = 'none';
        searchResults.style.display = 'block';
        searchResults.innerHTML = '';

        const matchingElements = [];

        // Search through all 7 tabs
        const allTabs = [
            'nemo-tab-ui-theme',
            'nemo-tab-character-handling',
            'nemo-tab-chat-messages',
            'nemo-tab-context-template',
            'nemo-tab-instruct-template',
            'nemo-tab-system-prompt',
            'nemo-tab-reasoning-misc',
        ];

        allTabs.forEach(tabId => {
            const tab = document.getElementById(tabId);
            if (!tab) return;

            const tabName = tabId.replace('nemo-tab-', '').replace(/-/g, ' ');

            const elements = tab.querySelectorAll('*');
            elements.forEach(element => {
                const text = element.textContent || '';
                const placeholder = element.getAttribute('placeholder') || '';
                const title = element.getAttribute('title') || '';
                const dataI18n = element.getAttribute('data-i18n') || '';
                const id = element.getAttribute('id') || '';

                const searchableText = `${text} ${placeholder} ${title} ${dataI18n} ${id}`.toLowerCase();

                if (searchableText.includes(term) && this.isRelevantElement(element)) {
                    const parent = this.findRelevantParent(element);
                    if (parent && !matchingElements.some(item => item.element === parent)) {
                        matchingElements.push({
                            element: parent,
                            tabName: tabName,
                            relevance: this.calculateRelevance(searchableText, term)
                        });
                    }
                }
            });
        });

        matchingElements.sort((a, b) => b.relevance - a.relevance);

        if (matchingElements.length === 0) {
            searchResults.innerHTML = `
                <div class="nemo-no-results">
                    <i class="fa-solid fa-search"></i>
                    <p>No settings found matching "<strong>${searchTerm}</strong>"</p>
                </div>
            `;
        } else {
            const resultsHeader = document.createElement('div');
            resultsHeader.className = 'nemo-search-results-header';
            resultsHeader.innerHTML = `
                <h4>Search Results for "<strong>${searchTerm}</strong>" (${matchingElements.length} found)</h4>
            `;
            searchResults.appendChild(resultsHeader);

            matchingElements.forEach(({ element, tabName }) => {
                const clone = element.cloneNode(true);

                const resultItem = document.createElement('div');
                resultItem.className = 'nemo-search-result-item';
                resultItem.innerHTML = `
                    <div class="nemo-search-result-header">
                        <span class="nemo-search-result-tab">${tabName.toUpperCase()}</span>
                    </div>
                `;

                resultItem.appendChild(clone);
                searchResults.appendChild(resultItem);

                this.makeCloneInteractive(clone, element);
            });
        }
    },

    clearSearchFilter: function() {
        const tabNavigation = document.querySelector('.nemo-user-settings-tabs');
        const userSettingsContent = document.getElementById('user-settings-block-content');
        const searchResults = document.getElementById('nemo-search-results');

        if (tabNavigation) tabNavigation.style.display = '';
        if (userSettingsContent) userSettingsContent.style.display = '';
        if (searchResults) searchResults.style.display = 'none';

        const activeTabContent = document.querySelector('.nemo-user-settings-tab-content.active');
        if (activeTabContent) {
            activeTabContent.style.display = 'block';
        }
    },

    isRelevantElement: function(element) {
        const tagName = element.tagName.toLowerCase();
        const className = element.className || '';

        if (['input', 'select', 'textarea', 'button', 'label'].includes(tagName)) {
            return true;
        }

        if (className.includes('checkbox_label') ||
            className.includes('flex-container') ||
            className.includes('menu_button') ||
            className.includes('range-block') ||
            className.includes('inline-drawer') ||
            className.includes('completion_prompt_manager') ||
            element.hasAttribute('data-i18n')) {
            return true;
        }

        return false;
    },

    findRelevantParent: function(element) {
        let current = element;

        while (current && current.parentNode) {
            if (current.className && (
                current.className.includes('checkbox_label') ||
                current.className.includes('range-block') ||
                current.className.includes('inline-drawer') ||
                current.className.includes('flex-container') ||
                current.className.includes('completion_prompt_manager') ||
                current.tagName.toLowerCase() === 'label'
            )) {
                return current;
            }
            current = current.parentNode;
        }

        return element;
    },

    calculateRelevance: function(text, term) {
        const words = text.split(/\s+/);
        let score = 0;

        if (text.includes(term)) score += 100;

        words.forEach(word => {
            if (word.includes(term)) score += 50;
            if (term.includes(word) && word.length > 2) score += 25;
        });

        return Math.min(score, 100);
    },

    makeCloneInteractive: function(clone, original) {
        const clonedInputs = clone.querySelectorAll('input, select, textarea');
        const originalInputs = original.querySelectorAll('input, select, textarea');

        clonedInputs.forEach((clonedInput, index) => {
            const originalInput = originalInputs[index];
            if (originalInput) {
                if (clonedInput.type === 'checkbox' || clonedInput.type === 'radio') {
                    clonedInput.checked = originalInput.checked;
                } else {
                    clonedInput.value = originalInput.value;
                }

                clonedInput.addEventListener('change', () => {
                    if (originalInput.type === 'checkbox' || originalInput.type === 'radio') {
                        originalInput.checked = clonedInput.checked;
                    } else {
                        originalInput.value = clonedInput.value;
                    }

                    originalInput.dispatchEvent(new Event('change', { bubbles: true }));
                    originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                });

                clonedInput.addEventListener('input', () => {
                    if (originalInput.type !== 'checkbox' && originalInput.type !== 'radio') {
                        originalInput.value = clonedInput.value;
                        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            }
        });

        const clonedButtons = clone.querySelectorAll('button, .menu_button');
        const originalButtons = original.querySelectorAll('button, .menu_button');

        clonedButtons.forEach((clonedButton, index) => {
            const originalButton = originalButtons[index];
            if (originalButton) {
                clonedButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    originalButton.click();
                });
            }
        });
    },

    restoreOriginalLayout: function() {
        const userSettingsContent = document.getElementById('user-settings-block-content');
        const tabNavigation = document.querySelector('.nemo-user-settings-tabs');

        if (tabNavigation) {
            tabNavigation.remove();
        }

        if (userSettingsContent) {
            const tabContents = userSettingsContent.querySelectorAll('.nemo-user-settings-tab-content');
            tabContents.forEach(tab => {
                while (tab.firstChild) {
                    userSettingsContent.appendChild(tab.firstChild);
                }
                tab.remove();
            });
        }

        // Restore the AF drawer visibility
        const afButton = document.getElementById('advanced-formatting-button');
        if (afButton) {
            afButton.style.display = '';
        }

        this.initialized = false;
        this._isCCMode = false;
        this._ccCheckboxStash = null;
    },

    cleanup: function() {
        const existingTabs = document.querySelector('.nemo-user-settings-tabs');
        const existingSearch = document.querySelector('.nemo-user-settings-search');
        const existingSearchResults = document.getElementById('nemo-search-results');

        if (existingTabs) existingTabs.remove();
        if (existingSearch) existingSearch.remove();
        if (existingSearchResults) existingSearchResults.remove();

        const userSettingsContent = document.getElementById('user-settings-block-content');
        if (userSettingsContent) {
            userSettingsContent.style.display = '';
        }
    }
};
